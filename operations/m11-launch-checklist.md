# M11 invited beta and production launch checklist

M11 promotes the reviewed M10 staging revision into a separate production
environment. Staging and production must never share database records, users,
storage, OAuth redirect configuration, or secret credentials.

## Current status — 2026-09-08

- [x] M10 staging release, 100-client rehearsal, encrypted restore drill, and
      complete release check passed.
- [x] Production environment template is separate from staging.
- [x] Privacy-redacted Sentry SDK integration and public-surface smoke runner
      are implemented locally.
- [x] Review and commit the M3–M11 release revision on a release branch.
- [x] Free one Supabase project slot by deleting the disposable
      `wrdl-restore-test` project, only after explicit owner approval.
- [x] Create the production Supabase project and store its database password in
      the approved DPAPI-protected owner location.
- [x] Apply migrations to production, verify the remote migration ledger, and
      confirm that a post-push dry run reports no pending migrations. Database
      acceptance suites remain restricted to staging or disposable restore
      targets and must not run against production.
- [x] Create the Vercel project, assign production environment variables, and
      deploy the reviewed release revision.
- [x] Create the Sentry project, assign DSN/build credentials only in Vercel,
      and verify one redacted sample event.
- [ ] Add the deployed origin to Supabase and Google OAuth allowlists and verify
      sign-in/sign-out.
- [ ] Run public, authenticated, multiplayer, mobile, and recovery smoke tests.
- [ ] Complete invited testing across devices and networks; fix and retest any
      release-blocking defect.
- [ ] Record the final revision, deployment origin, backup result, smoke result,
      and owner acceptance without recording secrets or personal data.

## Launch verification — 2026-09-08

- Production deployment `AcrwuGjxHA1ZqkB7qG9zCnk7CNH4` reached Ready at
  `https://wrdl-web.vercel.app` from revision `e3f7e50`.
- The public production smoke passed for the home, sign-in, maintenance, icon,
  and unauthenticated private-API surfaces, including security headers and
  no-store caching.
- Sentry received one synthetic privacy-redacted verification event. Release
  `e3f7e50` was finalized for `vercel-production` with 400 source-map artifacts.
- Encrypted production backup `wrdl-20260908-180605.dump.gpg` was created in the
  approved owner-controlled location and its SHA-256 checksum matched.
- Before the M11 lobby correction, encrypted production backup
  `wrdl-20260908-235430.dump.gpg` was created in the approved owner-controlled
  location and its SHA-256 checksum matched. Migration
  `20260908010000_m11_ready_players_allow_host_settings.sql` then applied
  successfully, and the post-push dry run reports production is up to date.
- Production deployment `94ALaSk6Q8nrXkpM1EveY1XypS8E` reached Ready from
  revision `f16e5b4`. The public production smoke passed after deployment.
- Daily Wordle officially launched on 2026-09-09 Philippine Time. Puzzle #1 is
  published, and 90 protected future puzzles are scheduled through 2026-12-08;
  verification recorded counts, dates, and status only, without answers.
- The production Supabase site/callback URLs and Google OAuth production origin
  and callback are configured. Interactive sign-in/sign-out remains part of the
  invited-account smoke below.
- Remaining launch gates: authenticated, multiplayer, multi-device/mobile,
  maintenance/rollback, and owner-acceptance testing with synthetic beta users.

## Owner smoke progress — 2026-09-08

- Google sign-in is accepted.
- Daily unavailable-state testing is accepted. The owner requested activation
  on 2026-09-09; puzzle #1 is now available and gameplay testing is pending.
- Free Play has not yet been tested in production.
- Friend, privacy, and leaderboard behavior is accepted.
- Lobby testing found two release blockers: hosts could not change settings while
  another member was Ready, and missed or delayed lobby signals could prevent
  unanimous Ready from advancing every player without a browser refresh. The
  fixes are deployed and pass automated checks, but still require two-account
  production retesting.
- Battle gameplay, exit/rejoin, disconnect, result/history, and returned-lobby
  behavior still require production testing.
- Three-to-eight-player production testing is pending.
- Desktop presentation is provisionally accepted; mobile testing is pending.
- Maintenance and rollback rehearsal is pending.
- Further card and visual-design upgrades are deferred as post-MVP polish.

## Automated production smoke

After deployment, run:

```powershell
$env:WRDL_PRODUCTION_URL = "https://your-production-origin.example"
pnpm smoke:production
Remove-Item Env:WRDL_PRODUCTION_URL
```

The runner logs only routes, response statuses, and timings. It verifies HTTPS,
same-origin redirects, the public sign-in and maintenance surfaces, denial of an
unauthenticated private API request, no-store API caching, and production
security headers. It never logs response bodies, cookies, tokens, or secrets.

## Manual launch smoke

Use synthetic beta accounts only. Verify:

1. Google sign-in, first-time username setup, profile load, settings, and sign-out.
2. Daily unavailable/available behavior without exposing an answer.
3. Free Play round start, input, result, and next round.
4. Friend search/request/accept, privacy choices, and leaderboard visibility.
5. Invitation arrival, two-account lobby, Ready/Cancel Ready, and synchronized start.
6. Battle input, opponent progress, exit/rejoin, disconnect grace, result/history,
   Continue, and returned-lobby membership.
7. Three-to-eight-player layout and scoring with the available beta group.
8. Mobile navigation and gameplay on supported phone widths plus one desktop
   browser on a different network.
9. Maintenance screen and documented rollback path.

Stop the launch for answer exposure, cross-account access, authentication loops,
incorrect or duplicate results/rewards, unrecoverable multiplayer divergence,
or evidence of data loss.
