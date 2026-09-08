-- Hosts may tune match settings while one or more members are Ready. Settings
-- become immutable only after the lobby has entered the match-start sequence.

create or replace function public.update_party_settings(new_rounds integer, new_timer_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  party_row public.parties;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if new_rounds not in (1, 3, 5) then raise exception 'Rounds must be 1, 3, or 5' using errcode = '22023'; end if;
  if new_timer_seconds not between 60 and 600 or new_timer_seconds % 30 <> 0 then
    raise exception 'Round timer must be 1–10 minutes in 30-second increments' using errcode = '22023';
  end if;

  select party.* into party_row
  from public.parties as party
  join public.party_members as member on member.party_id = party.id
  where member.user_id = caller_id for update of party;

  if party_row.id is null then raise exception 'Party not found' using errcode = 'P0002'; end if;
  if party_row.host_id <> caller_id then raise exception 'Host control required' using errcode = '42501'; end if;
  if party_row.phase <> 'lobby' then
    raise exception 'Party settings are locked' using errcode = '55000';
  end if;

  update public.parties
  set rounds_configured = new_rounds,
      round_timer_seconds = new_timer_seconds,
      state_version = state_version + 1
  where id = party_row.id;
  update public.user_settings
  set preferred_battle_rounds = new_rounds,
      preferred_battle_timer_seconds = new_timer_seconds
  where user_id = caller_id;
  return private.party_snapshot(caller_id, party_row.id);
end;
$$;

revoke all on function public.update_party_settings(integer, integer) from public, anon;
grant execute on function public.update_party_settings(integer, integer) to authenticated;
