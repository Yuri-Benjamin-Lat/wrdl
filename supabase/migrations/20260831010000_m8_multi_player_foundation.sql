-- M8: generalize the authoritative battle model from two players to 2-8 while
-- preserving the approved M7 two-player scoring and reconnect behavior.

alter table public.battles
  drop constraint if exists battles_m7_two_players,
  drop constraint if exists battles_completion_consistent;

alter table public.battles
  add column preservation_deadline timestamptz,
  add constraint battles_player_count_range check (player_count between 2 and 8),
  add constraint battles_completion_consistent check (
    (phase = 'battle_complete' and completed_at is not null)
    or (phase = 'voided' and winner_id is null and completed_at is not null)
    or (phase not in ('battle_complete', 'voided') and completed_at is null)
  );

alter table public.battle_members
  drop constraint if exists battle_members_join_order,
  drop constraint if exists battle_members_connection_state;

alter table public.battle_members
  add column round_rank integer,
  add column became_host_at timestamptz,
  add constraint battle_members_join_order check (join_order between 1 and 8),
  add constraint battle_members_round_rank check (round_rank is null or round_rank between 1 and 8),
  add constraint battle_members_connection_state check (
    (is_connected and disconnected_at is null and reconnect_deadline is null)
    or (not is_connected and disconnected_at is not null)
  );

create or replace function private.create_battle(target_party_id uuid)
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
  select * into party_row
  from public.parties
  where id = target_party_id
  for update;

  if party_row.id is null then
    raise exception 'Party not found' using errcode = 'P0002';
  end if;
  if party_row.phase <> 'match_starting' or party_row.start_deadline is null then
    raise exception 'Party is not starting' using errcode = '55000';
  end if;
  if party_row.active_battle_id is not null then
    return party_row.active_battle_id;
  end if;

  select count(*)::integer into member_count
  from public.party_members
  where party_id = target_party_id;

  if member_count not between 2 and 8 then
    raise exception 'A battle requires between two and eight players' using errcode = '23514';
  end if;

  if member_count = 2 then
    return private.create_two_player_battle(target_party_id);
  end if;

  insert into public.battles (
    party_id,
    player_count,
    rounds_configured,
    round_timer_seconds,
    target_points,
    phase_deadline,
    players_ready_at
  ) values (
    target_party_id,
    member_count,
    party_row.rounds_configured,
    party_row.round_timer_seconds,
    case party_row.rounds_configured when 1 then 1 when 3 then 2 else 3 end,
    arrival_deadline,
    null
  )
  returning id into new_battle;

  insert into public.battle_members (
    battle_id,
    user_id,
    join_order,
    is_connected,
    disconnected_at,
    reconnect_deadline,
    arrived_at
  )
  select
    new_battle,
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
  player_rows jsonb := '[]'::jsonb;
  viewer_row jsonb;
  opponent_row jsonb;
  reveal_opponent_letters boolean;
