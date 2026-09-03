-- Qualify the original-party identifier used by the M7 Continue transaction.

create or replace function public.continue_from_battle()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  battle_row public.battles;
  target_party_id uuid;
  everyone_returned boolean;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select battle.* into battle_row
  from public.battles as battle
  join public.battle_members as member on member.battle_id = battle.id
  where member.user_id = caller_id and member.continued_at is null
  order by battle.created_at desc limit 1
  for update of battle;
  if battle_row.id is null then raise exception 'Battle not found' using errcode = 'P0002'; end if;
  if battle_row.phase not in ('battle_complete', 'voided') then
    raise exception 'Battle is not complete' using errcode = '55000';
  end if;
  target_party_id := battle_row.party_id;

  update public.battle_members
  set continued_at = clock_timestamp()
  where battle_id = battle_row.id and user_id = caller_id;
  update public.party_members
  set returned_to_lobby = true,
      is_ready = false,
      last_seen_at = clock_timestamp()
  where party_members.party_id = target_party_id and user_id = caller_id;

  select bool_and(returned_to_lobby) into everyone_returned
  from public.party_members where party_members.party_id = target_party_id;

  update public.parties
  set phase = 'lobby',
      active_battle_id = case when everyone_returned then null else active_battle_id end,
      start_deadline = null,
      state_version = state_version + 1
  where id = target_party_id;

  return private.party_snapshot(caller_id, target_party_id);
end;
$$;

revoke all on function public.continue_from_battle() from public;
grant execute on function public.continue_from_battle() to authenticated;
