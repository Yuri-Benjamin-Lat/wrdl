-- M8 preservation precedence: while fewer than two players are connected, a
-- completed/expired round waits for preservation recovery instead of committing
-- a final result that should still be eligible to become void.

create or replace function private.resolve_multi_player_round(target_battle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  battle_row public.battles;
  connected_count integer;
begin
  select * into battle_row
  from public.battles
  where id = target_battle_id
  for update;

  if battle_row.id is null or battle_row.phase not in ('round_active', 'round_resolving') then
    return;
  end if;
  if battle_row.player_count < 3 then
    perform private.resolve_two_player_round(target_battle_id);
    return;
  end if;

  select count(*)::integer into connected_count
  from public.battle_members
  where battle_id = target_battle_id and is_connected;

  if connected_count < 2 and battle_row.preservation_deadline is not null then
    if battle_row.preservation_deadline <= clock_timestamp() then
      perform private.complete_multi_player_battle(target_battle_id, 'voided');
    end if;
    return;
  end if;

  with solved as (
    select
      user_id,
      dense_rank() over (order by completion_centiseconds)::integer as round_rank
    from public.battle_members
    where battle_id = target_battle_id and round_status = 'solved'
  ), awarded as (
    select
      member.user_id,
      solved.round_rank,
      case
        when solved.round_rank is null then 0
        when solved.round_rank = 1 then 5
        when solved.round_rank = 2 then 3
        when solved.round_rank = 3 then 2
        else 1
      end as points
    from public.battle_members as member
    left join solved on solved.user_id = member.user_id
    where member.battle_id = target_battle_id
  )
  update public.battle_members as member
  set last_round_points = awarded.points,
      total_points = member.total_points + awarded.points,
      round_rank = awarded.round_rank,
      round_status = case
        when member.round_status = 'active' then 'failed'::public.battle_round_status
        else member.round_status
      end
  from (select user_id, round_rank, points from awarded) as awarded
  where member.battle_id = target_battle_id and member.user_id = awarded.user_id;

  update private.battle_rounds
  set resolved_at = clock_timestamp()
  where battle_id = target_battle_id and round_number = battle_row.current_round;

  if battle_row.current_round >= battle_row.rounds_configured then
    perform private.complete_multi_player_battle(target_battle_id, 'score');
    return;
  end if;

  update public.battles
  set phase = 'between_rounds',
      phase_deadline = clock_timestamp() + interval '10 seconds',
      round_deadline = null,
      next_sudden_death = false,
      state_version = state_version + 1
  where id = target_battle_id;
end;
$$;

revoke all on function private.resolve_multi_player_round(uuid) from public, anon, authenticated;
