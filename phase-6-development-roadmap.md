# WRDL — Phase 6: Development Roadmap

## Document Purpose

This document turns the approved Phase 1–5 specifications, polished HTML previews, and technical architecture into an ordered implementation plan. Each milestone must leave WRDL in a working, testable state and must include its database, security, responsive UI, accessibility, and automated tests rather than postponing those concerns until the end.

**Status:** Complete — roadmap approved; M0 development started

---

## 1. Sources of Truth

Development follows these approved sources:

1. `phase-1-product-requirements.md` — product behavior, scoring, privacy, and rules
2. `phase-2-user-journeys.md` — flows, errors, recovery, and edge cases
3. `phase-3-ux-wireframes.md` — screen structure and responsive behavior
4. `phase-4-visual-design-system.md` — visual language, components, states, and motion
5. `phase-5-technical-architecture.md` — stack, data ownership, security, contracts, testing, and operations
6. Polished `wrdl-*-preview.html` files — visual implementation references

A preview is a visual reference, not production code. Production uses shared React components and approved design tokens rather than copying each preview into an isolated page.

---

## 2. Definition of MVP Complete

The MVP is complete only when:

- Google sign-in, username setup, sign-out, and account deletion work safely.
- Daily Wordle, Free Play, profiles, friends, leaderboards, invitations, and two-to-eight-player Friendly Battles match the approved rules.
- Desktop and mobile production screens match the approved polished previews closely.
- Privacy, protected answers, scoring, timers, reconnect behavior, and one-active-battle control are server-authoritative.
- Required automated tests and the manual staging checklist pass.
- Backups have been restored successfully in an isolated environment.
- Invited beta testing has no unresolved critical or high-severity defects.
- Production monitoring, maintenance behavior, and rollback procedures are ready.

A page looking complete without its real validation, persistence, permissions, responsive behavior, and tests does not count as a finished feature.

---

## 3. Development Strategy

### 3.1 Build Vertical Slices

WRDL is built as usable vertical slices. A slice includes the visible screen, client behavior, secure server operation, database migration, access control, errors, and tests. This avoids completing every screen visually while leaving the real game rules until the end.

### 3.2 Shared Foundations First

The WRDL logo, typography, colors, spacing, navigation, buttons, inputs, dialogs, notifications, player rows, Wordle grid, and keyboard are shared components. Later milestones extend these foundations instead of recreating them.

### 3.3 Production Safety Throughout

- Every migration is reversible through a tested forward-recovery migration or restore procedure.
- Protected answers and service credentials never enter browser bundles, logs, fixtures committed to source control, or monitoring payloads.
- Feature work is not complete until tests cover success, failure, and concurrency-sensitive behavior.
- Staging is updated before production and uses separate data and credentials.

---

## 4. Milestone Roadmap

Effort estimates assume one developer working carefully, include implementation and milestone-level testing, and are not calendar promises. Waiting for user review, provider configuration, beta feedback, and defect correction may extend calendar time.

| Milestone | Outcome | Estimated effort |
|---|---|---:|
| M0 — Repository and environments | Reproducible frontend project, CI, hosted development/staging Supabase connection | 2–3 working days |
| M1 — Design foundation and application shell | Shared WRDL design system, navigation, themes, responsive shell | 4–6 working days |
| M2 — Authentication, profiles, and settings | Real accounts, username flow, profile editing, avatars, privacy/settings | 5–8 working days |
| M3 — Word engine and Free Play | Tested Wordle rules and complete memory-only Free Play | 5–7 working days |
| M4 — Daily Wordle | Philippine Daily schedule, saved progress, results, streak/EXP, sharing | 6–9 working days |
| M5 — Friends, activity, and leaderboards | Search, requests, friendships, profiles, histories, ranked lists | 7–10 working days |
| M6 — Invitations and reusable battle lobby | Party lifecycle, lobby settings, Ready flow, host controls, invitations | 6–9 working days |
| M7 — Two-player Friendly Battle | Authoritative rounds, scoring, ties, sudden death, reconnect win rules | 8–12 working days |
| M8 — Three-to-eight-player Friendly Battle | Dense placement, shared progress, overlays, preservation, tied results | 8–12 working days |
| M9 — Supporting and cross-device states | Offline, stale, loading, maintenance, second-device control, recovery polish | 5–8 working days |
| M10 — Security, performance, and release hardening | Full regression, load tests, accessibility, backup restore, optimization | 8–12 working days |
| M11 — Invited beta and production MVP | Friend beta, fixes, release rehearsal, monitored production launch | 4–6 working days |

**Manual solo-development baseline:** approximately **68–102 focused working days**, or roughly **14–20 full-time working weeks** before allowance for major redesigns or long beta-feedback gaps.

