-- M8 3-8-player acceptance. Synthetic accounts and all battle writes roll back.

begin;

create or replace function pg_temp.m8_user(player_number integer)
returns uuid
language sql
immutable
as $$
  select ('a8000000-0000-4000-8000-' || lpad(player_number::text, 12, '0'))::uuid;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  pg_temp.m8_user(player_number),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'm8-acceptance-' || player_number || '@wrdl.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from generate_series(1, 8) as player_number;

do $$
declare player_number integer;
begin
  for player_number in 1..8 loop
    perform set_config('request.jwt.claim.sub', pg_temp.m8_user(player_number)::text, true);
    perform public.complete_my_profile('m8accept' || player_number);
  end loop;
end;
$$;

-- Every supported population creates a protected battle, produces the approved
-- dense point table, completes every configured round, and records history.
do $$
declare
  population integer;
  target_party uuid;
  target_battle uuid;
  snapshot jsonb;
  actual_points integer[];
  expected_points integer[];
begin
  for population in 3..8 loop
    insert into public.parties (
      host_id, phase, rounds_configured, round_timer_seconds,
      next_join_order, start_deadline
    ) values (
      pg_temp.m8_user(1), 'match_starting', 1, 60,
      population + 1, clock_timestamp() + interval '30 seconds'
    ) returning id into target_party;

    insert into public.party_members (
      party_id, user_id, join_order, is_ready, returned_to_lobby
    )
    select target_party, pg_temp.m8_user(player_number), player_number, true, true
    from generate_series(1, population) as player_number;

    target_battle := private.create_battle(target_party);

    assert (
      select player_count = population and is_sudden_death = false
      from public.battles where id = target_battle
    ), 'population ' || population || ' created an invalid battle';

    snapshot := private.battle_snapshot(pg_temp.m8_user(1), target_battle);
    assert (snapshot ->> 'playerCount')::integer = population,
      'snapshot population is wrong for ' || population;
    assert jsonb_array_length(snapshot -> 'players') = population,
      'snapshot roster is incomplete for ' || population;
    assert position('"answer"' in snapshot::text) = 0,
      'protected answer leaked for population ' || population;

    update public.battles
    set phase = 'round_resolving',
        players_ready_at = clock_timestamp(),
        phase_deadline = clock_timestamp() - interval '1 second',
        round_started_at = clock_timestamp() - interval '30 seconds',
        round_deadline = clock_timestamp() + interval '30 seconds'
    where id = target_battle;

    update public.battle_members
    set is_connected = true,
        disconnected_at = null,
        reconnect_deadline = null,
        arrived_at = clock_timestamp(),
        round_status = case
          when population >= 6 and join_order = population
            then 'failed'::public.battle_round_status
          else 'solved'::public.battle_round_status
        end,
        completion_centiseconds = case
          when population >= 6 and join_order = population then null
          when population >= 5 and join_order in (1, 2) then 100
          else join_order * 100
        end
    where battle_id = target_battle;

    perform private.resolve_multi_player_round(target_battle);

    select array_agg(last_round_points order by join_order)
    into actual_points
    from public.battle_members
    where battle_id = target_battle;

    expected_points := case population
      when 3 then array[5, 3, 2]
      when 4 then array[5, 3, 2, 1]
      when 5 then array[5, 5, 3, 2, 1]
      when 6 then array[5, 5, 3, 2, 1, 0]
      when 7 then array[5, 5, 3, 2, 1, 1, 0]
      else array[5, 5, 3, 2, 1, 1, 1, 0]
    end;

    assert actual_points = expected_points,
      'dense scoring is wrong for population ' || population;
    assert (
      select phase = 'battle_complete'
        and is_sudden_death = false
        and current_round = rounds_configured
      from public.battles where id = target_battle
    ), 'population ' || population || ' did not complete its scheduled round';
    assert (
      select count(*) = population
      from public.battle_history_standings
      where match_id = (
        select id from public.battle_history_summaries
        where source_battle_id = target_battle
      )
    ), 'history omitted standings for population ' || population;

    if population >= 5 then
      assert (
        select count(*) = 2
        from public.battle_members
        where battle_id = target_battle and final_rank = 1
      ), 'shared first place was not retained for population ' || population;
      assert (
        select winner_id is null from public.battles where id = target_battle
      ), 'a tied multi-player battle exposed a sole winner';
    end if;

    delete from public.parties where id = target_party;
  end loop;
