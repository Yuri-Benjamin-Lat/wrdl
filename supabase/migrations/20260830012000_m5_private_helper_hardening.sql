-- M5 hardening: private helpers are reachable only through approved public
-- security-definer contracts, never directly by browser roles.

revoke all on function private.are_friends(uuid, uuid) from public;
revoke all on function private.can_view_audience(uuid, uuid, public.wrdl_audience) from public;
revoke all on function private.social_relationship(uuid, uuid) from public;
revoke all on function private.social_player_json(uuid, uuid) from public;
revoke all on function private.effective_daily_streak(uuid) from public;

