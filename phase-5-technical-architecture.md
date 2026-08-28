# WRDL — Phase 5: Technical Architecture

## Document Purpose

This document translates the approved product requirements, user journeys, wireframes, and visual design system into an implementation plan for WRDL. It defines the application stack, system boundaries, data ownership, persistence rules, real-time multiplayer behavior, security model, and deployment approach before development begins.

**Status:** Complete — final architecture audit passed

---

## 1. Sources of Truth

Implementation must follow the approved planning documents in this order:

1. `phase-1-product-requirements.md` for product rules and scoring.
2. `phase-2-user-journeys.md` for flows, edge cases, and recovery behavior.
3. `phase-3-ux-wireframes.md` for screen structure and responsive behavior.
4. `phase-4-visual-design-system.md` for visual rules, components, themes, and motion.

If two documents appear to conflict, the newest explicit decision recorded in the planning documents takes priority. A genuine unresolved conflict must be clarified before implementation.

### 1.1 Polished HTML Previews

The polished HTML previews are the visual source of truth during UI development. They are not disposable concept files. Their layout, responsive behavior, spacing, typography, colors, controls, interaction examples, and screen states should be translated into reusable production components.

| Screen group | Reference preview |
|---|---|
| Entry and Home | `wrdl-entry-home-polished-preview.html` |
| Solo games and results | `wrdl-solo-polished-preview.html` |
| Friends and Profiles | `wrdl-social-profile-polished-preview.html` |
| Leaderboards and Settings | `wrdl-rankings-settings-polished-preview.html` |
| Battle Setup and Lobby | `wrdl-battle-lobby-polished-preview.html` |
| Active Battle | `wrdl-active-battle-polished-preview.html` |
| Between Rounds | `wrdl-between-rounds-polished-preview.html` |
| Battle Complete | `wrdl-battle-complete-polished-preview.html` |
| Supporting States | `wrdl-supporting-states-polished-preview.html` |

The production UI should reuse their design decisions, not copy each preview into an isolated production page. Shared elements such as the WRDL logo, navigation, buttons, tiles, keyboard, player rows, dropdowns, overlays, notifications, and dialogs must become shared components.

---

## 2. Phase 5 Roadmap

1. **Platform and stack** — choose the frontend, backend, database, authentication, real-time service, file storage, and hosting.
2. **Application boundaries** — decide what runs in the browser, application server, database, and real-time layer.
3. **Data model and security** — define the main tables, relationships, privacy enforcement, validation, and access policies.
4. **Word and Daily Wordle engine** — define word pools, guess validation, Philippine-date puzzle scheduling, daily resets, progress, and statistics.
5. **Friendly Battle engine** — define the authoritative state machine, lobby state, initial ready-up, automatic intermissions, timers, scoring, disconnects, reconnects, and host transfer.
6. **API and real-time contracts** — define commands, events, error responses, idempotency, and synchronization rules.
7. **Client state, offline behavior, and media** — define temporary state, account-synced settings, avatar storage, and Share Results image generation.
8. **Testing, deployment, and operations** — define environments, automated tests, monitoring, backups, rate limits, and release workflow.
9. **Final architecture audit** — verify every approved Phase 1–4 rule has an implementation owner and no technical questions remain before Phase 6.

---

## 3. Approved MVP Stack

| Area | Recommendation | Reason for WRDL |
|---|---|---|
| Web application | Next.js App Router with React and TypeScript | Responsive application routing, server and client code in one project, and strong TypeScript support |
| Styling | CSS Modules plus shared CSS custom properties | Lets development closely reproduce the approved HTML/CSS previews without imposing a component library's appearance |
| Authentication | Supabase Auth with Google | Matches the approved Google-only sign-in flow |
| Database | Supabase Postgres | Relational data fits users, friendships, daily attempts, battles, standings, and privacy rules |
| Real-time transport | Supabase Realtime private channels | Supports lobby events, battle progress, presence, invitations, and synchronized screen changes |
| Secure game operations | Postgres functions and short-lived server/Edge Function endpoints | Keeps answers, scoring, timers, permissions, and match transitions authoritative rather than trusting clients |
| Avatar storage | Supabase Storage | Stores optional player-uploaded profile pictures with a default silhouette fallback |
| Frontend hosting | Vercel | Straightforward deployment and preview environments for Next.js |
| Testing | Vitest, React Testing Library, and Playwright | Covers game logic, components, and complete desktop/mobile user journeys |

**Decision:** Approved. The MVP will use this stack unless later technical testing identifies a material problem.

### 3.1 Why this is the current recommendation

- It keeps the MVP in one TypeScript-centered development workflow.
- Managed authentication, Postgres, storage, and real-time infrastructure avoid building those systems from scratch.
- The relational database can enforce unique usernames, friendships, privacy, and authoritative battle updates.
- It is suitable for an MVP while leaving a path to replace the battle transport or application server later if real-world scale requires it.

### 3.2 Important implementation rule

The client may display optimistic feedback, but it must never be authoritative for Daily Wordle completion, battle answers, timers, placements, points, host privileges, friendship state, or leaderboard values. The server/database validates each accepted action and publishes the resulting state.

### 3.3 Free-Tier Performance and Reliability Strategy

The initial backend and hosting must remain on free plans. Quality remains the priority; WRDL will use staged testing and will not be released merely to meet a rushed date.

The free plan does not mean every request is deliberately slowed. The main constraints are limited compute, quotas, possible serverless cold starts, automatic pausing after low activity, shorter log retention, and the absence of paid reliability guarantees and automatic backups.

WRDL will use the following approach to obtain the fastest practical response within those constraints:

- Create the Supabase project in **Southeast Asia (Singapore)**, the closest available primary region to the initial Philippine audience.
- Place database-heavy Vercel or Supabase functions in Singapore so application code and data do not make unnecessary intercontinental trips.
- Serve the application shell, CSS, fonts, icons, and other static assets through the frontend CDN.
- Keep typing, keyboard feedback, menus, non-authoritative animations, and other safe interactions immediate in the browser.
- Send only meaningful game actions across the network. Key presses are local; submitted guesses, ready-state changes, lobby settings, and other authoritative actions are validated remotely.
- Use one compact database function/transaction for operations that must update several related records. Avoid chains of client-to-server-to-server requests.
- Use private Realtime channels for event delivery instead of frequent polling. Presence is reserved for slow-changing connection state; gameplay events use compact broadcasts or committed database changes.
- Store authoritative timer deadlines as server timestamps. Clients render countdowns locally and resynchronize, so no continuously running backend timer is required.
- Index all frequently queried usernames, friendships, active battles, daily attempts, and leaderboard fields.
- Fetch the signed-in player's essential Home data together and prefetch likely next-screen data after authentication.
- Minimize Edge Function dependencies on the sign-in path and keep necessary functions small, short-lived, and idempotent.
- Resize and compress avatars before upload because free storage does not include server-side image transformations.
- Monitor database size, storage, bandwidth, Realtime messages, connections, function invocations, and response latency before they approach free limits.

#### Free-plan operational limitations