**Working estimate with Codex performing most implementation:** approximately **25–45 active development days**. This is not a strict calendar deadline: the owner may review whenever convenient, while multiplayer testing, external account configuration, visual revisions, and invited-beta feedback remain the main sources of elapsed time.

---

## 5. Milestone Details and Acceptance Gates

### M0 — Repository and Environments

**Build**

- Create the Next.js App Router project with React, TypeScript, CSS Modules, formatting, linting, and strict type checking.
- Establish the production folder structure for routes, shared components, domain logic, server operations, tests, and database migrations.
- Configure the Fredoka font and the approved icon approach without importing the preview sandbox itself.
- Initialize version-controlled Supabase migrations, hosted development/staging linkage, test fixtures, environment validation, and separate development/staging and production configuration templates without Docker.
- Add CI checks for install, lint, type check, unit tests, and production build.
- Add secret scanning and prevent local environment files, dumps, generated avatars, and protected word schedules from being committed.

**Gate**

- A new trusted checkout can start the WRDL frontend locally from documented commands and connect to its authorized hosted development/staging backend without Docker.
- CI passes from a clean checkout.
- No secret or production identifier exists in the repository.

### M1 — Design Foundation and Application Shell

**Reference previews**

- `wrdl-logo-type-options-preview.html`
- `wrdl-component-styles-preview.html`
- `wrdl-gameplay-styles-preview.html`
- `wrdl-icons-status-preview.html`
- `wrdl-entry-home-polished-preview.html`

**Build**

- Implement approved light/dark themes, high-contrast tiles, typography, colors, spacing, radii, elevation, motion, and reduced-motion behavior.
- Build the responsive WRDL logo, desktop navigation, mobile menu, screen header, game cards, buttons, fields, steppers, dropdowns, toasts, dialogs, avatars, status dots, skeletons, grid, and keyboard.
- Build Sign In, Username Setup, and Home presentation against static fixtures.
- Create a private development component gallery or Storybook-equivalent route for shared states.

**Gate**

- Shared components match the polished references at desktop, 360-pixel mobile, and the 320-pixel minimum.
- Keyboard and screen-reader navigation work for all foundational controls.
- Light, dark, high-contrast, and reduced-motion checks pass.

### M2 — Authentication, Profiles, and Settings

**Reference previews**

- `wrdl-entry-home-polished-preview.html`
- `wrdl-social-profile-polished-preview.html`
- `wrdl-rankings-settings-polished-preview.html`
- `wrdl-supporting-states-polished-preview.html`

**Build**

- Implement Google authentication, callback recovery, first-account username setup, case-insensitive uniqueness, username change cooldown, and sign-out.
- Add profile/settings migrations, RLS, privacy-aware reads, account-synced preferences, bio and display-name editing.
- Implement avatar selection, square crop/reposition, 512 × 512 processing, upload, replacement, removal, and silhouette fallback.
- Implement account deletion, fresh-auth requirement, anonymization, storage cleanup, and username reservation.
- Connect the authenticated application shell and supporting authentication/error states.

**Gate**

- A new user can sign in, claim a valid username, edit their profile/settings, replace/remove an avatar, sign out, return, and delete the account.
- Invalid or conflicting username requests cannot bypass server validation.
- Private fields remain hidden under direct database/API access tests.

### M3 — Word Engine and Free Play

**Reference previews**

- `wrdl-solo-polished-preview.html`
- `wrdl-gameplay-styles-preview.html`

**Build**

- Create the curated answer and accepted-guess catalogs with documented licensing/source review.
- Implement and exhaustively test five-letter validation and repeated-letter evaluation.
- Build Common, Uncommon, and Rare Free Play selection with Common always enabled and the approved independent toggles.
- Implement the complete grid/keyboard interaction, typing during flips, invalid-word shake, sounds, win confetti, failure result, and Next Word.
- Keep the current round memory-only while persisting only word-pool preferences.
- Support continuing an already-open Free Play round during a temporary network interruption.

**Gate**

- Evaluation passes a comprehensive repeated-letter test table.
- Free Play works from setup through repeated rounds on desktop and mobile.
- Refreshing or leaving destroys the round and creates no statistics, history, EXP, or Share Results data.

### M4 — Daily Wordle

**Reference previews**

- `wrdl-solo-polished-preview.html`
- `wrdl-supporting-states-polished-preview.html`

**Build**

- Add protected puzzle schedule, permanent puzzle numbering, Philippine-date authority, reset/repair operations, and account-creation-day eligibility.
- Implement duplicate-safe server guess submission, saved progress, Win/Failed/Missed/Voided outcomes, streak, EXP, and the last 30 eligible cards.
- Implement midnight screen reset behavior and no-answer failed result.
- Generate the approved 1080 × 1080 spoiler-free result PNG, copy it to the clipboard, and provide the download fallback.
- Add offline, retry, expired-day, and service-failure behavior.

