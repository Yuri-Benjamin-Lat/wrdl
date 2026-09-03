-- M7: authoritative two-player Friendly Battle state, protected answers,
-- duplicate-safe guesses, synchronized timers, sudden death, reconnect grace,
-- immutable history, and reusable-party continuation.

create type public.battle_phase as enum (
  'round_starting',
  'round_active',
  'round_resolving',
  'between_rounds',
  'battle_complete',
  'voided'
);

create type public.battle_round_status as enum ('active', 'solved', 'failed');
create type public.battle_completion_reason as enum ('score', 'forfeit', 'voided');

create table public.battles (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties (id) on delete cascade,
  phase public.battle_phase not null default 'round_starting',
  state_version bigint not null default 1,
  player_count integer not null,
  rounds_configured integer not null,
  round_timer_seconds integer not null,
  target_points integer not null,
  current_round integer not null default 1,
  is_sudden_death boolean not null default false,
  sudden_death_round integer not null default 0,
  next_sudden_death boolean not null default false,
  phase_deadline timestamptz,
  round_started_at timestamptz,
  round_deadline timestamptz,
  winner_id uuid references public.profiles (id) on delete set null,
  completion_reason public.battle_completion_reason,
  completed_at timestamptz,
  history_committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint battles_m7_two_players check (player_count = 2),
  constraint battles_rounds check (rounds_configured in (1, 3, 5)),
  constraint battles_timer check (
    round_timer_seconds between 60 and 600 and round_timer_seconds % 30 = 0
  ),
  constraint battles_target check (target_points in (1, 2, 3)),
  constraint battles_version_positive check (state_version >= 1),
  constraint battles_round_positive check (current_round >= 1),
  constraint battles_sudden_death_nonnegative check (sudden_death_round >= 0),
  constraint battles_completion_consistent check (
    (phase = 'battle_complete' and winner_id is not null and completed_at is not null)
    or (phase = 'voided' and winner_id is null and completed_at is not null)
    or (phase not in ('battle_complete', 'voided') and completed_at is null)
  )
);

create unique index battles_one_unfinished_party
  on public.battles (party_id)
  where phase not in ('battle_complete', 'voided');

create trigger battles_set_updated_at
before update on public.battles
for each row execute function public.set_updated_at();

alter table public.parties
  add constraint parties_active_battle_fk
  foreign key (active_battle_id) references public.battles (id) on delete set null;

create table private.battle_rounds (
  battle_id uuid not null references public.battles (id) on delete cascade,
  round_number integer not null,
  answer text not null references private.daily_words (word),
  sudden_death boolean not null default false,
  sudden_death_number integer not null default 0,
  started_at timestamptz,
  deadline timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (battle_id, round_number),
  constraint battle_rounds_number_positive check (round_number >= 1),
  constraint battle_rounds_sudden_death_nonnegative check (sudden_death_number >= 0)
);

create table public.battle_members (
  battle_id uuid not null references public.battles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  join_order integer not null,
  total_points integer not null default 0,
  last_round_points integer not null default 0,
  round_status public.battle_round_status not null default 'active',
  accepted_guess_count integer not null default 0,
  completion_centiseconds integer,
  is_connected boolean not null default true,
  connection_id uuid,
  last_heartbeat_at timestamptz not null default now(),
  disconnected_at timestamptz,
  reconnect_deadline timestamptz,
  continued_at timestamptz,
  final_rank integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (battle_id, user_id),
  unique (battle_id, join_order),
  constraint battle_members_join_order check (join_order between 1 and 2),
  constraint battle_members_points_nonnegative check (
    total_points >= 0 and last_round_points >= 0
  ),
  constraint battle_members_guesses check (accepted_guess_count between 0 and 6),
  constraint battle_members_completion_nonnegative check (
    completion_centiseconds is null or completion_centiseconds >= 0
  ),
  constraint battle_members_connection_state check (
    (is_connected and disconnected_at is null and reconnect_deadline is null)
    or (not is_connected and disconnected_at is not null and reconnect_deadline is not null)
  )
);

