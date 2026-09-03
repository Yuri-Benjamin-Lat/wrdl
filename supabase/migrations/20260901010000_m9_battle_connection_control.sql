-- M9: opening an active battle is read-only until the tab either owns the
-- current connection or explicitly transfers control with Continue here.

create or replace function public.open_my_battle_connection(new_connection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_battle uuid;
  battle_phase public.battle_phase;
  member_row public.battle_members;
  connection_status text;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if new_connection_id is null then
    raise exception 'Connection identifier required' using errcode = '23514';
  end if;

  select member.battle_id into target_battle
  from public.battle_members as member
  join public.battles as battle on battle.id = member.battle_id
  where member.user_id = caller_id and member.continued_at is null
  order by battle.created_at desc
  limit 1;

  if target_battle is null then
    return jsonb_build_object('status', 'unavailable', 'battle', null);
  end if;

  select phase into battle_phase
  from public.battles
  where id = target_battle;

  if battle_phase not in ('battle_complete', 'voided') then
    perform private.repair_multi_player_battle(target_battle);
  end if;

  select phase into battle_phase
  from public.battles
  where id = target_battle;

  if battle_phase in ('battle_complete', 'voided') then
    return jsonb_build_object(
      'status', 'terminal',
      'battle', private.battle_snapshot(caller_id, target_battle)
    );
  end if;

  select * into member_row
  from public.battle_members
  where battle_id = target_battle and user_id = caller_id
  for update;

  if member_row.connection_id is null
    or member_row.connection_id = new_connection_id
    or not member_row.is_connected then
    update public.battle_members
    set connection_id = new_connection_id,
        is_connected = true,
        arrived_at = coalesce(arrived_at, clock_timestamp()),
        last_heartbeat_at = clock_timestamp(),
        disconnected_at = null,
        reconnect_deadline = null
    where battle_id = target_battle and user_id = caller_id;
    connection_status := 'controlling';
    perform private.repair_multi_player_battle(target_battle);
  else
    connection_status := 'active_elsewhere';
  end if;

  return jsonb_build_object(
    'status', connection_status,
    'battle', private.battle_snapshot(caller_id, target_battle)
  );
end;
$$;

revoke all on function public.open_my_battle_connection(uuid) from public;
grant execute on function public.open_my_battle_connection(uuid) to authenticated;
