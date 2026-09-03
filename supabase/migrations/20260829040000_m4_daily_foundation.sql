-- M4: protected Daily Wordle schedule, Philippine-day authority, durable
-- attempts, compact statistics, rollover repair, and answer-free snapshots.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create type public.daily_puzzle_status as enum ('scheduled', 'published', 'voided');
create type public.daily_attempt_status as enum ('in_progress', 'win', 'failed', 'voided');

create table private.daily_words (
  word text primary key,
  answer_eligible boolean not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint daily_words_format check (word ~ '^[a-z]{5}$')
);

create table private.daily_puzzles (
  puzzle_date date primary key,
  puzzle_number bigint not null unique,
  answer text not null references private.daily_words (word),
  status public.daily_puzzle_status not null default 'scheduled',
  published_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_puzzles_number_positive check (puzzle_number > 0),
  constraint daily_puzzles_publication_consistent check (
    (status = 'scheduled' and published_at is null and voided_at is null and void_reason is null)
    or (status = 'published' and published_at is not null and voided_at is null and void_reason is null)
    or (
      status = 'voided'
      and published_at is not null
      and voided_at is not null
      and nullif(btrim(void_reason), '') is not null
    )
  )
);

create table public.daily_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  puzzle_date date not null references private.daily_puzzles (puzzle_date),
  status public.daily_attempt_status not null default 'in_progress',
  accepted_guess_count smallint not null default 0,
  reward_experience integer not null default 0,
  streak_after integer,
  level_after integer,
  experience_after integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint daily_attempts_one_per_player_day unique (user_id, puzzle_date),
  constraint daily_attempts_guess_count check (accepted_guess_count between 0 and 6),
  constraint daily_attempts_reward check (reward_experience in (0, 5, 20)),
  constraint daily_attempts_completion_consistent check (
    (status = 'in_progress' and completed_at is null)
    or (status <> 'in_progress' and completed_at is not null)
  )
);

create index daily_attempts_user_date
  on public.daily_attempts (user_id, puzzle_date desc);

create table public.daily_guesses (
  attempt_id uuid not null references public.daily_attempts (id) on delete cascade,
  guess_number smallint not null,
  command_id uuid not null unique,
  guess text not null references private.daily_words (word),
  pattern text not null,
  accepted_at timestamptz not null default now(),
  primary key (attempt_id, guess_number),
  constraint daily_guesses_number check (guess_number between 1 and 6),
  constraint daily_guesses_pattern check (pattern ~ '^[012]{5}$')
);

create table public.daily_statistics (
  user_id uuid primary key references auth.users (id) on delete cascade,
  wins integer not null default 0,
  failed integer not null default 0,
  last_resolved_date date,
  last_win_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_statistics_wins_nonnegative check (wins >= 0),
  constraint daily_statistics_failed_nonnegative check (failed >= 0)
);

create trigger daily_attempts_set_updated_at
before update on public.daily_attempts
for each row execute function public.set_updated_at();

create trigger daily_statistics_set_updated_at
before update on public.daily_statistics
for each row execute function public.set_updated_at();

create or replace function private.manila_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (current_timestamp at time zone 'Asia/Manila')::date;
$$;

create or replace function private.manila_reset_after(day date)
returns timestamptz
language sql
immutable
strict
set search_path = ''
as $$
  select (day + 1)::timestamp at time zone 'Asia/Manila';
$$;