end;
$$;

-- A partial roster waits for the 30-second barrier, then starts with the two
-- arrivals that are sufficient to keep the battle valid.
do $$
declare
  target_party uuid;
  target_battle uuid;
begin
  insert into public.parties (
    host_id, phase, rounds_configured, round_timer_seconds,
    next_join_order, start_deadline
  ) values (
    pg_temp.m8_user(1), 'match_starting', 1, 60, 5,
    clock_timestamp() + interval '30 seconds'
  ) returning id into target_party;

  insert into public.party_members (
    party_id, user_id, join_order, is_ready, returned_to_lobby
  )
  select target_party, pg_temp.m8_user(player_number), player_number, true, true
  from generate_series(1, 4) as player_number;

  target_battle := private.create_battle(target_party);
  update public.battle_members
  set is_connected = true,
      disconnected_at = null,
      reconnect_deadline = null,
      arrived_at = clock_timestamp()
  where battle_id = target_battle and join_order <= 2;

  perform private.repair_multi_player_battle(target_battle);
  assert (
    select players_ready_at is null
    from public.battles where id = target_battle
  ), 'two early arrivals bypassed the full multi-player barrier';

  update public.battles
  set phase_deadline = clock_timestamp() - interval '1 second'
  where id = target_battle;
  perform private.repair_multi_player_battle(target_battle);
  assert (
    select players_ready_at is not null and phase = 'round_starting'
    from public.battles where id = target_battle
  ), 'the arrival deadline did not release a valid two-player remainder';

  delete from public.parties where id = target_party;
end;
$$;

-- Immediate host succession, preservation recovery, and preservation expiry.
do $$
declare
  target_party uuid;
  target_battle uuid;
  connection_ids uuid[] := array[
    'a8100000-0000-4000-8000-000000000001'::uuid,
    'a8100000-0000-4000-8000-000000000002'::uuid,
    'a8100000-0000-4000-8000-000000000003'::uuid,
    'a8100000-0000-4000-8000-000000000004'::uuid
  ];
