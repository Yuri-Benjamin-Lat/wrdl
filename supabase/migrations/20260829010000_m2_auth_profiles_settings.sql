-- M2: Google-authenticated WRDL profiles, account-synced settings, avatars,
-- username lifecycle, and self-service account deletion.

create type public.wrdl_theme as enum ('system', 'light', 'dark');
create type public.wrdl_audience as enum ('public', 'friends', 'none');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  username_key text generated always as (lower(username)) stored,
  display_name text,
  bio text,
  avatar_path text,
  level integer not null default 1,
  experience integer not null default 0,
  current_streak integer not null default 0,
  daily_eligibility_date date not null default ((now() at time zone 'Asia/Manila')::date),
  username_changed_at timestamptz,
  last_online_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username is null or (char_length(username) between 1 and 20 and username ~ '^[A-Za-z0-9]+$')
  ),
  constraint profiles_display_name_format check (
    display_name is null or (char_length(display_name) between 1 and 20 and display_name ~ '^[A-Za-z0-9]+$')
  ),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 60),
  constraint profiles_level_positive check (level >= 1),
  constraint profiles_experience_nonnegative check (experience >= 0),
  constraint profiles_streak_nonnegative check (current_streak >= 0),
  constraint profiles_avatar_owner_path check (
    avatar_path is null or avatar_path like id::text || '/%'
  )
);

create unique index profiles_username_key_unique
  on public.profiles (username_key)
  where username_key is not null;

create index profiles_username_search on public.profiles (username_key text_pattern_ops);
create index profiles_streak_ranking on public.profiles (current_streak desc, username_key);

create table public.username_reservations (
  username_key text primary key,
  former_owner uuid,
  reserved_until timestamptz not null,
  created_at timestamptz not null default now(),
  constraint username_reservations_key_format check (
    char_length(username_key) between 1 and 20 and username_key ~ '^[a-z0-9]+$'
  )
);

create index username_reservations_expiry on public.username_reservations (reserved_until);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sound_enabled boolean not null default true,
  theme public.wrdl_theme not null default 'system',
  high_contrast_tiles boolean not null default false,
  daily_history_audience public.wrdl_audience not null default 'public',
  statistics_audience public.wrdl_audience not null default 'public',
  battle_history_audience public.wrdl_audience not null default 'public',
  activity_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