- A Supabase Free project with insufficient activity over a seven-day period may be paused. This is different from a brief cold start: the owner must resume a paused project in the dashboard. Genuine regular use normally supplies activity; development must still account for pauses during inactive periods.
- Supabase Edge Functions can experience cold starts. They must not hold battle timers or long-lived match state in memory.
- The free Supabase database uses Nano compute and may slow under sustained or inefficient workloads. Load tests and query profiling are required before release.
- The current free allowances include a 500 MB database, 1 GB storage, 200 peak Realtime connections, 2 million Realtime messages per month, and 500,000 Edge Function invocations. These are planning ceilings, not launch targets, and must be rechecked before deployment because provider limits can change.
- The free plan does not include automatic database backups or an uptime service-level agreement. Exported backups must therefore be part of the project's operating procedure.
- Vercel Hobby scales functions down when idle, so cold starts are possible. Static pages and assets remain CDN-delivered, while backend-dependent actions must show immediate, non-blocking feedback.
- Vercel Hobby is intended for personal, non-commercial use. Hosting must be reviewed before any commercial release.

### 3.4 Environment and Release Decision

- Provider accounts and development environments will be created at the beginning of Phase 6, when implementation starts—not postponed until the end—because authentication, database policies, and real-time behavior need early integration testing.
- Routine development should run locally where possible.
- A free cloud staging environment will be used for Google authentication, real-time, mobile-device, and cross-browser testing.
- Production release will be quality-gated by the approved user journeys, security policies, multiplayer tests, responsive visual comparison against the polished HTML previews, and free-tier capacity tests.
- The product will progress through internal development, controlled testing, and release-candidate testing before a public launch. No phase is shortened merely to publish sooner.

---

## 4. Already-Confirmed Technical Constraints

- WRDL is a responsive web application for desktop and mobile browsers.
- Authentication is Google-only for the MVP.
- Usernames contain only letters and numbers, are case-insensitively unique, and receive a final server-side availability check.
- Daily Wordle uses the Philippine calendar day and resets at **12:00 AM Asia/Manila (UTC+8)**.
- Daily Wordle progress is saved to the player's account; an unfinished puzzle becomes **Failed** when its Philippine day ends.
- A missed Daily Wordle day is recorded as **Missed** once the player has an account and is eligible for that day.
- Daily guesses require an internet connection and server validation before the guess and its colors are committed.
- Free Play is temporary, has no statistics, and is not saved locally or to the account.
- An already-open Free Play game may continue without a connection using the word data already loaded in memory.
- Share Results exists only for Daily Wordle and copies a spoiler-free image; unsupported image-clipboard browsers receive a download fallback.
- Account settings and battle-host preferences synchronize across signed-in devices.
- Friendly Battles support two to eight players and require one active battle connection per account.
- Two-player disconnects use a 30-second grace period. Three-to-eight-player battles do not show per-player reconnect countdowns and follow their separately approved preservation rules.
- Battle timers and transitions continue during disconnections; reconnecting players receive the current authoritative screen and state.
- Leaderboards update from relevant changes and use a one-minute fallback refresh.
- Production real-time channels must be private and limited to eligible authenticated users.
- MVP error screens show useful recovery actions without internal reference codes or technical details.

---

## 5. Architecture Decisions Still to Resolve

- Expected MVP traffic and free-tier capacity targets.
- Repository, deployment account, and environment ownership.
- Detailed database schema and retention rules.
- Daily answer scheduling and word-pool maintenance workflow.
- Exact authoritative battle command/event protocol.
- Avatar file limits, formats, transformations, and moderation policy.
- Rate limits for username checks, friend search, requests, invitations, guesses, and battle actions.
- Testing targets and supported browser/device matrix.
- Backup, monitoring, analytics, and operational alerting choices.

---

## 6. Application Boundaries and Data Ownership — Approved

### 6.1 Responsibility by System

| System | Owns | Must not own |
|---|---|---|
| Browser | Rendering, navigation, typed-but-unsubmitted letters, keyboard feedback, animations, sounds, temporary form state, temporary Free Play session, local countdown display | Authoritative answers, final scoring, official timers, permissions, rankings, or permanent statistics |
| Next.js application | Routes, shared UI, authentication callback, initial data loading, secure server endpoints where needed, and response shaping | Long-running in-memory battle rooms or permanent timer processes |
| Supabase Auth | Google identity, authenticated sessions, and account identity | WRDL profile rules or game scoring |
| Postgres database | Durable source of truth for profiles, privacy, friendships, daily attempts, statistics, word schedules, lobbies, battles, rounds, guesses, standings, and preferences | Per-keystroke UI state or temporary animations |
| Secure database functions / Edge Functions | Validate commands, enforce permissions, apply transactions, calculate results, and reject duplicates | Long-lived timer loops or state that disappears when a function stops |
| Supabase Realtime | Deliver private invitations, presence changes, lobby changes, accepted gameplay progress, screen transitions, and updated standings | The only copy of battle state or unverified client-calculated results |
| Supabase Storage | Player-uploaded avatar files | Private game answers or primary application records |

### 6.2 Authoritative Action Flow

For an action that affects official state:

1. The browser reacts immediately where safe—for example, displaying a typed letter or pressed-button state.
2. The browser submits a compact command containing the action and a unique command identifier.
3. A secure operation verifies the signed-in player, current state, permissions, time boundary, and submitted values.
4. Postgres applies all related changes atomically in one transaction.
5. The committed state receives an incremented version number.
6. Realtime informs eligible connected clients of the committed result.
7. A client that misses or receives an out-of-order event requests the latest state snapshot and resumes from its version.

Duplicate submissions with the same command identifier return the original committed result rather than applying the action twice.

### 6.3 Responsiveness Rules

- Typing and deleting letters never wait for the network.
- Submitting a Daily Wordle or Friendly Battle guess temporarily locks that row while it is validated.
- Tile colors and official progress appear only after the server accepts the guess.
- Rejected guesses unlock the row and show the approved inline explanation without consuming an attempt.
- Navigation and read-only cached content remain usable while fresh data loads, where the approved offline rules allow it.
- Countdown visuals run locally from a server-issued deadline and periodically correct drift without visibly jumping under normal conditions.
- Real-time events carry only the smallest data needed for the receiving screen; clients fetch a full snapshot only when joining, reconnecting, or recovering from a missed version.

### 6.4 Ownership by Feature

| Feature | Browser state | Server/database state |
|---|---|---|
| Daily Wordle | Current typed row, animations, share-image rendering | Philippine puzzle date, protected answer, accepted guesses, colors, completion, streak, and statistics |
| Free Play | Selected word pools, answer, guesses, result, and current round—all memory-only | Supplies eligible word data when a round starts; stores no progress or result |
| Friendly Battle | Current typed row, local countdown rendering, animations, and the latest received snapshot | Lobby, membership, host, settings, ready states, answer, accepted guesses, deadlines, disconnect state, placements, points, and match result |
| Friends | Search input and currently displayed results | Friendships, pending requests, blocks, invite eligibility, and privacy enforcement |
| Invitations | Open/minimized bubble UI | Invitation record and whether its lobby remains joinable; Realtime delivers additions and removals |
| Profiles | Editing controls and unsaved input | Profile data, avatar reference, privacy settings, statistics, and battle history |
| Presence | Current connection heartbeat | Realtime presence plus a throttled durable `last_online_at` value |
| Leaderboards | Active Global/Friends view and pinned-row presentation | Ranked streak data and authoritative friendship scope |
| Settings | Immediate visual/theme preview | Account-synced choices and persistent host battle preferences |

### 6.5 Protected Answer Rules

- The Daily Wordle answer is never sent to an unfinished player's browser.
- A Friendly Battle answer is never sent to a player while it could affect their active puzzle.
- Opponent letters are disclosed only under the already-approved viewing rules after the viewer completes their own puzzle.
- Free Play is the exception: its answer may exist in browser memory so an already-open game can continue offline. Because Free Play has no statistics, progression, sharing, or competitive result, inspecting that local value provides no account advantage.

