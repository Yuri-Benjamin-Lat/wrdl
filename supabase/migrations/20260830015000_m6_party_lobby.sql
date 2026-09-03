-- M6: authoritative reusable party lobby, initial Ready flow, invitations, and
-- host controls. Between-round flow belongs to battles (M7/M8) and has no Ready
-- state; this party Ready state exists only before a new battle begins.

create type public.party_phase as enum (
  'lobby',
  'match_starting',
  'active',
  'battle_complete'
);

alter table public.user_settings
  add column preferred_battle_rounds integer not null default 3,
  add column preferred_battle_timer_seconds integer not null default 180,
  add constraint user_settings_battle_rounds check (preferred_battle_rounds in (1, 3, 5)),
  add constraint user_settings_battle_timer check (
    preferred_battle_timer_seconds between 60 and 600
    and preferred_battle_timer_seconds % 30 = 0
  );

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references public.profiles (id) on delete set null,
  phase public.party_phase not null default 'lobby',
  rounds_configured integer not null,
  round_timer_seconds integer not null,
  state_version bigint not null default 1,
  next_join_order integer not null default 2,
  start_deadline timestamptz,
  active_battle_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parties_rounds check (rounds_configured in (1, 3, 5)),
  constraint parties_timer check (
    round_timer_seconds between 60 and 600 and round_timer_seconds % 30 = 0
  ),
  constraint parties_version_positive check (state_version >= 1),
  constraint parties_join_order_positive check (next_join_order >= 2),
  constraint parties_start_deadline_state check (
    (phase = 'match_starting' and start_deadline is not null)
    or (phase <> 'match_starting' and start_deadline is null)
  )
);

create trigger parties_set_updated_at
before update on public.parties
for each row execute function public.set_updated_at();

