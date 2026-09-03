-- M4: duplicate-safe, server-authoritative Daily Wordle guess submission.

create or replace function private.evaluate_daily_guess(answer text, guess text)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  pattern text := '00000';
  consumed boolean[] := array[false, false, false, false, false];
  guess_index integer;
  answer_index integer;
begin
  if answer !~ '^[a-z]{5}$' or guess !~ '^[a-z]{5}$' then
    raise exception 'Daily evaluation requires two lowercase five-letter words'
      using errcode = '23514';
  end if;

  for guess_index in 1..5 loop
    if substr(guess, guess_index, 1) = substr(answer, guess_index, 1) then
      pattern := overlay(pattern placing '2' from guess_index for 1);
      consumed[guess_index] := true;
    end if;
  end loop;

  for guess_index in 1..5 loop
    if substr(pattern, guess_index, 1) <> '2' then
      for answer_index in 1..5 loop
        if not consumed[answer_index]
          and substr(guess, guess_index, 1) = substr(answer, answer_index, 1) then
          pattern := overlay(pattern placing '1' from guess_index for 1);
          consumed[answer_index] := true;
          exit;
        end if;
      end loop;
    end if;
  end loop;

  return pattern;
end;
$$;

create or replace function public.submit_my_daily_guess(
  command_id uuid,
  submitted_guess text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  official_date date := private.manila_today();
  normalized_guess text := lower(btrim(submitted_guess));
  puzzle_row private.daily_puzzles;
  attempt_row public.daily_attempts;
  profile_row public.profiles;
  next_guess_number smallint;
  evaluated_pattern text;
  resolved_status public.daily_attempt_status;
  reward integer := 0;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if command_id is null then
    raise exception 'A command identifier is required' using errcode = '23514';
  end if;

  if normalized_guess !~ '^[a-z]{5}$' then
    raise exception 'Guess must contain exactly five letters' using errcode = '23514';
  end if;

  if not exists (
    select 1 from private.daily_words where word = normalized_guess and active
  ) then
    raise exception 'Word is not in the accepted list' using errcode = '23514';
  end if;

  perform private.publish_due_daily_puzzles(official_date);
  perform private.finalize_my_expired_daily_state(caller_id, official_date);

  if exists (
    select 1
    from public.daily_guesses as daily_guess
    join public.daily_attempts as daily_attempt on daily_attempt.id = daily_guess.attempt_id
    where daily_guess.command_id = submit_my_daily_guess.command_id
      and daily_attempt.user_id = caller_id
  ) then
    return public.get_my_daily_snapshot();
  end if;

  select * into profile_row
  from public.profiles
  where id = caller_id
  for update;

  if profile_row.username is null then
    raise exception 'Complete account setup first' using errcode = '23514';
  end if;

  if profile_row.daily_eligibility_date > official_date then
    raise exception 'Daily Wordle is not available for this account yet' using errcode = '42501';
  end if;

  select * into puzzle_row
  from private.daily_puzzles
  where puzzle_date = official_date
  for share;

  if puzzle_row.puzzle_date is null or puzzle_row.status = 'scheduled' then
    raise exception 'Daily puzzle is unavailable' using errcode = 'P0002';
  end if;

  if puzzle_row.status = 'voided' then
    raise exception 'Daily puzzle has been voided' using errcode = '23514';
  end if;

  insert into public.daily_statistics (user_id)
  values (caller_id)
  on conflict (user_id) do nothing;

  insert into public.daily_attempts (user_id, puzzle_date)
  values (caller_id, official_date)
  on conflict (user_id, puzzle_date) do nothing;

  select * into attempt_row
  from public.daily_attempts
  where user_id = caller_id and puzzle_date = official_date
  for update;

  if exists (
    select 1
    from public.daily_guesses as daily_guess
    where daily_guess.command_id = submit_my_daily_guess.command_id
      and daily_guess.attempt_id = attempt_row.id
  ) then
    return public.get_my_daily_snapshot();
  end if;

  if attempt_row.status <> 'in_progress' then
    raise exception 'Daily puzzle is already complete' using errcode = '23514';
  end if;

  if attempt_row.accepted_guess_count >= 6 then
    raise exception 'No Daily guesses remain' using errcode = '23514';
  end if;

  next_guess_number := attempt_row.accepted_guess_count + 1;
  evaluated_pattern := private.evaluate_daily_guess(puzzle_row.answer, normalized_guess);

  insert into public.daily_guesses (
    attempt_id,
    guess_number,
    command_id,
    guess,
    pattern
  ) values (
    attempt_row.id,
    next_guess_number,
    command_id,
    normalized_guess,
    evaluated_pattern
  );

  resolved_status := case
    when evaluated_pattern = '22222' then 'win'::public.daily_attempt_status
    when next_guess_number = 6 then 'failed'::public.daily_attempt_status
    else 'in_progress'::public.daily_attempt_status
  end;

  if resolved_status = 'win' then
    reward := 20;

    update public.profiles
    set current_streak = current_streak + 1
    where id = caller_id;

    perform private.apply_daily_experience(caller_id, reward);

    update public.daily_statistics
    set wins = wins + 1,
        last_resolved_date = official_date,
        last_win_date = official_date
    where user_id = caller_id;
  elsif resolved_status = 'failed' then
    reward := 5;

    update public.profiles
    set current_streak = 0
    where id = caller_id;

    perform private.apply_daily_experience(caller_id, reward);

    update public.daily_statistics
    set failed = failed + 1,
        last_resolved_date = official_date
    where user_id = caller_id;
  end if;

  select * into profile_row
  from public.profiles
  where id = caller_id;

  update public.daily_attempts
  set accepted_guess_count = next_guess_number,
      status = resolved_status,
      reward_experience = reward,
      streak_after = case when resolved_status = 'in_progress' then null else profile_row.current_streak end,
      level_after = case when resolved_status = 'in_progress' then null else profile_row.level end,
      experience_after = case when resolved_status = 'in_progress' then null else profile_row.experience end,
      completed_at = case when resolved_status = 'in_progress' then null else now() end
  where id = attempt_row.id;

  return public.get_my_daily_snapshot();
exception
  when unique_violation then
    if exists (
      select 1
      from public.daily_guesses as daily_guess
      join public.daily_attempts as daily_attempt on daily_attempt.id = daily_guess.attempt_id
      where daily_guess.command_id = submit_my_daily_guess.command_id
        and daily_attempt.user_id = caller_id
    ) then
      return public.get_my_daily_snapshot();
    end if;
    raise;
end;
$$;

revoke all on function private.evaluate_daily_guess(text, text) from public;
revoke all on function public.submit_my_daily_guess(uuid, text) from public;

grant execute on function public.submit_my_daily_guess(uuid, text) to authenticated;
