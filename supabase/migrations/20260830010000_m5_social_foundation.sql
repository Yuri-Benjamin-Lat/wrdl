-- M5: authoritative friendships, requests, private aliases, battle-invite
-- blocking, privacy-safe activity, and social discovery contracts.

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friend_requests_distinct_players check (requester_id <> recipient_id),
  constraint friend_requests_direction_unique unique (requester_id, recipient_id)
);

create index friend_requests_recipient_created
  on public.friend_requests (recipient_id, created_at desc);

create table public.friendships (
  user_one_id uuid not null references public.profiles (id) on delete cascade,
  user_two_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_one_id, user_two_id),
  constraint friendships_canonical_pair check (user_one_id < user_two_id)
);

create index friendships_user_two_created
  on public.friendships (user_two_id, created_at desc);

create table public.friend_aliases (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  constraint friend_aliases_distinct_players check (owner_id <> friend_id),
  constraint friend_aliases_length check (char_length(alias) between 1 and 20)
);

create trigger friend_aliases_set_updated_at
before update on public.friend_aliases
for each row execute function public.set_updated_at();

create table public.battle_invite_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  constraint battle_invite_blocks_distinct_players check (blocker_id <> blocked_user_id)
);

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_aliases enable row level security;
alter table public.battle_invite_blocks enable row level security;

revoke all on public.friend_requests from public, anon, authenticated;
revoke all on public.friendships from public, anon, authenticated;
revoke all on public.friend_aliases from public, anon, authenticated;
revoke all on public.battle_invite_blocks from public, anon, authenticated;