create or replace function private.publish_due_daily_puzzles(through_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.daily_puzzles
  set status = 'published',
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where status = 'scheduled'
    and puzzle_date <= through_date;
end;
$$;

create or replace function private.apply_daily_experience(target_user uuid, award integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_level integer;
  next_experience integer;
  required_experience bigint;
begin
  if award < 0 then
    raise exception 'Experience award cannot be negative' using errcode = '23514';
  end if;

  select level, experience
  into next_level, next_experience
  from public.profiles
  where id = target_user
  for update;

  if next_level is null then
    raise exception 'Profile not found' using errcode = '23503';
  end if;

  next_experience := next_experience + award;
  required_experience := 20 * power(2::numeric, next_level - 1);

  while next_experience >= required_experience loop
    next_experience := next_experience - required_experience;
    next_level := next_level + 1;
    required_experience := 20 * power(2::numeric, next_level - 1);

    if required_experience > 2147483647 then
      raise exception 'Level progression exceeds supported integer range' using errcode = '22003';
    end if;
  end loop;

  update public.profiles
  set level = next_level,
      experience = next_experience
  where id = target_user;
end;
$$;

create or replace function private.finalize_my_expired_daily_state(
  target_user uuid,
  official_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired record;
  latest_win date;
  eligibility_date date;
begin
  insert into public.daily_statistics (user_id)
  values (target_user)
  on conflict (user_id) do nothing;

  for expired in
    select attempt.id, attempt.puzzle_date, puzzle.status as puzzle_status
    from public.daily_attempts as attempt
    join private.daily_puzzles as puzzle on puzzle.puzzle_date = attempt.puzzle_date
    where attempt.user_id = target_user
      and attempt.status = 'in_progress'
      and attempt.puzzle_date < official_date
    order by attempt.puzzle_date
    for update of attempt
  loop
    if expired.puzzle_status = 'voided' then
      update public.daily_attempts
      set status = 'voided',
          reward_experience = 0,
          completed_at = now()
      where id = expired.id and status = 'in_progress';
    else
      update public.daily_attempts
      set status = 'failed',
          reward_experience = 5,
          completed_at = now()
      where id = expired.id and status = 'in_progress';

      if found then
        perform private.apply_daily_experience(target_user, 5);

        update public.daily_statistics
        set failed = failed + 1,
            last_resolved_date = greatest(last_resolved_date, expired.puzzle_date)
        where user_id = target_user;

        update public.profiles
        set current_streak = 0
        where id = target_user;
      end if;
    end if;
  end loop;

  select stats.last_win_date, profile.daily_eligibility_date
  into latest_win, eligibility_date
  from public.daily_statistics as stats
  join public.profiles as profile on profile.id = stats.user_id
  where stats.user_id = target_user;

  if exists (
    select 1
    from private.daily_puzzles as puzzle
    where puzzle.status = 'published'
      and puzzle.puzzle_date < official_date
      and puzzle.puzzle_date > greatest(coalesce(latest_win, eligibility_date), eligibility_date)
  ) then
    update public.profiles
    set current_streak = 0
    where id = target_user and current_streak <> 0;
  end if;
end;
$$;

create or replace function public.schedule_daily_puzzle(
  scheduled_date date,
  scheduled_number bigint,
  scheduled_answer text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_answer text := lower(btrim(scheduled_answer));
begin
  if scheduled_date is null or scheduled_number is null or scheduled_number < 1 then
    raise exception 'A valid date and positive puzzle number are required' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from private.daily_words
    where word = normalized_answer and answer_eligible and active
  ) then
    raise exception 'Daily answer is not eligible' using errcode = '23514';
  end if;

  insert into private.daily_puzzles (puzzle_date, puzzle_number, answer)
  values (scheduled_date, scheduled_number, normalized_answer);
end;
$$;

create or replace function public.void_daily_puzzle(target_date date, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(reason), '') is null then
    raise exception 'A void reason is required' using errcode = '23514';
  end if;

  update private.daily_puzzles
  set status = 'voided',
      published_at = coalesce(published_at, now()),
      voided_at = now(),
      void_reason = btrim(reason),
      updated_at = now()
  where puzzle_date = target_date and status in ('scheduled', 'published');

  if not found then
    raise exception 'Puzzle is missing or already voided' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.get_my_daily_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  official_date date := private.manila_today();
  profile_row public.profiles;
  puzzle_row private.daily_puzzles;
  attempt_row public.daily_attempts;
  statistics_row public.daily_statistics;
  guesses jsonb := '[]'::jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform private.publish_due_daily_puzzles(official_date);
  perform private.finalize_my_expired_daily_state(caller_id, official_date);

  select * into profile_row
  from public.profiles
  where id = caller_id;

  if profile_row.username is null then
    raise exception 'Complete account setup first' using errcode = '23514';
  end if;

  select * into puzzle_row
  from private.daily_puzzles
  where puzzle_date = official_date
    and status in ('published', 'voided');

  select * into attempt_row
  from public.daily_attempts
  where user_id = caller_id and puzzle_date = official_date;

  select * into statistics_row
  from public.daily_statistics
  where user_id = caller_id;

  if attempt_row.id is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'number', daily_guesses.guess_number,
          'guess', daily_guesses.guess,
          'pattern', daily_guesses.pattern,
          'acceptedAt', daily_guesses.accepted_at
        ) order by daily_guesses.guess_number
      ),
      '[]'::jsonb
    )
    into guesses
    from public.daily_guesses
    where daily_guesses.attempt_id = attempt_row.id;
  end if;

  return jsonb_build_object(
    'officialDate', official_date,
    'serverTime', now(),
    'resetAt', private.manila_reset_after(official_date),
    'eligible', profile_row.daily_eligibility_date <= official_date,
    'puzzleNumber', puzzle_row.puzzle_number,
    'status', case
      when puzzle_row.puzzle_date is null then 'unavailable'
      when puzzle_row.status = 'voided' then 'voided'
      when attempt_row.id is null then 'not_started'
      else attempt_row.status::text
    end,
    'guesses', guesses,
    'acceptedGuessCount', coalesce(attempt_row.accepted_guess_count, 0),
    'rewardExperience', coalesce(attempt_row.reward_experience, 0),
    'streak', profile_row.current_streak,
    'level', profile_row.level,
    'experience', profile_row.experience,
    'wins', coalesce(statistics_row.wins, 0),
    'failed', coalesce(statistics_row.failed, 0)
  );
end;
$$;

alter table public.daily_attempts enable row level security;
alter table public.daily_guesses enable row level security;
alter table public.daily_statistics enable row level security;

revoke all on private.daily_words from public, anon, authenticated;
revoke all on private.daily_puzzles from public, anon, authenticated;
revoke all on public.daily_attempts from public, anon, authenticated;
revoke all on public.daily_guesses from public, anon, authenticated;
revoke all on public.daily_statistics from public, anon, authenticated;

revoke all on function private.manila_today() from public;
revoke all on function private.manila_reset_after(date) from public;
revoke all on function private.publish_due_daily_puzzles(date) from public;
revoke all on function private.apply_daily_experience(uuid, integer) from public;
revoke all on function private.finalize_my_expired_daily_state(uuid, date) from public;
revoke all on function public.schedule_daily_puzzle(date, bigint, text) from public;
revoke all on function public.void_daily_puzzle(date, text) from public;
revoke all on function public.get_my_daily_snapshot() from public;

grant execute on function public.schedule_daily_puzzle(date, bigint, text) to service_role;
grant execute on function public.void_daily_puzzle(date, text) to service_role;
grant execute on function public.get_my_daily_snapshot() to authenticated;
