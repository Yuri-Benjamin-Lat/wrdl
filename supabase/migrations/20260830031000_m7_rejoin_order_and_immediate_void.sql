-- Rejoining keeps a Party's monotonic join order, but a two-player Battle must
-- always snapshot its participants as positions 1 and 2. Explicit departure
-- also voids immediately once no connected player remains.

create or replace function private.create_two_player_battle(target_party_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  party_row public.parties;
  member_count integer;
  new_battle uuid;
  chosen_answer text;
  arrival_deadline timestamptz := clock_timestamp() + interval '30 seconds';
begin
  select * into party_row from public.parties
  where id = target_party_id for update;

  if party_row.id is null then
    raise exception 'Party not found' using errcode = 'P0002';
  end if;
  if party_row.phase <> 'match_starting' or party_row.start_deadline is null then
    raise exception 'Party is not starting' using errcode = '55000';
  end if;
  if party_row.active_battle_id is not null then return party_row.active_battle_id; end if;

  select count(*)::integer into member_count
  from public.party_members where party_id = target_party_id;
  if member_count <> 2 then
    raise exception 'M7 supports exactly two players' using errcode = '0A000';
  end if;

  insert into public.battles (
    party_id, player_count, rounds_configured, round_timer_seconds,
    target_points, phase_deadline, players_ready_at
  ) values (
    target_party_id, 2, party_row.rounds_configured, party_row.round_timer_seconds,
    case party_row.rounds_configured when 1 then 1 when 3 then 2 else 3 end,
    arrival_deadline, null
  ) returning id into new_battle;

  insert into public.battle_members (
    battle_id, user_id, join_order, is_connected, disconnected_at,
    reconnect_deadline, arrived_at
  )
  select new_battle,
    member.user_id,
    (row_number() over (order by member.join_order))::integer,
    false,
    clock_timestamp(),
    arrival_deadline,
    null
  from public.party_members as member
  where member.party_id = target_party_id
  order by member.join_order;

  chosen_answer := private.choose_battle_answer(new_battle);
  if chosen_answer is null then
    raise exception 'No eligible battle answer is available' using errcode = 'P0002';
  end if;

  insert into private.battle_rounds (battle_id, round_number, answer)
  values (new_battle, 1, chosen_answer);

  update public.party_members
  set returned_to_lobby = false
  where party_id = target_party_id;

  update public.parties
  set active_battle_id = new_battle,
      start_deadline = arrival_deadline,
      state_version = state_version + 1
  where id = target_party_id;

  return new_battle;
end;
$$;

create or replace function public.disconnect_my_battle(active_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_battle uuid;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select battle.id into target_battle
  from public.battles as battle
  join public.battle_members as member on member.battle_id = battle.id
  where member.user_id = caller_id
    and member.connection_id = active_connection_id
    and member.continued_at is null
    and battle.phase not in ('battle_complete', 'voided')
  order by battle.created_at desc
  limit 1
  for update of battle;

  if target_battle is null then return; end if;

  update public.battle_members
  set is_connected = false,
      disconnected_at = clock_timestamp(),
      reconnect_deadline = clock_timestamp() + interval '30 seconds'
  where battle_id = target_battle
    and user_id = caller_id
    and connection_id = active_connection_id;

  if not exists (
    select 1 from public.battle_members
    where battle_id = target_battle and is_connected
  ) then
    perform private.complete_two_player_battle(target_battle, null, 'voided');
  end if;
end;
$$;

revoke all on function private.create_two_player_battle(uuid) from public, anon, authenticated;
revoke all on function public.disconnect_my_battle(uuid) from public;
grant execute on function public.disconnect_my_battle(uuid) to authenticated;
