-- M6 authoritative lobby acceptance. All synthetic accounts and party writes
-- are rolled back, including private Realtime signals.

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a6000000-0000-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'm6-acceptance-a@wrdl.invalid', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('b6000000-0000-4000-8000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'm6-acceptance-b@wrdl.invalid', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

select set_config('request.jwt.claim.sub', 'a6000000-0000-4000-8000-000000000001', true);
select public.complete_my_profile('m6accepta');
select set_config('request.jwt.claim.sub', 'b6000000-0000-4000-8000-000000000002', true);
select public.complete_my_profile('m6acceptb');

update public.profiles
set display_name = case when id = 'a6000000-0000-4000-8000-000000000001'
  then 'AlphaLobby' else 'BetaLobby' end,
    last_online_at = now()
where id in (
  'a6000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000002'
);

insert into public.friendships (user_one_id, user_two_id)
values (
  least(
    'a6000000-0000-4000-8000-000000000001'::uuid,
    'b6000000-0000-4000-8000-000000000002'::uuid
  ),
  greatest(
    'a6000000-0000-4000-8000-000000000001'::uuid,
    'b6000000-0000-4000-8000-000000000002'::uuid
  )
);

select set_config('request.jwt.claim.sub', 'a6000000-0000-4000-8000-000000000001', true);

do $$
declare
  snapshot jsonb := public.create_party(null, null);
  candidates jsonb;
begin
  assert snapshot ->> 'phase' = 'lobby', 'new party did not enter Lobby';
  assert (snapshot ->> 'memberCount')::integer = 1, 'host membership was not created';
  assert (snapshot ->> 'readyCount')::integer = 0, 'host started Ready';
  assert (snapshot ->> 'isHost')::boolean, 'creator is not the host';
  assert snapshot #>> '{members,0,isHost}' = 'true', 'host crown state is missing';
  candidates := public.get_party_invite_candidates('m6acceptb');
  assert jsonb_array_length(candidates) = 1, 'online friend picker omitted an eligible friend';
  assert candidates #>> '{0,inviteStatus}' = 'available', 'candidate status is not available';
end;
$$;

do $$
begin
  begin
    perform public.set_party_ready(true);
    assert false, 'one-person lobby entered Ready';
  exception when sqlstate '55000' then null;
  end;
end;
$$;

do $$
declare
  response jsonb := public.send_party_invitation('m6acceptb');
begin
  assert response ->> 'status' = 'invited', 'invitation was not created';
end;
$$;

select set_config('request.jwt.claim.sub', 'b6000000-0000-4000-8000-000000000002', true);

do $$
declare
  invitations jsonb := public.get_my_party_invitations();
  response jsonb;
begin
  assert jsonb_array_length(invitations) = 1, 'recipient did not receive one invitation';
  assert invitations #>> '{0,playerCount}' = '1', 'invitation lobby size is wrong';
  assert not (invitations -> 0 ? 'rounds'), 'invitation leaked match settings';
  assert not (invitations -> 0 ? 'roundTimerSeconds'), 'invitation leaked timer settings';
  response := public.respond_to_party_invitation(
    (invitations #>> '{0,id}')::uuid,
    true
  );
  assert response ->> 'status' = 'joined', 'acceptance did not join the lobby';
  assert response #>> '{party,memberCount}' = '2', 'accepted member was not counted';
  assert response #>> '{party,readyCount}' = '0', 'accepted member did not enter Not Ready';
end;
$$;

do $$
begin
  begin
    perform public.update_party_settings(5, 600);
    assert false, 'non-host changed lobby settings';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', 'a6000000-0000-4000-8000-000000000001', true);

do $$
declare
  snapshot jsonb := public.transfer_party_host('b6000000-0000-4000-8000-000000000002');
begin
  assert snapshot ->> 'hostId' = 'b6000000-0000-4000-8000-000000000002',
    'manual host transfer failed';
end;
$$;

select public.leave_party();

select set_config('request.jwt.claim.sub', 'b6000000-0000-4000-8000-000000000002', true);

do $$
declare
  envelope jsonb := public.get_my_party();
  invitation jsonb;
begin
  assert envelope #>> '{party,hostId}' = 'b6000000-0000-4000-8000-000000000002',
    'remaining member did not retain host control';
  assert envelope #>> '{party,memberCount}' = '1', 'departing member remained in the party';
  invitation := public.send_party_invitation('m6accepta');
  assert invitation ->> 'status' = 'invited', 'new host could not reinvite the departed member';
end;
$$;

select set_config('request.jwt.claim.sub', 'a6000000-0000-4000-8000-000000000001', true);

do $$
declare
  invitations jsonb := public.get_my_party_invitations();
  response jsonb;
begin
  response := public.respond_to_party_invitation((invitations #>> '{0,id}')::uuid, true);
  assert response ->> 'status' = 'joined', 'reinvited player did not rejoin';
  assert response #>> '{party,members,1,ready}' = 'false', 'reinvited player returned Ready';
end;
$$;

do $$
declare
  snapshot jsonb := public.set_party_ready(true);
begin
  assert snapshot ->> 'phase' = 'lobby', 'first Ready started the match early';
  assert snapshot ->> 'readyCount' = '1', 'first Ready was not counted';
end;
$$;

select set_config('request.jwt.claim.sub', 'b6000000-0000-4000-8000-000000000002', true);

do $$
declare
  snapshot jsonb := public.update_party_settings(3, 90);
begin
  assert snapshot ->> 'rounds' = '3',
    'host could not change rounds while another player was Ready';
  assert snapshot ->> 'roundTimerSeconds' = '90',
    'host could not change the timer while another player was Ready';
  assert snapshot ->> 'readyCount' = '1',
    'changing settings cleared an existing Ready state';
end;
$$;

select public.leave_party();

select set_config('request.jwt.claim.sub', 'a6000000-0000-4000-8000-000000000001', true);

do $$
declare
  envelope jsonb := public.get_my_party();
  invitation jsonb;
begin
  assert envelope #>> '{party,readyCount}' = '0',
    'a player leaving did not cancel the remaining Ready state';
  invitation := public.send_party_invitation('m6acceptb');
  assert invitation ->> 'status' = 'invited', 'departed player could not be reinvited';
end;
$$;

select set_config('request.jwt.claim.sub', 'b6000000-0000-4000-8000-000000000002', true);

do $$
declare
  invitations jsonb := public.get_my_party_invitations();
  response jsonb;
begin
  response := public.respond_to_party_invitation((invitations #>> '{0,id}')::uuid, true);
  assert response ->> 'status' = 'joined', 'second reinvite did not restore the player';
end;
$$;

select set_config('request.jwt.claim.sub', 'a6000000-0000-4000-8000-000000000001', true);
select public.update_party_settings(5, 600);

do $$
declare
  snapshot jsonb := public.set_party_ready(true);
begin
  assert snapshot ->> 'phase' = 'lobby' and snapshot ->> 'readyCount' = '1',
    'host could not Ready after changing settings';
end;
$$;

select set_config('request.jwt.claim.sub', 'b6000000-0000-4000-8000-000000000002', true);

do $$
declare
  snapshot jsonb := public.set_party_ready(true);
begin
  assert snapshot ->> 'phase' = 'match_starting', 'all Ready did not start countdown';
  assert snapshot -> 'startDeadline' <> 'null'::jsonb, 'start countdown has no deadline';
  assert snapshot ->> 'rounds' = '5', 'final settings snapshot has wrong rounds';
  assert snapshot ->> 'roundTimerSeconds' = '600', 'final settings snapshot has wrong timer';
end;
$$;

select set_config('request.jwt.claim.sub', 'a6000000-0000-4000-8000-000000000001', true);

do $$
begin
  begin
    perform public.remove_party_member('b6000000-0000-4000-8000-000000000002');
    assert false, 'host removed a member after Match Starting';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    perform public.set_party_ready(false);
    assert false, 'Ready cancellation remained available during countdown';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;

do $$
begin
  assert not has_table_privilege('authenticated', 'public.parties', 'select')
    and not has_table_privilege('authenticated', 'public.party_members', 'select')
    and not has_table_privilege('authenticated', 'public.party_invitations', 'select'),
    'authenticated clients can bypass M6 RPC contracts';
  assert not has_function_privilege(
    'authenticated', 'private.party_snapshot(uuid,uuid)', 'execute'
  ), 'authenticated clients can call the private party snapshot helper';
end;
$$;

rollback;

do $$
begin
  assert not exists (
    select 1 from auth.users
    where id in (
      'a6000000-0000-4000-8000-000000000001',
      'b6000000-0000-4000-8000-000000000002'
    )
  ), 'rolled-back M6 accounts were retained';
end;
$$;
