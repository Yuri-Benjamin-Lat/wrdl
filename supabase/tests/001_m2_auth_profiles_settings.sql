-- Run against the hosted development project after migrations are applied.
-- These checks are read-only and fail loudly if the M2 security surface is incomplete.

do $$
begin
  assert to_regclass('public.profiles') is not null, 'profiles table is missing';
  assert to_regclass('public.user_settings') is not null, 'user_settings table is missing';
  assert to_regclass('public.username_reservations') is not null,
    'username_reservations table is missing';
  assert exists (select 1 from storage.buckets where id = 'avatars' and public = false),
    'private avatars bucket is missing';
  assert (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
    'profiles RLS is disabled';
  assert (select relrowsecurity from pg_class where oid = 'public.user_settings'::regclass),
    'user_settings RLS is disabled';
  assert has_function_privilege(
    'authenticated',
    'public.complete_my_profile(text)',
    'EXECUTE'
  ), 'authenticated cannot complete profiles';
  assert not has_table_privilege('anon', 'public.profiles', 'SELECT'),
    'anonymous users can read profiles';
  assert not has_table_privilege('authenticated', 'public.profiles', 'SELECT'),
    'authenticated users have unrestricted profile-column access';
  assert not has_column_privilege('authenticated', 'public.profiles', 'last_online_at', 'SELECT'),
    'private activity timestamps are directly readable';
  assert has_function_privilege('authenticated', 'public.get_visible_profile(text)', 'EXECUTE'),
    'privacy-aware profile reads are unavailable';
  assert not has_table_privilege(
    'authenticated',
    'public.username_reservations',
    'SELECT'
  ), 'username reservations are exposed';
end;
$$;
