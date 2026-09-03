-- M5: compact lifetime Friendly Battle statistics and privacy-aware latest-20
-- completed battle summaries. M7/M8 will write these records transactionally
-- when authoritative battle completion is implemented.

create table public.friendly_battle_statistics (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  two_player_wins integer not null default 0,
  two_player_losses integer not null default 0,
  three_player_wins integer not null default 0,
  three_player_losses integer not null default 0,
  four_plus_wins integer not null default 0,
  four_plus_losses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendly_battle_statistics_nonnegative check (
    two_player_wins >= 0
    and two_player_losses >= 0
    and three_player_wins >= 0
    and three_player_losses >= 0
    and four_plus_wins >= 0
    and four_plus_losses >= 0
  )
);

create trigger friendly_battle_statistics_set_updated_at
before update on public.friendly_battle_statistics
for each row execute function public.set_updated_at();

insert into public.friendly_battle_statistics (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create or replace function private.create_friendly_battle_statistics()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.friendly_battle_statistics (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger profiles_create_friendly_battle_statistics
after insert on public.profiles
for each row execute function private.create_friendly_battle_statistics();

create table public.battle_history_summaries (
  id uuid primary key default gen_random_uuid(),
  source_battle_id uuid unique,
  completed_at timestamptz not null,
  rounds_configured integer not null,
  round_timer_seconds integer not null,
  player_count integer not null,
  created_at timestamptz not null default now(),
  constraint battle_history_rounds_range check (rounds_configured between 1 and 5),
  constraint battle_history_timer_range check (
    round_timer_seconds between 30 and 300 and round_timer_seconds % 30 = 0
  ),
  constraint battle_history_player_count_range check (player_count between 2 and 8)
);

create index battle_history_summaries_completed
  on public.battle_history_summaries (completed_at desc, id desc);

create table public.battle_history_standings (
  match_id uuid not null references public.battle_history_summaries (id) on delete cascade,
  join_order integer not null,
  player_id uuid references public.profiles (id) on delete set null,
  final_rank integer not null,
  total_points numeric(10, 2) not null,
  primary key (match_id, join_order),
  constraint battle_history_join_order_range check (join_order between 1 and 8),
  constraint battle_history_rank_range check (final_rank between 1 and 8),
  constraint battle_history_points_nonnegative check (total_points >= 0)
);

create unique index battle_history_standings_linked_player
  on public.battle_history_standings (match_id, player_id)
  where player_id is not null;

create index battle_history_standings_player_matches
  on public.battle_history_standings (player_id, match_id)
  where player_id is not null;

alter table public.friendly_battle_statistics enable row level security;
alter table public.battle_history_summaries enable row level security;
alter table public.battle_history_standings enable row level security;

revoke all on public.friendly_battle_statistics from public, anon, authenticated;
revoke all on public.battle_history_summaries from public, anon, authenticated;
revoke all on public.battle_history_standings from public, anon, authenticated;

create or replace function public.get_player_battle_history(target_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target_profile public.profiles;
  target_setting public.user_settings;
  history_visible boolean;
  matches jsonb := '[]'::jsonb;
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
    target_setting.battle_history_audience
  );

  if not history_visible then
    return jsonb_build_object('visible', false, 'matches', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(summary_data order by completed_at desc, id desc), '[]'::jsonb)
  into matches
  from (
    select
      summary.id,
      summary.completed_at,
      jsonb_build_object(
        'id', summary.id,
        'completedAt', summary.completed_at,
        'rounds', summary.rounds_configured,
        'roundTimerSeconds', summary.round_timer_seconds,
        'playerCount', summary.player_count,
        'placement', target_standing.final_rank,
        'result', case
          when summary.player_count = 2 and target_standing.final_rank = 1 then 'win'
          when summary.player_count = 2 then 'loss'
          else 'placement'
        end,
        'scoreLine', case
          when summary.player_count = 2 then concat(
            trim_scale(target_standing.total_points),
            '–',
            trim_scale(coalesce(opponent_standing.total_points, 0))
          )
          else null
        end,
        'standings', coalesce(standing_rows.standings, '[]'::jsonb)
      ) as summary_data
    from public.battle_history_summaries as summary
    join public.battle_history_standings as target_standing
      on target_standing.match_id = summary.id
      and target_standing.player_id = target_profile.id
    left join lateral (
      select standing.total_points
      from public.battle_history_standings as standing
      where standing.match_id = summary.id
        and standing.player_id is distinct from target_profile.id
      order by standing.join_order
      limit 1
    ) as opponent_standing on summary.player_count = 2
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'rank', standing.final_rank,
        'playerId', standing.player_id,
        'username', profile.username,
        'displayName', case
          when standing.player_id is null then 'Deleted Player'
          else coalesce(profile.display_name, profile.username)
        end,
        'avatarPath', profile.avatar_path,
        'points', trim_scale(standing.total_points),
        'isProfileOwner', standing.player_id = target_profile.id
      ) order by standing.final_rank, standing.join_order) as standings
      from public.battle_history_standings as standing
      left join public.profiles as profile on profile.id = standing.player_id
      where standing.match_id = summary.id
    ) as standing_rows on true
    order by summary.completed_at desc, summary.id desc
    limit 20
  ) as recent_matches;

  return jsonb_build_object('visible', true, 'matches', matches);
end;
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
  target_battle_statistics public.friendly_battle_statistics;
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
  perform private.finalize_my_expired_daily_state(target_profile.id, private.manila_today());

  select * into target_statistics
  from public.daily_statistics
  where user_id = target_profile.id;

  select * into target_battle_statistics
  from public.friendly_battle_statistics
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
          ),
          'battles', jsonb_build_object(
            'twoPlayerWins', coalesce(target_battle_statistics.two_player_wins, 0),
            'twoPlayerLosses', coalesce(target_battle_statistics.two_player_losses, 0),
            'threePlayerWins', coalesce(target_battle_statistics.three_player_wins, 0),
            'threePlayerLosses', coalesce(target_battle_statistics.three_player_losses, 0),
            'fourPlusWins', coalesce(target_battle_statistics.four_plus_wins, 0),
            'fourPlusLosses', coalesce(target_battle_statistics.four_plus_losses, 0)
          )
        )
        else null
      end
    );

  return result;
end;
$$;

revoke all on function private.create_friendly_battle_statistics() from public;
revoke all on function public.get_player_battle_history(text) from public;
grant execute on function public.get_player_battle_history(text) to authenticated;

