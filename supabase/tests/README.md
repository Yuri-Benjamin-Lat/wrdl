# Database tests

Do not run `supabase test db`, including with `--linked`. The Supabase CLI
implements that command through a downloaded `pg_prove` container, which is
outside WRDL's strictly Windows-native, no-Docker workflow. These SQL assertions
remain version-controlled for review and future execution through an approved
native database runner only.

Hosted development/staging database and Row Level Security tests will live
here. Fixtures must be synthetic, deterministic, and contain no protected word
schedule or real user data.

After installing the approved native PostgreSQL client and setting
`WRDL_STAGING_DATABASE_URL` in the current PowerShell process, run every test in
order with `./scripts/Invoke-WrdlDatabaseTests.ps1`. The runner refuses a URL
that matches `WRDL_PRODUCTION_DATABASE_URL`.

`001_m2_auth_profiles_settings.sql` verifies the hosted M2 tables, private avatar
bucket, RLS activation, and critical grants after the migration is applied.

`002_m3_free_play_preferences.sql` verifies the final two-pool Free Play
preference schema.

`003_m4_daily_foundation.sql` verifies that Daily answers and schedules are
inaccessible to browser roles, player records cannot bypass approved RPCs, and
only the answer-free snapshot, guess submission, and history contracts are
executable by authenticated players. It also verifies the distinct Missed
outcome and lifetime total.

`004_m5_social_privacy_leaderboards.sql` verifies that social records are not
directly readable by browser roles, the approved privacy-aware social/profile/
leaderboard contracts are callable, and the effective-streak helper remains
private.

`005_m5_multi_account_acceptance.sql` exercises the complete two-account M5
friendship, privacy, battle-history, leaderboard, crossed-request, and deletion
behavior inside a transaction that is always rolled back.

`006_m6_party_lobby_acceptance.sql` exercises two-account lobby creation,
online-friend invitation and acceptance, host controls and transfer, reusable
membership, Ready-state locking, automatic Match Starting, and private table
boundaries inside a transaction that is always rolled back.

`007_m7_two_player_battle_acceptance.sql` exercises reversible lobby Ready, the
atomic all-ready transition, the 30-second player-arrival barrier, synchronized
countdown release, startup cancellation without history/statistics, protected snapshots, duplicate-safe guesses,
color-only opponent progress, exact ties, explicit target sudden death,
sole-sudden-death completion, score/forfeit history labels, reusable-lobby
return, automatic forfeit-loser detachment, and direct-table/private-helper
denial.

`008_m8_multi_player_battle_acceptance.sql` covers every supported 3–8-player
population, protected full-roster snapshots, dense placement points, shared
ties, failed solvers, fixed-round completion without sudden death, full arrival
barrier fallback, immediate host succession, below-two-player preservation and
recovery/expiry, preservation-before-resolution precedence, complete history
standings, and individual reusable-lobby
continuation.

`009_m9_connection_control.sql` verifies that opening a battle in a second tab
or device cannot silently take control, **Continue here** transfers ownership,
the superseded connection can no longer heartbeat, and refreshing the active
controlling tab preserves its authority. It also verifies that sign-out records
an immediate disconnection and that the final connected player's sign-out
immediately voids the battle.

`010_m10_hundred_player_capacity.sql` creates 100 synthetic authenticated players
across mixed 2–8-player battles, connects every player, submits a 100-command
burst, verifies answer-free responses, and replays a command to prove exactly-once
persistence. Everything runs inside a transaction that is always rolled back.
This deterministic SQL fixture intentionally executes in one database session.
The separate live staging transport rehearsal reached 100 concurrent Realtime
connections with 100% probe delivery on 2026-09-03.
