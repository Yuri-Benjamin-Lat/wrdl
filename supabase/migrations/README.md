# Database migrations

Versioned SQL migrations for the hosted WRDL development/staging project live
here. Apply them with the Windows-native Supabase CLI after explicitly linking
an authorized hosted project. WRDL does not run a local Supabase stack.

The CLI migration commands are Windows-native. Do not use `supabase test db`:
even with `--linked`, that command downloads and runs a `pg_prove` container.

The first application migration, `20260829010000_m2_auth_profiles_settings.sql`,
establishes the M2 identity, profile, settings, username, avatar-storage, RLS,
and account-deletion foundation.

The two M2 migrations, both M3 preference migrations, and M4 migrations through
`20260829044000` were originally applied through the hosted dashboard. On
2026-08-30, the Windows CLI was authorized and linked to the same project,
those nine existing versions were reconciled as applied, and
`20260829045000_m4_daily_streak_statistics.sql` was pushed through the CLI.
Local and hosted migration histories are now aligned through `20260830021000`.

The manually scheduled `#1,893` M4 fixture and its derived player data were
removed from the hosted development project on 2026-08-30. Puzzle #1 may be
reused during pre-launch testing only when it is treated as disposable and
fully purged before the official global schedule begins. A disposable test
puzzle #1 was published for 2026-08-30 Philippine Time and must therefore be
included in that final pre-launch purge.

`20260829030000_m3_two_pool_free_play.sql` removes the superseded Uncommon
preference after the product decision to mirror Wordle's Common answer list and
full accepted-word Rare pool.

`20260829040000_m4_daily_foundation.sql` establishes the protected Daily word
and schedule tables, Philippine-time authority, durable attempts and guesses,
compact Daily statistics, idempotent expired-attempt repair, administrative
schedule/void operations, and the authenticated answer-free snapshot RPC.

`20260829041000_m4_daily_word_catalog.sql` imports the exact 12,966 accepted
words and marks the 2,309 Common words as Daily-answer eligible. It is generated
from the versioned catalog by `pnpm daily-catalog:write` and validates both
counts inside the migration.

`20260829042000_m4_daily_guess_submission.sql` adds the protected two-pass
evaluation function and the authenticated transactional guess command. A
unique command identifier plus row locking makes retries and two-tab submissions
safe without consuming duplicate guesses or awarding progression twice.

`20260829043000_m4_missed_outcome.sql` adds the distinct Missed result and its
compact lifetime total. `20260829044000_m4_daily_history_rollover.sql` makes
past-day repair idempotent, preserves the account-creation-day exemption, and
adds the authenticated answer-free last-30-card profile contract.

`20260829045000_m4_daily_streak_statistics.sql` permanently retains each
player's highest-ever Daily streak and adds current/highest streak values to
the authenticated Daily statistics payload.

`20260830010000_m5_social_foundation.sql` adds transactional crossed friend
requests, canonical accepted friendships, owner-private aliases, per-friend
battle-invite blocking, throttled activity writes, privacy-safe discovery,
incoming-request counts, and every approved friend ordering.

`20260830011000_m5_profiles_leaderboards.sql` adds privacy-aware friend profile
and spoiler-safe Daily history contracts plus Global/Friends streak rankings,
dense ties, the top-100 Global cap, and the pinned viewer row.

`20260830012000_m5_private_helper_hardening.sql` explicitly revokes browser-role
execution from every private M5 helper while retaining access through the
approved privacy-aware public contracts.

`20260830013000_m5_battle_history.sql` adds compact lifetime battle statistics,
deletion-safe latest-20 match summaries and standings, privacy-aware profile
history, and the storage contract that later authoritative battle completion
transactions will populate.

`20260830014000_m5_social_online_boolean.sql` keeps player-search responses
type-stable by returning `online: false` for accounts that have not published an
activity timestamp yet.

`20260830015000_m6_party_lobby.sql` adds private reusable Party records,
two-to-eight-player membership, persisted host preferences, authoritative host
controls, Ready state, and the automatic all-ready Match Starting transition.

`20260830016000_m6_party_invitations.sql` adds online-friend invitation
eligibility, Accept/Decline, invalid-invitation cleanup, repeat-decline cooling,
and temporary inviter mutes without exposing Party tables to browser roles.

`20260830017000_m6_party_realtime_lifecycle.sql` adds private minimal-signal
Realtime channels for Party, invitation, and removal changes plus safe host
transfer and Party cleanup when an account is deleted.

`20260830018000_m6_party_signal_filter.sql` limits member-update signals to
visible Party state so background presence heartbeats cannot create a Realtime
refresh loop.

