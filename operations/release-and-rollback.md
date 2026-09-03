# Release and rollback

## Before a staging release

1. Confirm staging and production are separate Supabase and hosting projects.
2. Confirm all required environment values are assigned in the target project;
   never paste their values into an issue, log, command transcript, or commit.
3. Run `pnpm release:check` and save only its pass/fail summary.
4. Run `./scripts/Invoke-WrdlDatabaseTests.ps1` against staging. It executes the
   rollback-only database acceptance suite described in `supabase/tests/README.md`.
5. Inspect the pending migration list, then apply it to staging.
6. Check Home, Daily, Free Play, Friends, Leaderboards, Profile, and a two-account
   Friendly Battle on desktop and mobile widths.
7. Confirm OAuth returns to the exact staging origin and that sign-out clears the
   session.

## Production release

1. Create and verify an encrypted pre-release backup.
2. Put the app into maintenance only when a migration is not backward compatible.
3. Apply the already-rehearsed migrations in order. Never edit an applied
   migration.
4. Deploy the same reviewed revision that passed staging.
5. Run the smoke checklist: sign in, profile load, Daily load, Free Play round,
   friend list, invitation arrival, two-account lobby, battle start, exit/rejoin,
   result persistence, sign out.
6. Review server errors, authentication failures, database size, storage use,
   Realtime use, and egress. Do not record answer text, guesses, usernames, email
   addresses, tokens, or full request bodies.
7. Remove maintenance mode after the smoke checklist passes.

## Rollback decision

Roll back immediately for protected-answer exposure, cross-account data access,
incorrect results, duplicate rewards/history, unrecoverable battle convergence,
authentication loops affecting most users, or evidence of data loss.

For an app-only defect, redeploy the last known-good revision. For a database
defect, prefer a forward-fix migration. Restore a backup only when a forward fix
cannot preserve correctness; restoration requires an isolated rehearsal first.
Keep maintenance enabled until the repaired system passes the smoke checklist.

Record the affected revision, first observed time, user-visible impact, repair,
and tests added. Store no personal or protected gameplay data in the incident
record.