### 6.6 Durable Battle State

Realtime transports changes, but Postgres remains the source of truth. The database stores enough current-round state for a player to refresh, reconnect, or move to the active shared screen without relying on missed messages. Functions do not remain alive for an entire round; server deadlines and transactional state transitions replace long-running processes.

### 6.7 Multiple Tabs and Devices — Approved

- An account may have only one controlling connection to an active battle.
- Opening that battle in another tab or device shows a **Battle active elsewhere** state with a **Continue here** action.
- Selecting **Continue here** transfers control to the new connection and makes the older connection read-only before disconnecting it from the battle channel.
- Ordinary non-battle pages may remain open in multiple tabs.

**Decision:** Approved in full. Free Play may hold its answer in temporary browser memory, Realtime is a transport rather than the source of truth, and active battle control may be transferred explicitly between tabs or devices.

---

## 7. Database Model and Access Control — Approved

The names below describe the approved logical records. Exact SQL identifiers may be refined mechanically during migrations without changing their ownership, relationships, privacy, or behavior.

### 7.1 Identity and Profile Records

| Record | Purpose |
|---|---|
| Auth User | Google-authenticated identity managed by Supabase Auth |
| Profile | Username with preserved casing, normalized lowercase username key, display name, bio, avatar path, level, EXP, streak, eligibility date, and timestamps |
| Username Reservation | Previous normalized username, former owner, and 30-day expiration |
| User Settings | Sounds, theme, high contrast, privacy audiences, activity visibility, and other account-synced choices |
| Battle Host Preferences | Last-used rounds and round timer |

The normalized username key receives a unique database constraint. Real-time availability feedback is helpful but does not reserve a name; the final profile transaction is the deciding check. Username changes enforce the 90-day cooldown and create a 30-day old-name reservation in the same transaction.

### 7.2 Social Records

| Record | Purpose |
|---|---|
| Friend Request | Pending requester and recipient; crossed requests are resolved into a friendship transactionally |
| Friendship | One canonical unordered pair of accepted players and friendship creation time |
| Friend Alias | Private alias owned by one player for one accepted friend |
| Battle-Invite Block | Prevents battle invitations from one specific accepted friend without removing the friendship |
| Battle Invitation | Pending inviter, recipient, and lobby; removed when declined or when the lobby starts or disappears |

Removing a friendship also deletes both players' aliases for that relationship and its battle-invite blocks. It does not change either player's privacy settings.

### 7.3 Word and Daily Wordle Records

| Record | Purpose |
|---|---|
| Word | Normalized five-letter word, allowed-guess status, answer eligibility, difficulty pools, and active status |
| Daily Puzzle | Philippine puzzle date, puzzle number, protected answer reference, and publication state |
| Daily Attempt | One player and puzzle date with In Progress, Win, Failed, or Missed status and timing data |
| Daily Guess | Accepted guess number, evaluated color pattern, and acceptance time |
| Daily Statistics | Lifetime wins, failed losses, missed losses, current streak, level, EXP, and last resolved date |

The answer reference and answer-only word access remain in a protected database schema that browser roles cannot read. Public profile history is returned through a privacy- and spoiler-aware query rather than direct unrestricted access to guess rows.

### 7.4 Friendly Battle Records

| Record | Purpose |
|---|---|
| Battle | Lobby and match identity, host, settings, current phase, round number, state version, and outcome |
| Battle Member | Player, join order, membership state, total points, current ready state, and final placement |
| Battle Round | Round number, protected answer, start/deadline/end timestamps, and round state |
| Battle Round Player | Per-player round status, completion time, placement, points earned, and disconnect state |
| Battle Guess | Accepted row and evaluated color pattern for reconnection and opponent progress |
| Active Battle Connection | One controlling battle connection per account, its connection identifier, and last-seen timestamp |
| Battle Command Receipt | Unique action identifier and committed result used to prevent duplicate actions |
| Battle History Summary | Displayable result, settings, date, player count, and final standings for the latest 20 battles |

The current active state is durable enough to rebuild every participant's screen after a refresh or reconnect. Only secure operations may award points, change phases, select answers, transfer hosts, remove lobby members, or conclude and void battles. Member removal is permitted only in the pre-game or returned reusable lobby, never after the first Match Starting transition begins.

### 7.5 Retention for the Free Database

- Daily Wordle lifetime totals, current streak, level, and EXP are retained as compact aggregate records.
- Full Daily Wordle card details are retained for the latest 30 eligible Philippine dates because that is the maximum visible history.
- Older detailed Daily guesses may be removed after their outcome has been safely included in lifetime aggregates.
- Each player retains only their latest 20 battle-history summaries and associated final standings.
- Detailed battle guesses and temporary round state are removed after the battle is complete and its history/statistics transaction has succeeded.
- Expired invitations, declined requests, expired username reservations, stale command receipts, and obsolete connection records are deleted.
- Aggregate statistics remain even when the detailed records that produced them age out.
- Cleanup is idempotent and can run during ordinary eligible requests; correctness does not depend on a precisely timed free cron job.

### 7.6 Access-Control Rules

Postgres Row Level Security and restricted database grants enforce privacy even when someone bypasses the WRDL interface.

- Browser clients never receive a Supabase secret/service key.
- Signed-in players may update only their own editable profile and settings through validated operations.
- Username cooldowns, reservations, statistics, streaks, EXP, and battle totals cannot be directly edited by browser clients.
- Only accepted friends satisfy a **Friends** audience; pending friend requests do not.
- **None** content is visible only to its owner.
- Hidden online activity is returned to other players as offline; its private actual presence is not exposed.
- Friend aliases are readable only by the player who created them.
- Battle channels are private. Only eligible lobby or battle members may subscribe to that battle's events.
- Only the current host may change host-controlled lobby settings, remove lobby members, or transfer the host role. Member removal is rejected while a battle is starting or active and becomes available again only in the returned reusable lobby.
- A player may change only their own ready state and submit guesses only for their own active board.
- Protected answers are readable only inside secure operations.
- Leaderboard queries expose only approved profile identity and streak fields.
- Avatar uploads are restricted by owner, file type, and application-level size limits.

### 7.7 Approved Meaning of Public

For the MVP, **Public** means visible to any authenticated WRDL player. Signed-out visitors see only the sign-in experience and cannot browse profiles, player search, histories, presence, or leaderboards. This reduces unintended data exposure and matches the approved sign-in-first journey.

### 7.8 Account Deletion

- **Delete Account** is included under Settings → Account.
- Deletion requires a fresh Google reauthentication when the current authentication is no longer recent, followed by an explicit permanent-deletion confirmation.
- The player's avatar, profile, settings, friendships, requests, aliases, invitations, Daily Wordle details, and leaderboard entry are removed.
- An active battle is exited through the applicable battle-exit path before deletion completes.
- Aggregate or history records that must remain coherent for other participants are anonymized as **Deleted Player** and retain no profile link, username, display name, avatar, bio, email, or Google identity.
- The deleted account's final normalized username remains reserved for 30 days before it may be claimed by another account.
- Deleting an account is not the same as signing out and cannot be undone after completion.

**Decision:** Approved in full. Public content is limited to authenticated WRDL players, Google account details are not displayed, detailed history follows the approved 30-day/20-battle limits, avatars require authenticated access, and account deletion is part of the MVP.

---

## 8. Daily Wordle and Word Engine — Approved

### 8.1 Word Catalog

