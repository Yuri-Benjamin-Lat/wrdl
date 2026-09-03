-- M9: signing out is an explicit battle disconnection. It begins the normal
-- reconnection rule before the authenticated session is destroyed.

create or replace function public.disconnect_my_battle_for_sign_out()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_battle uuid;
  battle_row public.battles;
  connected_count integer;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select battle.* into battle_row
  from public.battles as battle
  join public.battle_members as member on member.battle_id = battle.id
  where member.user_id = caller_id
    and member.continued_at is null
    and battle.phase not in ('battle_complete', 'voided')
  order by battle.created_at desc
  limit 1
  for update of battle;

  if battle_row.id is null then return; end if;
  target_battle := battle_row.id;

  update public.battle_members
  set is_connected = false,
      disconnected_at = clock_timestamp(),
      reconnect_deadline = case
        when battle_row.player_count = 2 then clock_timestamp() + interval '30 seconds'
        else null
      end
  where battle_id = target_battle and user_id = caller_id;

  select count(*)::integer into connected_count
  from public.battle_members
  where battle_id = target_battle and is_connected;

  if battle_row.player_count = 2 then
    if connected_count = 0 then
      perform private.complete_two_player_battle(target_battle, null, 'voided');
    end if;
    return;
  end if;

  perform private.transfer_disconnected_multi_host(target_battle);
  if connected_count = 0 then
    perform private.complete_multi_player_battle(target_battle, 'voided');
  elsif connected_count < 2 then
    update public.battles
    set preservation_deadline = coalesce(
          preservation_deadline,
          clock_timestamp() + interval '20 seconds'
        ),
        state_version = state_version + 1
    where id = target_battle;
  end if;
end;
$$;

revoke all on function public.disconnect_my_battle_for_sign_out() from public;
grant execute on function public.disconnect_my_battle_for_sign_out() to authenticated;
