-- A lobby Ready choice is valid only for the membership that existed when it
-- was made. Leaving or removing a player cancels Ready for everyone remaining.

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

  update public.party_members
  set is_ready = false
  where party_id = target_party_id and is_ready;

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

  update public.party_members
  set is_ready = false
  where party_id = party_row.id and is_ready;

  insert into public.party_removal_notices (user_id, party_id, removed_by)
  values (target_user_id, party_row.id, caller_id)
  on conflict (user_id) do update
  set party_id = excluded.party_id, removed_by = excluded.removed_by, created_at = now();
  update public.parties set state_version = state_version + 1 where id = party_row.id;
  return private.party_snapshot(caller_id, party_row.id);
end;
$$;

revoke all on function private.reassign_or_close_party(uuid, uuid) from public;
revoke all on function public.remove_party_member(uuid) from public;
grant execute on function public.remove_party_member(uuid) to authenticated;