Each word is stored once in normalized lowercase and may carry separate capabilities:

- **Allowed guess:** May be submitted as a valid five-letter guess.
- **Daily answer eligible:** May be scheduled as a Daily Wordle answer.
- **Free Play answer eligible:** May be selected in Free Play.
- **Rarity:** Exactly one of Common, Uncommon, or Rare for Free Play filtering and display.
- **Active:** Can be disabled without deleting historical references.

The allowed-guess catalog is broader than the answer catalog. A familiar inflected form or alternate spelling may be accepted as a guess without being used as a Daily answer. WRDL will maintain its own curated, version-controlled word catalog rather than depend on another Wordle product's live list.

### 8.2 Daily Answer Schedule

- One protected schedule row maps each Philippine calendar date to one answer and one permanent puzzle number.
- The schedule is generated ahead of release from the curated Daily-answer pool and reviewed before publication.
- Eligible answers are shuffled into a cycle without replacement, so an answer cannot repeat until every answer in that cycle has been used.
- A new cycle is independently shuffled when the eligible pool is exhausted.
- Adding words does not rearrange already scheduled dates or renumber puzzles.
- A scheduled future word may be replaced before publication if curation discovers a problem; published puzzle records are immutable.
- The production schedule should always have at least 90 reviewed future days, with an operational warning before the buffer falls below 30 days.
- The detailed schedule and answer references exist only in the protected server/database schema.
- WRDL Daily puzzle numbering begins at **#1** on the public launch date; larger numbers used in design previews are sample content.

### 8.3 Philippine-Date Authority and Reset

- The database determines the official date and deadlines using `Asia/Manila`; client device dates never decide puzzle eligibility.
- Each response includes the official puzzle date, server time, and reset deadline so the client can render a synchronized countdown.
- At 12:00 AM Philippine Time, the open client disables old-puzzle input, displays the approved reset notification, and requests the new puzzle.
- Supabase Cron runs a small database rollover function at Philippine midnight to finalize expired started attempts and publish the new puzzle state. Supabase Cron uses the database's `pg_cron` scheduler and does not require an always-running server.
- Every Daily Wordle read or command also performs an idempotent rollover check. If the free project was paused or a scheduled job was delayed, the next request repairs the state before returning data.
- No late submission can change an expired puzzle even when the client clock is incorrect or the midnight notification was missed.

### 8.4 Efficient Missed-Day Accounting

- Opening a puzzle without submitting a valid guess does not need to create an attempt row.
- A player's account-creation date is excluded from Missed accounting if they submit no guess that day.
- From the first complete eligible day onward, a completed puzzle date with no accepted attempt is treated as Missed.
- Missed totals can be derived from published eligible dates minus Wins and Failed attempts, avoiding one permanent database row for every inactive player every day.
- The last 30 days of profile cards are produced from the puzzle calendar joined with the player's attempts; an eligible date without an attempt becomes a generated Missed card.
- Effective streak is zero when the last successful date is too old to continue through the latest completed Philippine puzzle day. This makes leaderboard correctness independent of a mass midnight update.
- A started attempt with at least one accepted guess is finalized as Failed when its date expires and awards the approved 5 EXP exactly once.

### 8.5 Guess Submission Transaction

For each submitted guess, one secure transaction:

1. Authenticates the player and obtains the server-authoritative Philippine puzzle date.
2. Locks or creates that player's current attempt to prevent two tabs from consuming the same guess number.
3. Rejects an expired, completed, malformed, duplicate, seventh, or disallowed-word submission.
4. Evaluates repeated letters using the standard two-pass rule: exact-position greens consume matching letters first, then yellows consume only the remaining unmatched answer-letter counts.
5. Stores the accepted guess number, compact color pattern, and server acceptance time.
6. On a correct guess, records Win, increments streak, and awards 20 EXP exactly once.
7. On the sixth incorrect guess, records Failed, resets streak, and awards 5 EXP exactly once.
8. Returns only the accepted row result and updated public result data; it never returns the protected answer.

The unique command identifier and database constraints make retries safe without consuming two attempts or awarding EXP twice.

### 8.6 Progress, Results, and Sharing

- Accepted guesses and their patterns are durable and reload on the same Philippine date.
- A completed result reopens as the same fixed board and cannot be replayed.
- Failed Daily Wordle results do not reveal the correct word.
- The browser renders the spoiler-free Share Results image from the server-confirmed result using the approved Phase 3–4 visual design.
- The image contains the WRDL branding, puzzle number, result, and constant 5-column × 6-row colored grid without answers or guessed letters.
- Clipboard image copying is attempted first; unsupported browsers receive the approved download fallback.

### 8.7 Free Play Word Handling

- Starting Free Play requests one answer from the union of the player's enabled Common, Uncommon, and Rare pools.
- The selected word's single rarity label is displayed during the game.
- Selection should avoid immediately repeating the previous Free Play answer when another eligible word exists.
- The answer, guesses, and result live only in browser memory for that round.
- Word evaluation uses the same shared and tested repeated-letter algorithm as Daily Wordle and Friendly Battles.
- Leaving or refreshing destroys the round; no Free Play statistics or history are written.

### 8.8 Catalog and Operational Decisions

- Common American and British spellings may be accepted guesses. Daily answers favor words broadly familiar to international English speakers.
- Offensive or vulgar words are excluded from both answers and accepted guesses.
- The catalog and reviewed schedule use a version-controlled CSV/spreadsheet plus validation script for the MVP; a private administration interface is not required.
- Free Play avoids immediately repeating its previous answer when another eligible answer exists, but does not save longer-term Free Play history.
- If a verified WRDL-wide outage makes a Daily puzzle meaningfully unavailable, an administrator may mark that puzzle date **Voided**. A voided date produces no Missed or Failed loss, EXP, or streak reset. This is an operational correction and not an individual player mercy feature.

**Decision:** Approved in full.

---

## 9. Friendly Battle Engine — Approved

### 9.1 Persistent Party and Match Separation

The friendly group and an individual scored battle are separate records:

- A **Party** owns the current host, lobby membership, join order, settings, ready state, and invitations.
- A **Battle** is one scored match created from a locked snapshot of that party's settings and participants.
- A completed battle becomes immutable history while the party returns to its reusable lobby for another match.
- Players still viewing the final result remain party members and appear as **Waiting for player** in the returned lobby.

This separation allows the same group to play again without editing completed match data or sending every invitation again.

### 9.2 Authoritative State Machine

| State | Permitted behavior | Exit condition |
|---|---|---|
| Lobby | Host edits settings and invitations; members Ready or Cancel Ready | At least two present members and all present members Ready |
| Match Starting | Settings, participants, Ready controls, and invitations are locked; synchronized `3… 2… 1…` | Server start deadline arrives |
| Round Active | Players submit guesses; timer and disconnect rules run | Approved round-end condition |
| Round Resolving | Secure operation fixes placements, points, total scores, and next state | Transaction completes |
| Between Rounds | Standings and a fixed visible 10-second intermission are shown | Intermission deadline expires |
| Round Starting | Synchronized `3… 2… 1…`; input remains locked | Server start deadline arrives |
| Battle Complete | Final standings fixed; members individually Continue | Each member returns to party lobby or leaves |
| Voided | No earned battle points or statistics are retained | Members return home or to the reusable party as applicable |

Every state has a monotonically increasing version. Commands are serialized against the current Battle or Party row, so simultaneous Ready, Cancel Ready, settings, guesses, exits, and timer claims cannot create two conflicting transitions.