insert into public.user_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.username_is_available(candidate text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized text := lower(candidate);
begin
  if candidate is null
    or char_length(candidate) not between 1 and 20
    or candidate !~ '^[A-Za-z0-9]+$' then
    return false;
  end if;

  return not exists (
    select 1 from public.profiles where username_key = normalized
  ) and not exists (
    select 1
    from public.username_reservations
    where username_key = normalized and reserved_until > now()
  );
end;
$$;

create or replace function public.complete_my_profile(candidate text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  result public.profiles;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.username_is_available(candidate) then
    raise exception 'Username is unavailable' using errcode = '23505';
  end if;

  update public.profiles
  set username = candidate,
      username_changed_at = now()
  where id = caller_id and username is null
  returning * into result;

  if result.id is null then
    raise exception 'Profile setup is already complete' using errcode = '23514';
  end if;

  return result;
exception
  when unique_violation then
    raise exception 'Username is unavailable' using errcode = '23505';
end;
$$;

create or replace function public.change_my_username(candidate text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_profile public.profiles;
  result public.profiles;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into current_profile
  from public.profiles
  where id = caller_id
  for update;

  if current_profile.username is null then
    raise exception 'Complete account setup first' using errcode = '23514';
  end if;

  if current_profile.username_changed_at > now() - interval '90 days' then
    raise exception 'Username can only be changed every 90 days' using errcode = '23514';
  end if;

  if lower(candidate) = current_profile.username_key then
    raise exception 'Choose a different username' using errcode = '23514';
  end if;

  if not public.username_is_available(candidate) then
    raise exception 'Username is unavailable' using errcode = '23505';
  end if;

  insert into public.username_reservations (username_key, former_owner, reserved_until)
  values (current_profile.username_key, caller_id, now() + interval '30 days')
  on conflict (username_key) do update
  set former_owner = excluded.former_owner,
      reserved_until = excluded.reserved_until,
      created_at = now();

  update public.profiles
  set username = candidate,
      username_changed_at = now()
  where id = caller_id
  returning * into result;

  return result;
exception
  when unique_violation then
    raise exception 'Username is unavailable' using errcode = '23505';
end;
$$;

create or replace function public.update_my_profile(new_display_name text, new_bio text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_display_name text := nullif(btrim(new_display_name), '');
  clean_bio text := nullif(btrim(new_bio), '');
  result public.profiles;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if clean_display_name is not null and (
    char_length(clean_display_name) not between 1 and 20
    or clean_display_name !~ '^[A-Za-z0-9]+$'
  ) then
    raise exception 'Display name must be 1-20 letters or numbers' using errcode = '23514';
  end if;

  if clean_bio is not null and char_length(clean_bio) > 60 then
    raise exception 'Bio must be 60 characters or fewer' using errcode = '23514';
  end if;

  update public.profiles
  set display_name = clean_display_name,
      bio = clean_bio
  where id = caller_id and username is not null
  returning * into result;

  if result.id is null then
    raise exception 'Complete account setup first' using errcode = '23514';
  end if;

  return result;
end;
$$;

create or replace function public.set_my_avatar(new_avatar_path text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  result public.profiles;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if new_avatar_path is not null and new_avatar_path not like caller_id::text || '/%' then
    raise exception 'Invalid avatar path' using errcode = '23514';
  end if;

  update public.profiles
  set avatar_path = new_avatar_path
  where id = caller_id
  returning * into result;

  return result;
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  issued_at bigint := coalesce((auth.jwt() ->> 'iat')::bigint, 0);
  old_username_key text;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if extract(epoch from now())::bigint - issued_at > 600 then
    raise exception 'Recent Google authentication required' using errcode = '42501';
  end if;

  select username_key into old_username_key
  from public.profiles
  where id = caller_id
  for update;

  if old_username_key is not null then
    insert into public.username_reservations (username_key, former_owner, reserved_until)
    values (old_username_key, null, now() + interval '30 days')
    on conflict (username_key) do update
    set former_owner = null,
        reserved_until = excluded.reserved_until,
        created_at = now();
  end if;

  delete from auth.users where id = caller_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.username_reservations enable row level security;

create policy profiles_authenticated_read
on public.profiles
for select
to authenticated
using (username is not null or id = (select auth.uid()));

create policy settings_owner_read
on public.user_settings
for select
to authenticated
using (user_id = (select auth.uid()));

create policy settings_owner_update
on public.user_settings
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on public.profiles from anon, authenticated;
revoke all on public.user_settings from anon, authenticated;
revoke all on public.username_reservations from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.user_settings to authenticated;
grant update (
  sound_enabled,
  theme,
  high_contrast_tiles,
  daily_history_audience,
  statistics_audience,
  battle_history_audience,
  activity_visible
) on public.user_settings to authenticated;

revoke all on function public.username_is_available(text) from public;
revoke all on function public.complete_my_profile(text) from public;
revoke all on function public.change_my_username(text) from public;
revoke all on function public.update_my_profile(text, text) from public;
revoke all on function public.set_my_avatar(text) from public;
revoke all on function public.delete_my_account() from public;

grant execute on function public.username_is_available(text) to authenticated;
grant execute on function public.complete_my_profile(text) to authenticated;
grant execute on function public.change_my_username(text) to authenticated;
grant execute on function public.update_my_profile(text, text) to authenticated;
grant execute on function public.set_my_avatar(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy avatar_authenticated_read
on storage.objects
for select
to authenticated
using (bucket_id = 'avatars');

create policy avatar_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and owner_id = (select auth.uid())::text
);

create policy avatar_owner_update
on storage.objects
for update
to authenticated
using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and owner_id = (select auth.uid())::text
);

create policy avatar_owner_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text);
