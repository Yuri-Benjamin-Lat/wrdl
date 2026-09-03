-- M6: private Realtime authorization, minimal change signals, and account-delete
-- host transfer. Realtime carries only "changed" signals; clients always reload
-- the authoritative snapshot through approved RPCs.

create or replace function private.can_receive_party_topic(
  topic_name text,
  viewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer_id is not null
    and topic_name ~ '^party:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and exists (
      select 1 from public.party_members
      where user_id = viewer_id
        and party_id = split_part(topic_name, ':', 2)::uuid
    );
$$;

create or replace function private.can_receive_user_topic(
  topic_name text,
  viewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer_id is not null and topic_name = 'user:' || viewer_id::text;
$$;

create policy wrdl_private_realtime_receive
on realtime.messages
for select
to authenticated
using (
  private.can_receive_party_topic(realtime.topic(), auth.uid())
  or private.can_receive_user_topic(realtime.topic(), auth.uid())
);

create or replace function private.signal_party_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_party uuid := case when tg_op = 'DELETE' then old.party_id else new.party_id end;
begin
  perform realtime.send(
    jsonb_build_object('partyId', target_party),
    'party_changed',
    'party:' || target_party::text,
    true
  );
  return coalesce(new, old);
end;
$$;

create trigger party_members_signal_change
after insert or update or delete on public.party_members
for each row execute function private.signal_party_change();

create or replace function private.signal_party_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_party uuid := case when tg_op = 'DELETE' then old.id else new.id end;
begin
  perform realtime.send(
    jsonb_build_object('partyId', target_party),
    'party_changed',
    'party:' || target_party::text,
    true
  );
  return coalesce(new, old);
end;
$$;

create trigger parties_signal_change
after update or delete on public.parties
for each row execute function private.signal_party_row_change();

create or replace function private.signal_invitation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_party uuid := case when tg_op = 'DELETE' then old.party_id else new.party_id end;
  target_user uuid := case when tg_op = 'DELETE' then old.recipient_id else new.recipient_id end;
begin
  perform realtime.send(
    jsonb_build_object('partyId', target_party),
    'party_changed',
    'party:' || target_party::text,
    true
  );
  perform realtime.send(
    jsonb_build_object('partyId', target_party),
    'invitations_changed',
    'user:' || target_user::text,
    true
  );
  return coalesce(new, old);
end;
$$;

create trigger party_invitations_signal_change
after insert or delete on public.party_invitations
for each row execute function private.signal_invitation_change();

create or replace function private.signal_removal_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('partyId', new.party_id),
    'party_removed',
    'user:' || new.user_id::text,
    true
  );
  return new;
end;
$$;

create trigger party_removal_notices_signal
after insert or update on public.party_removal_notices
for each row execute function private.signal_removal_notice();

create or replace function private.leave_party_before_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_party uuid;
begin
  select party_id into target_party
  from public.party_members where user_id = old.id;
  if target_party is not null then
    perform private.reassign_or_close_party(target_party, old.id);
  end if;
  return old;
end;
$$;

create trigger profiles_leave_party_before_delete
before delete on public.profiles
for each row execute function private.leave_party_before_profile_delete();

revoke all on function private.can_receive_party_topic(text, uuid) from public;
revoke all on function private.can_receive_user_topic(text, uuid) from public;
revoke all on function private.signal_party_change() from public;
revoke all on function private.signal_party_row_change() from public;
revoke all on function private.signal_invitation_change() from public;
revoke all on function private.signal_removal_notice() from public;
revoke all on function private.leave_party_before_profile_delete() from public;
