# M10 security review

| Area                 | Control and evidence                                                                                                                                                            | Status                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Daily answers        | Stored in `private`; browser roles have no schema access; snapshots omit answers                                                                                                | Covered by migrations and database tests            |
| Battle answers       | Stored in `private.battle_rounds`; opponent snapshots expose colors/progress only                                                                                               | Covered by M7/M8 tests                              |
| Row access           | RLS enabled on profiles, settings, social, party, battle, history, and Daily player tables                                                                                      | Statically gated and database-tested                |
| Avatars              | Private bucket, owner path policy, MIME allowlist, size limit                                                                                                                   | Statically gated and database-tested                |
| Invitations          | Authenticated RPCs validate friendship, online state, blocks, lobby state, and membership                                                                                       | Covered by M6 acceptance tests                      |
| Privacy              | Friend aliases are viewer-private; visibility rules stay server-authoritative                                                                                                   | Covered by M5 acceptance tests                      |
| Replay               | Daily and battle commands carry unique command IDs and return prior durable state on replay                                                                                     | Covered by M4/M7/M9 tests                           |
| Cross-account access | Direct private tables/functions are revoked; synthetic multi-account tests exercise denial                                                                                      | Covered by M4–M9 tests                              |
| Function privileges  | Browser roles receive only the explicitly allowlisted public RPCs; private helpers and administrative Daily operations remain unavailable                                       | Hardened and verified on staging/restored backup    |
| Browser hardening    | CSP, framing denial, MIME sniffing denial, referrer and permissions policy, HSTS in production                                                                                  | Unit- and build-gated                               |
| Accessibility        | One main landmark per page, explicit raw-button types, image alternatives, document language, responsive overflow, and browser-console review                                   | Static, lint, and authenticated browser checks pass |
| Secrets and logs     | Environment files/backups are ignored; secret scanner rejects known credentials; application errors use fixed event codes and optional validated digests without raw error text | CI-gated; production sink review required           |
| Abuse limits         | Word submissions are bounded by authenticated state, six guesses, deadlines, and unique commands; activity writes are server-throttled                                          | Implemented; live usage below 70% safety threshold  |
| Dependencies         | Production dependency advisory review completed on 2026-09-02 with no known vulnerabilities reported                                                                            | Completed                                           |
| Backup recovery      | Encrypted staging backup restored into a disposable project; application hooks and all ten rollback-only database suites passed                                                 | Completed 2026-09-03                                |

The Supabase Free-plan dashboard was reviewed on 2026-09-03: no quota was
exceeded and every tracked service remained below WRDL's 70% safety threshold.
Free-plan quota notifications go to the organization's billing email; custom
spend-threshold alerts are not available on this plan.

Local staging OAuth is configured for `localhost` and `127.0.0.1`, and its
Google callback URL matches the staging project. The two checks that require a
real deployed origin remain open: add and verify the hosted OAuth callback, then
send privacy-safe sample failures through the production monitoring sink. Both
are repeated in M11 because no hosted WRDL environment or monitoring account
exists yet.
