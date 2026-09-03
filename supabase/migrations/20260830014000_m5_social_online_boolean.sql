-- Keep the social-player JSON contract type-stable for accounts that have not
-- published activity yet. SQL boolean expressions involving a null timestamp
-- otherwise return null instead of the required false value.

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
    'online', coalesce(
      setting.activity_visible
        and profile.last_online_at >= now() - interval '5 minutes',
      false
    ),
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

revoke all on function private.social_player_json(uuid, uuid) from public, anon, authenticated;