begin
  select * into battle_row
  from public.battles
  where id = target_battle_id;
  if battle_row.id is null then return null; end if;

  select * into viewer_member
  from public.battle_members
  where battle_id = target_battle_id and user_id = viewer_id;
  if viewer_member.user_id is null then
    raise exception 'Battle membership required' using errcode = '42501';
  end if;

  reveal_opponent_letters := viewer_member.round_status <> 'active'
    or battle_row.phase not in ('round_active', 'round_resolving');

  select coalesce(jsonb_agg(player_payload order by rank_value, join_order_value), '[]'::jsonb)
  into player_rows
  from (
    select
      member.join_order as join_order_value,
      coalesce(
        member.final_rank,
        dense_rank() over (order by member.total_points desc)::integer
      ) as rank_value,
      private.social_player_json(viewer_id, member.user_id) || jsonb_build_object(
        'joinOrder', member.join_order,
        'points', member.total_points,
        'roundPoints', member.last_round_points,
        'rank', coalesce(
          member.final_rank,
          dense_rank() over (order by member.total_points desc)::integer
        ),
        'roundRank', member.round_rank,
        'roundStatus', member.round_status,
        'acceptedGuessCount', member.accepted_guess_count,
        'completionCentiseconds', member.completion_centiseconds,
        'connected', member.is_connected,
        'reconnectDeadline', member.reconnect_deadline,
        'continued', member.continued_at is not null,
        'becameHostAt', member.became_host_at,
        'guesses', coalesce((
          select jsonb_agg(jsonb_build_object(
            'guessNumber', guess.guess_number,
            'guess', case
              when member.user_id = viewer_id or reveal_opponent_letters then upper(guess.guess)
              else null
            end,
            'pattern', guess.pattern
          ) order by guess.guess_number)
          from public.battle_guesses as guess
          where guess.battle_id = target_battle_id
            and guess.round_number = battle_row.current_round
            and guess.user_id = member.user_id
        ), '[]'::jsonb)
      ) as player_payload
    from public.battle_members as member
    where member.battle_id = target_battle_id
  ) as ranked_players;

  select player into viewer_row
  from jsonb_array_elements(player_rows) as player
  where player ->> 'id' = viewer_id::text;

  select player into opponent_row
  from jsonb_array_elements(player_rows) as player
  where player ->> 'id' <> viewer_id::text
  order by (player ->> 'joinOrder')::integer
  limit 1;

  return jsonb_build_object(
    'id', battle_row.id,
    'partyId', battle_row.party_id,
    'phase', battle_row.phase,
    'stateVersion', battle_row.state_version,
    'serverTime', clock_timestamp(),
    'playerCount', battle_row.player_count,
    'hostId', (select host_id from public.parties where id = battle_row.party_id),
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
    'preservationDeadline', battle_row.preservation_deadline,
    'winnerId', battle_row.winner_id,
    'completionReason', battle_row.completion_reason,
    'viewer', viewer_row,
    'opponent', opponent_row,
    'players', player_rows
  );
end;
$$;

