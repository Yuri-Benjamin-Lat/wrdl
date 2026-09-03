-- M6: invitation eligibility, recipient panel, acceptance/decline, and the
-- online-friends-only host picker. Invitations have no countdown; invalid
-- records are removed silently when read or when a party starts/closes/fills.

create or replace function private.party_invitation_is_available(
  invitation_row public.party_invitations,
  recipient_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select invitation_row.recipient_id = recipient_id
    and exists (
      select 1
      from public.parties as party
      where party.id = invitation_row.party_id
        and party.phase = 'lobby'
        and party.host_id = invitation_row.inviter_id
        and (select count(*) from public.party_members where party_id = party.id) < 8
    )
    and private.are_friends(invitation_row.inviter_id, invitation_row.recipient_id)
    and not exists (
      select 1 from public.battle_invite_blocks
      where blocker_id = invitation_row.recipient_id
        and blocked_user_id = invitation_row.inviter_id
    )
    and not exists (
      select 1 from public.party_invitation_mutes
      where recipient_id = invitation_row.recipient_id
        and inviter_id = invitation_row.inviter_id
        and muted_until > now()
    )
    and not exists (
      select 1 from public.party_members where user_id = invitation_row.recipient_id
    );
$$;

create or replace function public.get_party_invite_candidates(filter_text text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  party_row public.parties;
  normalized text := lower(btrim(coalesce(filter_text, '')));
  result jsonb;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if char_length(normalized) > 40 then raise exception 'Search is too long' using errcode = '22023'; end if;

  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id;

  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;
  if party_row.host_id <> caller_id then raise exception 'Host control required' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(
    private.social_player_json(caller_id, candidate.friend_id)
      || jsonb_build_object('inviteStatus', candidate.invite_status)
    order by candidate.username_key
  ), '[]'::jsonb)
  into result
  from (
    select
      case when friendship.user_one_id = caller_id
        then friendship.user_two_id else friendship.user_one_id end as friend_id,
      profile.username_key,
      case
        when exists (
          select 1 from public.party_members
          where party_id = party_row.id and user_id = profile.id
        ) then 'in_lobby'
        when exists (
          select 1 from public.party_invitations
          where party_id = party_row.id and recipient_id = profile.id
        ) then 'invited'
        else 'available'
      end as invite_status
    from public.friendships as friendship
    join public.profiles as profile
      on profile.id = case when friendship.user_one_id = caller_id
        then friendship.user_two_id else friendship.user_one_id end
    join public.user_settings as setting on setting.user_id = profile.id
    where (friendship.user_one_id = caller_id or friendship.user_two_id = caller_id)
      and setting.activity_visible
      and profile.last_online_at >= now() - interval '5 minutes'
      and (
        normalized = ''
        or profile.username_key like '%' || normalized || '%'
        or lower(coalesce(profile.display_name, '')) like '%' || normalized || '%'
      )
      and not exists (
        select 1 from public.battle_invite_blocks
        where blocker_id = profile.id and blocked_user_id = caller_id
      )
    order by profile.username_key
    limit 50
  ) as candidate;

  return result;
end;
$$;

create or replace function public.send_party_invitation(target_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_id uuid;
  party_row public.parties;
  existing_invitation public.party_invitations;
  new_invitation public.party_invitations;
  member_count integer;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id
  for update of party;

  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;
  if party_row.host_id <> caller_id then raise exception 'Host control required' using errcode = '42501'; end if;
  if party_row.phase <> 'lobby' then raise exception 'Invitations are locked' using errcode = '55000'; end if;

  select id into target_id from public.profiles
  where username_key = lower(btrim(target_username)) and username is not null;
  if target_id is null then raise exception 'Player not found' using errcode = 'P0002'; end if;

  select count(*)::integer into member_count
  from public.party_members where party_id = party_row.id;
  if member_count >= 8 then raise exception 'Lobby is full' using errcode = '23514'; end if;
  if exists (
    select 1 from public.party_members
    where party_id = party_row.id and user_id = target_id
  ) then return jsonb_build_object('status', 'in_lobby'); end if;

  if not private.are_friends(caller_id, target_id) then
    raise exception 'Accepted friendship required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles as profile
    join public.user_settings as setting on setting.user_id = profile.id
    where profile.id = target_id
      and setting.activity_visible
      and profile.last_online_at >= now() - interval '5 minutes'
  ) then raise exception 'Only online friends can be invited' using errcode = '55000'; end if;
  if exists (
    select 1 from public.battle_invite_blocks
    where blocker_id = target_id and blocked_user_id = caller_id
  ) then raise exception 'Battle invitations are blocked' using errcode = '42501'; end if;
  if exists (
    select 1 from public.party_invitation_mutes
    where recipient_id = target_id and inviter_id = caller_id and muted_until > now()
  ) then raise exception 'Invitations are temporarily muted' using errcode = '42501'; end if;
  if exists (select 1 from public.party_members where user_id = target_id) then
    raise exception 'Player is already in a lobby' using errcode = '55000';
  end if;

  select * into existing_invitation from public.party_invitations
  where party_id = party_row.id and recipient_id = target_id;
  if existing_invitation.id is not null then
    return jsonb_build_object('status', 'invited', 'invitationId', existing_invitation.id);
  end if;

  if exists (
    select 1 from public.party_invitation_declines
    where inviter_id = caller_id and recipient_id = target_id
      and declined_at > now() - interval '3 seconds'
  ) then raise exception 'Wait before inviting this player again' using errcode = '55000'; end if;

  insert into public.party_invitations (party_id, inviter_id, recipient_id)
  values (party_row.id, caller_id, target_id)
  returning * into new_invitation;

  return jsonb_build_object('status', 'invited', 'invitationId', new_invitation.id);
end;
$$;

create or replace function public.get_my_party_invitations()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  result jsonb;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  delete from public.party_invitations as invitation
  where invitation.recipient_id = caller_id
    and not private.party_invitation_is_available(invitation, caller_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', invitation.id,
      'partyId', invitation.party_id,
      'createdAt', invitation.created_at,
      'playerCount', (
        select count(*) from public.party_members where party_id = invitation.party_id
      ),
      'inviter', private.social_player_json(caller_id, invitation.inviter_id)
    ) order by invitation.created_at desc
  ), '[]'::jsonb)
  into result
  from public.party_invitations as invitation
  where invitation.recipient_id = caller_id;

  return result;