### 9.3 Lobby Start Rules

- Every present member, including the host, has Ready / Cancel Ready.
- Pending invitees are not members and are never counted in Ready totals.
- Host setting changes do not reset Ready states.
- The transaction that observes at least two present members and all of them Ready changes the party to Match Starting immediately.
- Once Match Starting is committed, Ready cancellation, settings changes, joins, kicks, host transfer, and old invitation acceptance are rejected.
- The same transaction snapshots the final participants and settings, removes outstanding invitations, chooses the first protected answer, and issues the shared countdown deadline.
- A player who joined just before that transaction is included and must be Ready; a player whose acceptance reaches the server afterward receives an unavailable invitation result.

### 9.4 Round Timing and Word Selection

- All round start times and deadlines are database timestamps.
- Clients animate `3… 2… 1…` and the round timer from those timestamps, but cannot extend or conclude the timer themselves.
- Any connected client may request a due transition; the database verifies the deadline and applies it idempotently. If no client is connected, the transition is repaired by the next battle request.
- Friendly Battle follows official Wordle's style of word policy: familiar curated five-letter answers, a broader valid-guess catalog, and consistent repeated-letter evaluation. WRDL uses its own reviewed catalog rather than copying another product's current or future Daily schedule.
- Friendly Battle has no difficulty selector; its answers come from WRDL's Wordle-standard curated answer pool.
- The current Philippine Daily Wordle answer is excluded from Free Play and Friendly Battle selection to prevent accidental same-day spoilers.
- An answer cannot repeat within one battle, including sudden-death rounds, while another eligible answer is available.
- Every participant receives the same protected answer reference for the round, but only secure guess evaluation may read the answer itself.

### 9.5 Guess and Opponent-Progress Flow

- Battle guesses use the same secure validation and repeated-letter evaluation as Daily Wordle.
- The server acceptance timestamp, measured from the shared server start time and rounded to two decimal places, determines completion time.
- The common battle channel publishes only attempt number, color pattern, state version, and finish/disconnect status—never guessed letters or the answer.
- An eligible viewer who has solved or failed their own puzzle requests opponent letters through a privacy-aware endpoint. An active player cannot obtain those letters by inspecting Realtime traffic.
- Opponent rows appear all at once after evaluation.
- A player's board stops accepting guesses after Solve, Failed, round expiry, or a committed two-player round conclusion.

### 9.6 Scoring Transaction

#### Two players

- First sole solver receives 1 point; the opponent receives 0.
- Neither solving before the deadline produces 0–0 and consumes the scheduled round.
- Correct submissions accepted within the same two-decimal server-time bucket create the approved exact tie and award 1 point to both.
- A tiny resolution window allows all submissions from that time bucket to be committed before the result is finalized; it is short enough to be visually immediate.
- The battle concludes when a player alone reaches the configured target: 1 point for one scheduled round, 2 for three, or 3 for five.
- If both reach the target through an exact tied round, or scheduled rounds end tied, sudden-death rounds continue until one player wins a round alone.

#### Three players

- Solvers use dense placement by two-decimal completion time: 1st = 5, 2nd = 3, and 3rd = 2.
- A player who does not solve before the deadline receives 0.

#### Four to eight players

- Solvers use dense placement by two-decimal completion time: 1st = 5, 2nd = 3, 3rd = 2, and every solving placement from 4th through 8th = 1.
- A player who does not solve before the deadline receives 0.

Tied players receive the full points for their shared dense placement. The next distinct completion bucket receives the immediately following placement. Three-to-eight-player battles play exactly the selected scheduled rounds, allow tied final placements, and never use sudden death.

### 9.7 Connection Authority and Heartbeats

- Realtime Presence provides fast visual connection hints, but it does not by itself award wins or void matches.
- While controlling an active battle, each client maintains a lightweight server heartbeat approximately every five seconds and refreshes it with meaningful commands.
- The authoritative disconnect time is derived from the last verified contact. A missing heartbeat is confirmed before a grace deadline is committed.
- The one-active-connection rule prevents two tabs or devices from maintaining competing heartbeats for the same player.
- Reconnecting replaces the connection identifier, reloads the latest durable snapshot, and resumes the current shared state without changing any deadline.

### 9.8 Two-Player Disconnection

- A verified disconnection creates one 30-second player grace deadline; the battle and any round timer continue.
- The connected opponent remains interactive and may finish the current round.
- Reconnection before the deadline clears the disconnected state and restores the exact current screen.
- If the grace expires, the connected opponent wins the entire battle and normal 2-player win/loss statistics are recorded.
- If the connected player earns the match-winning point during the grace period, the battle ends normally before the disconnect deadline.
- Otherwise, a completed round advances to Between Rounds while the same remaining grace deadline continues.
- If the disconnected player was host and does not return, the connected winner becomes party host.

### 9.9 Three-to-Eight-Player Disconnection

- Individual disconnected players have no visible or authoritative personal countdown while at least two players remain connected.
- Their board uses the approved disconnected overlay and their existing guesses remain durable.
- Disconnected players do not delay a round's completion and may rejoin any still-active round with its remaining time.
- When connected participation falls below two, one 20-second battle-preservation deadline begins without pausing the round timer.
- Returning to at least two connected players clears that preservation deadline.
- Expiration while fewer than two remain voids the battle and discards its earned points and statistics.
- A disconnected host transfers the party host role immediately to the earliest eligible present member under the approved join-order rule.
- A player who is both finished and disconnected retains both independent statuses for the approved split overlay.

### 9.10 Between-Round Automatic Intermission

- Every non-final round enters a fixed 10-second Between Rounds state showing the updated standings and a visible **Next round in 00:10** countdown.
- The intermission has no Ready command, ready count, configurable duration, Indefinite mode, or host removal action.
- The host's removal authority is locked for the entire active battle and returns only in the original lobby after Battle Complete.
- A disconnected member remains a battle participant while the automatic intermission and the applicable 30-second or 20-second reconnect rule continue independently.
- A reconnecting member receives whichever intermission, countdown, or active-round state is current without restarting the 10 seconds.
- When the server intermission deadline expires, an idempotent transition issues the next shared `3… 2… 1…` start deadline for every battle participant.

### 9.11 Final Results and Returned Lobby

- Final standings and battle statistics are committed exactly once before Battle Complete is published.
- Each member's Continue action changes only their party return status.
- Continue redirects each player to the original party lobby used before that battle. Returned players may see and edit it as their permissions allow; members still on results appear as **Waiting for player**.
- The next match cannot enter its all-ready start countdown while a retained party member is still on the previous result screen, disconnected, or otherwise not Ready.
- The host may remove a waiting or disconnected member from the returned lobby under the normal lobby removal confirmation.
- Once the party is eligible again, the same canonical Setup and Lobby interface is reused for the next battle.

**Decision:** Approved in full. The pre-game lobby keeps Ready / Cancel Ready for all present members. After the match begins, every non-final round uses an automatic fixed 10-second standings intermission followed by the synchronized start countdown; there are no between-round Ready controls, configurable intermission durations, or in-battle host removal controls.

---

## 10. API and Real-Time Contracts — Approved

### 10.1 Contract Pattern

WRDL separates authoritative commands, durable snapshots, and real-time notifications:

- A **command** is an authenticated HTTPS or database-function request that asks the server to change state.
- A **snapshot** is the latest server-approved state needed to render one screen after opening, refreshing, reconnecting, or detecting a missed event.
- A **real-time event** announces a committed change so subscribed clients can update quickly. It never replaces the durable snapshot or independently decides game results.
- Every command response includes the authoritative server time and resulting entity version.
- The browser may animate or show a pending state immediately, but permanent results appear only after the command commits.

