-- Presence heartbeats update last_seen_at but must not emit party_changed and
-- cause every member to reload in a loop. Signal only visible membership state.

drop trigger party_members_signal_change on public.party_members;

create trigger party_members_signal_change
after insert or delete or update of is_ready, returned_to_lobby
on public.party_members
for each row execute function private.signal_party_change();

