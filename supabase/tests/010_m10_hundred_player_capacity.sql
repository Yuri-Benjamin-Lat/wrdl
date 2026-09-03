-- M10 deterministic 100-player capacity fixture. This validates the complete
-- mixed-size state and command path in one rollback-only transaction. The live
-- concurrency rehearsal described in operations/m10-performance-baseline.md
-- runs the same population with parallel clients and provider metrics visible.

begin;

create or replace function pg_temp.m10_user(player_number integer)
returns uuid
language sql
immutable
as $$
  select ('a1000000-0000-4000-8000-' || lpad(player_number::text, 12, '0'))::uuid;
$$;

create or replace function pg_temp.m10_connection(player_number integer)
returns uuid
language sql
immutable
as $$
  select ('b1000000-0000-4000-8000-' || lpad(player_number::text, 12, '0'))::uuid;
$$;

create or replace function pg_temp.m10_command(player_number integer)
returns uuid
language sql
immutable
as $$
  select ('c1000000-0000-4000-8000-' || lpad(player_number::text, 12, '0'))::uuid;
$$;

create temp table m10_groups (
  group_number integer primary key,
  population integer not null,
  first_player integer,
  party_id uuid,
  battle_id uuid
) on commit drop;

create temp table m10_players (
  player_number integer primary key,
  group_number integer not null,
  battle_id uuid not null
) on commit drop;

insert into m10_groups (group_number, population)
select ordinality::integer, population
from unnest(array[2,3,4,5,6,7,8,2,3,4,5,6,7,8,8,8,7,7])
  with ordinality as matrix(population, ordinality);

do $$
begin
  assert (select sum(population) = 100 from m10_groups),
    'the M10 population matrix must contain exactly 100 players';
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  pg_temp.m10_user(player_number),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'm10-load-' || player_number || '@wrdl.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from generate_series(1, 100) as player_number;

do $$
declare player_number integer;
begin
  for player_number in 1..100 loop
    perform set_config('request.jwt.claim.sub', pg_temp.m10_user(player_number)::text, true);
    perform public.complete_my_profile('m10load' || lpad(player_number::text, 3, '0'));
  end loop;
end;
$$;

do $$
declare
  target_group record;
  target_party uuid;
  target_battle uuid;
  next_player integer := 1;
begin
  for target_group in select * from m10_groups order by group_number loop
    insert into public.parties (
      host_id, phase, rounds_configured, round_timer_seconds,
      next_join_order, start_deadline
    ) values (
      pg_temp.m10_user(next_player), 'match_starting', 1, 60,
      target_group.population + 1, clock_timestamp() + interval '30 seconds'
    ) returning id into target_party;

    insert into public.party_members (
      party_id, user_id, join_order, is_ready, returned_to_lobby
    )
    select
      target_party,
      pg_temp.m10_user(player_number),
      player_number - next_player + 1,
      true,
      true
    from generate_series(
      next_player,
      next_player + target_group.population - 1
    ) as player_number;

    target_battle := private.create_battle(target_party);
    update m10_groups
    set first_player = next_player,
        party_id = target_party,
        battle_id = target_battle
    where group_number = target_group.group_number;

    insert into m10_players (player_number, group_number, battle_id)
    select player_number, target_group.group_number, target_battle
    from generate_series(
      next_player,
      next_player + target_group.population - 1
    ) as player_number;

    next_player := next_player + target_group.population;
  end loop;
end;
$$;

do $$
declare
  target_player record;
  response jsonb;
begin
  for target_player in select * from m10_players order by player_number loop
    perform set_config(
      'request.jwt.claim.sub',
      pg_temp.m10_user(target_player.player_number)::text,
      true
    );
    response := public.open_my_battle_connection(
      pg_temp.m10_connection(target_player.player_number)
    );
    assert response ->> 'status' = 'controlling',
      'a synthetic player did not receive battle control';
  end loop;
end;
$$;

do $$
begin
  assert (
    select count(*) = 100 from public.battle_members as member
    join m10_groups as target_group on target_group.battle_id = member.battle_id
    where member.is_connected
  ), 'the M10 fixture did not connect all 100 players';
end;
$$;

update public.battles as battle
set phase = 'round_active',
    players_ready_at = coalesce(players_ready_at, clock_timestamp()),
    phase_deadline = null,
    round_started_at = clock_timestamp(),
    round_deadline = clock_timestamp() + interval '60 seconds'
from m10_groups as target_group
where battle.id = target_group.battle_id;

update private.battle_rounds as round
set started_at = clock_timestamp(),
    deadline = clock_timestamp() + interval '60 seconds'
from m10_groups as target_group
where round.battle_id = target_group.battle_id and round.round_number = 1;

do $$
declare
  target_group record;
  snapshot jsonb;
begin
  for target_group in select * from m10_groups order by group_number loop
    perform set_config(
      'request.jwt.claim.sub',
      pg_temp.m10_user(target_group.first_player)::text,
      true
    );
    snapshot := private.battle_snapshot(
      pg_temp.m10_user(target_group.first_player),
      target_group.battle_id
    );
    assert position('"answer"' in snapshot::text) = 0,
      'an active mixed-size battle exposed a protected answer';
  end loop;
end;
$$;

do $$
declare
  target_player record;
begin
  for target_player in select * from m10_players order by player_number loop
    perform set_config(
      'request.jwt.claim.sub',
      pg_temp.m10_user(target_player.player_number)::text,
      true
    );
    perform public.submit_my_battle_guess(
      pg_temp.m10_command(target_player.player_number),
      pg_temp.m10_connection(target_player.player_number),
      'crane'
    );
  end loop;
end;
$$;

do $$
begin
  assert (
    select count(*) = 100 from public.battle_guesses as guess
    join m10_groups as target_group on target_group.battle_id = guess.battle_id
  ), 'the 100-player command burst did not persist exactly once per player';
end;
$$;

do $$
begin
  perform set_config('request.jwt.claim.sub', pg_temp.m10_user(1)::text, true);
  perform public.submit_my_battle_guess(
    pg_temp.m10_command(1), pg_temp.m10_connection(1), 'crane'
  );
end;
$$;

do $$
begin
  assert (
    select count(*) = 100 from public.battle_guesses as guess
    join m10_groups as target_group on target_group.battle_id = guess.battle_id
  ), 'replaying a burst command created a duplicate guess';
end;
$$;

rollback;
