-- M2 hardening: avoid exposing private activity/cooldown columns through direct
-- profile reads and provide privacy-aware account/profile operations.

revoke select on public.profiles from authenticated;

grant select (
  id,
  username,
  username_key,
  display_name,
  bio,
  avatar_path,
  level,
  experience,
  current_streak,
  created_at,
  updated_at
) on public.profiles to authenticated;

create or replace function public.get_my_profile()
returns public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.get_visible_profile(target_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_path text,
  level integer,
  experience integer,
  current_streak integer,
  last_online_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_path,
    p.level,
    p.experience,
    p.current_streak,
    case when s.activity_visible then p.last_online_at else null end
  from public.profiles p
  join public.user_settings s on s.user_id = p.id
  where p.username_key = lower(target_username)
    and p.username is not null
    and auth.uid() is not null;
$$;

create or replace function public.touch_my_activity()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.profiles
  set last_online_at = touched_at
  where id = auth.uid();

  return touched_at;
end;
$$;

revoke all on function public.get_my_profile() from public;
revoke all on function public.get_visible_profile(text) from public;
revoke all on function public.touch_my_activity() from public;

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.get_visible_profile(text) to authenticated;
grant execute on function public.touch_my_activity() to authenticated;
