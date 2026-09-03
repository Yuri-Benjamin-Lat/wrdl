-- M5: privacy-aware player profiles and Daily history plus authoritative
-- Global/Friends streak leaderboards with dense ties and a pinned viewer row.

create or replace function private.effective_daily_streak(target_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when profile.current_streak = 0 then 0
    when statistics.last_win_date is null then 0
    when statistics.last_win_date >= coalesce((
      select max(puzzle.puzzle_date)
      from private.daily_puzzles as puzzle
      where puzzle.status = 'published'
        and puzzle.puzzle_date < private.manila_today()
    ), statistics.last_win_date) then profile.current_streak
    else 0
  end
  from public.profiles as profile
  left join public.daily_statistics as statistics on statistics.user_id = profile.id
  where profile.id = target_user;
$$;

create or replace function public.get_player_profile(target_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target_profile public.profiles;
  target_setting public.user_settings;
  target_statistics public.daily_statistics;
  is_owner boolean;
  is_friend boolean;
  statistics_visible boolean;
  result jsonb;
begin
  if viewer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target_profile
  from public.profiles
  where username_key = lower(btrim(target_username))
    and username is not null;

  if target_profile.id is null then
    return null;
  end if;

  select * into target_setting
  from public.user_settings
  where user_id = target_profile.id;

  perform private.publish_due_daily_puzzles(private.manila_today());
  perform private.finalize_my_expired_daily_state(
    target_profile.id,
    private.manila_today()
  );

  select * into target_statistics
  from public.daily_statistics
  where user_id = target_profile.id;

  is_owner := viewer_id = target_profile.id;
  is_friend := private.are_friends(viewer_id, target_profile.id);
  statistics_visible := private.can_view_audience(
    viewer_id,
    target_profile.id,
    target_setting.statistics_audience
  );

  result := private.social_player_json(viewer_id, target_profile.id)
    || jsonb_build_object(
      'bio', target_profile.bio,
      'experience', target_profile.experience,
      'experienceCap', (20::bigint * power(2::numeric, target_profile.level - 1))::bigint,
      'currentStreak', private.effective_daily_streak(target_profile.id),
      'isOwner', is_owner,
      'isFriend', is_friend,
      'dailyHistoryVisible', private.can_view_audience(
        viewer_id,
        target_profile.id,
        target_setting.daily_history_audience
      ),
      'statisticsVisible', statistics_visible,
      'battleHistoryVisible', private.can_view_audience(
        viewer_id,
        target_profile.id,
        target_setting.battle_history_audience
      ),
      'dailyHistoryAudience', case when is_owner then target_setting.daily_history_audience else null end,
      'statisticsAudience', case when is_owner then target_setting.statistics_audience else null end,
      'battleHistoryAudience', case when is_owner then target_setting.battle_history_audience else null end,
      'statistics', case
        when statistics_visible then jsonb_build_object(
          'wins', coalesce(target_statistics.wins, 0),
          'missed', coalesce(target_statistics.missed, 0),
          'failed', coalesce(target_statistics.failed, 0),
          'currentStreak', private.effective_daily_streak(target_profile.id),
          'highestStreak', greatest(
            target_profile.current_streak,
            coalesce(target_statistics.highest_streak, 0)
          )
        )
        else null
      end
    );

  return result;
end;
$$;

create or replace function public.get_player_daily_history(target_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target_profile public.profiles;
  target_setting public.user_settings;
  official_date date := private.manila_today();
  viewer_finished_today boolean := false;
  history_visible boolean;
  cards jsonb := '[]'::jsonb;
begin
  if viewer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target_profile
  from public.profiles
  where username_key = lower(btrim(target_username))
    and username is not null;

  if target_profile.id is null then
    return null;
  end if;

  select * into target_setting
  from public.user_settings
  where user_id = target_profile.id;

  history_visible := private.can_view_audience(
    viewer_id,
    target_profile.id,
    target_setting.daily_history_audience
  );

  if not history_visible then
    return jsonb_build_object('visible', false, 'cards', '[]'::jsonb);
  end if;

  perform private.publish_due_daily_puzzles(official_date);
  perform private.finalize_my_expired_daily_state(target_profile.id, official_date);

  if viewer_id = target_profile.id then
    viewer_finished_today := true;
  else
    select exists (
      select 1
      from public.daily_attempts as viewer_attempt
      where viewer_attempt.user_id = viewer_id
        and viewer_attempt.puzzle_date = official_date
        and viewer_attempt.status in ('win', 'failed', 'voided')
    ) or exists (
      select 1
      from private.daily_puzzles as current_puzzle
      where current_puzzle.puzzle_date = official_date
        and current_puzzle.status = 'voided'
    )
    into viewer_finished_today;
  end if;

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
        'lettersHidden', puzzle.puzzle_date = official_date
          and viewer_id <> target_profile.id
          and not viewer_finished_today,
        'guesses', coalesce(guess_rows.guesses, '[]'::jsonb)
      ) as card_data
    from private.daily_puzzles as puzzle
    left join public.daily_attempts as attempt
      on attempt.user_id = target_profile.id
      and attempt.puzzle_date = puzzle.puzzle_date
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'number', daily_guess.guess_number,
          'guess', case
            when puzzle.puzzle_date = official_date
              and viewer_id <> target_profile.id
              and not viewer_finished_today then null
            else daily_guess.guess
          end,
          'pattern', daily_guess.pattern,
          'acceptedAt', daily_guess.accepted_at
        ) order by daily_guess.guess_number
      ) as guesses
      from public.daily_guesses as daily_guess
      where daily_guess.attempt_id = attempt.id
    ) as guess_rows on true
    where puzzle.puzzle_date <= official_date
      and puzzle.puzzle_date >= target_profile.daily_eligibility_date
      and puzzle.status in ('published', 'voided')
      and (
        puzzle.puzzle_date > target_profile.daily_eligibility_date
        or puzzle.puzzle_date = official_date
        or attempt.id is not null
        or puzzle.status = 'voided'
      )
    order by puzzle.puzzle_date desc
    limit 30
  ) as recent_cards;

  return jsonb_build_object('visible', true, 'cards', cards);