create or replace function private.are_friends(left_user uuid, right_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select left_user is not null
    and right_user is not null
    and left_user <> right_user
    and exists (
      select 1
      from public.friendships as friendship
      where friendship.user_one_id = least(left_user, right_user)
        and friendship.user_two_id = greatest(left_user, right_user)
    );
$$;

create or replace function private.can_view_audience(
  viewer_id uuid,
  target_id uuid,
  audience public.wrdl_audience
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer_id = target_id
    or audience = 'public'::public.wrdl_audience
    or (
      audience = 'friends'::public.wrdl_audience
      and private.are_friends(viewer_id, target_id)
    );
$$;

create or replace function private.social_relationship(viewer_id uuid, target_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when viewer_id = target_id then 'self'
    when private.are_friends(viewer_id, target_id) then 'friends'
    when exists (
      select 1 from public.friend_requests
      where requester_id = viewer_id and recipient_id = target_id
    ) then 'outgoing'
    when exists (
      select 1 from public.friend_requests
      where requester_id = target_id and recipient_id = viewer_id
    ) then 'incoming'
    else 'none'
  end;
$$;

create or replace function private.social_player_json(viewer_id uuid, target_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', profile.id,
    'username', profile.username,
    'displayName', coalesce(profile.display_name, profile.username),
    'avatarPath', profile.avatar_path,
    'level', profile.level,
    'currentStreak', profile.current_streak,
    'relationship', private.social_relationship(viewer_id, profile.id),
    'alias', (
      select friend_alias.alias
      from public.friend_aliases as friend_alias
      where friend_alias.owner_id = viewer_id
        and friend_alias.friend_id = profile.id
    ),
    'activityVisible', setting.activity_visible,
    'online', setting.activity_visible
      and profile.last_online_at >= now() - interval '5 minutes',
    'lastOnlineAt', case
      when setting.activity_visible then profile.last_online_at
      else null
    end,
    'battleInvitesBlocked', exists (
      select 1
      from public.battle_invite_blocks as invite_block
      where invite_block.blocker_id = viewer_id
        and invite_block.blocked_user_id = profile.id
    )
  )
  from public.profiles as profile
  join public.user_settings as setting on setting.user_id = profile.id
  where profile.id = target_id
    and profile.username is not null;
$$;

create or replace function public.search_players(
  search_text text,
  result_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized text := lower(btrim(search_text));
  safe_limit integer := least(greatest(coalesce(result_limit, 20), 1), 50);
  result jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if normalized = ''
    or char_length(normalized) > 20
    or normalized !~ '^[a-z0-9]+$' then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(private.social_player_json(caller_id, match.id)
    order by match.username_key), '[]'::jsonb)
  into result
  from (
    select profile.id, profile.username_key
    from public.profiles as profile
    where profile.id <> caller_id
      and profile.username is not null
      and profile.username_key like normalized || '%'
    order by
      case when profile.username_key = normalized then 0 else 1 end,
      profile.username_key
    limit safe_limit
  ) as match;

  return result;
end;
$$;

create or replace function public.get_my_friends(
  sort_order text default 'activity_desc',
  filter_text text default '',
  result_offset integer default 0,
  result_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_filter text := lower(btrim(coalesce(filter_text, '')));
  safe_offset integer := greatest(coalesce(result_offset, 0), 0);
  safe_limit integer := least(greatest(coalesce(result_limit, 30), 1), 50);
  result jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if sort_order not in (
    'activity_desc',
    'activity_asc',
    'added_first',
    'added_last',
    'alphabetical'
  ) then
    raise exception 'Invalid friend sort order' using errcode = '22023';
  end if;

  with friend_rows as (
    select
      case
        when friendship.user_one_id = caller_id then friendship.user_two_id
        else friendship.user_one_id
      end as friend_id,
      friendship.created_at as friendship_created_at
    from public.friendships as friendship
    where friendship.user_one_id = caller_id or friendship.user_two_id = caller_id
  ),
  filtered as (
    select
      friend_rows.friend_id,
      friend_rows.friendship_created_at,
      profile.username_key,
      profile.last_online_at,
      setting.activity_visible,
      friend_alias.alias
    from friend_rows
    join public.profiles as profile on profile.id = friend_rows.friend_id
    join public.user_settings as setting on setting.user_id = friend_rows.friend_id
    left join public.friend_aliases as friend_alias
      on friend_alias.owner_id = caller_id and friend_alias.friend_id = friend_rows.friend_id
    where normalized_filter = ''
      or profile.username_key like '%' || normalized_filter || '%'
      or lower(coalesce(profile.display_name, '')) like '%' || normalized_filter || '%'
      or lower(coalesce(friend_alias.alias, '')) like '%' || normalized_filter || '%'
  ),
  ordered as (
    select *
    from filtered
    order by
      case when sort_order = 'activity_desc'
        then activity_visible and last_online_at >= now() - interval '5 minutes' end desc nulls last,
      case when sort_order = 'activity_desc' and activity_visible then last_online_at end desc nulls last,
      case when sort_order = 'activity_asc' and activity_visible then last_online_at end asc nulls last,
      case when sort_order = 'added_first' then friendship_created_at end asc,
      case when sort_order = 'added_last' then friendship_created_at end desc,
      case when sort_order = 'alphabetical' then username_key end asc,
      username_key asc
    offset safe_offset
    limit safe_limit + 1
  ),
  page as (
    select * from ordered limit safe_limit
  )
  select jsonb_build_object(
    'items', coalesce(
      (select jsonb_agg(private.social_player_json(caller_id, page.friend_id)) from page),
      '[]'::jsonb
    ),
    'hasMore', (select count(*) > safe_limit from ordered),
    'nextOffset', safe_offset + (select count(*) from page)
  )
  into result;

  return result;
end;
$$;

create or replace function public.get_my_incoming_friend_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  result jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    private.social_player_json(caller_id, request.requester_id)
      || jsonb_build_object('requestId', request.id, 'requestedAt', request.created_at)
    order by request.created_at desc
  ), '[]'::jsonb)
  into result
  from public.friend_requests as request
  where request.recipient_id = caller_id;

  return result;
end;
$$;

create or replace function public.get_my_pending_friend_request_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then 0
    else (
      select count(*)::integer
      from public.friend_requests
      where recipient_id = auth.uid()
    )
  end;
$$;

create or replace function public.send_friend_request(target_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select profile.id into target_id
  from public.profiles as profile
  where profile.username_key = lower(btrim(target_username))
    and profile.username is not null;

  if target_id is null then
    raise exception 'Player not found' using errcode = 'P0002';
  end if;

  if target_id = caller_id then
    raise exception 'You cannot add yourself' using errcode = '23514';
  end if;

  perform 1
  from public.profiles
  where id in (caller_id, target_id)
  order by id
  for update;

  if private.are_friends(caller_id, target_id) then
    return 'friends';
  end if;

  if exists (
    select 1 from public.friend_requests
    where requester_id = target_id and recipient_id = caller_id
  ) then
    delete from public.friend_requests
    where (requester_id = caller_id and recipient_id = target_id)
       or (requester_id = target_id and recipient_id = caller_id);

    insert into public.friendships (user_one_id, user_two_id)
    values (least(caller_id, target_id), greatest(caller_id, target_id))
    on conflict do nothing;

    return 'friends';
  end if;

  insert into public.friend_requests (requester_id, recipient_id)
  values (caller_id, target_id)
  on conflict (requester_id, recipient_id) do nothing;

  return 'outgoing';
end;
$$;

create or replace function public.cancel_friend_request(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.friend_requests
  where requester_id = auth.uid() and recipient_id = target_user;
end;
$$;

create or replace function public.respond_to_friend_request(
  request_id uuid,
  accept_request boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  request_row public.friend_requests;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into request_row
  from public.friend_requests
  where id = request_id and recipient_id = caller_id
  for update;

  if request_row.id is null then
    raise exception 'Friend request is no longer available' using errcode = 'P0002';
  end if;

  if accept_request then
    perform 1
    from public.profiles
    where id in (caller_id, request_row.requester_id)
    order by id
    for update;

    insert into public.friendships (user_one_id, user_two_id)
    values (
      least(caller_id, request_row.requester_id),
      greatest(caller_id, request_row.requester_id)
    )
    on conflict do nothing;

    delete from public.friend_requests
    where (requester_id = caller_id and recipient_id = request_row.requester_id)
       or (requester_id = request_row.requester_id and recipient_id = caller_id);

    return 'friends';
  end if;

  delete from public.friend_requests where id = request_row.id;
  return 'declined';
end;
$$;

create or replace function public.remove_friend(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.friend_aliases
  where (owner_id = caller_id and friend_id = target_user)
     or (owner_id = target_user and friend_id = caller_id);

  delete from public.battle_invite_blocks
  where (blocker_id = caller_id and blocked_user_id = target_user)
     or (blocker_id = target_user and blocked_user_id = caller_id);

  delete from public.friendships
  where user_one_id = least(caller_id, target_user)
    and user_two_id = greatest(caller_id, target_user);
end;
$$;

create or replace function public.set_friend_alias(target_user uuid, new_alias text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_alias text := nullif(btrim(new_alias), '');
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not private.are_friends(caller_id, target_user) then
    raise exception 'Accepted friendship required' using errcode = '42501';
  end if;

  if clean_alias is not null and char_length(clean_alias) > 20 then
    raise exception 'Friend alias must be 20 characters or fewer' using errcode = '23514';
  end if;

  if clean_alias is null then
    delete from public.friend_aliases
    where owner_id = caller_id and friend_id = target_user;
    return '';
  end if;

  insert into public.friend_aliases (owner_id, friend_id, alias)
  values (caller_id, target_user, clean_alias)
  on conflict (owner_id, friend_id) do update
  set alias = excluded.alias;

  return clean_alias;
end;
$$;

create or replace function public.set_battle_invite_block(
  target_user uuid,
  blocked boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not private.are_friends(caller_id, target_user) then
    raise exception 'Accepted friendship required' using errcode = '42501';
  end if;

  if blocked then
    insert into public.battle_invite_blocks (blocker_id, blocked_user_id)
    values (caller_id, target_user)
    on conflict do nothing;
  else
    delete from public.battle_invite_blocks
    where blocker_id = caller_id and blocked_user_id = target_user;
  end if;

  return blocked;
end;
$$;

-- Activity writes are throttled at the database boundary. Hidden activity is
-- still recorded for the owner but never disclosed by social read contracts.
create or replace function public.touch_my_activity()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.profiles
  set last_online_at = now()
  where id = auth.uid()
    and (last_online_at is null or last_online_at < now() - interval '2 minutes')
  returning last_online_at into touched_at;

  if touched_at is null then
    select last_online_at into touched_at
    from public.profiles
    where id = auth.uid();
  end if;

  return touched_at;
end;
$$;

revoke all on function public.search_players(text, integer) from public;
revoke all on function public.get_my_friends(text, text, integer, integer) from public;
revoke all on function public.get_my_incoming_friend_requests() from public;
revoke all on function public.get_my_pending_friend_request_count() from public;
revoke all on function public.send_friend_request(text) from public;
revoke all on function public.cancel_friend_request(uuid) from public;
revoke all on function public.respond_to_friend_request(uuid, boolean) from public;
revoke all on function public.remove_friend(uuid) from public;
revoke all on function public.set_friend_alias(uuid, text) from public;
revoke all on function public.set_battle_invite_block(uuid, boolean) from public;

grant execute on function public.search_players(text, integer) to authenticated;
grant execute on function public.get_my_friends(text, text, integer, integer) to authenticated;
grant execute on function public.get_my_incoming_friend_requests() to authenticated;
grant execute on function public.get_my_pending_friend_request_count() to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.set_friend_alias(uuid, text) to authenticated;
grant execute on function public.set_battle_invite_block(uuid, boolean) to authenticated;