create table public.party_members (
  party_id uuid not null references public.parties (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  join_order integer not null,
  is_ready boolean not null default false,
  returned_to_lobby boolean not null default true,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (party_id, user_id),
  unique (user_id),
  unique (party_id, join_order),
  constraint party_members_join_order_positive check (join_order >= 1)
);

create table public.party_invitations (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (party_id, recipient_id),
  constraint party_invitations_distinct_players check (inviter_id <> recipient_id)
);

create index party_invitations_recipient_newest
  on public.party_invitations (recipient_id, created_at desc);

create table public.party_invitation_declines (
  id bigint generated always as identity primary key,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  declined_at timestamptz not null default now(),
  constraint party_invitation_declines_distinct check (inviter_id <> recipient_id)
);

create index party_invitation_declines_recent
  on public.party_invitation_declines (recipient_id, inviter_id, declined_at desc);

create table public.party_invitation_mutes (
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  muted_until timestamptz not null,
  primary key (recipient_id, inviter_id),
  constraint party_invitation_mutes_distinct check (recipient_id <> inviter_id)
);

create table public.party_removal_notices (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  party_id uuid not null,
  removed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.party_invitations enable row level security;
alter table public.party_invitation_declines enable row level security;
alter table public.party_invitation_mutes enable row level security;
alter table public.party_removal_notices enable row level security;

revoke all on public.parties from public, anon, authenticated;
revoke all on public.party_members from public, anon, authenticated;
revoke all on public.party_invitations from public, anon, authenticated;
revoke all on public.party_invitation_declines from public, anon, authenticated;
revoke all on public.party_invitation_mutes from public, anon, authenticated;
revoke all on public.party_removal_notices from public, anon, authenticated;

create or replace function private.party_snapshot(viewer_id uuid, target_party_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  party_row public.parties;
  member_count integer;
  ready_count integer;
  members jsonb;
begin
  if not exists (
    select 1 from public.party_members
    where party_id = target_party_id and user_id = viewer_id
  ) then
    raise exception 'Party membership required' using errcode = '42501';
  end if;

  select * into party_row from public.parties where id = target_party_id;
  if party_row.id is null then return null; end if;

  select count(*)::integer, (count(*) filter (where is_ready))::integer
  into member_count, ready_count
  from public.party_members
  where party_id = target_party_id;

  select coalesce(jsonb_agg(
    private.social_player_json(viewer_id, member.user_id)
      || jsonb_build_object(
        'joinOrder', member.join_order,
        'ready', member.is_ready,
        'returnedToLobby', member.returned_to_lobby,
        'isHost', member.user_id = party_row.host_id
      )
    order by member.join_order
  ), '[]'::jsonb)
  into members
  from public.party_members as member
  where member.party_id = target_party_id;

  return jsonb_build_object(
    'id', party_row.id,
    'phase', party_row.phase,
    'hostId', party_row.host_id,
    'isHost', viewer_id = party_row.host_id,
    'rounds', party_row.rounds_configured,
    'roundTimerSeconds', party_row.round_timer_seconds,
    'stateVersion', party_row.state_version,
    'startDeadline', party_row.start_deadline,
    'activeBattleId', party_row.active_battle_id,
    'memberCount', member_count,
    'readyCount', ready_count,
    'members', members
  );
end;
$$;

create or replace function private.reassign_or_close_party(
  target_party_id uuid,
  departing_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  party_row public.parties;
  next_host uuid;
begin
  select * into party_row from public.parties where id = target_party_id for update;
  if party_row.id is null then return; end if;

  delete from public.party_members
  where party_id = target_party_id and user_id = departing_user_id;

  if not exists (select 1 from public.party_members where party_id = target_party_id) then
    delete from public.parties where id = target_party_id;
    return;
  end if;

  if party_row.host_id = departing_user_id or party_row.host_id is null then
    select user_id into next_host
    from public.party_members
    where party_id = target_party_id
    order by join_order
    limit 1;

    update public.parties
    set host_id = next_host,
        state_version = state_version + 1
    where id = target_party_id;
  else
    update public.parties
    set state_version = state_version + 1
    where id = target_party_id;
  end if;
end;
$$;

create or replace function public.create_party(
  requested_rounds integer default null,
  requested_timer_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  existing_party uuid;
  new_party uuid;
  selected_rounds integer;
  selected_timer integer;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));

  select party_id into existing_party
  from public.party_members where user_id = caller_id;
  if existing_party is not null then
    return private.party_snapshot(caller_id, existing_party);
  end if;

  select
    coalesce(requested_rounds, preferred_battle_rounds),
    coalesce(requested_timer_seconds, preferred_battle_timer_seconds)
  into selected_rounds, selected_timer
  from public.user_settings where user_id = caller_id;

  if selected_rounds not in (1, 3, 5) then
    raise exception 'Rounds must be 1, 3, or 5' using errcode = '22023';
  end if;
  if selected_timer not between 60 and 600 or selected_timer % 30 <> 0 then
    raise exception 'Round timer must be 1–10 minutes in 30-second increments'
      using errcode = '22023';
  end if;

  insert into public.parties (host_id, rounds_configured, round_timer_seconds)
  values (caller_id, selected_rounds, selected_timer)
  returning id into new_party;

  insert into public.party_members (party_id, user_id, join_order)
  values (new_party, caller_id, 1);

  delete from public.party_removal_notices where user_id = caller_id;

  return private.party_snapshot(caller_id, new_party);
end;
$$;

create or replace function public.get_my_party()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_party uuid;
  notice jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select party_id into target_party
  from public.party_members where user_id = caller_id;

  if target_party is not null then
    update public.party_members set last_seen_at = now()
    where party_id = target_party and user_id = caller_id;
    return jsonb_build_object(
      'party', private.party_snapshot(caller_id, target_party),
      'removed', false
    );
  end if;

  delete from public.party_removal_notices
  where user_id = caller_id
  returning jsonb_build_object('partyId', party_id, 'removedAt', created_at)
  into notice;

  return jsonb_build_object(
    'party', null,
    'removed', notice is not null,
    'removal', notice
  );
end;
$$;

create or replace function public.update_party_settings(
  new_rounds integer,
  new_timer_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  party_row public.parties;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if new_rounds not in (1, 3, 5) then
    raise exception 'Rounds must be 1, 3, or 5' using errcode = '22023';
  end if;
  if new_timer_seconds not between 60 and 600 or new_timer_seconds % 30 <> 0 then
    raise exception 'Round timer must be 1–10 minutes in 30-second increments'
      using errcode = '22023';
  end if;

  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id
  for update of party;

  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;
  if party_row.host_id <> caller_id then raise exception 'Host control required' using errcode = '42501'; end if;
  if party_row.phase <> 'lobby' then raise exception 'Party settings are locked' using errcode = '55000'; end if;

  update public.parties
  set rounds_configured = new_rounds,
      round_timer_seconds = new_timer_seconds,
      state_version = state_version + 1
  where id = party_row.id;

  update public.user_settings
  set preferred_battle_rounds = new_rounds,
      preferred_battle_timer_seconds = new_timer_seconds
  where user_id = caller_id;

  return private.party_snapshot(caller_id, party_row.id);
end;
$$;

create or replace function public.set_party_ready(new_ready boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  party_row public.parties;
  total_members integer;
  all_ready boolean;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id
  for update of party;

  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;
  if party_row.phase <> 'lobby' then raise exception 'Ready controls are locked' using errcode = '55000'; end if;

  update public.party_members set is_ready = new_ready
  where party_id = party_row.id and user_id = caller_id;

  select count(*)::integer, bool_and(is_ready)
  into total_members, all_ready
  from public.party_members where party_id = party_row.id;

  if new_ready and total_members >= 2 and all_ready then
    update public.parties
    set phase = 'match_starting',
        start_deadline = clock_timestamp() + interval '3 seconds',
        state_version = state_version + 1
    where id = party_row.id;
    delete from public.party_invitations where party_id = party_row.id;
  else
    update public.parties set state_version = state_version + 1
    where id = party_row.id;
  end if;

  return private.party_snapshot(caller_id, party_row.id);
end;
$$;

create or replace function public.transfer_party_host(new_host_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  party_row public.parties;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id
  for update of party;
  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;
  if party_row.host_id <> caller_id then raise exception 'Host control required' using errcode = '42501'; end if;
  if party_row.phase <> 'lobby' then raise exception 'Host transfer is locked' using errcode = '55000'; end if;
  if not exists (
    select 1 from public.party_members
    where party_id = party_row.id and user_id = new_host_id
  ) then raise exception 'Player is not in this party' using errcode = 'P0002'; end if;

  update public.parties
  set host_id = new_host_id, state_version = state_version + 1
  where id = party_row.id;
  return private.party_snapshot(caller_id, party_row.id);
end;
$$;

create or replace function public.remove_party_member(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  party_row public.parties;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id
  for update of party;
  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;
  if party_row.host_id <> caller_id then raise exception 'Host control required' using errcode = '42501'; end if;
  if party_row.phase <> 'lobby' then raise exception 'Player removal is locked' using errcode = '55000'; end if;
  if target_user_id = caller_id then raise exception 'Use Leave Lobby' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.party_members
    where party_id = party_row.id and user_id = target_user_id
  ) then raise exception 'Player is not in this party' using errcode = 'P0002'; end if;

  delete from public.party_members
  where party_id = party_row.id and user_id = target_user_id;
  insert into public.party_removal_notices (user_id, party_id, removed_by)
  values (target_user_id, party_row.id, caller_id)
  on conflict (user_id) do update
  set party_id = excluded.party_id, removed_by = excluded.removed_by, created_at = now();
  update public.parties set state_version = state_version + 1 where id = party_row.id;
  return private.party_snapshot(caller_id, party_row.id);
end;
$$;

create or replace function public.leave_party()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  party_row public.parties;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id
  for update of party;
  if party_row.id is null then return; end if;
  if party_row.phase <> 'lobby' then raise exception 'Leaving is locked while the match starts' using errcode = '55000'; end if;
  perform private.reassign_or_close_party(party_row.id, caller_id);
end;
$$;

revoke all on function private.party_snapshot(uuid, uuid) from public;
revoke all on function private.reassign_or_close_party(uuid, uuid) from public;
revoke all on function public.create_party(integer, integer) from public;
revoke all on function public.get_my_party() from public;
revoke all on function public.update_party_settings(integer, integer) from public;
revoke all on function public.set_party_ready(boolean) from public;
revoke all on function public.transfer_party_host(uuid) from public;
revoke all on function public.remove_party_member(uuid) from public;
revoke all on function public.leave_party() from public;

grant execute on function public.create_party(integer, integer) to authenticated;
grant execute on function public.get_my_party() to authenticated;
grant execute on function public.update_party_settings(integer, integer) to authenticated;
grant execute on function public.set_party_ready(boolean) to authenticated;
grant execute on function public.transfer_party_host(uuid) to authenticated;
grant execute on function public.remove_party_member(uuid) to authenticated;
grant execute on function public.leave_party() to authenticated;
