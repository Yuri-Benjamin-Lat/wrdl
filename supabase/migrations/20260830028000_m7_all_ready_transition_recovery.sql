-- M7 acceptance correction: recover a Party that carries a terminal Battle
-- reference into Match Starting, and make an idempotent Ready(true) call repair
-- an all-ready Lobby instead of returning before the start transition.

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
  all_ready boolean := false;
  caller_ready boolean;
  prior_battle_phase public.battle_phase;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id
  for update of party;

  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;
  if party_row.phase <> 'lobby' then raise exception 'Ready controls are locked' using errcode = '55000'; end if;

  select is_ready into caller_ready from public.party_members
  where party_id = party_row.id and user_id = caller_id;

  select count(*)::integer into total_members
  from public.party_members where party_id = party_row.id;
  if new_ready and total_members < 2 then
    raise exception 'At least two players are required to get Ready' using errcode = '55000';
  end if;
  if new_ready and exists (
    select 1 from public.party_members
    where party_id = party_row.id and not returned_to_lobby
  ) then
    raise exception 'Wait for every player to return to the lobby' using errcode = '55000';
  end if;

  if caller_ready <> new_ready then
    update public.party_members set is_ready = new_ready
    where party_id = party_row.id and user_id = caller_id;
  elsif not new_ready then
    return private.party_snapshot(caller_id, party_row.id);
  end if;

  if new_ready then
    select bool_and(is_ready) into all_ready
    from public.party_members where party_id = party_row.id;
  end if;

  if all_ready then
    if party_row.active_battle_id is not null then
      select phase into prior_battle_phase
      from public.battles where id = party_row.active_battle_id;
      if prior_battle_phase not in ('battle_complete', 'voided') then
        raise exception 'The previous battle is still active' using errcode = '55000';
      end if;
    end if;

    update public.parties
    set phase = 'match_starting',
        active_battle_id = null,
        start_deadline = clock_timestamp() + interval '30 seconds',
        state_version = state_version + 1
    where id = party_row.id;
    delete from public.party_invitations where party_id = party_row.id;
    if total_members = 2 then perform private.create_two_player_battle(party_row.id); end if;
  elsif caller_ready <> new_ready then
    update public.parties set state_version = state_version + 1 where id = party_row.id;
  end if;

  return private.party_snapshot(caller_id, party_row.id);
end;
$$;

revoke all on function public.set_party_ready(boolean) from public;
grant execute on function public.set_party_ready(boolean) to authenticated;

-- Repair only the authenticated player's own Party. This avoids a deployment
-- changing unrelated live lobbies while still allowing a client to recover a
-- missed all-ready transition or a stale terminal Battle reference.
create or replace function public.recover_my_party_start()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  party_row public.parties;
  referenced_battle_phase public.battle_phase;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id
  for update of party;

  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;

  if party_row.phase = 'match_starting' then
    if party_row.active_battle_id is null then
      perform private.repair_unclaimed_party_start(party_row.id);
    else
      select phase into referenced_battle_phase
      from public.battles where id = party_row.active_battle_id;

      if referenced_battle_phase is null
         or referenced_battle_phase in ('battle_complete', 'voided') then
        update public.party_members
        set is_ready = false
        where party_id = party_row.id;

        update public.parties
        set phase = 'lobby',
            active_battle_id = null,
            start_deadline = null,
            state_version = state_version + 1
        where id = party_row.id;
      end if;
    end if;
  end if;

  return private.party_snapshot(caller_id, party_row.id);
end;
$$;

revoke all on function public.recover_my_party_start() from public;
grant execute on function public.recover_my_party_start() to authenticated;