This allows fast interaction on the free backend without trusting a browser or requiring a permanently running battle server.

### 10.2 Standard Command Envelope

Every state-changing request carries:

| Field | Purpose |
|---|---|
| `command_id` | A new UUID generated once for the user action and reused for an exact retry |
| `entity_id` | Profile, party, battle, round, friendship, or invitation being changed |
| `expected_version` | Last version seen by the client when ordering matters |
| `connection_id` | Identifies the controlling tab/device for active-battle commands |
| `payload` | Only the validated values required by that command |

A successful response returns `command_id`, `committed_version`, `server_time`, the accepted result, and either a small state patch or an instruction to reload the snapshot. Critical commands store a short-lived receipt. Retrying the same `command_id` returns the original committed result instead of applying the action twice.

### 10.3 Command Groups

| Area | Commands |
|---|---|
| Account and profile | Complete username setup, update display name or bio, update avatar reference, change privacy/settings, sign out, delete account |
| Friends | Send or cancel request, accept or decline request, remove friend, set alias, block or unblock battle invitations |
| Daily Wordle | Load today's private state, submit guess, resolve expired unfinished puzzle, load eligible history/share data |
| Party lobby | Create party, invite friend, accept invitation, leave, update rounds/timer, Ready or Cancel Ready, transfer host, remove member |
| Active battle | Load snapshot, claim controlling connection, heartbeat, submit guess, request eligible opponent letters, request a due transition, leave battle, Continue to original lobby |

Commands are named by action rather than by screen. The same server operation is reused anywhere that action appears, preventing the profile, Friends page, invitation bubble, and lobby from implementing different rules.

### 10.4 Private Channel Scope

| Channel | Subscribers | Examples |
|---|---|---|
| User channel | That signed-in account only | Friend requests, invitations, removal notices, settings changed on another device |
| Party channel | Current party members | Membership, host, settings, Ready states, invitation availability, match-start transition |
| Battle channel | Locked battle participants | Phase/version changes, timer deadlines, color-only opponent progress, finish/disconnect status, standings, completion |

Profiles, Friends lists, Daily history, and leaderboards are loaded through privacy-aware queries. They do not receive broad public database subscriptions. Leaderboards refresh under their approved once-per-minute rule.

### 10.5 Event Envelope and Ordering

Every event contains:

- `event_id`, event type, entity identifier, committed version, and server timestamp
- only the minimum display-safe payload required for that event
- no protected answer, unapproved opponent letters, private presence, email, or Google account data

Clients apply an event only when its version is newer than the version already rendered. If the version skips one or the event does not match the current state, the client discards assumptions and reloads the relevant snapshot. Duplicate or late events are harmless.

Important event families are:

- `friend_request.changed` and `friendship.changed`
- `battle_invitation.changed`
- `party.changed` and `party.match_starting`
- `battle.phase_changed`
- `battle.opponent_progressed`
- `battle.member_connection_changed`
- `battle.round_resolved`
- `battle.completed` or `battle.voided`
- private `daily.changed` and `settings.changed` events for cross-device synchronization

### 10.6 Guess Submission Contract

- Pressing Enter creates one `command_id`, keeps the submitted row visible, and temporarily prevents a second submission for that row.
- The server validates authentication, active connection, phase/version, deadline, dictionary membership, and duplicate command status before reading the protected answer.
- Success returns the evaluated color pattern and current board state. Battle opponent events contain colors and attempt number only.
- A retry after an uncertain connection result reuses the same `command_id`; it can never consume two attempts.
- Invalid-word responses preserve the entered letters and use the approved shake feedback.
- A stale phase or passed deadline reloads the authoritative screen instead of accepting a late guess.

### 10.7 Error Contract and Recovery

Players receive plain-language messages and direct recovery actions. Internal errors remain in protected logs and are not shown as reference codes.

| Error family | Client behavior |
|---|---|
| Invalid input | Keep the input and explain what must change |
| Not signed in | Show the approved Google sign-in recovery and preserve recoverable state |
| Not permitted | Remove the unavailable control and reload the relevant snapshot |
| Stale version | Refresh automatically, then explain only if the requested action can no longer happen |
| Invitation unavailable | Remove the invitation card without a countdown or dead-lobby screen |
| Duplicate command | Use the original committed response |
| Rate limited | Keep safe input, pause repeated submission, and offer retry after a short wait |
| Temporary service failure | Keep safe input and show Try Again; never guess whether the command committed |

### 10.8 Reconnection and Missed Events

- Realtime is used for speed; losing it does not erase the current screen.
- The persistent approved offline/reconnecting banner appears when connectivity is lost.
- An active battle continues its existing disconnect rules and server deadlines. Guess submission waits for server confirmation.
- On reconnection, the client authenticates, reclaims or confirms its controlling connection, loads one current snapshot, then resubscribes from that version.
- While Realtime is unavailable but normal server requests still work, active battles check their authoritative snapshot every two seconds. Lobbies and social screens check every 10 seconds. Normal Realtime delivery resumes automatically after recovery.
- User-channel events handled in one signed-in tab or device become resolved in the database and disappear from the others.
- After connectivity is restored, the persistent offline banner disappears and a small **Back online** confirmation appears for two seconds, then dismisses automatically.

### 10.9 Approved Visible Request Behavior

- Buttons become temporarily unavailable immediately after submission to prevent accidental double-clicks.
- If an ordinary request is still pending after one second, its label changes to a clear state such as **Saving…**, **Joining…**, or **Submitting…**.
- Read-only pages use the approved shaped skeletons; actions do not replace the whole page with a spinner.
- Successful background refreshes are silent unless they resolve an offline state or materially change the current screen.
- A stale action that can no longer happen uses a small side notification and the corrected screen state rather than a blocking error page.

### 10.10 Approved Retry and Cross-Device Behavior

- If connectivity becomes uncertain during a guess submission, the client first checks the original `command_id` result automatically. It shows **Try Again** only after confirming that the attempt was not committed, and an exact retry reuses that identifier.
- Invitation and friend-request changes committed in one signed-in tab or device are removed silently from every other open screen.
- The active-battle two-second fallback and lobby/social 10-second fallback run only while Realtime delivery is unavailable and stop as soon as the subscription is healthy.

**Decision:** Approved in full, including the one-second pending labels, automatic duplicate-safe guess recovery, fallback update intervals, automatic stale-screen correction, cross-device event resolution, and two-second **Back online** confirmation.

---

## 11. Client State, Offline Behavior, and Media — Approved

### 11.1 State Ownership

| State | Browser responsibility | Authoritative persistence |
|---|---|---|
| Authentication | Current session display and redirect intent | Supabase Auth session and account identity |
| Daily Wordle | Current input row, animations, pending command, and a disposable render cache | Server-approved attempt, accepted guesses, result, streak, and puzzle date |
| Free Play | Selected answer, board, guesses, rarity, and result for the open round | No round persistence; only selected word-pool preferences sync to the account |
| Party lobby | Temporary open dialogs and draft interaction state | Party members, host, invitations, settings, Ready states, and version |
| Active battle | Keyboard input, animation progress, server-clock offset, and last rendered snapshot | Battle phase, deadlines, guesses, points, connections, standings, and result |
| Profiles and settings | Unsaved form input, crop position, and pending-save feedback | Profile fields, privacy, appearance, sound, and battle-host preferences |