create trigger battle_members_set_updated_at
before update on public.battle_members
for each row execute function public.set_updated_at();

create table public.battle_guesses (
  battle_id uuid not null references public.battles (id) on delete cascade,
  round_number integer not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  guess_number integer not null,
  command_id uuid not null unique,
  guess text not null references private.daily_words (word),
  pattern text not null,
  accepted_at timestamptz not null default now(),
  elapsed_centiseconds integer not null,
  primary key (battle_id, round_number, user_id, guess_number),
  foreign key (battle_id, round_number)
    references private.battle_rounds (battle_id, round_number) on delete cascade,
  constraint battle_guesses_number check (guess_number between 1 and 6),
  constraint battle_guesses_pattern check (pattern ~ '^[012]{5}$'),
  constraint battle_guesses_elapsed_nonnegative check (elapsed_centiseconds >= 0)
);

create index battle_guesses_round_progress
  on public.battle_guesses (battle_id, round_number, user_id, guess_number);

alter table public.battles enable row level security;
alter table public.battle_members enable row level security;
alter table public.battle_guesses enable row level security;
alter table private.battle_rounds enable row level security;

revoke all on public.battles from public, anon, authenticated;
revoke all on public.battle_members from public, anon, authenticated;
revoke all on public.battle_guesses from public, anon, authenticated;
revoke all on private.battle_rounds from public, anon, authenticated;

create or replace function private.choose_battle_answer(target_battle_id uuid)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select word.word
  from private.daily_words as word
  where word.active
    and word.answer_eligible
    and word.word is distinct from (
      select puzzle.answer
      from private.daily_puzzles as puzzle
      where puzzle.puzzle_date = private.manila_today()
        and puzzle.status = 'published'
      limit 1
    )
    and not exists (
      select 1 from private.battle_rounds as previous
      where previous.battle_id = target_battle_id
        and previous.answer = word.word
    )
  order by random()
  limit 1;
$$;

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
    party_id,
    player_count,
    rounds_configured,
    round_timer_seconds,
    target_points,
    phase_deadline
  ) values (
    target_party_id,
    2,
    party_row.rounds_configured,
    party_row.round_timer_seconds,
    case party_row.rounds_configured when 1 then 1 when 3 then 2 else 3 end,
    party_row.start_deadline
  ) returning id into new_battle;

  insert into public.battle_members (battle_id, user_id, join_order)
  select new_battle, member.user_id, member.join_order
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

revoke all on function private.choose_battle_answer(uuid) from public;
revoke all on function private.create_two_player_battle(uuid) from public;
revoke all on function private.battle_snapshot(uuid, uuid) from public;

alter table public.battle_history_summaries
  drop constraint battle_history_timer_range,
  add constraint battle_history_timer_range check (
    round_timer_seconds between 60 and 600 and round_timer_seconds % 30 = 0
  );

create or replace function private.complete_two_player_battle(
  target_battle_id uuid,
  winning_user_id uuid,
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
  losing_user_id uuid;
begin
  select * into battle_row from public.battles
  where id = target_battle_id for update;
  if battle_row.id is null or battle_row.completed_at is not null then return; end if;

  if reason = 'voided' then
    update public.battles
    set phase = 'voided',
        phase_deadline = null,
        round_deadline = null,
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

  if winning_user_id is null or not exists (
    select 1 from public.battle_members
    where battle_id = target_battle_id and user_id = winning_user_id
  ) then
    raise exception 'A participating winner is required' using errcode = '23514';
  end if;

  select user_id into losing_user_id
  from public.battle_members
  where battle_id = target_battle_id and user_id <> winning_user_id
  limit 1;

  update public.battle_members
  set final_rank = case when user_id = winning_user_id then 1 else 2 end
  where battle_id = target_battle_id;

  update public.battles
  set phase = 'battle_complete',
      phase_deadline = null,
      round_deadline = null,
      winner_id = winning_user_id,
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
    2
  )
  on conflict (source_battle_id) do nothing
  returning id into history_id;

  if history_id is not null then
    insert into public.battle_history_standings (
      match_id, join_order, player_id, final_rank, total_points
    )
    select history_id, member.join_order, member.user_id,
      case when member.user_id = winning_user_id then 1 else 2 end,
      member.total_points
    from public.battle_members as member
    where member.battle_id = target_battle_id
    order by member.join_order;

    insert into public.friendly_battle_statistics (user_id)
    select user_id from public.battle_members where battle_id = target_battle_id
    on conflict (user_id) do nothing;

    update public.friendly_battle_statistics
    set two_player_wins = two_player_wins + 1
    where user_id = winning_user_id;

    update public.friendly_battle_statistics
    set two_player_losses = two_player_losses + 1
    where user_id = losing_user_id;

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
      host_id = case
        when reason = 'forfeit' and host_id = losing_user_id then winning_user_id
        else host_id
      end,
      start_deadline = null,
      state_version = state_version + 1
  where id = battle_row.party_id;
