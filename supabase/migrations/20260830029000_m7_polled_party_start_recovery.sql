-- Make the existing one-second Party poll self-heal a missed all-ready start.
-- Recovery remains limited to the authenticated caller's own Party.

create or replace function public.get_my_party()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_party uuid;
  target_phase public.party_phase;
  total_members integer;
  all_ready boolean := false;
  party_data jsonb;
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

    select phase into target_phase
    from public.parties where id = target_party;

    if target_phase = 'lobby' then
      select count(*)::integer, coalesce(bool_and(is_ready), false)
      into total_members, all_ready
      from public.party_members where party_id = target_party;

      if total_members >= 2 and all_ready then
        party_data := public.set_party_ready(true);
      else
        party_data := private.party_snapshot(caller_id, target_party);
      end if;
    elsif target_phase = 'match_starting' then
      party_data := public.recover_my_party_start();
    else
      party_data := private.party_snapshot(caller_id, target_party);
    end if;

    return jsonb_build_object(
      'party', party_data,
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

revoke all on function public.get_my_party() from public;
grant execute on function public.get_my_party() to authenticated;