begin
  insert into public.parties (
    host_id, phase, rounds_configured, round_timer_seconds,
    next_join_order, start_deadline
  ) values (
    pg_temp.m8_user(1), 'match_starting', 3, 60, 5,
    clock_timestamp() + interval '30 seconds'
  ) returning id into target_party;

  insert into public.party_members (
    party_id, user_id, join_order, is_ready, returned_to_lobby
  )
  select target_party, pg_temp.m8_user(player_number), player_number, true, true
  from generate_series(1, 4) as player_number;

  target_battle := private.create_battle(target_party);

  update public.battles
  set phase = 'round_active',
      players_ready_at = clock_timestamp(),
      phase_deadline = null,
      round_started_at = clock_timestamp(),
      round_deadline = clock_timestamp() + interval '60 seconds'
  where id = target_battle;

  update public.parties
  set phase = 'active', start_deadline = null
  where id = target_party;

  update public.battle_members
  set is_connected = true,
      connection_id = connection_ids[join_order],
      last_heartbeat_at = clock_timestamp(),
      disconnected_at = null,
      reconnect_deadline = null,
      arrived_at = clock_timestamp()
  where battle_id = target_battle;

  perform set_config('request.jwt.claim.sub', pg_temp.m8_user(1)::text, true);
  perform public.disconnect_my_battle(connection_ids[1]);
  assert (select host_id = pg_temp.m8_user(2) from public.parties where id = target_party),
    'disconnected multi-player host did not transfer immediately';
  assert (
    select became_host_at is not null
    from public.battle_members
    where battle_id = target_battle and user_id = pg_temp.m8_user(2)
  ), 'new host notification timestamp was not recorded';

  perform set_config('request.jwt.claim.sub', pg_temp.m8_user(4)::text, true);
  perform public.disconnect_my_battle(connection_ids[4]);
  assert (select preservation_deadline is null from public.battles where id = target_battle),
    'preservation began while two players remained';

  perform set_config('request.jwt.claim.sub', pg_temp.m8_user(3)::text, true);
  perform public.disconnect_my_battle(connection_ids[3]);
  assert (select preservation_deadline is not null from public.battles where id = target_battle),
    'below-two-connected preservation did not begin';

  update public.battle_members
  set round_status = case
        when user_id = pg_temp.m8_user(2) then 'solved'::public.battle_round_status
        else round_status
      end,
      completion_centiseconds = case
        when user_id = pg_temp.m8_user(2) then 250
        else completion_centiseconds
      end
  where battle_id = target_battle;
  update public.battles
  set phase = 'round_resolving', phase_deadline = clock_timestamp() - interval '1 second'
  where id = target_battle;
  perform private.resolve_multi_player_round(target_battle);
  assert (
    select phase = 'round_resolving' and completed_at is null
    from public.battles where id = target_battle
  ), 'round resolution bypassed active battle preservation';

  perform public.claim_my_battle_connection(gen_random_uuid());
  assert (select preservation_deadline is null from public.battles where id = target_battle),
    'returning to two connected players did not clear preservation';

  update public.battle_members
  set is_connected = false,
      disconnected_at = clock_timestamp(),
      reconnect_deadline = null
  where battle_id = target_battle and user_id = pg_temp.m8_user(3);
  update public.battles
  set preservation_deadline = clock_timestamp() - interval '1 second'
  where id = target_battle;

  perform set_config('request.jwt.claim.sub', pg_temp.m8_user(2)::text, true);
  perform public.advance_my_battle();
  assert (
    select phase = 'voided'
      and history_committed_at is null
      and preservation_deadline is null
    from public.battles where id = target_battle
  ), 'expired preservation did not void and discard the battle';

  delete from public.parties where id = target_party;
end;
$$;

-- Score completion keeps all retained members in the reusable lobby and lets
-- each player Continue independently.
do $$
declare
  target_party uuid;
  target_battle uuid;
  player_number integer;
begin
  insert into public.parties (
    host_id, phase, rounds_configured, round_timer_seconds,
    next_join_order, start_deadline
  ) values (
    pg_temp.m8_user(1), 'match_starting', 1, 60, 4,
    clock_timestamp() + interval '30 seconds'
  ) returning id into target_party;

  insert into public.party_members (
    party_id, user_id, join_order, is_ready, returned_to_lobby
  )
  select target_party, pg_temp.m8_user(series.player_no), series.player_no, true, true
  from generate_series(1, 3) as series(player_no);

  target_battle := private.create_battle(target_party);
  update public.battle_members
  set total_points = case join_order when 1 then 5 when 2 then 3 else 2 end
  where battle_id = target_battle;
  perform private.complete_multi_player_battle(target_battle, 'score');

  for player_number in 1..3 loop
    perform set_config('request.jwt.claim.sub', pg_temp.m8_user(player_number)::text, true);
    perform public.continue_from_battle();
    assert (
      select returned_to_lobby
      from public.party_members
      where party_id = target_party and user_id = pg_temp.m8_user(player_number)
    ), 'Continue did not return player ' || player_number || ' to the lobby';
  end loop;

  assert (
    select phase = 'lobby' and active_battle_id is null
    from public.parties where id = target_party
  ), 'the reusable lobby did not clear the completed battle after everyone returned';
end;
$$;

do $$
begin
  assert has_function_privilege('authenticated', 'private.create_battle(uuid)', 'execute') = false,
    'authenticated can execute the private M8 creator';
  assert has_function_privilege('authenticated', 'private.resolve_multi_player_round(uuid)', 'execute') = false,
    'authenticated can execute the private M8 scorer';
  assert has_function_privilege('authenticated', 'private.repair_multi_player_battle(uuid)', 'execute') = false,
    'authenticated can execute the private M8 repair function';
end;
$$;

rollback;