end;
$$;

create or replace function private.resolve_two_player_round(target_battle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  battle_row public.battles;
  winning_centiseconds integer;
  round_winner_count integer := 0;
  round_winner_id uuid;
  leading_points integer;
  leader_count integer;
  leading_user_id uuid;
  next_sudden boolean := false;
begin
  select * into battle_row from public.battles
  where id = target_battle_id for update;
  if battle_row.id is null or battle_row.phase not in ('round_active', 'round_resolving') then
    return;
  end if;

  select min(completion_centiseconds) into winning_centiseconds
  from public.battle_members
  where battle_id = target_battle_id and round_status = 'solved';

  if winning_centiseconds is not null then
    select count(*)::integer
    into round_winner_count
    from public.battle_members
    where battle_id = target_battle_id
      and round_status = 'solved'
      and completion_centiseconds = winning_centiseconds;
    select user_id into round_winner_id
    from public.battle_members
    where battle_id = target_battle_id
      and round_status = 'solved'
      and completion_centiseconds = winning_centiseconds
    order by join_order
    limit 1;
  end if;

  update public.battle_members
  set last_round_points = case
        when round_status = 'solved' and completion_centiseconds = winning_centiseconds then 1
        else 0
      end,
      total_points = total_points + case
        when round_status = 'solved' and completion_centiseconds = winning_centiseconds then 1
        else 0
      end,
      round_status = case when round_status = 'active' then 'failed' else round_status end
  where battle_id = target_battle_id;

  update private.battle_rounds
  set resolved_at = clock_timestamp()
  where battle_id = target_battle_id and round_number = battle_row.current_round;

  select max(total_points) into leading_points
  from public.battle_members where battle_id = target_battle_id;
  select count(*)::integer
  into leader_count
  from public.battle_members
  where battle_id = target_battle_id and total_points = leading_points;
  select user_id into leading_user_id
  from public.battle_members
  where battle_id = target_battle_id and total_points = leading_points
  order by join_order
  limit 1;

  if battle_row.is_sudden_death then
    if round_winner_count = 1 then
      perform private.complete_two_player_battle(target_battle_id, round_winner_id, 'score');
      return;
    end if;
    next_sudden := true;
  elsif leading_points >= battle_row.target_points then
    if leader_count = 1 then
      perform private.complete_two_player_battle(target_battle_id, leading_user_id, 'score');
      return;
    end if;
    next_sudden := true;
  elsif battle_row.current_round >= battle_row.rounds_configured then
    if leader_count = 1 then
      perform private.complete_two_player_battle(target_battle_id, leading_user_id, 'score');
      return;
    end if;
    next_sudden := true;
  end if;

  update public.battles
  set phase = 'between_rounds',
      phase_deadline = clock_timestamp() + interval '10 seconds',
      round_deadline = null,
      next_sudden_death = next_sudden,
      state_version = state_version + 1
  where id = target_battle_id;
end;
$$;

create or replace function private.prepare_next_two_player_round(target_battle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  battle_row public.battles;
  next_round integer;
  next_sudden_number integer;
  chosen_answer text;
begin
  select * into battle_row from public.battles
  where id = target_battle_id for update;
  if battle_row.id is null or battle_row.phase <> 'between_rounds' then return; end if;

  next_round := battle_row.current_round + 1;
  next_sudden_number := case
    when battle_row.next_sudden_death then battle_row.sudden_death_round + 1
    else 0
  end;
  chosen_answer := private.choose_battle_answer(target_battle_id);
  if chosen_answer is null then
    raise exception 'No eligible battle answer is available' using errcode = 'P0002';
  end if;

  insert into private.battle_rounds (
    battle_id, round_number, answer, sudden_death, sudden_death_number
  ) values (
    target_battle_id,
    next_round,
    chosen_answer,
    battle_row.next_sudden_death,
    next_sudden_number
  );

  update public.battle_members
  set last_round_points = 0,
      round_status = 'active',
      accepted_guess_count = 0,
      completion_centiseconds = null
  where battle_id = target_battle_id;

  update public.battles
  set phase = 'round_starting',
      current_round = next_round,
      is_sudden_death = next_sudden_death,
      sudden_death_round = next_sudden_number,
      next_sudden_death = false,
      phase_deadline = clock_timestamp() + interval '3 seconds',
      round_started_at = null,
      round_deadline = null,
      state_version = state_version + 1
  where id = target_battle_id;
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
  for step in 1..8 loop
    select * into battle_row from public.battles
    where id = target_battle_id for update;
    if battle_row.id is null or battle_row.phase in ('battle_complete', 'voided') then return; end if;

    update public.battle_members
    set is_connected = false,
        disconnected_at = clock_timestamp(),
        reconnect_deadline = clock_timestamp() + interval '30 seconds'
    where battle_id = target_battle_id
      and is_connected
      and last_heartbeat_at < clock_timestamp() - interval '12 seconds';

    select count(*)::integer
    into connected_count
    from public.battle_members
    where battle_id = target_battle_id and is_connected;
    select user_id into connected_user
    from public.battle_members
    where battle_id = target_battle_id and is_connected
    order by join_order
    limit 1;

    select count(*)::integer into expired_disconnected
    from public.battle_members
    where battle_id = target_battle_id
      and not is_connected
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
      set phase = 'active',
          start_deadline = null,
          state_version = state_version + 1
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

revoke all on function private.complete_two_player_battle(uuid, uuid, public.battle_completion_reason) from public;
revoke all on function private.resolve_two_player_round(uuid) from public;
revoke all on function private.prepare_next_two_player_round(uuid) from public;
revoke all on function private.repair_two_player_battle(uuid) from public;

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
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select member.battle_id into target_battle
  from public.battle_members as member
  join public.battles as battle on battle.id = member.battle_id
  where member.user_id = caller_id
    and member.continued_at is null
  order by battle.created_at desc
  limit 1;

  if target_battle is null then return null; end if;
  perform private.repair_two_player_battle(target_battle);
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

  perform private.repair_two_player_battle(target_battle);
  update public.battle_members
  set connection_id = new_connection_id,
      is_connected = true,
      last_heartbeat_at = clock_timestamp(),
      disconnected_at = null,
      reconnect_deadline = null
  where battle_id = target_battle and user_id = caller_id;

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

  perform private.repair_two_player_battle(target_battle);
  update public.battle_members
  set last_heartbeat_at = clock_timestamp(),
      is_connected = true,
      disconnected_at = null,
      reconnect_deadline = null
  where battle_id = target_battle
    and user_id = caller_id
    and connection_id = active_connection_id;

  if not found then
    raise exception 'This battle is controlled by another connection' using errcode = '55000';
  end if;
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
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  update public.battle_members as member
  set is_connected = false,
      disconnected_at = clock_timestamp(),
      reconnect_deadline = clock_timestamp() + interval '30 seconds'
  from public.battles as battle
  where member.battle_id = battle.id
    and member.user_id = caller_id
    and member.connection_id = active_connection_id
    and member.continued_at is null
    and battle.phase not in ('battle_complete', 'voided');
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
  order by created_at desc limit 1;
  if target_battle is null then return null; end if;
  perform private.repair_two_player_battle(target_battle);
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
  if not exists (
    select 1 from private.daily_words where word = normalized_guess and active
  ) then
    raise exception 'Word is not in the accepted list' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.battle_guesses
    where battle_guesses.command_id = submit_my_battle_guess.command_id
      and battle_guesses.user_id = caller_id
  ) then
    select battle_id into target_battle from public.battle_guesses
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
  order by battle.created_at desc limit 1;
  if target_battle is null then raise exception 'Active battle not found' using errcode = 'P0002'; end if;

  perform private.repair_two_player_battle(target_battle);
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
    perform private.repair_two_player_battle(target_battle);
    raise exception 'The round timer has expired' using errcode = '55000';
  end if;
  if member_row.round_status <> 'active' or member_row.accepted_guess_count >= 6 then
    raise exception 'Your puzzle is already finished' using errcode = '55000';
  end if;

  elapsed_cs := greatest(0, floor(
    extract(epoch from (clock_timestamp() - battle_row.round_started_at)) * 100
  )::integer);
  evaluated_pattern := private.evaluate_daily_guess(round_row.answer, normalized_guess);

  if battle_row.phase = 'round_resolving' then
    select min(completion_centiseconds) into first_completion
    from public.battle_members
    where battle_id = target_battle and round_status = 'solved';
    if evaluated_pattern <> '22222' or elapsed_cs <> first_completion
      or battle_row.phase_deadline < clock_timestamp() then
      raise exception 'The round has already concluded' using errcode = '55000';
    end if;
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

  if evaluated_pattern = '22222' then
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
  elsif next_guess_number = 6 and not exists (
    select 1 from public.battle_members
    where battle_id = target_battle and round_status = 'active'
  ) then
    update public.battles
    set phase = 'round_resolving',
        phase_deadline = clock_timestamp(),
        state_version = state_version + 1
    where id = target_battle;
    perform private.repair_two_player_battle(target_battle);
  else
    update public.battles set state_version = state_version + 1 where id = target_battle;
  end if;

  return private.battle_snapshot(caller_id, target_battle);
exception
  when unique_violation then
    if exists (
      select 1 from public.battle_guesses
      where battle_guesses.command_id = submit_my_battle_guess.command_id
        and battle_guesses.user_id = caller_id
    ) then
      select battle_id into target_battle from public.battle_guesses
      where battle_guesses.command_id = submit_my_battle_guess.command_id
        and battle_guesses.user_id = caller_id;
      return private.battle_snapshot(caller_id, target_battle);
    end if;
    raise;
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
  order by battle.created_at desc limit 1
  for update of battle;
  if battle_row.id is null then raise exception 'Battle not found' using errcode = 'P0002'; end if;
  if battle_row.phase not in ('battle_complete', 'voided') then
    raise exception 'Battle is not complete' using errcode = '55000';
  end if;
  target_party_id := battle_row.party_id;

  update public.battle_members
  set continued_at = clock_timestamp()
  where battle_id = battle_row.id and user_id = caller_id;
  update public.party_members
  set returned_to_lobby = true,
      is_ready = false,
      last_seen_at = clock_timestamp()
  where party_members.party_id = target_party_id and user_id = caller_id;

  select bool_and(returned_to_lobby) into everyone_returned
  from public.party_members where party_members.party_id = target_party_id;

  update public.parties
  set phase = 'lobby',
      active_battle_id = case when everyone_returned then null else active_battle_id end,
      start_deadline = null,
      state_version = state_version + 1
  where id = target_party_id;

  return private.party_snapshot(caller_id, target_party_id);
end;
$$;

revoke all on function public.get_my_battle() from public;
revoke all on function public.claim_my_battle_connection(uuid) from public;
revoke all on function public.heartbeat_my_battle(uuid) from public;
revoke all on function public.disconnect_my_battle(uuid) from public;
revoke all on function public.advance_my_battle() from public;
revoke all on function public.submit_my_battle_guess(uuid, uuid, text) from public;
revoke all on function public.continue_from_battle() from public;

grant execute on function public.get_my_battle() to authenticated;
grant execute on function public.claim_my_battle_connection(uuid) to authenticated;
grant execute on function public.heartbeat_my_battle(uuid) to authenticated;
grant execute on function public.disconnect_my_battle(uuid) to authenticated;
grant execute on function public.advance_my_battle() to authenticated;
grant execute on function public.submit_my_battle_guess(uuid, uuid, text) to authenticated;
grant execute on function public.continue_from_battle() to authenticated;

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
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id
  for update of party;

  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;
  if party_row.phase <> 'lobby' then raise exception 'Ready controls are locked' using errcode = '55000'; end if;

  select count(*)::integer into total_members
  from public.party_members where party_id = party_row.id;
  if new_ready and total_members < 2 then
    raise exception 'At least two players are required to get Ready' using errcode = '55000';
  end if;
  if new_ready and exists (
    select 1 from public.party_members
    where party_id = party_row.id and not returned_to_lobby
  ) then
    raise exception 'Wait for every player to return to the lobby' using errcode = '55000';
  end if;

  update public.party_members set is_ready = new_ready
  where party_id = party_row.id and user_id = caller_id;

  select bool_and(is_ready) into all_ready
  from public.party_members where party_id = party_row.id;

  if new_ready and all_ready then
    update public.parties
    set phase = 'match_starting',
        start_deadline = clock_timestamp() + interval '3 seconds',
        state_version = state_version + 1
    where id = party_row.id;
    delete from public.party_invitations where party_id = party_row.id;

    if total_members = 2 then
      perform private.create_two_player_battle(party_row.id);
    end if;
  else
    update public.parties set state_version = state_version + 1
    where id = party_row.id;
  end if;

  return private.party_snapshot(caller_id, party_row.id);
end;
$$;

revoke all on function public.set_party_ready(boolean) from public;
grant execute on function public.set_party_ready(boolean) to authenticated;

create or replace function private.can_receive_battle_topic(
  topic_name text,
  viewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer_id is not null
    and topic_name ~ '^battle:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and exists (
      select 1 from public.battle_members
      where user_id = viewer_id
        and battle_id = split_part(topic_name, ':', 2)::uuid
    );
$$;

drop policy wrdl_private_realtime_receive on realtime.messages;
create policy wrdl_private_realtime_receive
on realtime.messages
for select
to authenticated
using (
  private.can_receive_party_topic(realtime.topic(), auth.uid())
  or private.can_receive_user_topic(realtime.topic(), auth.uid())
  or private.can_receive_battle_topic(realtime.topic(), auth.uid())
);

create or replace function private.signal_battle_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_battle uuid := case when tg_op = 'DELETE' then old.id else new.id end;
begin
  perform realtime.send(
    jsonb_build_object('battleId', target_battle),
    'battle_changed',
    'battle:' || target_battle::text,
    true
  );
  return coalesce(new, old);
end;
$$;

create or replace function private.signal_battle_member_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_battle uuid := case when tg_op = 'DELETE' then old.battle_id else new.battle_id end;
begin
  perform realtime.send(
    jsonb_build_object('battleId', target_battle),
    'battle_changed',
    'battle:' || target_battle::text,
    true
  );
  return coalesce(new, old);
end;
$$;

create trigger battles_signal_change
after update on public.battles
for each row execute function private.signal_battle_change();

create trigger battle_members_signal_insert
after insert or delete on public.battle_members
for each row execute function private.signal_battle_member_change();

create trigger battle_members_signal_visible_update
after update of total_points, last_round_points, round_status, accepted_guess_count,
  completion_centiseconds, is_connected, disconnected_at, reconnect_deadline,
  continued_at, final_rank
on public.battle_members
for each row execute function private.signal_battle_member_change();

create trigger battle_guesses_signal_insert
after insert on public.battle_guesses
for each row execute function private.signal_battle_member_change();

revoke all on function private.can_receive_battle_topic(text, uuid) from public;
revoke all on function private.signal_battle_change() from public;
revoke all on function private.signal_battle_member_change() from public;