`20260830019000_m6_unclaimed_start_recovery.sql` safely returns an unclaimed
Match Starting Party to the lobby if the next milestone's battle transaction
does not claim it, preventing users from becoming trapped during development or
after a failed start.

`20260830020000_m6_minimum_ready_members.sql` prevents a one-person Party from
entering Ready at the authoritative command boundary; the lobby UI mirrors this
rule by disabling Ready until a second member joins.

`20260830021000_m5_private_alias_display_names.sql` applies each viewer's
owner-private friend aliases as replacement display names in leaderboards and
battle-history standings while preserving the underlying username and keeping
the alias inaccessible to every other account.

`20260830022000_m7_two_player_battle.sql` adds the authoritative two-player
match state machine, protected shared answers, duplicate-safe guesses, exact
two-decimal ties, target wins, scoreless rounds, sudden death, 30-second
reconnection forfeits, automatic intermissions, immutable result commits, and
return to the original reusable lobby.

`20260830025000_m7_waiting_arrival_and_history_labels.sql` introduced one-way
pre-game Ready, adds the authoritative 30-second player-arrival barrier before the
synchronized three-second countdown, cancels an under-populated startup without
history/statistics, distinguishes occupied invite candidates, persists score vs.
forfeit history labels, and sends completed voids home instead of retaining a
stale lobby.

`20260830026000_m7_reversible_lobby_ready.sql` corrects the accepted Ready flow:
players remain in the lobby and may Cancel Ready until every current member is
Ready; only the atomic all-ready transition creates the battle and sends clients
to the player-arrival barrier.

`20260830027000_m7_terminal_battle_home_and_party_cleanup.sql` detaches a
two-player forfeit loser from both the completed-battle rejoin state and the
reusable party, while leaving a fully voided battle available only for the Home
notification and explicit fresh-lobby acknowledgement flow.

`20260830028000_m7_all_ready_transition_recovery.sql` prevents a stale terminal
Battle reference or a missed one-time client refresh from trapping a Party at
2/2 Ready. It lets an idempotent Ready request complete a valid all-ready
transition and exposes an authenticated recovery limited to the caller's own
Party while preserving legitimate arrival barriers.

`20260830029000_m7_polled_party_start_recovery.sql` connects that recovery to
the existing authenticated Party poll, so a browser already open on a stuck
2/2 Ready lobby can recover without a reload or a second button click.

`20260830030000_m7_membership_change_cancels_ready.sql` invalidates the remaining
players' Ready choices whenever someone leaves or is removed from a Lobby, so
the updated group must deliberately Ready again.

`20260830031000_m7_rejoin_order_and_immediate_void.sql` maps monotonically
ordered Party members into valid 1/2 Battle positions after a reinvite, and
immediately voids an active Battle when the final connected player explicitly
leaves.

`20260831010000_m8_multi_player_foundation.sql` extends Battles and Battle
members to eight players, emits privacy-safe full-roster snapshots, implements
dense 3-player and 4–8-player scoring with shared ranks, commits tied final
standings/history/statistics, and prepares fixed scheduled rounds without sudden
death.

`20260831011000_m8_multi_player_runtime.sql` adds generalized battle commands,
3–8-player connection handling, immediate disconnected-host succession,
20-second below-two-connected preservation, explicit-abandonment voiding, and
automatic multi-player round resolution while preserving M7 two-player rules.

`20260831012000_m8_full_arrival_barrier.sql` keeps a frozen multi-player roster
on Waiting for Players until everyone arrives or the 30-second window expires;
at expiry, two or more arrivals begin the shared countdown while fewer than two
cancel startup without a result.

`20260831013000_m8_member_version_convergence.sql` advances the authoritative
Battle version whenever visible member state changes so missed, duplicated, or
reordered refreshes converge on the newest connection, placement, score, host,
and continuation state.

`20260831014000_m8_preservation_before_resolution.sql` gives the 20-second
below-two-connected preservation window precedence over round/final resolution,
preventing a lone finisher from committing a scored result before recovery or
void expiry is decided.

`20260901010000_m9_battle_connection_control.sql` makes opening an active battle
an ownership check instead of a silent takeover. The current tab keeps control
until the player deliberately selects Continue here on another tab or device.

`20260901011000_m9_sign_out_disconnect.sql` records sign-out as an immediate
battle disconnection before the session ends, preserving the established
two-player grace period and multi-player preservation behavior.

`20260902010000_m10_function_privilege_hardening.sql` revokes implicit function
execution from browser roles in `public` and `private`, hardens default
privileges for future functions, and grants authenticated access only to the
documented public RPC surface. Daily scheduling and voiding remain restricted
to the service role.
