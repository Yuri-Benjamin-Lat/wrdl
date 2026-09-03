-- M7 acceptance polish: irreversible per-player Ready staging, an authoritative
-- player-arrival barrier before the synchronized countdown, accurate invite
-- availability, void dismissal, and durable forfeit history labels.

alter table public.battles
  add column players_ready_at timestamptz;

alter table public.battle_members
  add column arrived_at timestamptz;

alter table public.battle_history_summaries
  add column completion_reason public.battle_completion_reason;

update public.battle_history_summaries as summary
set completion_reason = coalesce(battle.completion_reason, 'score'::public.battle_completion_reason)
from public.battles as battle
where battle.id = summary.source_battle_id;

update public.battle_history_summaries
set completion_reason = 'score'
where completion_reason is null;

alter table public.battle_history_summaries
  alter column completion_reason set default 'score',
  alter column completion_reason set not null;

create or replace function private.capture_battle_history_completion_reason()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_battle_id is not null then
    select coalesce(battle.completion_reason, 'score'::public.battle_completion_reason)
    into new.completion_reason
    from public.battles as battle
    where battle.id = new.source_battle_id;
  end if;
  new.completion_reason := coalesce(new.completion_reason, 'score');
  return new;
end;
$$;

create trigger battle_history_capture_completion_reason
before insert on public.battle_history_summaries
for each row execute function private.capture_battle_history_completion_reason();

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
  select new_battle, member.user_id, member.join_order, false,
    clock_timestamp(), arrival_deadline, null
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

create or replace function private.battle_snapshot(viewer_id uuid, target_battle_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  battle_row public.battles;
  viewer_member public.battle_members;
  opponent_member public.battle_members;
  viewer_guesses jsonb := '[]'::jsonb;
  opponent_guesses jsonb := '[]'::jsonb;
  reveal_opponent_letters boolean;
  viewer_rank integer;
  opponent_rank integer;
  opponent_id uuid;
begin
  select * into battle_row from public.battles where id = target_battle_id;
  if battle_row.id is null then return null; end if;

  select * into viewer_member from public.battle_members
  where battle_id = target_battle_id and user_id = viewer_id;
  if viewer_member.user_id is null then
    raise exception 'Battle membership required' using errcode = '42501';
  end if;

  select * into opponent_member from public.battle_members
  where battle_id = target_battle_id and user_id <> viewer_id
  order by join_order limit 1;
  opponent_id := opponent_member.user_id;

  reveal_opponent_letters := viewer_member.round_status <> 'active'
    or battle_row.phase not in ('round_active', 'round_resolving');

  select coalesce(jsonb_agg(jsonb_build_object(
    'guessNumber', guess.guess_number,
    'guess', upper(guess.guess),
    'pattern', guess.pattern
  ) order by guess.guess_number), '[]'::jsonb)
  into viewer_guesses
  from public.battle_guesses as guess
  where guess.battle_id = target_battle_id
    and guess.round_number = battle_row.current_round
    and guess.user_id = viewer_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'guessNumber', guess.guess_number,
    'guess', case when reveal_opponent_letters then upper(guess.guess) else null end,
    'pattern', guess.pattern
  ) order by guess.guess_number), '[]'::jsonb)
  into opponent_guesses
  from public.battle_guesses as guess
  where guess.battle_id = target_battle_id
    and guess.round_number = battle_row.current_round
    and guess.user_id = opponent_id;

  if viewer_member.final_rank is not null then
    viewer_rank := viewer_member.final_rank;
    opponent_rank := opponent_member.final_rank;
  elsif viewer_member.total_points = opponent_member.total_points then
    viewer_rank := 1;
    opponent_rank := 1;
  elsif viewer_member.total_points > opponent_member.total_points then
    viewer_rank := 1;
    opponent_rank := 2;
  else
    viewer_rank := 2;
    opponent_rank := 1;
  end if;

  return jsonb_build_object(
    'id', battle_row.id,
    'partyId', battle_row.party_id,
    'phase', battle_row.phase,
    'stateVersion', battle_row.state_version,
    'serverTime', clock_timestamp(),
    'rounds', battle_row.rounds_configured,
    'roundTimerSeconds', battle_row.round_timer_seconds,
    'targetPoints', battle_row.target_points,
    'currentRound', battle_row.current_round,
    'isSuddenDeath', battle_row.is_sudden_death,
    'suddenDeathRound', battle_row.sudden_death_round,
    'waitingForPlayers', battle_row.phase = 'round_starting'
      and battle_row.players_ready_at is null,
    'nextSuddenDeath', battle_row.next_sudden_death,
    'phaseDeadline', battle_row.phase_deadline,
    'roundStartedAt', battle_row.round_started_at,
    'roundDeadline', battle_row.round_deadline,
    'winnerId', battle_row.winner_id,
    'completionReason', battle_row.completion_reason,
    'viewer', private.social_player_json(viewer_id, viewer_id) || jsonb_build_object(
      'joinOrder', viewer_member.join_order,
      'points', viewer_member.total_points,
      'roundPoints', viewer_member.last_round_points,
      'rank', viewer_rank,
      'roundStatus', viewer_member.round_status,
      'acceptedGuessCount', viewer_member.accepted_guess_count,
      'completionCentiseconds', viewer_member.completion_centiseconds,
      'connected', viewer_member.is_connected,
      'reconnectDeadline', viewer_member.reconnect_deadline,
      'continued', viewer_member.continued_at is not null,
      'guesses', viewer_guesses
    ),
    'opponent', private.social_player_json(viewer_id, opponent_id) || jsonb_build_object(
      'joinOrder', opponent_member.join_order,
      'points', opponent_member.total_points,
      'roundPoints', opponent_member.last_round_points,
      'rank', opponent_rank,
      'roundStatus', opponent_member.round_status,
      'acceptedGuessCount', opponent_member.accepted_guess_count,
      'completionCentiseconds', opponent_member.completion_centiseconds,
      'connected', opponent_member.is_connected,
      'reconnectDeadline', opponent_member.reconnect_deadline,
      'continued', opponent_member.continued_at is not null,
      'guesses', opponent_guesses
    )
  );
