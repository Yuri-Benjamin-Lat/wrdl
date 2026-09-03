-- A one-person lobby cannot enter Ready. The UI mirrors this rule, while the
-- command remains authoritative against stale clients and direct RPC calls.

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

  select count(*)::integer into total_members
  from public.party_members where party_id = party_row.id;
  if new_ready and total_members < 2 then
    raise exception 'At least two players are required to get Ready' using errcode = '55000';
  end if;

  update public.party_members set is_ready = new_ready
  where party_id = party_row.id and user_id = caller_id;

  select bool_and(is_ready) into all_ready
  from public.party_members where party_id = party_row.id;

  if new_ready and all_ready then
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

revoke all on function public.set_party_ready(boolean) from public;
grant execute on function public.set_party_ready(boolean) to authenticated;