The browser cache is never allowed to overwrite newer server state. Refreshing or reconnecting loads the authoritative snapshot, then restores only safe local presentation state.

### 11.2 Local and Account-Synced Preferences

- Theme, high-contrast tiles, sound settings, privacy settings, and the host's rounds/timer preferences sync to the signed-in account.
- A small local copy may apply appearance immediately during startup, but the newest server version wins after authentication.
- Free Play remembers enabled Common, Uncommon, and Rare toggles, but never saves its current answer, guesses, or result.
- The optional 30-day Free Play exit-warning preference is stored locally because it controls only that browser's confirmation behavior.
- Draft display-name, bio, and settings input remains on screen after a retryable failure but is not treated as saved until confirmed.

### 11.3 Offline Matrix

| Area | Offline behavior |
|---|---|
| Navigation and already-rendered read-only content | Remains visible, marked by the persistent offline banner |
| Daily Wordle | Cannot accept or evaluate new guesses; durable progress remains available after reconnection |
| Already-open Free Play | Continues from in-memory state; refresh, close, sign-out, or navigation away discards it |
| Party lobby and social actions | Preserve safe input and wait or offer retry; no local membership/friendship mutation is assumed successful |
| Friendly Battle | Enters the approved reconnecting/disconnected flow while server timers continue |
| Settings and profile changes | Preserve unsaved values and retry after connection returns |

After reconnection, WRDL reloads the relevant server snapshot before accepting dependent actions. The offline banner disappears, a small **Back online** confirmation appears, and that confirmation dismisses automatically after two seconds.

### 11.4 Avatar Pipeline

- MVP avatars are static JPG, PNG, or WebP files with a maximum selected-file size of 5 MB.
- Animated GIF and other animated avatar formats are not accepted.
- The player receives a square crop interface with repositioning before upload.
- The browser corrects image orientation, renders the approved crop at 512 × 512 pixels, removes unnecessary metadata, and compresses the result to a web-appropriate static format before upload.
- The storage path is owned by the authenticated account and uses a non-guessable versioned filename so cached old avatars are not mistaken for the replacement.
- A replacement becomes visible only after the new upload and profile update both succeed. The previous file is then deleted safely.
- Removing the custom avatar clears its profile reference, restores the WRDL silhouette immediately after confirmation, and deletes the old stored image.
- If an upload fails, the previous avatar remains active and the cropped selection stays available for retry while the page remains open.

### 11.5 Share Results Image

- Share Results exists only for a completed Daily Wordle.
- The browser generates a consistent branded 1080 × 1080 PNG independent of the player's selected application theme.
- The image contains the WRDL logo, puzzle number, result (`1/6` through `6/6` or `X/6`), current streak, and the constant 5-column × 6-row colored grid.
- Unused rows remain visible so every shared result keeps the same layout.
- The image contains no answer or guessed letters and excludes the next-puzzle countdown because that value becomes outdated.
- Generation uses only server-confirmed result data already available to the player. The generated image is never uploaded to WRDL or stored in Supabase.
- WRDL first copies the PNG itself to the system clipboard and shows the approved **Copied to clipboard** confirmation.
- When the browser cannot copy an image, WRDL explains the limitation and downloads the same PNG using a readable name such as `WRDL-1893-4-of-6.png` or `WRDL-1893-X-of-6.png`.

**Decision:** Approved in full. Avatar limits, square cropping, 512 × 512 processing, replacement/removal behavior, fixed 1080 × 1080 spoiler-free sharing, client-only image generation, and clipboard/download behavior are final for the MVP.

---

## 12. Testing, Deployment, and Operations — Approved

### 12.1 Project Use and Hosting

- WRDL is a personal, non-commercial project intended for occasional use with friends.
- Vercel Hobby remains appropriate for the web application under that declared use. If WRDL later introduces ads, subscriptions, paid access, business use, or another commercial purpose, hosting eligibility must be reviewed before that change launches.
- Supabase Free remains the database, authentication, storage, secure-operation, and Realtime provider for the MVP.
- Current provider limits are deployment constraints, not application promises, and must be rechecked before public release.

### 12.2 Environments

| Environment | Purpose | Backend |
|---|---|---|
| Windows developer workstation | Next.js development plus unit, component, and browser tests that do not require a backend | Windows-native PowerShell, Node.js, and pnpm; no Docker, Ubuntu, WSL, Linux environment, or local backend |
| Development/staging | Database, security, Google sign-in, Realtime, mobile-device, migration, and release-candidate testing | First private Supabase Free cloud project |
| Production | Real personal/friend accounts and live games | Second Supabase Free cloud project |

- WRDL development, required setup, commands, and CI are Windows-native. Docker, Ubuntu, WSL, Linux development environments, and a locally hosted Supabase stack are prohibited. Backend-dependent development requires an internet connection to the private development/staging project.
- Development/staging and production never share users, secrets, storage buckets, database records, or OAuth callback configuration.
- Vercel preview deployments use staging-safe configuration and never receive production service credentials.
- Production deployment occurs only from the protected release branch after all required checks pass.
- Database migrations are authored and reviewed locally as SQL, applied to development/staging first, backed up, and then applied to production as an explicit release step.

### 12.3 Supported Browsers and Layouts

- WRDL supports the latest two released versions of Chrome, Edge, Firefox, and Safari.
- Mobile testing includes current Chrome on Android and Safari on iPhone.
- Production layouts must remain usable down to 320 CSS pixels wide even though the primary approved mobile mockups target approximately 360 pixels.
- Keyboard-only navigation, visible focus, screen-reader names, contrast, reduced motion, zoom, and touch target behavior are release requirements rather than optional polish.
- Image clipboard support may vary by browser; the approved PNG download fallback is required wherever direct image copying is unavailable.

### 12.4 Automated Test Layers

| Test layer | Required coverage |
|---|---|
| Unit | Repeated-letter evaluation, dictionary rules, Philippine-date calculations, streak/EXP rules, scoring, dense ties, timers, and state transitions |
| Database | Constraints, Row Level Security, privacy audiences, idempotent receipts, concurrent commands, retention, and account deletion/anonymization |
| Component | Forms, validation, keyboard, grids, dropdowns, dialogs, overlays, notifications, responsive states, and accessibility behavior |
| Integration | Google-auth callback, Daily submission, friends/invitations, avatar pipeline, Share Results, lobby start, battle progress, results, and returned lobby |
| End-to-end | Complete desktop and mobile journeys for Daily, Free Play, social/profile, leaderboards, two-player battle, and three-to-eight-player battle |
| Recovery | Refresh, expired authentication, duplicate retry, stale versions, Realtime loss, reconnect, multiple tabs/devices, host transfer, and provider failures |

No release may bypass failed required tests. Flaky tests are treated as defects and must be repaired or replaced rather than repeatedly retried until green.

### 12.5 Multiplayer and Load Verification

- The initial free-tier target is 100 simultaneous connected players, leaving material headroom below the currently documented 200-connection Supabase Free limit.
- Tests include full eight-player parties, many smaller simultaneous parties, repeated lobby joins/leaves, synchronized countdowns, guess bursts, disconnect storms, and snapshot recovery after missed events.
- Message-rate tests verify WRDL remains below the provider's current Free throughput ceiling and that a rejected subscription or throttled connection falls back safely.
- Server-authoritative scoring and state transitions are stress-tested with commands arriving at the same deadline, the same two-decimal finish bucket, and from reconnecting clients.
- A release is blocked by duplicated attempts, double-awarded points/EXP, leaked answers or letters, diverging screens, missed finalization, or an unrecoverable battle state.