**Gate**

- Tests cross Philippine midnight, month/year boundaries, account-creation day, missed days, late guesses, duplicate retries, and two-tab submissions.
- The answer is inaccessible through browser data, Realtime traffic, ordinary queries, logs, and failed-result payloads.
- Copied and downloaded images contain the correct constant 5 × 6 layout and no letters or answer.

### M5 — Friends, Activity, and Leaderboards

**Reference previews**

- `wrdl-social-profile-polished-preview.html`
- `wrdl-rankings-settings-polished-preview.html`

**Build**

- Implement per-character username search with safe debouncing, requests, accept/decline/cancel, unfriend, aliases, and battle-invite blocking.
- Implement Friends ordering/filter choices, online/last-online privacy, throttled activity updates, and private user events.
- Complete own/friend profiles, spoiler-aware Daily cards, expandable statistics, and latest-20 battle history standings.
- Implement global and friends streak leaderboards, dense ties, colored flames, fixed current-player row, and one-minute fallback refresh.

**Gate**

- Pending requests never count as friends or invitation eligibility.
- Privacy combinations pass owner/friend/authenticated-stranger tests.
- Hidden activity never leaks its real state or timestamp.
- Leaderboard rank, ties, removal after unfriend, and current-player placement are correct.

### M6 — Invitations and Reusable Battle Lobby

**Reference previews**

- `wrdl-battle-lobby-polished-preview.html`
- `wrdl-supporting-states-polished-preview.html`

**Build**

- Implement Party records, private channels, host preference persistence, rounds/timer steppers, two-to-eight-player membership, and reusable returned lobbies.
- Implement online-friend invitations, invitation bubble/panel, Accept/Decline, removal when unavailable, and blocked-invite rules.
- Implement host transfer, pre-game/returned-lobby removal, host crown, Leave, Ready/Cancel Ready for everyone, and the automatic all-ready start countdown.
- Lock settings, membership changes, host actions, Ready cancellation, and invitations at Match Starting.

**Gate**

- Simultaneous joins, invitation acceptance, Ready cancellation, host transfer, removal, and start attempts produce one authoritative result.
- The host cannot remove anyone after Match Starting.
- Every participant enters the same countdown and first-round state.

### M7 — Two-Player Friendly Battle

**Reference previews**

- `wrdl-active-battle-polished-preview.html`
- `wrdl-between-rounds-polished-preview.html`
- `wrdl-battle-complete-polished-preview.html`

**Build**

- Implement protected shared answer selection, server-clock timer, duplicate-safe guesses, color-only opponent progress, and post-finish letter access.
- Implement one-point rounds, target-based early match conclusion, exact two-decimal ties, 0–0 rounds, and two-player-only sudden death.
- Implement 30-second disconnect grace without pausing, continued connected-player input, automatic win on expiry, and host outcome behavior.
- Implement fixed 10-second standings intermission, synchronized next-round countdown, final results, history/statistics, and Continue to the original lobby.

**Gate**

- Race tests cover simultaneous correct guesses, deadline submissions, disconnect during submission, match-winning point during grace, and tied final scheduled rounds.
- Reconnect restores the exact authoritative screen without restarting timers.
- Results and statistics commit exactly once.

### M8 — Three-to-Eight-Player Friendly Battle

**Reference previews**

- `wrdl-active-battle-polished-preview.html`
- `wrdl-between-rounds-polished-preview.html`
- `wrdl-battle-complete-polished-preview.html`

**Build**

- Extend opponent-card layouts and scrolling for up to eight players without changing the shared game engine.
- Implement dense completion placement and the approved 3-player and 4–8-player point tables.
- Implement finished, disconnected, and split finished/disconnected overlays.
- Implement immediate disconnected-host transfer, no per-player reconnect countdown, and the 20-second below-two-connected preservation rule.
- Implement tied round/final rows, no sudden death, full scheduled-round completion, and returned-lobby behavior.

**Gate**

- Tests cover every player count from three through eight, all scoring placements, multi-way exact ties, failures, disconnect combinations, host loss, preservation recovery/expiry, and returned members still on results.
- All clients converge on identical standings, deadlines, host, and phase after missed or reordered events.

### M9 — Supporting and Cross-Device States

**Reference preview**

- `wrdl-supporting-states-polished-preview.html`

**Build**

- Finish shaped loading states, page/blocking errors, maintenance, offline banner, two-second Back online confirmation, and stale-action notifications.
- Implement one controlling battle connection, Battle active elsewhere, Continue here, and Battle opened elsewhere.
- Implement two-second battle and 10-second lobby/social fallback checks while Realtime is unavailable.
- Verify sign-out, expired authentication, refresh, browser close, and voluntary Exit across every game mode.

**Gate**

