# Incidents and recovery

## Paused or unavailable Supabase project

1. Check the Supabase dashboard and the owner warning email before changing code.
2. Resume the project from its dashboard when it is paused.
3. Keep the existing maintenance/error experience visible while the database is
   starting; do not repeatedly submit mutations.
4. Run `pnpm backend:check`, then verify sign-in, one read, one safe write, and a
   two-account Realtime update.
5. If availability does not return, keep maintenance enabled and follow the
   provider incident status. Do not rotate credentials unless compromise is
   suspected.

## Maintenance mode

Enable the hosting project's documented maintenance environment switch and
redeploy the already-reviewed revision. Verify `/maintenance` is reachable and
that protected routes cannot create new gameplay mutations. Disable the switch
and redeploy only after database and application smoke checks pass.

## Daily puzzle void

1. Identify the Philippine puzzle date and confirm the wrong or unsafe puzzle in
   the private schedule using the dashboard SQL editor.
2. Void only that date with the version-controlled administrative SQL procedure;
   include a short non-sensitive reason.
3. Verify active players receive the voided state, no answer is exposed, streaks
   are not harmed, and the following date remains scheduled.
4. Record the date, reason category, and verification result without recording
   the answer.

## Account and data recovery

- Authentication access: verify the OAuth provider and callback origin first.
  Never manually assign another person's identity to an account.
- Username/profile: restore only owner-scoped rows after confirming the auth user
  ID. Aliases remain visible only to the friend who created them.
- Avatar: replace or remove only objects whose first storage path segment equals
  the authenticated user ID.
- Gameplay result: never rewrite a result from a screenshot alone. Reconcile the
  immutable command/result records and add a forward-fix migration if needed.
- Account deletion: use the authenticated deletion flow. A backup is disaster
  recovery, not a way to bypass a completed deletion request.

## Friendly Battle recovery

Use the durable snapshot as authority. Do not restart timers from browser state.
For a stuck battle, first run the appropriate repair function through the normal
authenticated snapshot path. If every member is disconnected, the battle must
be voided rather than revived. If history already committed, do not commit it a
second time.
