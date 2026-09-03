-- M5 social/privacy/leaderboard contract assertions. Keep this file compatible
-- with a future approved native database runner; never invoke it through
-- `supabase test db`, which starts a Docker container.

do $$
begin
  assert to_regclass('public.friend_requests') is not null,
    'friend_requests is missing';
  assert to_regclass('public.friendships') is not null,
    'friendships is missing';
  assert to_regclass('public.friend_aliases') is not null,
    'friend_aliases is missing';
  assert to_regclass('public.battle_invite_blocks') is not null,
    'battle_invite_blocks is missing';
  assert to_regclass('public.friendly_battle_statistics') is not null,
    'friendly_battle_statistics is missing';
  assert to_regclass('public.battle_history_summaries') is not null,
    'battle_history_summaries is missing';
  assert to_regclass('public.battle_history_standings') is not null,
    'battle_history_standings is missing';

  assert not has_table_privilege('authenticated', 'public.friend_requests', 'select')
    and not has_table_privilege('authenticated', 'public.friendships', 'select')
    and not has_table_privilege('authenticated', 'public.friend_aliases', 'select')
    and not has_table_privilege('authenticated', 'public.battle_invite_blocks', 'select')
    and not has_table_privilege('authenticated', 'public.friendly_battle_statistics', 'select')
    and not has_table_privilege('authenticated', 'public.battle_history_summaries', 'select')
    and not has_table_privilege('authenticated', 'public.battle_history_standings', 'select'),
    'authenticated users can bypass privacy-aware social contracts';

  assert has_function_privilege(
    'authenticated',
    'public.search_players(text,integer)',
    'execute'
  ) and has_function_privilege(
    'authenticated',
    'public.get_my_friends(text,text,integer,integer)',
    'execute'
  ) and has_function_privilege(
    'authenticated',
    'public.get_player_profile(text)',
    'execute'
  ) and has_function_privilege(
    'authenticated',
    'public.get_player_daily_history(text)',
    'execute'
  ) and has_function_privilege(
    'authenticated',
    'public.get_streak_leaderboard(text)',
    'execute'
  ) and has_function_privilege(
    'authenticated',
    'public.get_player_battle_history(text)',
    'execute'
  ), 'authenticated users are missing approved M5 read contracts';

  assert not has_function_privilege(
    'authenticated',
    'private.effective_daily_streak(uuid)',
    'execute'
  ), 'authenticated users can execute the private streak helper';
  assert not has_function_privilege(
    'authenticated',
    'private.create_friendly_battle_statistics()',
    'execute'
  ), 'authenticated users can execute the private battle-statistics trigger';
end;
$$;
