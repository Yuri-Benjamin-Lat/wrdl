-- M10: battle snapshots may advance overdue battle phases before returning the
-- answer-free client view, so PostgreSQL must not treat the function as stable.

alter function private.battle_snapshot(uuid, uuid) volatile;