end;
$$;

create or replace function private.cancel_unstarted_two_player_battle(target_battle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  battle_row public.battles;
begin
  select * into battle_row from public.battles
  where id = target_battle_id for update;
  if battle_row.id is null or battle_row.players_ready_at is not null
    or battle_row.phase <> 'round_starting' then return;
  end if;

  update public.battles
  set phase = 'voided',
      phase_deadline = null,
      completion_reason = 'voided',
      completed_at = clock_timestamp(),
      state_version = state_version + 1
  where id = target_battle_id;

  update public.battle_members
  set continued_at = clock_timestamp()
  where battle_id = target_battle_id;

  update public.party_members
  set is_ready = false,
      returned_to_lobby = true,
      last_seen_at = clock_timestamp()
  where party_id = battle_row.party_id;

  update public.parties
  set phase = 'lobby',
      active_battle_id = null,
      start_deadline = null,
      state_version = state_version + 1
  where id = battle_row.party_id;
end;
$$;

create or replace function private.repair_two_player_battle(target_battle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  battle_row public.battles;
  expired_disconnected integer;
  connected_count integer;
  connected_user uuid;
  step integer;
  start_time timestamptz;
begin
  for step in 1..10 loop
    select * into battle_row from public.battles
    where id = target_battle_id for update;
    if battle_row.id is null or battle_row.phase in ('battle_complete', 'voided') then return; end if;

    update public.battle_members
    set is_connected = false,
        disconnected_at = clock_timestamp(),
        reconnect_deadline = case
          when battle_row.phase = 'round_starting' and battle_row.players_ready_at is null
            then battle_row.phase_deadline
          else clock_timestamp() + interval '30 seconds'
        end
    where battle_id = target_battle_id
      and arrived_at is not null
      and is_connected
      and last_heartbeat_at < clock_timestamp() - interval '12 seconds';

    select count(*)::integer into connected_count
    from public.battle_members
    where battle_id = target_battle_id and is_connected and arrived_at is not null;
    select user_id into connected_user
    from public.battle_members
    where battle_id = target_battle_id and is_connected and arrived_at is not null
    order by join_order limit 1;

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

    if battle_row.phase = 'round_starting' and battle_row.players_ready_at is not null
      and connected_count < 2 then
      update public.battles
      set players_ready_at = null,
          phase_deadline = clock_timestamp() + interval '30 seconds',
          state_version = state_version + 1
      where id = target_battle_id;
      update public.parties
      set start_deadline = clock_timestamp() + interval '30 seconds',
          state_version = state_version + 1
      where id = battle_row.party_id;
      continue;
    end if;

    select count(*)::integer into expired_disconnected
    from public.battle_members
    where battle_id = target_battle_id
      and not is_connected
      and arrived_at is not null
      and reconnect_deadline <= clock_timestamp();

    if expired_disconnected > 0 then
      if connected_count = 1 then
        perform private.complete_two_player_battle(target_battle_id, connected_user, 'forfeit');
      elsif connected_count = 0 then
        perform private.complete_two_player_battle(target_battle_id, null, 'voided');
      end if;
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
      set phase = 'active', start_deadline = null, state_version = state_version + 1
      where id = battle_row.party_id;
      continue;
    end if;

    if battle_row.phase = 'round_resolving'
      and battle_row.phase_deadline <= clock_timestamp() then
      perform private.resolve_two_player_round(target_battle_id);
      continue;
    end if;
    if battle_row.phase = 'round_active'
      and battle_row.round_deadline <= clock_timestamp() then
      perform private.resolve_two_player_round(target_battle_id);
      continue;
    end if;
    if battle_row.phase = 'round_active' and not exists (
      select 1 from public.battle_members
      where battle_id = target_battle_id and round_status = 'active'
    ) then
      perform private.resolve_two_player_round(target_battle_id);
      continue;
    end if;
    if battle_row.phase = 'between_rounds'
      and battle_row.phase_deadline <= clock_timestamp() then
      perform private.prepare_next_two_player_round(target_battle_id);
      continue;
    end if;
    return;
  end loop;
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
  where member.user_id = caller_id and member.continued_at is null
    and battle.phase not in ('battle_complete', 'voided')
  order by battle.created_at desc limit 1;
  if target_battle is null then return null; end if;

  perform private.repair_two_player_battle(target_battle);
  update public.battle_members as member
  set connection_id = new_connection_id,
      is_connected = true,
      arrived_at = coalesce(member.arrived_at, clock_timestamp()),
      last_heartbeat_at = clock_timestamp(),
      disconnected_at = null,
      reconnect_deadline = null
  from public.battles as battle
  where member.battle_id = target_battle and member.user_id = caller_id
    and battle.id = member.battle_id
    and battle.phase not in ('battle_complete', 'voided');

  if not found then return null; end if;
  perform private.repair_two_player_battle(target_battle);
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
  where member.user_id = caller_id and member.continued_at is null
    and battle.phase not in ('battle_complete', 'voided')
  order by battle.created_at desc limit 1;
  if target_battle is null then return null; end if;

  perform private.repair_two_player_battle(target_battle);
  update public.battle_members
  set last_heartbeat_at = clock_timestamp(),
      is_connected = true,
      arrived_at = coalesce(arrived_at, clock_timestamp()),
      disconnected_at = null,
      reconnect_deadline = null
  where battle_id = target_battle and user_id = caller_id
    and connection_id = active_connection_id;

  if not found then
    raise exception 'This battle is controlled by another connection' using errcode = '55000';
  end if;
  perform private.repair_two_player_battle(target_battle);
  return private.battle_snapshot(caller_id, target_battle);
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
  all_ready boolean;
  caller_ready boolean;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not new_ready then
    raise exception 'Ready cannot be cancelled after entering the waiting screen' using errcode = '55000';
  end if;

  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id
  for update of party;

  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;
  if party_row.phase <> 'lobby' then raise exception 'Ready controls are locked' using errcode = '55000'; end if;

  select is_ready into caller_ready from public.party_members
  where party_id = party_row.id and user_id = caller_id;
  if caller_ready then return private.party_snapshot(caller_id, party_row.id); end if;

  select count(*)::integer into total_members
  from public.party_members where party_id = party_row.id;
  if total_members < 2 then
    raise exception 'At least two players are required to get Ready' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.party_members
    where party_id = party_row.id and not returned_to_lobby
  ) then
    raise exception 'Wait for every player to return to the lobby' using errcode = '55000';
  end if;

  update public.party_members set is_ready = true
  where party_id = party_row.id and user_id = caller_id;

  select bool_and(is_ready) into all_ready
  from public.party_members where party_id = party_row.id;

  if all_ready then
    update public.parties
    set phase = 'match_starting',
        start_deadline = clock_timestamp() + interval '30 seconds',
        state_version = state_version + 1
    where id = party_row.id;
    delete from public.party_invitations where party_id = party_row.id;
    if total_members = 2 then perform private.create_two_player_battle(party_row.id); end if;
  else
    update public.parties set state_version = state_version + 1 where id = party_row.id;
  end if;

  return private.party_snapshot(caller_id, party_row.id);
end;
$$;

create or replace function public.update_party_settings(new_rounds integer, new_timer_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  party_row public.parties;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if new_rounds not in (1, 3, 5) then raise exception 'Rounds must be 1, 3, or 5' using errcode = '22023'; end if;
  if new_timer_seconds not between 60 and 600 or new_timer_seconds % 30 <> 0 then
    raise exception 'Round timer must be 1–10 minutes in 30-second increments' using errcode = '22023';
  end if;

  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id for update of party;

  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;
  if party_row.host_id <> caller_id then raise exception 'Host control required' using errcode = '42501'; end if;
  if party_row.phase <> 'lobby' or exists (
    select 1 from public.party_members where party_id = party_row.id and is_ready
  ) then raise exception 'Party settings are locked' using errcode = '55000'; end if;

  update public.parties
  set rounds_configured = new_rounds,
      round_timer_seconds = new_timer_seconds,
      state_version = state_version + 1
  where id = party_row.id;
  update public.user_settings
  set preferred_battle_rounds = new_rounds,
      preferred_battle_timer_seconds = new_timer_seconds
  where user_id = caller_id;
  return private.party_snapshot(caller_id, party_row.id);
end;
$$;

create or replace function public.get_party_invite_candidates(filter_text text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  party_row public.parties;
  normalized text := lower(btrim(coalesce(filter_text, '')));
  result jsonb;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if char_length(normalized) > 40 then raise exception 'Search is too long' using errcode = '22023'; end if;

  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id;
  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;
  if party_row.host_id <> caller_id then raise exception 'Host control required' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(
    private.social_player_json(caller_id, candidate.friend_id)
      || jsonb_build_object('inviteStatus', candidate.invite_status)
    order by candidate.username_key
  ), '[]'::jsonb)
  into result
  from (
    select
      case when friendship.user_one_id = caller_id
        then friendship.user_two_id else friendship.user_one_id end as friend_id,
      profile.username_key,
      case
        when exists (
          select 1 from public.party_members
          where party_id = party_row.id and user_id = profile.id
        ) then 'in_lobby'
        when exists (
          select 1 from public.party_members as occupied
          join public.parties as occupied_party on occupied_party.id = occupied.party_id
          where occupied.user_id = profile.id
            and occupied_party.phase in ('match_starting', 'active')
        ) then 'in_battle'
        when exists (
          select 1 from public.party_members where user_id = profile.id
        ) then 'other_lobby'
        when exists (
          select 1 from public.party_invitations
          where party_id = party_row.id and recipient_id = profile.id
        ) then 'invited'
        else 'available'
      end as invite_status
    from public.friendships as friendship
    join public.profiles as profile
      on profile.id = case when friendship.user_one_id = caller_id
        then friendship.user_two_id else friendship.user_one_id end
    join public.user_settings as setting on setting.user_id = profile.id
    where (friendship.user_one_id = caller_id or friendship.user_two_id = caller_id)
      and setting.activity_visible
      and profile.last_online_at >= now() - interval '5 minutes'
      and (
        normalized = '' or profile.username_key like '%' || normalized || '%'
        or lower(coalesce(profile.display_name, '')) like '%' || normalized || '%'
      )
      and not exists (
        select 1 from public.battle_invite_blocks
        where blocker_id = profile.id and blocked_user_id = caller_id
      )
    order by profile.username_key limit 50
  ) as candidate;
  return result;
end;
$$;

create or replace function public.continue_from_battle()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  battle_row public.battles;
  target_party_id uuid;
  everyone_returned boolean;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select battle.* into battle_row
  from public.battles as battle
  join public.battle_members as member on member.battle_id = battle.id
  where member.user_id = caller_id and member.continued_at is null
  order by battle.created_at desc limit 1 for update of battle;
  if battle_row.id is null then raise exception 'Battle not found' using errcode = 'P0002'; end if;
  if battle_row.phase not in ('battle_complete', 'voided') then
    raise exception 'Battle is not complete' using errcode = '55000';
  end if;
  target_party_id := battle_row.party_id;

  update public.battle_members set continued_at = clock_timestamp()
  where battle_id = battle_row.id and user_id = caller_id;

  if battle_row.phase = 'voided' then
    delete from public.party_invitations where party_id = target_party_id;
    delete from public.party_members where party_id = target_party_id;
    update public.parties
    set phase = 'battle_complete', host_id = null, active_battle_id = null,
        start_deadline = null, state_version = state_version + 1
    where id = target_party_id;
    return jsonb_build_object('destination', 'home');
  end if;

  update public.party_members
  set returned_to_lobby = true, is_ready = false, last_seen_at = clock_timestamp()
  where party_id = target_party_id and user_id = caller_id;
  select bool_and(returned_to_lobby) into everyone_returned
  from public.party_members where party_id = target_party_id;
  update public.parties
  set phase = 'lobby',
      active_battle_id = case when everyone_returned then null else active_battle_id end,
      start_deadline = null,
      state_version = state_version + 1
  where id = target_party_id;
  return private.party_snapshot(caller_id, target_party_id);
end;
$$;

create or replace function public.get_player_battle_history(target_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  payload jsonb;
  aliased_standings jsonb;
  match_payload jsonb;
  reason public.battle_completion_reason;
  match_index integer;
begin
  if viewer_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  payload := private.get_player_battle_history_base(target_username);
  if payload is null or jsonb_array_length(payload -> 'matches') = 0 then return payload; end if;

  for match_index in 0..jsonb_array_length(payload -> 'matches') - 1 loop
    match_payload := payload #> array['matches', match_index::text];
    select summary.completion_reason into reason
    from public.battle_history_summaries as summary
    where summary.id = (match_payload ->> 'id')::uuid;

    select coalesce(jsonb_agg(
      entry.standing || jsonb_build_object(
        'displayName', coalesce(friend_alias.alias, entry.standing ->> 'displayName')
      ) order by entry.ordinality
    ), '[]'::jsonb)
    into aliased_standings
    from jsonb_array_elements(match_payload -> 'standings')
      with ordinality as entry(standing, ordinality)
    left join public.friend_aliases as friend_alias
      on friend_alias.owner_id = viewer_id
      and friend_alias.friend_id = (entry.standing ->> 'playerId')::uuid;

    match_payload := jsonb_set(match_payload, '{standings}', aliased_standings)
      || jsonb_build_object('completionReason', coalesce(reason, 'score'));
    payload := jsonb_set(payload, array['matches', match_index::text], match_payload);
  end loop;
  return payload;
end;
$$;

revoke all on function private.capture_battle_history_completion_reason() from public, anon, authenticated;
revoke all on function private.create_two_player_battle(uuid) from public, anon, authenticated;
revoke all on function private.battle_snapshot(uuid, uuid) from public, anon, authenticated;
revoke all on function private.cancel_unstarted_two_player_battle(uuid) from public, anon, authenticated;
revoke all on function private.repair_two_player_battle(uuid) from public, anon, authenticated;
revoke all on function public.claim_my_battle_connection(uuid) from public;
revoke all on function public.heartbeat_my_battle(uuid) from public;
revoke all on function public.set_party_ready(boolean) from public;
revoke all on function public.update_party_settings(integer, integer) from public;
revoke all on function public.get_party_invite_candidates(text) from public;
revoke all on function public.continue_from_battle() from public;
revoke all on function public.get_player_battle_history(text) from public;

grant execute on function public.claim_my_battle_connection(uuid) to authenticated;
grant execute on function public.heartbeat_my_battle(uuid) to authenticated;
grant execute on function public.set_party_ready(boolean) to authenticated;
grant execute on function public.update_party_settings(integer, integer) to authenticated;
grant execute on function public.get_party_invite_candidates(text) to authenticated;
grant execute on function public.continue_from_battle() to authenticated;
grant execute on function public.get_player_battle_history(text) to authenticated;
