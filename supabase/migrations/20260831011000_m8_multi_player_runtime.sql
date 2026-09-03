-- M8: 3-8-player runtime, connection preservation, host succession, and
-- generalized public commands. Two-player commands continue through M7.

create or replace function private.transfer_disconnected_multi_host(target_battle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  battle_row public.battles;
  party_host uuid;
  next_host uuid;
begin
  select * into battle_row
  from public.battles
  where id = target_battle_id;
  if battle_row.id is null or battle_row.player_count < 3 then return; end if;

  select host_id into party_host
  from public.parties
  where id = battle_row.party_id
  for update;

  if party_host is null or exists (
    select 1 from public.battle_members
    where battle_id = target_battle_id and user_id = party_host and is_connected
  ) then return; end if;

  select user_id into next_host
  from public.battle_members
  where battle_id = target_battle_id
    and is_connected
    and continued_at is null
  order by join_order
  limit 1;

  if next_host is null then return; end if;

  update public.parties
  set host_id = next_host,
      state_version = state_version + 1
  where id = battle_row.party_id;

  update public.battle_members
  set became_host_at = clock_timestamp()
  where battle_id = target_battle_id and user_id = next_host;
end;
$$;

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
      if connected_count >= 2 then
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

create or replace function public.get_my_battle()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_battle uuid;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select member.battle_id into target_battle
  from public.battle_members as member
  join public.battles as battle on battle.id = member.battle_id
  where member.user_id = caller_id and member.continued_at is null
  order by battle.created_at desc
  limit 1;

  if target_battle is null then return null; end if;
  perform private.repair_multi_player_battle(target_battle);
  return private.battle_snapshot(caller_id, target_battle);
end;
$$;

create or replace function public.claim_my_battle_connection(new_connection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_battle uuid;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if new_connection_id is null then raise exception 'Connection identifier required' using errcode = '23514'; end if;

  select member.battle_id into target_battle
  from public.battle_members as member
  join public.battles as battle on battle.id = member.battle_id
  where member.user_id = caller_id
    and member.continued_at is null
    and battle.phase not in ('battle_complete', 'voided')
  order by battle.created_at desc
  limit 1;

  if target_battle is null then return null; end if;

  perform private.repair_multi_player_battle(target_battle);

  update public.battle_members as member
  set connection_id = new_connection_id,
      is_connected = true,
      arrived_at = coalesce(member.arrived_at, clock_timestamp()),
      last_heartbeat_at = clock_timestamp(),
      disconnected_at = null,
      reconnect_deadline = null
  from public.battles as battle
  where member.battle_id = target_battle
    and member.user_id = caller_id
    and battle.id = member.battle_id
    and battle.phase not in ('battle_complete', 'voided');

  if not found then return null; end if;
  perform private.repair_multi_player_battle(target_battle);
  return private.battle_snapshot(caller_id, target_battle);
end;
$$;

create or replace function public.heartbeat_my_battle(active_connection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_battle uuid;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select member.battle_id into target_battle
  from public.battle_members as member
  join public.battles as battle on battle.id = member.battle_id
  where member.user_id = caller_id
    and member.continued_at is null
    and battle.phase not in ('battle_complete', 'voided')
  order by battle.created_at desc
  limit 1;

  if target_battle is null then return null; end if;
  perform private.repair_multi_player_battle(target_battle);

  update public.battle_members
  set last_heartbeat_at = clock_timestamp(),
      is_connected = true,
      arrived_at = coalesce(arrived_at, clock_timestamp()),
      disconnected_at = null,
      reconnect_deadline = null
  where battle_id = target_battle
    and user_id = caller_id
    and connection_id = active_connection_id;

  if not found then
    raise exception 'This battle is controlled by another connection' using errcode = '55000';
  end if;

  perform private.repair_multi_player_battle(target_battle);
  return private.battle_snapshot(caller_id, target_battle);
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
  battle_row public.battles;
  connected_count integer;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select battle.* into battle_row
  from public.battles as battle
  join public.battle_members as member on member.battle_id = battle.id
  where member.user_id = caller_id
    and member.connection_id = active_connection_id
    and member.continued_at is null
    and battle.phase not in ('battle_complete', 'voided')
  order by battle.created_at desc
  limit 1
  for update of battle;

  if battle_row.id is null then return; end if;
  target_battle := battle_row.id;

  update public.battle_members
  set is_connected = false,
      disconnected_at = clock_timestamp(),
      reconnect_deadline = case
        when battle_row.player_count = 2 then clock_timestamp() + interval '30 seconds'
        else null
      end
  where battle_id = target_battle
    and user_id = caller_id
    and connection_id = active_connection_id;

  select count(*)::integer into connected_count
  from public.battle_members
  where battle_id = target_battle and is_connected;

  if battle_row.player_count = 2 then
    if connected_count = 0 then
      perform private.complete_two_player_battle(target_battle, null, 'voided');
    end if;
    return;
  end if;

  perform private.transfer_disconnected_multi_host(target_battle);

  if connected_count = 0 then
    perform private.complete_multi_player_battle(target_battle, 'voided');
  elsif connected_count < 2 then
    update public.battles
    set preservation_deadline = coalesce(
          preservation_deadline,
          clock_timestamp() + interval '20 seconds'
        ),
        state_version = state_version + 1
    where id = target_battle;
  end if;
end;
$$;

create or replace function public.advance_my_battle()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_battle uuid;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select battle_id into target_battle
  from public.battle_members
  where user_id = caller_id and continued_at is null
  order by created_at desc
  limit 1;

  if target_battle is null then return null; end if;
  perform private.repair_multi_player_battle(target_battle);
  return private.battle_snapshot(caller_id, target_battle);
end;
$$;

create or replace function public.submit_my_battle_guess(
  command_id uuid,
  active_connection_id uuid,
  submitted_guess text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_guess text := lower(btrim(submitted_guess));
  target_battle uuid;
  battle_row public.battles;
  member_row public.battle_members;
  round_row private.battle_rounds;
  next_guess_number integer;
  evaluated_pattern text;
  elapsed_cs integer;
  first_completion integer;
  resolution_deadline timestamptz;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if command_id is null or active_connection_id is null then
    raise exception 'Command and connection identifiers are required' using errcode = '23514';
  end if;
  if normalized_guess !~ '^[a-z]{5}$' then
    raise exception 'Guess must contain exactly five letters' using errcode = '23514';
  end if;
  if not exists (select 1 from private.daily_words where word = normalized_guess and active) then
    raise exception 'Word is not in the accepted list' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.battle_guesses
    where battle_guesses.command_id = submit_my_battle_guess.command_id
      and battle_guesses.user_id = caller_id
  ) then
    select battle_id into target_battle
    from public.battle_guesses
    where battle_guesses.command_id = submit_my_battle_guess.command_id
      and battle_guesses.user_id = caller_id;
    return private.battle_snapshot(caller_id, target_battle);
  end if;

  select member.battle_id into target_battle
  from public.battle_members as member
  join public.battles as battle on battle.id = member.battle_id
  where member.user_id = caller_id
    and member.continued_at is null
    and battle.phase not in ('battle_complete', 'voided')
  order by battle.created_at desc
  limit 1;

  if target_battle is null then raise exception 'Active battle not found' using errcode = 'P0002'; end if;

  perform private.repair_multi_player_battle(target_battle);
  select * into battle_row from public.battles where id = target_battle for update;
  select * into member_row from public.battle_members
  where battle_id = target_battle and user_id = caller_id for update;
  select * into round_row from private.battle_rounds
  where battle_id = target_battle and round_number = battle_row.current_round;

  if member_row.connection_id is distinct from active_connection_id then
    raise exception 'This battle is controlled by another connection' using errcode = '55000';
  end if;
  if not member_row.is_connected then
    raise exception 'Reconnect before submitting a guess' using errcode = '55000';
  end if;
  if battle_row.phase not in ('round_active', 'round_resolving') then
    raise exception 'The round is not accepting guesses' using errcode = '55000';
  end if;
  if battle_row.round_deadline <= clock_timestamp() then
    perform private.repair_multi_player_battle(target_battle);
    raise exception 'The round timer has expired' using errcode = '55000';
  end if;
  if member_row.round_status <> 'active' or member_row.accepted_guess_count >= 6 then
    raise exception 'Your puzzle is already finished' using errcode = '55000';
  end if;

  elapsed_cs := greatest(0, floor(
    extract(epoch from (clock_timestamp() - battle_row.round_started_at)) * 100
  )::integer);
  evaluated_pattern := private.evaluate_daily_guess(round_row.answer, normalized_guess);

  if battle_row.player_count = 2 and battle_row.phase = 'round_resolving' then
    select min(completion_centiseconds) into first_completion
    from public.battle_members
    where battle_id = target_battle and round_status = 'solved';
    if evaluated_pattern <> '22222'
      or elapsed_cs <> first_completion
      or battle_row.phase_deadline < clock_timestamp() then
      raise exception 'The round has already concluded' using errcode = '55000';
    end if;
  elsif battle_row.phase = 'round_resolving' then
    raise exception 'The round has already concluded' using errcode = '55000';
  end if;

  next_guess_number := member_row.accepted_guess_count + 1;
  insert into public.battle_guesses (
    battle_id, round_number, user_id, guess_number, command_id,
    guess, pattern, elapsed_centiseconds
  ) values (
    target_battle, battle_row.current_round, caller_id, next_guess_number, command_id,
    normalized_guess, evaluated_pattern, elapsed_cs
  );

  update public.battle_members
  set accepted_guess_count = next_guess_number,
      last_heartbeat_at = clock_timestamp(),
      round_status = case
        when evaluated_pattern = '22222' then 'solved'::public.battle_round_status
        when next_guess_number = 6 then 'failed'::public.battle_round_status
        else round_status
      end,
      completion_centiseconds = case
        when evaluated_pattern = '22222' then elapsed_cs
        else completion_centiseconds
      end
  where battle_id = target_battle and user_id = caller_id;

  if battle_row.player_count = 2 and evaluated_pattern = '22222' then
    resolution_deadline := greatest(
      clock_timestamp() + interval '30 milliseconds',
      battle_row.round_started_at + ((elapsed_cs + 1) * interval '10 milliseconds')
        + interval '10 milliseconds'
    );
    update public.battles
    set phase = 'round_resolving',
        phase_deadline = case
          when phase = 'round_resolving' then least(phase_deadline, resolution_deadline)
          else resolution_deadline
        end,
        state_version = state_version + 1
    where id = target_battle;
  elsif not exists (
    select 1 from public.battle_members
    where battle_id = target_battle
      and is_connected
      and round_status = 'active'
  ) then
    update public.battles
    set phase = 'round_resolving',
        phase_deadline = clock_timestamp(),
        state_version = state_version + 1
    where id = target_battle;
    perform private.repair_multi_player_battle(target_battle);
  else
    update public.battles
    set state_version = state_version + 1
    where id = target_battle;
  end if;

  return private.battle_snapshot(caller_id, target_battle);
exception
  when unique_violation then
    if exists (
      select 1 from public.battle_guesses
      where battle_guesses.command_id = submit_my_battle_guess.command_id
        and battle_guesses.user_id = caller_id
    ) then
      select battle_id into target_battle
      from public.battle_guesses
      where battle_guesses.command_id = submit_my_battle_guess.command_id
        and battle_guesses.user_id = caller_id;
      return private.battle_snapshot(caller_id, target_battle);
    end if;
    raise;
end;
$$;

create or replace function public.set_party_ready(new_ready boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  party_row public.parties;
  total_members integer;
  all_ready boolean := false;
  caller_ready boolean;
  prior_battle_phase public.battle_phase;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id
  for update of party;

  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;
  if party_row.phase <> 'lobby' then raise exception 'Ready controls are locked' using errcode = '55000'; end if;

  select is_ready into caller_ready
  from public.party_members
  where party_id = party_row.id and user_id = caller_id;

  select count(*)::integer into total_members
  from public.party_members
  where party_id = party_row.id;

  if new_ready and total_members < 2 then
    raise exception 'At least two players are required to get Ready' using errcode = '55000';
  end if;
  if new_ready and exists (
    select 1 from public.party_members
    where party_id = party_row.id and not returned_to_lobby
  ) then
    raise exception 'Wait for every player to return to the lobby' using errcode = '55000';
  end if;

  if caller_ready <> new_ready then
    update public.party_members
    set is_ready = new_ready
    where party_id = party_row.id and user_id = caller_id;
  elsif not new_ready then
    return private.party_snapshot(caller_id, party_row.id);
  end if;

  if new_ready then
    select bool_and(is_ready) into all_ready
    from public.party_members
    where party_id = party_row.id;
  end if;

  if all_ready then
    if party_row.active_battle_id is not null then
      select phase into prior_battle_phase
      from public.battles
      where id = party_row.active_battle_id;
      if prior_battle_phase not in ('battle_complete', 'voided') then
        raise exception 'The previous battle is still active' using errcode = '55000';
      end if;
    end if;

    update public.parties
    set phase = 'match_starting',
        active_battle_id = null,
        start_deadline = clock_timestamp() + interval '30 seconds',
        state_version = state_version + 1
    where id = party_row.id;

    delete from public.party_invitations where party_id = party_row.id;
    perform private.create_battle(party_row.id);
  elsif caller_ready <> new_ready then
    update public.parties
    set state_version = state_version + 1
    where id = party_row.id;
  end if;

  return private.party_snapshot(caller_id, party_row.id);
end;
$$;

create or replace function public.recover_my_party_start()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  party_row public.parties;
  referenced_battle_phase public.battle_phase;
  total_members integer;
  all_ready boolean;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id
  for update of party;

  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;

  if party_row.phase = 'match_starting' then
    if party_row.active_battle_id is null then
      select count(*)::integer, coalesce(bool_and(is_ready), false)
      into total_members, all_ready
      from public.party_members
      where party_id = party_row.id;

      if total_members between 2 and 8 and all_ready then
        perform private.create_battle(party_row.id);
      else
        perform private.repair_unclaimed_party_start(party_row.id);
      end if;
    else
      select phase into referenced_battle_phase
      from public.battles
      where id = party_row.active_battle_id;

      if referenced_battle_phase is null
        or referenced_battle_phase in ('battle_complete', 'voided') then
        update public.party_members
        set is_ready = false
        where party_id = party_row.id;

        update public.parties
        set phase = 'lobby',
            active_battle_id = null,
            start_deadline = null,
            state_version = state_version + 1
        where id = party_row.id;
      end if;
    end if;
  end if;

  return private.party_snapshot(caller_id, party_row.id);
end;
$$;

revoke all on function private.transfer_disconnected_multi_host(uuid) from public, anon, authenticated;
revoke all on function private.repair_multi_player_battle(uuid) from public, anon, authenticated;
revoke all on function public.get_my_battle() from public;
revoke all on function public.claim_my_battle_connection(uuid) from public;
revoke all on function public.heartbeat_my_battle(uuid) from public;
revoke all on function public.disconnect_my_battle(uuid) from public;
revoke all on function public.advance_my_battle() from public;
revoke all on function public.submit_my_battle_guess(uuid, uuid, text) from public;
revoke all on function public.set_party_ready(boolean) from public;
revoke all on function public.recover_my_party_start() from public;

grant execute on function public.get_my_battle() to authenticated;
grant execute on function public.claim_my_battle_connection(uuid) to authenticated;
grant execute on function public.heartbeat_my_battle(uuid) to authenticated;
grant execute on function public.disconnect_my_battle(uuid) to authenticated;
grant execute on function public.advance_my_battle() to authenticated;
grant execute on function public.submit_my_battle_guess(uuid, uuid, text) to authenticated;
grant execute on function public.set_party_ready(boolean) to authenticated;
grant execute on function public.recover_my_party_start() to authenticated;