### 12.6 Performance and Reliability Checks

- Performance is measured separately for warm service operation and the first request after an idle or cold period.
- Tests run on a representative mid-range mobile device, throttled mobile network, and desktop connection.
- The home screen, game board, and keyboard prioritize a small initial bundle; secondary profile history, standings details, and nonessential media load afterward.
- Database queries are inspected for missing indexes, repeated row-by-row requests, oversized snapshots, and unnecessary Realtime payloads.
- Daily and battle commands record privacy-safe latency, success, retry, conflict, and failure measurements so regressions can be found before users report them.
- WRDL never hides a slow action: the approved one-second pending label, offline banner, fallback refresh, and direct retry behavior remain required.

### 12.7 Backups and Recovery

- Supabase Free does not provide downloadable managed database backups, so WRDL creates its own encrypted logical exports outside the production project.
- A scheduled daily export is retained as seven daily backups and four weekly backups.
- An additional verified export is required immediately before every production schema migration or destructive maintenance task.
- Backups are encrypted, access-restricted, excluded from the source repository, and never written to a public artifact or public storage location.
- At least once before the invited beta and once before the public MVP, a backup is restored into an isolated environment to prove it is usable.
- If a scheduled backup fails, production-changing work is paused until a successful backup exists.

### 12.8 Monitoring and Privacy

- Sentry's free developer monitoring captures application exceptions and privacy-safe performance spans for staging and production.
- Monitoring never includes answers, guessed words, tile letters, email addresses, Google identity, usernames, display names, bios, aliases, avatar contents, invitation text, or unrestricted request bodies.
- Users are represented only by a rotating or opaque internal diagnostic identifier where correlation is necessary.
- Source maps are uploaded privately during deployment and are not publicly exposed.
- Supabase and Vercel usage dashboards are reviewed for database size, storage, bandwidth, function calls, Realtime connections/messages, errors, and approaching free limits.
- WRDL collects only anonymous reliability and performance measurements. Advertising trackers and session recordings are excluded.

### 12.9 Release Workflow

1. Local tests, linting, type checking, and production build succeed.
2. Database and security tests succeed against isolated disposable data in the hosted development/staging project and clean up their fixtures.
3. A staging deployment runs the complete automated browser suite.
4. Manual staging checks cover at least one desktop browser, one Android browser, and one iPhone Safari session, including a real multiplayer match.
5. A pre-release backup and production migration rehearsal succeed.
6. Production deployment is manually approved and followed by a focused smoke test.
7. A failed smoke test rolls the application back and avoids irreversible database rollback unless a separately tested recovery migration is required.

### 12.10 Gradual Availability

- **Private testing:** Developer-controlled accounts and synthetic data validate core flows.
- **Invited beta:** A small group of friends uses real devices and reports confusing behavior, latency, and recovery problems.
- **Public MVP:** The personal project may be opened more broadly only after critical defects are resolved, backups have been restored successfully, and free-tier usage remains comfortably within limits.
- Provider quotas and performance are reviewed after each stage. Reaching a safe free limit pauses expansion rather than degrading data integrity or multiplayer correctness.

### 12.11 Free-Plan Availability Reality

- Supabase may pause a Free project after a low-activity period. Because WRDL is intended for occasional personal use, the owner must watch Supabase warning emails and check that the project is active before a planned session with friends.
- A paused project is resumed from the Supabase dashboard; WRDL cannot promise an always-on backend while remaining exclusively on the Free plan.
- Synthetic traffic whose only purpose is evading the provider's inactivity policy is not part of the architecture.
- The maintenance experience is used when the backend is unavailable, and the approved administrator Daily-void rule remains available only for a verified WRDL-wide outage.

**Decision:** Approved in full for a personal, non-commercial project. The environment split, browser matrix, 100-connection load target, automated and manual gates, encrypted external backups, privacy-safe Sentry monitoring, staged release, anonymous measurements, and free-plan availability expectations are final for the MVP.

---

## 13. Final Architecture Audit — Passed

### 13.1 Implementation Ownership

| Approved product area | Implementation owner |
|---|---|
| Google sign-in, username setup, sign-out, and account recovery | Supabase Auth, validated profile functions, and Next.js authentication routes |
| Profiles, avatars, privacy, presence, friendships, aliases, requests, and invitation blocking | Postgres records and RLS, private user events, Supabase Storage, and shared profile/social components |
| Daily Wordle schedule, Philippine reset, guesses, outcomes, streak, EXP, history, and sharing | Protected Daily tables/functions, `Asia/Manila` date authority, scheduled rollover/repair, server-confirmed client rendering, and client-only PNG generation |
| Free Play pools, offline continuation, and non-persistence | Shared word/evaluation library plus browser-memory round state and account-synced pool preferences |
| Global/friends streak leaderboards | Privacy-aware ranked queries, effective-streak calculation, one-minute refresh fallback, and fixed current-player row |
| Party creation, invitations, host transfer/removal, settings persistence, and initial Ready flow | Authoritative Party functions, private Party channel, versioned snapshots, and reusable lobby components |
| Battle answers, timers, guesses, opponent visibility, scoring, ties, sudden death, and results | Protected Battle functions and records, server timestamps, idempotent state machine, private Battle events, and immutable result summaries |
| Disconnects, reconnects, one controlling device, automatic intermissions, and returned lobby | Durable connection/heartbeat records, server deadlines, snapshot recovery, fallback checks, and Party/Battle separation |
| Loading, offline, stale-action, error, maintenance, and confirmation states | Shared client request layer and supporting-state components following the approved previews |
| Visual and responsive implementation | Reusable production components derived from the nine polished HTML preview groups and Phase 4 design tokens |
| Security, retention, backups, monitoring, tests, and releases | RLS/restricted grants, cleanup operations, encrypted exports, privacy-safe monitoring, staged CI/release gates, and recovery runbooks |

### 13.2 Consistency Corrections Completed

- Removed the obsolete between-round Ready screen and configurable ready-up references from Phases 1–5 and both affected battle previews.
- Preserved Ready / Cancel Ready only in the pre-game and returned reusable lobby.
- Confirmed that host removal is available only in those lobby states and never during a starting or active battle.
- Confirmed sudden death is exclusive to two-player ties; three-to-eight-player battles use dense tied placements.
- Confirmed Free Play has no statistics, progression, persistence, or Share Results action.
- Confirmed failed Daily Wordle never reveals the answer, while Free Play may show its answer after completion and opponent letters unlock only after the viewer finishes their own battle puzzle.
- Confirmed two-player 30-second reconnection, three-to-eight-player 20-second below-minimum preservation, and fixed 10-second automatic intermissions remain separate timers with separate purposes.
- Confirmed the newer **Continue here** control-transfer flow replaces automatic takeover by merely opening a second tab or device.
- Removed the obsolete unresolved note about whether Share Results would generate an image.

### 13.3 Audit Result

- Every approved Phase 1–4 product rule has a client, database, secure-operation, Realtime, storage, or operational owner.
- No unresolved product choice remains in the Phase 5 architecture.
- Exact filenames, SQL identifiers, component boundaries, and migration ordering may be refined during implementation only when they preserve these approved contracts.
- A material behavior change requires updating the applicable planning phase before production code adopts it.

**Decision:** Phase 5 passes the final architecture audit and is complete.

---

**Document Status:** Complete — final cross-document architecture audit passed.

**Next Phase:** Phase 6 — Development Roadmap