end;
$$;

create or replace function public.get_streak_leaderboard(
  leaderboard_scope text default 'global'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  result jsonb;
begin
  if viewer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if leaderboard_scope not in ('global', 'friends') then
    raise exception 'Invalid leaderboard scope' using errcode = '22023';
  end if;

  if leaderboard_scope = 'global' then
    with candidates as materialized (
      select
        profile.id,
        profile.username,
        profile.username_key,
        coalesce(profile.display_name, profile.username) as display_name,
        profile.avatar_path,
        private.effective_daily_streak(profile.id) as streak
      from public.profiles as profile
      where profile.username is not null
    ),
    ranked as materialized (
      select
        candidate.*,
        dense_rank() over (order by candidate.streak desc)::integer as rank
      from candidates as candidate
    ),
    visible_rows as (
      select *
      from ranked
      order by rank, username_key
      limit 100
    )
    select jsonb_build_object(
      'scope', 'global',
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'rank', row.rank,
          'id', row.id,
          'username', row.username,
          'displayName', row.display_name,
          'avatarPath', row.avatar_path,
          'streak', row.streak,
          'isViewer', row.id = viewer_id
        ) order by row.rank, row.username_key)
        from visible_rows as row
      ), '[]'::jsonb),
      'viewer', (
        select jsonb_build_object(
          'rank', viewer.rank,
          'id', viewer.id,
          'username', viewer.username,
          'displayName', viewer.display_name,
          'avatarPath', viewer.avatar_path,
          'streak', viewer.streak,
          'isViewer', true
        )
        from ranked as viewer
        where viewer.id = viewer_id
      )
    ) into result;
  else
    with friend_ids as (
      select viewer_id as id
      union
      select case
        when friendship.user_one_id = viewer_id then friendship.user_two_id
        else friendship.user_one_id
      end
      from public.friendships as friendship
      where friendship.user_one_id = viewer_id or friendship.user_two_id = viewer_id
    ),
    candidates as materialized (
      select
        profile.id,
        profile.username,
        profile.username_key,
        coalesce(profile.display_name, profile.username) as display_name,
        profile.avatar_path,
        private.effective_daily_streak(profile.id) as streak
      from friend_ids
      join public.profiles as profile on profile.id = friend_ids.id
      where profile.username is not null
    ),
    ranked as materialized (
      select
        candidate.*,
        dense_rank() over (order by candidate.streak desc)::integer as rank
      from candidates as candidate
    )
    select jsonb_build_object(
      'scope', 'friends',
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'rank', row.rank,
          'id', row.id,
          'username', row.username,
          'displayName', row.display_name,
          'avatarPath', row.avatar_path,
          'streak', row.streak,
          'isViewer', row.id = viewer_id
        ) order by row.rank, row.username_key)
        from ranked as row
      ), '[]'::jsonb),
      'viewer', (
        select jsonb_build_object(
          'rank', viewer.rank,
          'id', viewer.id,
          'username', viewer.username,
          'displayName', viewer.display_name,
          'avatarPath', viewer.avatar_path,
          'streak', viewer.streak,
          'isViewer', true
        )
        from ranked as viewer
        where viewer.id = viewer_id
      )
    ) into result;
  end if;

  return result;
end;
$$;

revoke all on function public.get_player_profile(text) from public;
revoke all on function public.get_player_daily_history(text) from public;
revoke all on function public.get_streak_leaderboard(text) from public;

grant execute on function public.get_player_profile(text) to authenticated;
grant execute on function public.get_player_daily_history(text) to authenticated;
grant execute on function public.get_streak_leaderboard(text) to authenticated;

