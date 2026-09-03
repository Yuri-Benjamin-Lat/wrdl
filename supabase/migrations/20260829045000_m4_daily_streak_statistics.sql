-- M4: retain a player's highest-ever Daily Wordle streak and expose both
-- current and highest streaks through the private Daily statistics payload.

alter table public.daily_statistics
  add column highest_streak integer not null default 0,
  add constraint daily_statistics_highest_streak_nonnegative check (highest_streak >= 0);

update public.daily_statistics as statistics
set highest_streak = greatest(
  coalesce((
    select max(attempt.streak_after)
    from public.daily_attempts as attempt
    where attempt.user_id = statistics.user_id
  ), 0),
  coalesce((
    select profile.current_streak
    from public.profiles as profile
    where profile.id = statistics.user_id
  ), 0)
);

create or replace function private.retain_daily_highest_streak()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.daily_statistics
  set highest_streak = greatest(highest_streak, new.current_streak)
  where user_id = new.id;

  return new;
end;
$$;

create trigger profiles_retain_daily_highest_streak
after update of current_streak on public.profiles
for each row
when (new.current_streak > old.current_streak)
execute function private.retain_daily_highest_streak();

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
    'currentStreak', profile_row.current_streak,
    'highestStreak', greatest(
      profile_row.current_streak,
      coalesce(statistics_row.highest_streak, 0)
    ),
    'cards', cards
  );
end;
$$;

revoke all on function public.get_my_daily_history() from public;
grant execute on function public.get_my_daily_history() to authenticated;
