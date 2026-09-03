-- M7 two-player authoritative battle acceptance. Synthetic accounts and every
-- battle/history/statistics write are rolled back.

begin;

create temporary table m7_state (
  party_id uuid,
  battle_id uuid,
  alpha_connection uuid,
  beta_connection uuid,
  duplicate_command uuid
) on commit drop;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a7000000-0000-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'm7-acceptance-a@wrdl.invalid', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('b7000000-0000-4000-8000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'm7-acceptance-b@wrdl.invalid', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000001', true);
select public.complete_my_profile('m7accepta');
select set_config('request.jwt.claim.sub', 'b7000000-0000-4000-8000-000000000002', true);
select public.complete_my_profile('m7acceptb');

update public.profiles
set display_name = case when id = 'a7000000-0000-4000-8000-000000000001'
  then 'AlphaBattle' else 'BetaBattle' end,
    last_online_at = now()
where id in (
  'a7000000-0000-4000-8000-000000000001',
  'b7000000-0000-4000-8000-000000000002'
);

insert into public.friendships (user_one_id, user_two_id)
values (
  least(
    'a7000000-0000-4000-8000-000000000001'::uuid,
    'b7000000-0000-4000-8000-000000000002'::uuid
  ),
  greatest(
    'a7000000-0000-4000-8000-000000000001'::uuid,
    'b7000000-0000-4000-8000-000000000002'::uuid
  )
);

select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000001', true);
select public.create_party(1, 60);
select public.send_party_invitation('m7acceptb');

