-- M9 one-controlling-connection acceptance. Synthetic accounts roll back.

begin;

create or replace function pg_temp.m9_user(player_number integer)
returns uuid
language sql
immutable
as $$
  select ('a9000000-0000-4000-8000-' || lpad(player_number::text, 12, '0'))::uuid;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  pg_temp.m9_user(player_number),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'm9-acceptance-' || player_number || '@wrdl.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from generate_series(1, 3) as player_number;

do $$
declare player_number integer;
begin
  for player_number in 1..3 loop
    perform set_config('request.jwt.claim.sub', pg_temp.m9_user(player_number)::text, true);
    perform public.complete_my_profile('m9accept' || player_number);
  end loop;
end;
$$;

do $$
declare
  target_party uuid;
  target_battle uuid;
  first_connection uuid := gen_random_uuid();
  second_connection uuid := gen_random_uuid();
  response jsonb;
begin
  insert into public.parties (
    host_id, phase, rounds_configured, round_timer_seconds,
    next_join_order, start_deadline
  ) values (
    pg_temp.m9_user(1), 'match_starting', 1, 60, 4,
    clock_timestamp() + interval '30 seconds'
  ) returning id into target_party;

  insert into public.party_members (
    party_id, user_id, join_order, is_ready, returned_to_lobby
  )
  select target_party, pg_temp.m9_user(player_number), player_number, true, true
  from generate_series(1, 3) as player_number;

  target_battle := private.create_battle(target_party);
  perform set_config('request.jwt.claim.sub', pg_temp.m9_user(1)::text, true);

  response := public.open_my_battle_connection(first_connection);
  assert response ->> 'status' = 'controlling',
    'the first battle connection did not receive control';

  response := public.open_my_battle_connection(second_connection);
  assert response ->> 'status' = 'active_elsewhere',
    'a second connection silently took battle control';
  assert (
    select connection_id = first_connection
    from public.battle_members
    where battle_id = target_battle and user_id = pg_temp.m9_user(1)
  ), 'the active connection changed before Continue here';

  perform public.claim_my_battle_connection(second_connection);
  assert (
    select connection_id = second_connection
    from public.battle_members
    where battle_id = target_battle and user_id = pg_temp.m9_user(1)
  ), 'Continue here did not transfer control';

  begin
    perform public.heartbeat_my_battle(first_connection);
    assert false, 'the superseded connection still controlled the battle';
  exception
    when sqlstate '55000' then null;
  end;

  response := public.open_my_battle_connection(second_connection);
  assert response ->> 'status' = 'controlling',
    'the controlling connection was not recognized on refresh';

  perform public.disconnect_my_battle_for_sign_out();
  assert not (
    select is_connected
    from public.battle_members
    where battle_id = target_battle and user_id = pg_temp.m9_user(1)
  ), 'sign-out did not immediately disconnect the battle member';

  response := public.open_my_battle_connection(gen_random_uuid());
  assert response ->> 'status' = 'terminal'
    and response #>> '{battle,phase}' = 'voided',
    'the final signed-out connection did not immediately void the battle';
end;
$$;

do $$
begin
  assert has_function_privilege(
    'authenticated', 'public.open_my_battle_connection(uuid)', 'execute'
  ), 'authenticated users cannot inspect battle connection ownership';
  assert not has_function_privilege(
    'anon', 'public.open_my_battle_connection(uuid)', 'execute'
  ), 'anonymous users can inspect battle connection ownership';
  assert has_function_privilege(
    'authenticated', 'public.disconnect_my_battle_for_sign_out()', 'execute'
  ), 'authenticated users cannot record a sign-out disconnection';
end;
$$;

rollback;
