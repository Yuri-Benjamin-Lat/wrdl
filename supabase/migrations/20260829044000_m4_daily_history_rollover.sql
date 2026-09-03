-- M4: idempotent missed-day rollover, compact lifetime totals, and the
-- answer-free last-30-card payload used by the player's own profile.

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
  eligibility_date date;
  missed_count integer := 0;
  latest_missed date;
begin
  insert into public.daily_statistics (user_id)
  values (target_user)
  on conflict (user_id) do nothing;

  select profile.daily_eligibility_date
  into eligibility_date
  from public.profiles as profile
  where profile.id = target_user
  for update;

  if eligibility_date is null then
    raise exception 'Profile not found' using errcode = '23503';
  end if;

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

  insert into public.daily_attempts (
    user_id,
    puzzle_date,
    status,
    started_at,
    completed_at
  )
  select
    target_user,
    puzzle.puzzle_date,
    'voided'::public.daily_attempt_status,
    null,
    coalesce(puzzle.voided_at, now())
  from private.daily_puzzles as puzzle
  where puzzle.status = 'voided'
    and puzzle.puzzle_date >= eligibility_date
    and puzzle.puzzle_date < official_date
  on conflict (user_id, puzzle_date) do nothing;

  with inserted_missed as (
    insert into public.daily_attempts (
      user_id,
      puzzle_date,
      status,
      started_at,
      completed_at
    )
    select
      target_user,
      puzzle.puzzle_date,
      'missed'::public.daily_attempt_status,
      null,
      private.manila_reset_after(puzzle.puzzle_date)
    from private.daily_puzzles as puzzle
    where puzzle.status = 'published'
      and puzzle.puzzle_date > eligibility_date
      and puzzle.puzzle_date < official_date
    on conflict (user_id, puzzle_date) do nothing
    returning puzzle_date
  )
  select count(*)::integer, max(puzzle_date)
  into missed_count, latest_missed
  from inserted_missed;

  if missed_count > 0 then
    update public.daily_statistics
    set missed = missed + missed_count,
        last_resolved_date = greatest(last_resolved_date, latest_missed)
    where user_id = target_user;

    update public.profiles
    set current_streak = 0
    where id = target_user and current_streak <> 0;
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
    'missed', coalesce(statistics_row.missed, 0),
    'failed', coalesce(statistics_row.failed, 0)
  );
end;
$$;

create or replace function public.get_my_daily_history()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  official_date date := private.manila_today();
  profile_row public.profiles;
  statistics_row public.daily_statistics;
  cards jsonb := '[]'::jsonb;
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

  select * into statistics_row
  from public.daily_statistics
  where user_id = caller_id;

  select coalesce(jsonb_agg(card_data order by puzzle_date desc), '[]'::jsonb)
  into cards
  from (
    select
      puzzle.puzzle_date,
      jsonb_build_object(
        'date', puzzle.puzzle_date,
        'puzzleNumber', puzzle.puzzle_number,
        'status', case
          when puzzle.status = 'voided' then 'voided'
          when attempt.id is null then 'not_started'
          else attempt.status::text
        end,
        'acceptedGuessCount', coalesce(attempt.accepted_guess_count, 0),
        'guesses', coalesce(guess_rows.guesses, '[]'::jsonb)
      ) as card_data
    from private.daily_puzzles as puzzle
    left join public.daily_attempts as attempt
      on attempt.user_id = caller_id
      and attempt.puzzle_date = puzzle.puzzle_date
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'number', daily_guess.guess_number,
          'guess', daily_guess.guess,
          'pattern', daily_guess.pattern,
          'acceptedAt', daily_guess.accepted_at
        ) order by daily_guess.guess_number
      ) as guesses
      from public.daily_guesses as daily_guess
      where daily_guess.attempt_id = attempt.id
    ) as guess_rows on true
    where puzzle.puzzle_date <= official_date
      and puzzle.puzzle_date >= profile_row.daily_eligibility_date
      and puzzle.status in ('published', 'voided')
      and (
        puzzle.puzzle_date > profile_row.daily_eligibility_date
        or puzzle.puzzle_date = official_date
        or attempt.id is not null
        or puzzle.status = 'voided'
      )
    order by puzzle.puzzle_date desc
    limit 30
  ) as recent_cards;

  return jsonb_build_object(
    'wins', coalesce(statistics_row.wins, 0),
    'missed', coalesce(statistics_row.missed, 0),
    'failed', coalesce(statistics_row.failed, 0),
    'cards', cards
  );
end;
$$;

revoke all on function public.get_my_daily_history() from public;
grant execute on function public.get_my_daily_history() to authenticated;