select set_config('request.jwt.claim.sub', 'b7000000-0000-4000-8000-000000000002', true);
do $$
declare invitations jsonb := public.get_my_party_invitations();
begin
  perform public.respond_to_party_invitation((invitations #>> '{0,id}')::uuid, true);
end;
$$;
select public.set_party_ready(true);
do $$
declare snapshot jsonb := public.set_party_ready(true);
begin
  assert snapshot ->> 'phase' = 'lobby' and snapshot ->> 'readyCount' = '1',
    'an idempotent first Ready incorrectly started or changed the lobby';
end;
$$;

select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000001', true);
select public.set_party_ready(true);

insert into m7_state
select party.id, party.active_battle_id, gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
from public.parties as party
join public.party_members as member on member.party_id = party.id
where member.user_id = 'a7000000-0000-4000-8000-000000000001';

do $$
declare snapshot jsonb := public.get_my_battle();
begin
  assert snapshot ->> 'phase' = 'round_starting'
    and (snapshot ->> 'waitingForPlayers')::boolean,
    'battle did not begin at the player-arrival barrier';
  assert snapshot ->> 'rounds' = '1' and snapshot ->> 'targetPoints' = '1',
    'one-round battle target is wrong';
  assert not (snapshot ? 'answer') and position('"answer"' in snapshot::text) = 0,
    'protected answer leaked in snapshot';
end;
$$;

select public.claim_my_battle_connection((select alpha_connection from m7_state));
do $$
declare snapshot jsonb := public.get_my_battle();
begin
  assert (snapshot ->> 'waitingForPlayers')::boolean,
    'the first arriving player started the countdown alone';
  assert (
    select players_ready_at is null and phase = 'round_starting'
    from public.battles where id = (select battle_id from m7_state)
  ), 'arrival barrier was released before both players arrived';
end;
$$;

select set_config('request.jwt.claim.sub', 'b7000000-0000-4000-8000-000000000002', true);
select public.claim_my_battle_connection((select beta_connection from m7_state));

do $$
declare snapshot jsonb := public.get_my_battle();
begin
  assert not (snapshot ->> 'waitingForPlayers')::boolean,
    'both arrivals did not release the synchronized countdown';
  assert (
    select players_ready_at is not null
      and phase = 'round_starting'
      and phase_deadline > clock_timestamp()
    from public.battles where id = (select battle_id from m7_state)
  ), 'the synchronized three-second countdown was not scheduled';
end;
$$;

update public.battles
set phase_deadline = clock_timestamp() - interval '1 second'
where id = (select battle_id from m7_state);
select public.advance_my_battle();

select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000001', true);
do $$
declare
  answer text;
  wrong_guess text;
begin
  select round.answer into answer
  from private.battle_rounds as round
  where round.battle_id = (select battle_id from m7_state) and round.round_number = 1;
  select word into wrong_guess from private.daily_words
  where active and word <> answer order by word limit 1;

  perform public.submit_my_battle_guess(
    (select duplicate_command from m7_state),
    (select alpha_connection from m7_state),
    wrong_guess
  );
  perform public.submit_my_battle_guess(
    (select duplicate_command from m7_state),
    (select alpha_connection from m7_state),
    wrong_guess
  );
  assert (
    select count(*) from public.battle_guesses
    where command_id = (select duplicate_command from m7_state)
  ) = 1, 'duplicate command inserted two guesses';
end;
$$;

select set_config('request.jwt.claim.sub', 'b7000000-0000-4000-8000-000000000002', true);
do $$
declare snapshot jsonb := public.get_my_battle();
begin
  assert snapshot #>> '{opponent,guesses,0,guess}' is null,
    'active opponent letters leaked before own puzzle finished';
  assert snapshot #>> '{opponent,guesses,0,pattern}' is not null,
    'opponent color progress was not visible';
end;
$$;

-- Same two-decimal completion bucket awards both players one point and sends a
-- completed one-round tie into two-player-only sudden death.
update public.battle_members
set round_status = 'solved', completion_centiseconds = 125
where battle_id = (select battle_id from m7_state);
update public.battles
set phase = 'round_resolving', phase_deadline = clock_timestamp() - interval '1 second'
where id = (select battle_id from m7_state);
select public.advance_my_battle();

do $$
begin
  assert (
    select bool_and(total_points = 1 and last_round_points = 1)
    from public.battle_members where battle_id = (select battle_id from m7_state)
  ), 'exact tie did not award one point to both players';
  assert (
    select phase = 'between_rounds' and next_sudden_death
    from public.battles where id = (select battle_id from m7_state)
  ), 'simultaneous target tie did not schedule sudden death';
end;
$$;

update public.battles
set phase_deadline = clock_timestamp() - interval '1 second'
where id = (select battle_id from m7_state);
select public.advance_my_battle();

do $$
begin
  assert (
    select phase = 'round_starting' and is_sudden_death and sudden_death_round = 1
    from public.battles where id = (select battle_id from m7_state)
  ), 'sudden-death countdown was not created';
end;
$$;

update public.battles
set phase_deadline = clock_timestamp() - interval '1 second'
where id = (select battle_id from m7_state);
select public.advance_my_battle();

update public.battle_members
set round_status = case
      when user_id = 'a7000000-0000-4000-8000-000000000001' then 'solved'::public.battle_round_status
      else 'active'::public.battle_round_status
    end,
    completion_centiseconds = case
      when user_id = 'a7000000-0000-4000-8000-000000000001' then 88 else null end
where battle_id = (select battle_id from m7_state);
update public.battles
set phase = 'round_resolving', phase_deadline = clock_timestamp() - interval '1 second'
where id = (select battle_id from m7_state);
select public.advance_my_battle();

do $$
begin
  assert (
    select phase = 'battle_complete'
      and winner_id = 'a7000000-0000-4000-8000-000000000001'
    from public.battles where id = (select battle_id from m7_state)
  ), 'sole sudden-death winner did not complete the battle';
  assert (
    select count(*) = 1 from public.battle_history_summaries
    where source_battle_id = (select battle_id from m7_state)
  ), 'battle history was not committed exactly once';
  assert (
    select completion_reason = 'score'
    from public.battle_history_summaries
    where source_battle_id = (select battle_id from m7_state)
  ), 'normal completion history was not labelled as score';
  assert (
    select two_player_wins = 1 from public.friendly_battle_statistics
    where user_id = 'a7000000-0000-4000-8000-000000000001'
  ), 'winner statistics were not recorded';
  assert (
    select two_player_losses = 1 from public.friendly_battle_statistics
    where user_id = 'b7000000-0000-4000-8000-000000000002'
  ), 'loser statistics were not recorded';
end;
$$;

select public.advance_my_battle();
do $$
begin
  assert (
    select count(*) = 1 from public.battle_history_summaries
    where source_battle_id = (select battle_id from m7_state)
  ), 'completion retry duplicated history';
end;
$$;

select public.continue_from_battle();
select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000001', true);
select public.continue_from_battle();

do $$
begin
  assert (
    select phase = 'lobby' and active_battle_id is null
    from public.parties where id = (select party_id from m7_state)
  ), 'both players did not return to the original reusable lobby';
end;
$$;

-- A second match proves the 30-second two-player grace awards a normal
-- forfeit and transfers host control when the disconnected host expires.
select public.update_party_settings(3, 90);
select public.set_party_ready(true);
select set_config('request.jwt.claim.sub', 'b7000000-0000-4000-8000-000000000002', true);
select public.set_party_ready(true);

update m7_state
set battle_id = (
      select active_battle_id from public.parties where id = m7_state.party_id
    ),
    alpha_connection = gen_random_uuid(),
    beta_connection = gen_random_uuid();

select public.claim_my_battle_connection((select beta_connection from m7_state));
select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000001', true);
select public.claim_my_battle_connection((select alpha_connection from m7_state));

update public.battles
set phase_deadline = clock_timestamp() - interval '1 second'
where id = (select battle_id from m7_state);
select public.advance_my_battle();

update public.battle_members
set is_connected = false,
    disconnected_at = clock_timestamp() - interval '31 seconds',
    reconnect_deadline = clock_timestamp() - interval '1 second'
where battle_id = (select battle_id from m7_state)
  and user_id = 'a7000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', 'b7000000-0000-4000-8000-000000000002', true);
select public.advance_my_battle();

do $$
begin
  assert (
    select phase = 'battle_complete'
      and completion_reason = 'forfeit'
      and winner_id = 'b7000000-0000-4000-8000-000000000002'
    from public.battles where id = (select battle_id from m7_state)
  ), 'expired reconnect grace did not award the connected opponent';
  assert (
    select host_id = 'b7000000-0000-4000-8000-000000000002'
    from public.parties where id = (select party_id from m7_state)
  ), 'forfeit winner did not inherit host control from the disconnected host';
  assert (
    select two_player_wins = 1 and two_player_losses = 1
    from public.friendly_battle_statistics
    where user_id = 'a7000000-0000-4000-8000-000000000001'
  ), 'Alpha did not retain exactly one win and one loss';
  assert (
    select two_player_wins = 1 and two_player_losses = 1
    from public.friendly_battle_statistics
    where user_id = 'b7000000-0000-4000-8000-000000000002'
  ), 'Beta did not retain exactly one win and one loss';
  assert (
    select completion_reason = 'forfeit'
    from public.battle_history_summaries
    where source_battle_id = (select battle_id from m7_state)
  ), 'disconnect history was not labelled as forfeit';
end;
$$;

do $$
declare history jsonb := public.get_player_battle_history('m7accepta');
begin
  assert history #>> '{matches,0,completionReason}' = 'forfeit',
    'public history did not expose the forfeit label';
end;
$$;

select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000001', true);
do $$
begin
  assert public.get_my_battle() is null,
    'the forfeit loser retained an active-battle Home state';
  assert not exists (
    select 1 from public.party_members
    where party_id = (select party_id from m7_state)
      and user_id = 'a7000000-0000-4000-8000-000000000001'
  ), 'the forfeit loser remained in the reusable party';
end;
$$;

-- The winner returns alone. Reinviting the former opponent then creates a third
-- match that proves Ready remains cancellable in the lobby and that one arrival
-- cannot start or record a battle when the 30-second barrier expires.
select set_config('request.jwt.claim.sub', 'b7000000-0000-4000-8000-000000000002', true);
select public.continue_from_battle();
do $$
begin
  assert (
    select phase = 'lobby' and active_battle_id is null
    from public.parties where id = (select party_id from m7_state)
  ), 'the forfeit winner did not return to a reusable lobby';
  assert (
    select count(*) = 1 from public.party_members
    where party_id = (select party_id from m7_state)
  ), 'the forfeit loser reappeared in the winner lobby';
end;
$$;

select public.send_party_invitation('m7accepta');
select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000001', true);
do $$
declare invitations jsonb := public.get_my_party_invitations();
begin
  perform public.respond_to_party_invitation((invitations #>> '{0,id}')::uuid, true);
end;
$$;

select set_config('request.jwt.claim.sub', 'b7000000-0000-4000-8000-000000000002', true);
select public.set_party_ready(true);
do $$
declare snapshot jsonb;
begin
  snapshot := public.set_party_ready(false);
  assert snapshot ->> 'phase' = 'lobby', 'cancelling Ready left the lobby phase';
  assert snapshot ->> 'readyCount' = '0', 'cancelling Ready did not clear the Ready state';
  snapshot := public.set_party_ready(true);
  assert snapshot ->> 'phase' = 'lobby', 'one Ready player started the match early';
end;
$$;

select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000001', true);
select public.set_party_ready(true);
update m7_state
set battle_id = (
      select active_battle_id from public.parties where id = m7_state.party_id
    ),
    alpha_connection = gen_random_uuid();
select public.claim_my_battle_connection((select alpha_connection from m7_state));
update public.battles
set phase_deadline = clock_timestamp() - interval '1 second'
where id = (select battle_id from m7_state);
select public.advance_my_battle();

do $$
begin
  assert (
    select phase = 'voided' and history_committed_at is null
    from public.battles where id = (select battle_id from m7_state)
  ), 'one-player arrival did not cancel without committing a result';
  assert (
    select phase = 'lobby' and active_battle_id is null
    from public.parties where id = (select party_id from m7_state)
  ), 'cancelled startup did not return the original party to its lobby';
  assert (
    select count(*) = 2 from public.battle_history_summaries
    where id in (
      select match_id from public.battle_history_standings
      where player_id = 'a7000000-0000-4000-8000-000000000001'
    )
  ), 'cancelled startup created an extra history record';
  assert (
    select two_player_wins = 1 and two_player_losses = 1
    from public.friendly_battle_statistics
    where user_id = 'a7000000-0000-4000-8000-000000000001'
  ), 'cancelled startup changed player statistics';
end;
$$;

do $$
begin
  assert not has_table_privilege('authenticated', 'public.battles', 'select')
    and not has_table_privilege('authenticated', 'public.battle_members', 'select')
    and not has_table_privilege('authenticated', 'public.battle_guesses', 'select'),
    'authenticated clients can bypass M7 RPC contracts';
  assert not has_function_privilege(
    'authenticated', 'private.battle_snapshot(uuid,uuid)', 'execute'
  ), 'authenticated clients can call the private battle snapshot helper';
end;
$$;

rollback;

do $$
begin
  assert not exists (
    select 1 from auth.users
    where id in (
      'a7000000-0000-4000-8000-000000000001',
      'b7000000-0000-4000-8000-000000000002'
    )
  ), 'rolled-back M7 accounts were retained';
end;
$$;
