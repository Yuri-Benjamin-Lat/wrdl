-- If the next milestone's battle creator does not claim a completed lobby
-- countdown, release the party instead of trapping members in Match Starting.
-- M7 will claim the party before this recovery window elapses.

create or replace function private.repair_unclaimed_party_start(target_party_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.parties
    where id = target_party_id
      and phase = 'match_starting'
      and active_battle_id is null
      and start_deadline < now() - interval '10 seconds'
    for update
  ) then
    update public.party_members set is_ready = false
    where party_id = target_party_id;
    update public.parties
    set phase = 'lobby',
        start_deadline = null,
        state_version = state_version + 1
    where id = target_party_id;
  end if;
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
    perform private.repair_unclaimed_party_start(target_party);
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

revoke all on function private.repair_unclaimed_party_start(uuid) from public;

