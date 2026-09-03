-- M8 synchronization correction: all frozen participants get the full arrival
-- window. Start immediately when everyone arrives, or after 30 seconds when at
-- least two arrived; cancel only when fewer than two ever reach the battle.

create or replace function private.repair_multi_player_battle(target_battle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  battle_row public.battles;
  connected_count integer;
  step integer;
  start_time timestamptz;
begin
  for step in 1..12 loop
    select * into battle_row
    from public.battles
    where id = target_battle_id
    for update;

    if battle_row.id is null or battle_row.phase in ('battle_complete', 'voided') then return; end if;
    if battle_row.player_count = 2 then
      perform private.repair_two_player_battle(target_battle_id);
      return;
    end if;

    update public.battle_members
    set is_connected = false,
        disconnected_at = clock_timestamp(),
        reconnect_deadline = null
    where battle_id = target_battle_id
      and arrived_at is not null
      and is_connected
      and last_heartbeat_at < clock_timestamp() - interval '12 seconds';

    perform private.transfer_disconnected_multi_host(target_battle_id);

    select count(*)::integer into connected_count
    from public.battle_members
    where battle_id = target_battle_id and is_connected and arrived_at is not null;

    if battle_row.phase = 'round_starting' and battle_row.players_ready_at is null then
      if connected_count = battle_row.player_count
        or (connected_count >= 2 and battle_row.phase_deadline <= clock_timestamp()) then
        update public.battles
        set players_ready_at = clock_timestamp(),
            phase_deadline = clock_timestamp() + interval '3 seconds',
            state_version = state_version + 1
        where id = target_battle_id;

        update public.parties
        set start_deadline = clock_timestamp() + interval '3 seconds',
            state_version = state_version + 1
        where id = battle_row.party_id;
        continue;
      elsif battle_row.phase_deadline <= clock_timestamp() then
        perform private.cancel_unstarted_two_player_battle(target_battle_id);
      end if;
      return;
    end if;

    if connected_count >= 2 and battle_row.preservation_deadline is not null then
      update public.battles
      set preservation_deadline = null,
          state_version = state_version + 1
      where id = target_battle_id;
      continue;
    elsif connected_count < 2 and battle_row.preservation_deadline is null then
      update public.battles
      set preservation_deadline = clock_timestamp() + interval '20 seconds',
          state_version = state_version + 1
      where id = target_battle_id;
      continue;
    elsif connected_count < 2
      and battle_row.preservation_deadline <= clock_timestamp() then
      perform private.complete_multi_player_battle(target_battle_id, 'voided');
      return;
    end if;

    if battle_row.phase = 'round_starting'
      and battle_row.phase_deadline <= clock_timestamp() then
      start_time := battle_row.phase_deadline;

      update private.battle_rounds
      set started_at = start_time,
          deadline = start_time + make_interval(secs => battle_row.round_timer_seconds)
      where battle_id = target_battle_id and round_number = battle_row.current_round;

      update public.battles
      set phase = 'round_active',
          phase_deadline = null,
          round_started_at = start_time,
          round_deadline = start_time + make_interval(secs => battle_row.round_timer_seconds),
          state_version = state_version + 1
      where id = target_battle_id;

      update public.parties
      set phase = 'active',
          start_deadline = null,
          state_version = state_version + 1
      where id = battle_row.party_id;
      continue;
    end if;

    if battle_row.phase = 'round_resolving'
      and battle_row.phase_deadline <= clock_timestamp() then
      perform private.resolve_multi_player_round(target_battle_id);
      continue;
    end if;

    if battle_row.phase = 'round_active'
      and battle_row.round_deadline <= clock_timestamp() then
      perform private.resolve_multi_player_round(target_battle_id);
      continue;
    end if;

    if battle_row.phase = 'round_active'
      and connected_count > 0
      and not exists (
        select 1 from public.battle_members
        where battle_id = target_battle_id
          and is_connected
          and round_status = 'active'
      ) then
      perform private.resolve_multi_player_round(target_battle_id);
      continue;
    end if;

    if battle_row.phase = 'between_rounds'
      and battle_row.phase_deadline <= clock_timestamp() then
      perform private.prepare_next_multi_player_round(target_battle_id);
      continue;
    end if;

    return;
  end loop;
end;
$$;

revoke all on function private.repair_multi_player_battle(uuid) from public, anon, authenticated;