- Recovery tests prove valid input is not silently lost and stale clients cannot mutate current state.
- Every supporting state works with keyboard, touch, mobile navigation, and reduced motion.

### M10 — Security, Performance, and Release Hardening

**Build and verify**

- Run the complete unit, database, component, integration, end-to-end, accessibility, and recovery suites.
- Perform threat review of answers, RLS, storage, invitations, privacy, rate limits, command replay, cross-account access, and logs.
- Load-test 100 simultaneous connected players with mixed two-to-eight-player battles and burst commands.
- Profile production bundles, database queries, Realtime payloads, memory, avatar processing, and result-image generation.
- Run encrypted backup and isolated restore drills.
- Complete production runbooks for deployment, rollback, paused backend, maintenance, Daily voiding, and account/data recovery.

**Gate**

- No open critical or high-severity security, correctness, accessibility, data-loss, or multiplayer convergence defect.
- Free-tier usage stays within the approved safety margin.
- A clean staging release and restore rehearsal pass.

### M11 — Invited Beta and Production MVP

**Build and verify**

- Run a private internal pass, then invite a small friend group across different devices and networks.
- Collect structured reports for confusing flows, slow operations, visual differences, disconnects, and failed sharing/upload behavior.
- Fix release-blocking issues and repeat affected regression/load checks.
- Verify production configuration, OAuth callbacks, monitoring, backups, quota alerts, maintenance screen, and owner access.
- Deploy production manually and complete the smoke-test checklist.

**Gate**

- Core journeys succeed on the supported browser/device matrix.
- Production has no unresolved critical or high-severity defect.
- Phase 6 is complete and the MVP enters controlled use.

---

## 6. Dependency Order

```text
M0 Repository
 └─ M1 Design foundation
     ├─ M2 Auth / profiles / settings
     │   ├─ M4 Daily Wordle
     │   └─ M5 Friends / leaderboards
     └─ M3 Word engine / Free Play
         ├─ M4 Daily Wordle
         └─ M6 Battle lobby
             └─ M7 Two-player battle
                 └─ M8 Three-to-eight-player battle
                     └─ M9 Cross-device recovery
                         └─ M10 Hardening
                             └─ M11 Beta / production
```

M2 and M3 may overlap only if separate work does not create conflicting changes to the shared application shell. M4 requires both authenticated persistence and the tested word engine. Multiplayer begins only after the shared word engine and account/social identity are stable.

---

## 7. Milestone Working Rules

- Only one milestone is considered the current release target at a time.
- A milestone begins with a short task breakdown and acceptance-test list derived from this document.
- Every completed screen is compared directly with its polished desktop/mobile reference.
- Product behavior changes discovered during development are recorded in the applicable earlier phase before implementation.
- New scope is not silently inserted into an active milestone; it is assessed for MVP necessity and dependency impact.
- Each milestone ends with updated documentation, test evidence, and a concise list of remaining known issues.
- Commits should be small enough to review and should not mix unrelated refactors with feature behavior.

---

## 8. Main Delivery Risks

| Risk | Planned control |
|---|---|
| Free Supabase project pauses during occasional use | Owner warning-email monitoring, pre-session availability check, maintenance behavior, documented resume runbook |
| Protected word or guessed-letter leakage | Restricted schemas/functions, minimal event payloads, RLS tests, log/monitoring filtering |
| Multiplayer race conditions | Versioned state machine, database transactions, command receipts, concurrent integration tests |
| Realtime messages missed or reordered | Durable snapshots, monotonic versions, reconnect reload, temporary fallback checks |
| UI drifts from approved previews | Shared components, screenshot comparisons, milestone visual review at desktop/mobile sizes |
| Dictionary quality or licensing problems | Curated reviewed source record, separate answer/guess pools, automated catalog validation |
| Free-tier quota exhaustion | Compact payloads, cleanup, 100-connection target, staged availability, usage monitoring |
| Browser clipboard or image differences | Standard PNG generation tests and required download fallback |
| Scope expansion delays the MVP | Fixed Definition of Done, milestone gates, explicit post-MVP list |

---

## 9. Approved Working Arrangement

- There is no strict weekly-hours commitment or deadline; the owner reviews and participates whenever convenient.
- The owner is the only human developer and works with Codex, which performs most implementation, migration, testing, and debugging work.
- WRDL uses a private GitHub repository for version history, CI, and deployment integration. Private is preferred because the project will eventually contain unreleased architecture, security-sensitive configuration templates, and development history; actual secrets remain excluded even from the private repository.
- M0 begins immediately after approval of this roadmap.
- Progress is reported by milestone acceptance gates rather than time spent.

**Decision:** Approved in full. The milestone order, quality gates, Codex-assisted estimate, private-repository approach, and immediate M0 start are final.

---

**Document Status:** Complete — development roadmap approved and M0 started.
