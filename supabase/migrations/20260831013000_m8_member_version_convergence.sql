-- M8 convergence: every visible member-state change advances the parent battle
-- version. Equal-version snapshots can therefore never overwrite a newer
-- connection, host-notification, score, placement, or continuation state.

create or replace function private.bump_battle_member_state_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.battles
  set state_version = state_version + 1
  where id = new.battle_id;
  return new;
end;
$$;

drop trigger if exists battle_members_bump_parent_version on public.battle_members;
create trigger battle_members_bump_parent_version
after update of total_points, last_round_points, round_rank, round_status,
  accepted_guess_count, completion_centiseconds, is_connected, disconnected_at,
  reconnect_deadline, continued_at, final_rank, became_host_at
on public.battle_members
for each row
when (
  old.total_points is distinct from new.total_points
  or old.last_round_points is distinct from new.last_round_points
  or old.round_rank is distinct from new.round_rank
  or old.round_status is distinct from new.round_status
  or old.accepted_guess_count is distinct from new.accepted_guess_count
  or old.completion_centiseconds is distinct from new.completion_centiseconds
  or old.is_connected is distinct from new.is_connected
  or old.disconnected_at is distinct from new.disconnected_at
  or old.reconnect_deadline is distinct from new.reconnect_deadline
  or old.continued_at is distinct from new.continued_at
  or old.final_rank is distinct from new.final_rank
  or old.became_host_at is distinct from new.became_host_at
)
execute function private.bump_battle_member_state_version();

revoke all on function private.bump_battle_member_state_version() from public, anon, authenticated;