end;
$$;

create or replace function public.respond_to_party_invitation(
  invitation_id uuid,
  accept_invitation boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  invitation_row public.party_invitations;
  party_row public.parties;
  new_join_order integer;
  recent_declines integer;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select * into invitation_row from public.party_invitations
  where id = invitation_id and recipient_id = caller_id
  for update;
  if invitation_row.id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select * into party_row from public.parties
  where id = invitation_row.party_id for update;

  if not accept_invitation then
    delete from public.party_invitations where id = invitation_row.id;
    insert into public.party_invitation_declines (inviter_id, recipient_id)
    values (invitation_row.inviter_id, caller_id);
    select least(count(*)::integer, 2) into recent_declines
    from public.party_invitation_declines
    where inviter_id = invitation_row.inviter_id and recipient_id = caller_id
      and declined_at > now() - interval '24 hours';
    return jsonb_build_object('status', 'declined', 'declineCount', recent_declines);
  end if;

  if party_row.id is null
    or not private.party_invitation_is_available(invitation_row, caller_id) then
    delete from public.party_invitations where id = invitation_row.id;
    return jsonb_build_object('status', 'unavailable');
  end if;
  if exists (select 1 from public.party_members where user_id = caller_id) then
    delete from public.party_invitations where recipient_id = caller_id;
    return jsonb_build_object('status', 'unavailable');
  end if;
  if (select count(*) from public.party_members where party_id = party_row.id) >= 8 then
    delete from public.party_invitations where party_id = party_row.id;
    return jsonb_build_object('status', 'unavailable');
  end if;

  new_join_order := party_row.next_join_order;
  update public.parties
  set next_join_order = next_join_order + 1,
      state_version = state_version + 1
  where id = party_row.id;
  insert into public.party_members (party_id, user_id, join_order)
  values (party_row.id, caller_id, new_join_order);
  delete from public.party_invitations where recipient_id = caller_id;
  delete from public.party_removal_notices where user_id = caller_id;

  if (select count(*) from public.party_members where party_id = party_row.id) >= 8 then
    delete from public.party_invitations where party_id = party_row.id;
  end if;

  return jsonb_build_object(
    'status', 'joined',
    'party', private.party_snapshot(caller_id, party_row.id)
  );
end;
$$;

create or replace function public.mute_party_inviter(inviter_user_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  decline_count integer;
  result timestamptz := now() + interval '1 minute';
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select count(*)::integer into decline_count
  from public.party_invitation_declines
  where inviter_id = inviter_user_id and recipient_id = caller_id
    and declined_at > now() - interval '24 hours';
  if decline_count < 2 then raise exception 'Two declines are required' using errcode = '42501'; end if;

  insert into public.party_invitation_mutes (recipient_id, inviter_id, muted_until)
  values (caller_id, inviter_user_id, result)
  on conflict (recipient_id, inviter_id) do update set muted_until = excluded.muted_until;
  delete from public.party_invitations
  where recipient_id = caller_id and inviter_id = inviter_user_id;
  return result;
end;
$$;

revoke all on function private.party_invitation_is_available(public.party_invitations, uuid) from public;
revoke all on function public.get_party_invite_candidates(text) from public;
revoke all on function public.send_party_invitation(text) from public;
revoke all on function public.get_my_party_invitations() from public;
revoke all on function public.respond_to_party_invitation(uuid, boolean) from public;
revoke all on function public.mute_party_inviter(uuid) from public;

grant execute on function public.get_party_invite_candidates(text) to authenticated;
grant execute on function public.send_party_invitation(text) to authenticated;
grant execute on function public.get_my_party_invitations() to authenticated;
grant execute on function public.respond_to_party_invitation(uuid, boolean) to authenticated;
grant execute on function public.mute_party_inviter(uuid) to authenticated;