create or replace function private.complete_multi_player_battle(
  target_battle_id uuid,
  reason public.battle_completion_reason
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  battle_row public.battles;
  history_id uuid;
  top_count integer;
  sole_winner uuid;
begin
  select * into battle_row
  from public.battles
  where id = target_battle_id
  for update;

  if battle_row.id is null or battle_row.completed_at is not null then return; end if;
  if battle_row.player_count < 3 then
    raise exception 'Multi-player completion requires at least three players' using errcode = '23514';
  end if;

  if reason = 'voided' then
    update public.battle_members
    set total_points = 0,
        last_round_points = 0,
        round_rank = null,
        final_rank = null
    where battle_id = target_battle_id;

    update public.battles
    set phase = 'voided',
        phase_deadline = null,
        round_deadline = null,
        preservation_deadline = null,
        winner_id = null,
        completion_reason = 'voided',
        completed_at = clock_timestamp(),
        state_version = state_version + 1
    where id = target_battle_id;

    update public.parties
    set phase = 'battle_complete',
        start_deadline = null,
        state_version = state_version + 1
    where id = battle_row.party_id;
    return;
  end if;

  with ranked as (
    select user_id, dense_rank() over (order by total_points desc)::integer as final_rank
    from public.battle_members
    where battle_id = target_battle_id
  )
  update public.battle_members as member
  set final_rank = ranked.final_rank
  from ranked
  where member.battle_id = target_battle_id and member.user_id = ranked.user_id;

  select count(*)::integer
  into top_count
  from public.battle_members
  where battle_id = target_battle_id and final_rank = 1;

  select user_id into sole_winner
  from public.battle_members
  where battle_id = target_battle_id and final_rank = 1
  order by join_order
  limit 1;

  update public.battles
  set phase = 'battle_complete',
      phase_deadline = null,
      round_deadline = null,
      preservation_deadline = null,
      winner_id = case when top_count = 1 then sole_winner else null end,
      completion_reason = reason,
      completed_at = clock_timestamp(),
      state_version = state_version + 1
  where id = target_battle_id;

  insert into public.battle_history_summaries (
    source_battle_id,
    completed_at,
    rounds_configured,
    round_timer_seconds,
    player_count
  ) values (
    target_battle_id,
    clock_timestamp(),
    battle_row.rounds_configured,
    battle_row.round_timer_seconds,
    battle_row.player_count
  )
  on conflict (source_battle_id) do nothing
  returning id into history_id;

  if history_id is not null then
    insert into public.battle_history_standings (
      match_id, join_order, player_id, final_rank, total_points
    )
    select history_id, join_order, user_id, final_rank, total_points
    from public.battle_members
    where battle_id = target_battle_id
    order by join_order;

    insert into public.friendly_battle_statistics (user_id)
    select user_id
    from public.battle_members
    where battle_id = target_battle_id
    on conflict (user_id) do nothing;

    if battle_row.player_count = 3 then
      update public.friendly_battle_statistics as statistic
      set three_player_wins = statistic.three_player_wins + case when member.final_rank = 1 then 1 else 0 end,
          three_player_losses = statistic.three_player_losses + case when member.final_rank = 1 then 0 else 1 end
      from public.battle_members as member
      where member.battle_id = target_battle_id and statistic.user_id = member.user_id;
    else
      update public.friendly_battle_statistics as statistic
      set four_plus_wins = statistic.four_plus_wins + case when member.final_rank = 1 then 1 else 0 end,
          four_plus_losses = statistic.four_plus_losses + case when member.final_rank = 1 then 0 else 1 end
      from public.battle_members as member
      where member.battle_id = target_battle_id and statistic.user_id = member.user_id;
    end if;

    update public.battles
    set history_committed_at = clock_timestamp()
    where id = target_battle_id;
  end if;

  update public.party_members
  set is_ready = false,
      returned_to_lobby = false
  where party_id = battle_row.party_id;

  update public.parties
  set phase = 'battle_complete',
      start_deadline = null,
      state_version = state_version + 1
  where id = battle_row.party_id;
end;
$$;

create or replace function private.resolve_multi_player_round(target_battle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  battle_row public.battles;
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

create or replace function private.prepare_next_multi_player_round(target_battle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  battle_row public.battles;
  next_round integer;
  chosen_answer text;
begin
  select * into battle_row
  from public.battles
  where id = target_battle_id
  for update;

  if battle_row.id is null or battle_row.phase <> 'between_rounds' then return; end if;
  if battle_row.player_count = 2 then
    perform private.prepare_next_two_player_round(target_battle_id);
    return;
  end if;

  next_round := battle_row.current_round + 1;
  chosen_answer := private.choose_battle_answer(target_battle_id);
  if chosen_answer is null then
    raise exception 'No eligible battle answer is available' using errcode = 'P0002';
  end if;

  insert into private.battle_rounds (battle_id, round_number, answer)
  values (target_battle_id, next_round, chosen_answer);

  update public.battle_members
  set last_round_points = 0,
      round_rank = null,
      round_status = 'active',
      accepted_guess_count = 0,
      completion_centiseconds = null
  where battle_id = target_battle_id;

  update public.battles
  set phase = 'round_starting',
      current_round = next_round,
      is_sudden_death = false,
      sudden_death_round = 0,
      next_sudden_death = false,
      phase_deadline = clock_timestamp() + interval '3 seconds',
      round_started_at = null,
      round_deadline = null,
      state_version = state_version + 1
  where id = target_battle_id;
end;
$$;

revoke all on function private.create_battle(uuid) from public, anon, authenticated;
revoke all on function private.battle_snapshot(uuid, uuid) from public, anon, authenticated;
revoke all on function private.complete_multi_player_battle(uuid, public.battle_completion_reason) from public, anon, authenticated;
revoke all on function private.resolve_multi_player_round(uuid) from public, anon, authenticated;
revoke all on function private.prepare_next_multi_player_round(uuid) from public, anon, authenticated;
