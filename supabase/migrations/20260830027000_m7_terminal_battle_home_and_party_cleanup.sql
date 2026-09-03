-- M7 acceptance correction: a two-player forfeit loser no longer remains
-- attached to the completed battle or its reusable party. Fully voided battles
-- remain attached only long enough to show each player the Home notification.

create or replace function private.detach_two_player_forfeit_loser()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phase <> 'battle_complete'
    or new.completion_reason <> 'forfeit'
    or new.player_count <> 2
    or new.winner_id is null then
    return new;
  end if;

  update public.battle_members
  set continued_at = coalesce(continued_at, clock_timestamp())
  where battle_id = new.id and user_id <> new.winner_id;

  delete from public.party_members
  where party_id = new.party_id and user_id <> new.winner_id;

  return new;
end;
$$;

revoke all on function private.detach_two_player_forfeit_loser() from public;

drop trigger if exists battle_detach_two_player_forfeit_loser on public.battles;
create trigger battle_detach_two_player_forfeit_loser
after update of phase on public.battles
for each row execute function private.detach_two_player_forfeit_loser();

-- Repair only a currently attached terminal forfeit. Historical Party rows may
-- have been reused for later matches and must never be rewritten here.
update public.battle_members as member
set continued_at = coalesce(member.continued_at, clock_timestamp())
from public.battles as battle
join public.parties as party on party.active_battle_id = battle.id
where member.battle_id = battle.id
  and battle.phase = 'battle_complete'
  and battle.completion_reason = 'forfeit'
  and battle.player_count = 2
  and battle.winner_id is not null
  and member.user_id <> battle.winner_id;

delete from public.party_members as member
using public.battles as battle, public.parties as party
where party.active_battle_id = battle.id
  and member.party_id = party.id
  and battle.phase = 'battle_complete'
  and battle.completion_reason = 'forfeit'
  and battle.player_count = 2
  and battle.winner_id is not null
  and member.user_id <> battle.winner_id;
