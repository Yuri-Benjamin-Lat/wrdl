-- M5 end-to-end acceptance with two temporary accounts. Every write is enclosed
-- in this transaction and rolled back, so the hosted project retains no test data.

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    'a5000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'm5-acceptance-a@wrdl.invalid', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'b5000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'm5-acceptance-b@wrdl.invalid', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

select set_config('request.jwt.claim.sub', 'a5000000-0000-4000-8000-000000000001', true);
select public.complete_my_profile('m5accepta');
select set_config('request.jwt.claim.sub', 'b5000000-0000-4000-8000-000000000002', true);
select public.complete_my_profile('m5acceptb');

update public.profiles
set display_name = case
  when id = 'a5000000-0000-4000-8000-000000000001' then 'AlphaTester'
  else 'BetaTester'
end
where id in (
  'a5000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000002'
);

update public.user_settings
set daily_history_audience = 'none',
    statistics_audience = 'none',
    battle_history_audience = 'none'
where user_id = 'b5000000-0000-4000-8000-000000000002';

select set_config('request.jwt.claim.sub', 'a5000000-0000-4000-8000-000000000001', true);

do $$
declare
  profile jsonb := public.get_player_profile('m5acceptb');
  search_result jsonb := public.search_players('m5acceptb', 20);
begin
  assert profile ->> 'relationship' = 'none', 'initial relationship is not none';
  assert (profile ->> 'dailyHistoryVisible')::boolean = false,
    'none Daily privacy leaked to a non-friend';
  assert (profile ->> 'statisticsVisible')::boolean = false,
    'none statistics privacy leaked to a non-friend';
  assert profile -> 'statistics' = 'null'::jsonb,
    'private statistics returned values';
  assert (profile ->> 'battleHistoryVisible')::boolean = false,
    'none battle privacy leaked to a non-friend';
  assert jsonb_array_length(search_result) = 1,
    'exact-prefix player search did not return the second account';
  assert jsonb_typeof(search_result #> '{0,online}') = 'boolean',
    'player search returned a nullable online state';
end;
$$;

do $$
begin
  assert public.send_friend_request('m5acceptb') = 'outgoing',
    'friend request did not enter outgoing state';
end;
$$;

select set_config('request.jwt.claim.sub', 'b5000000-0000-4000-8000-000000000002', true);

do $$
declare
  incoming_id uuid;
begin
  assert public.get_my_pending_friend_request_count() = 1,
    'recipient did not receive the pending request';
  select id into incoming_id
  from public.friend_requests
  where requester_id = 'a5000000-0000-4000-8000-000000000001'
    and recipient_id = 'b5000000-0000-4000-8000-000000000002';
  assert public.respond_to_friend_request(incoming_id, true) = 'friends',
    'accepting the request did not create a friendship';
end;
$$;

update public.user_settings
set daily_history_audience = 'friends',
    statistics_audience = 'friends',
    battle_history_audience = 'friends'
where user_id = 'a5000000-0000-4000-8000-000000000001';

insert into public.battle_history_summaries (
  id, completed_at, rounds_configured, round_timer_seconds, player_count
) values (
  'c5000000-0000-4000-8000-000000000003', now(), 5, 180, 2
);

insert into public.battle_history_standings (
  match_id, join_order, player_id, final_rank, total_points
) values
  ('c5000000-0000-4000-8000-000000000003', 1,
   'a5000000-0000-4000-8000-000000000001', 1, 18),
  ('c5000000-0000-4000-8000-000000000003', 2,
   'b5000000-0000-4000-8000-000000000002', 2, 15);

do $$
declare
  friend_page jsonb := public.get_my_friends('alphabetical', '', 0, 30);
  profile jsonb := public.get_player_profile('m5accepta');
  history jsonb := public.get_player_battle_history('m5accepta');
begin
  assert jsonb_array_length(friend_page -> 'items') = 1,
    'accepted friend did not appear in the Friends list';
  assert (profile ->> 'statisticsVisible')::boolean,
    'friends-only statistics were not visible to a friend';
  assert (profile ->> 'battleHistoryVisible')::boolean,
    'friends-only battle history was not visible to a friend';
  assert (history ->> 'visible')::boolean,
    'battle-history contract rejected an accepted friend';
  assert jsonb_array_length(history -> 'matches') = 1,
    'latest battle summary did not appear';
  assert history #>> '{matches,0,result}' = 'win',
    'two-player result was not computed from the profile-owner placement';
  assert jsonb_array_length(history #> '{matches,0,standings}') = 2,
    'expanded final standings are incomplete';
end;
$$;

do $$
declare
  profile jsonb;
  history jsonb;
  leaderboard jsonb;
  aliased_leaderboard_name text;
begin
  assert public.set_friend_alias(
    'a5000000-0000-4000-8000-000000000001', 'Alpha alias'
  ) = 'Alpha alias', 'private alias was not saved';
  assert public.set_battle_invite_block(
    'a5000000-0000-4000-8000-000000000001', true
  ), 'battle invite blocking was not enabled';

  profile := public.get_player_profile('m5accepta');
  history := public.get_player_battle_history('m5accepta');
  leaderboard := public.get_streak_leaderboard('friends');
  select item ->> 'displayName' into aliased_leaderboard_name
  from jsonb_array_elements(leaderboard -> 'items') as item
  where item ->> 'id' = 'a5000000-0000-4000-8000-000000000001';

  assert profile ->> 'alias' = 'Alpha alias',
    'friend profile did not return the viewer-private alias';
  assert history #>> '{matches,0,standings,0,displayName}' = 'Alpha alias',
    'battle standings did not use the viewer-private alias';
  assert aliased_leaderboard_name = 'Alpha alias',
    'leaderboard did not use the viewer-private alias';
end;
$$;

select public.remove_friend('a5000000-0000-4000-8000-000000000001');

do $$
declare
  profile jsonb := public.get_player_profile('m5accepta');
  history jsonb := public.get_player_battle_history('m5accepta');
  leaderboard jsonb := public.get_streak_leaderboard('friends');
begin
  assert (profile ->> 'statisticsVisible')::boolean = false,
    'friends-only statistics remained visible after unfriend';
  assert (history ->> 'visible')::boolean = false,
    'friends-only battle history remained visible after unfriend';
  assert jsonb_array_length(leaderboard -> 'items') = 1,
    'Friends leaderboard retained a removed friend';
end;
$$;

do $$
begin
  assert public.send_friend_request('m5accepta') = 'outgoing',
    'reverse request did not enter outgoing state';
end;
$$;

select set_config('request.jwt.claim.sub', 'a5000000-0000-4000-8000-000000000001', true);

do $$
declare
  leaderboard jsonb;
begin
  assert public.send_friend_request('m5acceptb') = 'friends',
    'crossed requests did not atomically become a friendship';
  leaderboard := public.get_streak_leaderboard('friends');
  assert jsonb_array_length(leaderboard -> 'items') = 2,
    'Friends leaderboard did not include both accepted friends';
end;
$$;

delete from auth.users
where id = 'b5000000-0000-4000-8000-000000000002';

do $$
declare
  history jsonb := public.get_player_battle_history('m5accepta');
begin
  assert history #>> '{matches,0,standings,1,displayName}' = 'Deleted Player',
    'deleted battle participant was not rendered safely';
  assert history #> '{matches,0,standings,1,playerId}' = 'null'::jsonb,
    'deleted battle participant retained an account reference';
end;
$$;

rollback;

do $$
begin
  assert not exists (
    select 1 from auth.users
    where id in (
      'a5000000-0000-4000-8000-000000000001',
      'b5000000-0000-4000-8000-000000000002'
    )
  ), 'rolled-back M5 acceptance accounts were retained';
end;
$$;
