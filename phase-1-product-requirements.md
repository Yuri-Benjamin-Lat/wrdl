# Wordle Game — Phase 1: Product Requirements

## Project Overview
A personal Wordle web application for friends featuring daily puzzles, free play, social features, and friendly battles. Built with traditional Wordle mechanics while adding multiplayer competitive elements and progression systems.

**Working product name:** WRDL

---

## 1. Core Game Modes

### 1.1 Daily Wordle
- **Unique daily word** for all players (shuffled from curated word list)
- **One attempt per day per player** — cannot replay or access previous day's puzzle
- **6 attempts maximum** to solve the word
- **Progress saves** if player leaves mid-game; resets next day when new word appears
- **Internet required** to play; if connectivity is lost, saved progress is retained and play resumes after reconnection
- **Daily answer pool**: Uses the exact archived 2,309-word Wordle answer list without WRDL-specific exclusions or reclassification
- **Guess validation**: Players may submit any valid accepted five-letter word, even when it is not eligible to be selected as a Daily answer
- **Answer repetition**: Daily answers do not repeat until the curated answer pool has been exhausted
- **Winning condition**: Solve word within 6 attempts
- **Losing condition**: Fail to solve within 6 attempts OR miss the day (next day's word resets progress)
- **Spoiler-free result sharing**: Completed results provide one **Share Results** action that copies a detailed result image to the clipboard; the image includes the colored grid and approved result details but never guessed letters or the answer

### 1.2 Free Play Mode
- **Unlimited games**: Players can start and play as many consecutive Wordle games as they want
- **6 guesses per game**: Each individual word still follows the traditional six-guess limit
- **Word pools**: Common uses the exact 2,309-word answer list; optional Rare expands selection to all 12,966 accepted Wordle words
- **Word commonality badges**: Common or Rare, based on which source list contains the selected word
- **Commonality toggle**: Common is always enabled; Rare can be enabled to use the full accepted-word pool
- **No statistics recording** — wins, losses, abandoned games, and word commonality are not recorded
- **UI distinction**: Clear visual separation from Daily Wordle mode
- **Restart button**: Players can easily start a new word
- **Difficulty selection**: Available BEFORE starting Free Play, not mid-game
  - If player navigates back mid-game: popup warning "You will lose this progress" with "Don't remind me again" checkbox
  - "Don't remind again" is suppressed for exactly 30 days from selection

---

## 2. User Journeys & Flows

### 2.1 Sign-Up / Login Flow
1. User navigates to site
2. Clicks "Sign in with Google"
3. Google authentication popup appears
4. On first login:
   - Username selection popup appears
   - User enters desired username
   - Real-time validation (1-20 chars, letters/numbers only)
   - System checks availability
   - User confirms selection
5. Redirected to home page
6. Can optionally set display name in profile settings (defaults to username)

### 2.2 Daily Wordle Gameplay Flow
1. User clicks "Daily Wordle" on home page
2. Game screen loads with:
   - Word grid (6 rows × 5 columns)
   - Letter keyboard
   - Attempt counter
   - Current day indicator
3. User makes guesses:
   - Types letters or clicks keyboard
   - Submits guess
   - Row shows color feedback (green/yellow/gray)
4. **Win scenario**: Completes word within 6 attempts
   - Celebration screen shown
   - Stats updated immediately (streak +1, EXP +20)
   - Can leave or view stats
5. **Loss scenario**: Uses all 6 attempts without solving
   - Loss screen shown
   - Stats updated immediately (streak reset to 0, EXP +5)
   - Correct word is not revealed
   - Can leave or view stats
6. **Leave mid-game**: Progress saved; can resume later same day
   - Next day: New word appears, progress from previous day lost
7. **Next day**: New word available, previous day's puzzle inaccessible

### 2.3 Free Play Gameplay Flow
1. User clicks "Free Play" on home page
2. Difficulty selection screen appears:
   - Toggle: Include Rare Words? (Yes/No)
3. User confirms selection → game loads
4. Gameplay identical to Daily Wordle (6 attempts, color feedback)
5. **Win**: Completes word
   - Restart button appears
   - Can click to load new word from same difficulty settings
   - Word commonality badge shown (Common/Rare)
   - No stats recorded
6. **Loss**: Uses all 6 attempts
   - Word revealed
   - Restart button appears
   - No stats recorded
7. **Exit mid-game**: 
   - Progress does NOT save
   - Clicking back → confirmation popup: "You will lose this progress" + "Don't remind me again" checkbox
   - Checkbox suppresses the warning for exactly 30 days
   - Returns to home page

### 2.4 Friendly Battle - Host Creation Flow
1. User starts from "Friendly Battle" on the home page or challenges an accepted friend from that friend's profile
2. Battle setup screen:
   - Select number of rounds: 1, 3, or 5
   - Select timer per round: 1-10 minutes in 30-second increments
3. User becomes host automatically
4. Battle supports up to 8 players total, including the host
5. Inviting players screen appears:
   - Search/select multiple friends at once
   - Can invite friends in bulk from modal
6. Invitations sent to selected friends
7. Battle lobby screen appears:
   - Host at top
   - Player cards show each invited player's status:
     - "Waiting" (invite pending)
     - "Joined" (player accepted, not ready)
     - "Ready" (player clicked ready button)
   - Counter displays only ready players over the current lobby population, such as "3/4 ready"; it does not separately show the eight-player capacity
   - Every present player, including the host, has a reversible "Ready" / "Cancel Ready" action while the party remains in the lobby
   - There is no host-only "Start Game" button
   - Host may adjust the rounds and round timer while nobody is Ready; those controls lock while at least one player is Ready and unlock again if every player cancels Ready
   - Host may invite additional friends while fewer than 8 players occupy the lobby
8. Pending invitations do not block the battle from starting
9. As friends accept invites → player cards update to "Joined"
10. Players click "Ready" button on their screen
11. Host sees ready status update in real-time
12. Each Ready player remains on the lobby setup screen, may select **Cancel Ready**, and sees the shared ready count update
13. When all joined players are Ready, the roster freezes, every client enters the battle screen, and each has up to 30 seconds to reach and acknowledge **Waiting for players**
14. If at least two players arrive, every arrived player receives the same synchronized `3… 2… 1…` countdown; the round timer starts only when it reaches zero
15. If fewer than two players arrive within 30 seconds, startup is cancelled with no result, statistics, history, or EXP

### 2.5 Friendly Battle - Join Flow
1. User receives battle invite (via in-app popup/modal)
2. Popup shows:
   - Inviter's name
   - Battle details (rounds, timer)
   - "Accept" / "Decline" buttons
3. **Accept path**:
   - Redirected to battle lobby
   - User's card shows "Joined" status
   - User clicks "Ready" button
   - The user remains in the lobby and may select **Cancel Ready** until all lobby members are Ready; after the all-ready transition, **Waiting for players** appears on the battle screen until the arrival barrier completes
4. **Decline path**:
   - Invite dismissed
   - If same person invites again within 3 seconds, popup appears
   - After declining 2 times from same person:
     - Third invite shows: "Mute for 1 minute" option
     - User can mute or decline
     - If muted: no invites from that person for 1 minute
   - User can also disable all invites from that person permanently via their profile
   - Re-enable by visiting profile → click "Allow Invites" button
5. Invitations have no timed expiration. They remain until accepted or declined, or disappear when their lobby starts, closes, or becomes unavailable
6. Multiple simultaneous invitations appear as separate invitation cards rather than overlapping popups
7. While a player is already in a Friendly Battle, new invitation popups are suppressed

### 2.6 Friendly Battle - Gameplay Flow (Per Round)
1. **Round transition** (before each round after the first):
   - All players see the current leaderboard during a fixed 10-second intermission
   - The screen shows the visible countdown, such as **Next round in 00:10**
   - There are no between-round Ready buttons, ready counts, configurable ready-up setting, or host removal controls
   - When the 10-second intermission ends, a synchronized `3… 2… 1…` countdown starts automatically
   
2. **Round gameplay**:
   - All players see same word
   - Real-time progress visible:
     - See opponents' colored squares (green/yellow/gray)
     - While still playing, do NOT see individual letters others guessed
     - After finishing their own puzzle by solving or failing, a player may see the letters in opponents' guesses
     - Opponent miniature boards update one completed row at a time without tile-by-tile animation
     - Similar to Tetrio battle screen (main view + small side views)
   - Timer counts down (1-10 minutes as set)
   - Leaderboard updates in real-time
   
3. **Round conclusion**:
   - First player to solve appears on leaderboard
   - Points awarded based on placement (see Battle Scoring System)
   - If timer expires: failed players shown, points awarded to solvers only
   
4. **Between-round leaderboard**:
   - After each round completes, full leaderboard screen shown
   - Displays current standings and points
   - All players see leaderboard (even if they disconnected/rejoined)
   - A fixed visible 10-second intermission runs automatically; nobody readies up and the host cannot remove a player during an active battle
   - At expiration, every battle participant remains included and the next synchronized `3… 2… 1…` countdown begins

5. **Disconnect/Rejoin during round**:
   - Popup offers: "Rejoin Game?" / "Exit"
   - If rejoin: Immediately joins current round with remaining time (no time adjustment)
   - If exit: Left battle (can still rejoin if at least 2 players remain)
   - A player who leaves or disconnects during the between-round intermission is marked Disconnected while the intermission continues normally
   - When they rejoin: They receive the battle's current intermission, countdown, or round screen
   - If connected participation drops below the required minimum, the applicable reconnection/preservation period begins before the battle is voided or awarded

6. **After final round**:
   - Final leaderboard shown
   - Stats recorded to all players' profiles
   - Continue button → returns to lobby
   - Exit button (in lobby) → leaves party entirely

### 2.7 2-Player Battle Scoring Flow
1. Round 1: Both players attempt same word
2. Player A solves in 2 guesses → 1 point
3. Player B fails → 0 points (Score: A=1, B=0)
4. Leaderboard shown, continue to Round 2
5. Round 2: Player B solves first → 1 point
6. The round ends immediately; Player A receives 0 points (Score: A=1, B=1)
7. Round 3: Player A solves first → 1 point
8. Player B fails → 0 points (Score: A=2, B=1)
9. Round 4: Player A solves first → 1 point (Score: A=3, B=1)
10. **Early win triggered**: Player A reached 3 points in a 5-round game
11. Game ends immediately (round 5 is not played)
12. Player A recorded as winner in stats

### 2.8 3+ Player Battle Scoring Flow
1. Round 1: 3 players competing
2. Player A solves (fastest) → 1st place → 5 points
3. Player B solves (2nd fastest) → 2nd place → 3 points
4. Player C fails → No points
5. Leaderboard: A=5, B=3, C=0
6. Fixed 10-second between-round intermission, then continue rounds
7. After all rounds: Final leaderboard determines overall winner
8. Recorded as battle win for highest scorer (or shared if tied)

### 2.9 Friend Request & Management Flow
1. User finds another player (via profile search/visit)
2. On their profile: "Add Friend" button visible (if not already friends/requested)
3. Click "Add Friend" → friend request sent
4. Button changes to "Request Pending"
5. Recipient sees notification in "Friends" section:
   - Friend Requests modal/screen
   - Shows who requested them
   - "Accept" / "Decline" buttons
6. **Accept path**: Friends added, can now see each other (based on privacy settings)
7. **Decline path**: Request rejected, button resets on sender's end
8. Once friends: Can add friend alias (nickname, visible only to you)

### 2.10 Profile Viewing Flow
1. **Own profile**:
   - All sections visible based on current settings
   - Can edit settings, change display name, manage aliases
   
2. **Other player's profile**:
   - Username and display name always shown
   - Level/EXP always shown
   - Streak always shown
   - Daily Wordle history: Shown if set to "Public" or if viewing friend (if set to "Friends")
   - Stats: Shown based on privacy setting (Public/Friends/None)
   - Battle history: Shown based on privacy setting (Public/Friends/None)
   - **Recent activity**: If their Daily Wordle history is visible to you, their current-day colored progress and attempt count may be shown even before you complete your own puzzle
   - If you haven't completed today's puzzle: Guessed letters are hidden and the card says **Not available until you finish today's Wordle**
   - After you complete today's puzzle: Their guessed letters become visible
   - Past attempted days show full 6-row grid with all guesses and color feedback
   - "Add Friend" / "Request Pending" / "Friends" badge shown appropriately

### 2.11 Settings Flow
1. User clicks Settings in sidebar
2. Settings page opens with categories:
   - **Sounds**: Toggle sound effects on/off
   - **Appearance**: Light, Dark, or Follow Device theme plus color-blind/high-contrast tile mode
   - **Privacy**: 
     - Daily Wordle History: Public | Friends | None
     - Statistics: Public | Friends | None
     - Friendly Battle History: Public | Friends | None
   - **Account**: Sign Out (additional account controls may be added later)
3. Changes save immediately (no confirmation needed)
4. Return to settings anytime via sidebar

---

## 3. Edge Cases & Error Handling

### 3.1 Disconnect/Network Failures
- **Mid-Daily Wordle**: Progress saves server-side; user can resume same day
- **Mid-Free Play**: A temporary network interruption keeps the open in-memory board; leaving, refreshing, closing the tab, or signing out discards progress with no loss recorded
- **Mid-Battle**: Rejoin popup offered; can rejoin if 2+ players remain
- **3-to-8-player reconnection grace period**: If a multiplayer battle drops below 2 connected players, the battle and round timer continue while a 20-second preservation timer runs; if nobody returns, void the battle and discard its points and statistics
- **2-player reconnection grace period**: If one player disconnects, the battle and round timer continue while a 30-second reconnection timer runs; the connected player may keep playing, the returning player resumes on the current synchronized screen without a new countdown, and failure to return awards the connected opponent the battle win
- **Individual multiplayer disconnect**: If at least 2 players remain connected, a disconnected player has no personal rejoin deadline and may return during any ongoing round
- **All players disconnect**: The applicable grace period begins; if nobody returns before it expires, the battle is voided with no statistics recorded. Home changes the active-battle card to **Battle voided** instead of reopening a terminal battle screen; acknowledging it starts a fresh lobby.

### 3.2 Timer Edge Cases
- **Round timer expires**: All players stop attempting; solvers get points
- **Battle timer expires mid-guess**: Guess doesn't count; no points awarded
- **Reconnect with time remaining**: Player resumes with remaining time (no time added/subtracted)

### 3.3 Tie/Simultaneous Actions
- **Two players solve at exact same time**: Compare completion times to 2 decimal places; if still tied in a 2-player round, both receive 1 point
- **Both players reach 3 points in 2-player 5-round game**: First to 3 wins (checked per submission)
- **Equal final scores in 3–8-player battles**: Tied players share the same placement under dense ranking; there is no sudden death
- **Tied placements in 3+ player battles**: Use dense ranking (for example: 1st, 1st, 2nd)
- **Tied 2-player match after scheduled rounds**: Play sudden-death rounds until the tie is broken; sudden death is exclusive to 2-player battles
- **Both players reach the match target simultaneously**: Continue to sudden death until one player wins a round alone

### 3.4 Friend Request Edge Cases
- **Self-friend request**: Cannot send friend request to yourself
- **Already friends**: "Friends" badge shown, no "Add Friend" button
- **Pending request**: "Request Pending" button shown; can cancel if you sent it
- **Pending from them**: Cannot send duplicate request
- **Pending is not friendship**: Pending requests do not grant friend-only profile access or permission to send battle invitations

### 3.5 Username/Display Name Edge Cases
- **Username taken**: Real-time validation shows error; must choose different name
- **Display name empty**: Defaults to username automatically
- **Username change cooldown**: Cannot change for 90 days after last change; message shown if attempted
- **Display name change**: No limit; changes reflected immediately

### 3.6 Privacy & Visibility Edge Cases
- **Set history to "None"**: Friends cannot see it, even if accepted friends
- **Deactivate friendship**: User can no longer see "Friends" level content from that person
- **Streak always visible**: Even if all other stats set to "None," streak displays
- **Level/EXP always visible**: Cannot hide

### 3.7 Daily Wordle Edge Cases
- **Global numbering**: Daily puzzle numbers belong to the shared Philippine-day schedule rather than individual accounts. A player who joins after launch starts with the current global puzzle number and cannot replay earlier Daily puzzles.
- **Account creation day**: The player's creation day is free and is not recorded as Missed if they do not play, regardless of the time the account was created
- **Playing on the creation day**: A successful attempt records a Win and an unsuccessful completed or expired attempt records a Failed loss
- **Missed-day tracking start**: Missed losses begin on the first complete Daily Wordle day after account creation; earlier days are not counted
- **Miss one day**: Streak resets (no freeze mechanic)
- **Miss multiple days**: Streak remains at 0 until new solve
- **View past puzzles**: Can see all 30 days (even unsolved days marked "Missed")
- **Daily reset**: The Daily Wordle resets globally at 12:00 AM Philippine Time (UTC+8)
- **Reset during an unfinished game**: Notify the player that the daily puzzle is resetting; an unfinished puzzle with at least one submitted guess is recorded as **Failed**, while a day with no submitted guesses is recorded as **Missed**
- **Skip current day**: Cannot access previous day's puzzle or replay current day

### 3.8 Free Play Edge Cases
- **Exit mid-game**: All progress lost; starting a new game gets a new word, and abandoning does not record a loss
- **Change difficulty mid-game**: Not allowed; must complete or exit
- **Unlimited play**: Players may play unlimited consecutive games, but each game allows only 6 guesses
- **Repeated words**: Previously encountered words may appear again
- **No persistent recovery**: Free Play is not saved locally or to the player's account; leaving, refreshing, closing the tab, or signing out ends the current game, while a temporary network disconnection does not erase the board that is already open in memory
- **Word reveals**: After solving, word commonality badge shown for learning

### 3.9 Battle-Specific Edge Cases
- **Host leaves battle**: Host control transfers to the second player who joined the lobby; the former host can rejoin as a regular player
- **Host succession fallback**: If the second player who joined is no longer present, control transfers to the earliest-joined player who is still present
- **Manual host transfer**: In the lobby, the host may select another present player's card and use a small confirmation modal to transfer the host role to that player
- **Host disconnect during a 2-player battle**: If the host fails to return within 30 seconds, the battle ends, the connected winner returns to the lobby and becomes host, while the departed loser is removed from that reusable party
- **Host disconnect during a 3–8-player battle**: Host control transfers immediately to the next eligible present player, who receives a small side notification
- **Only 1 connected player remains in a 3–8-player battle**: The 20-second preservation period begins; the battle is voided only if nobody returns
- **Player accepts invite, then leaves before the initial lobby ready-up**: Treated as left; can rejoin if game ongoing
- **Initial lobby ready-up**: Ready is disabled while only one player is present. With at least two players, Ready remains reversible in the lobby through **Cancel Ready**. When all present players are Ready, the roster freezes and every client enters **Waiting for players**; arrived battle clients wait up to 30 seconds for the minimum two participants before the synchronized `3… 2… 1…` countdown. An under-populated startup is cancelled without a result, statistics, history, or EXP
- **Between-round transition**: Every non-final round is followed by a fixed visible 10-second leaderboard intermission and then a synchronized `3… 2… 1…`; there are no between-round Ready buttons, ready counts, configurable ready-up duration, or host removal controls
- **Disconnected-player intermission status**: A player who leaves or disconnects during the intermission is marked Disconnected, remains a battle participant, and may return during the intermission or any ongoing round under the existing reconnect rules
- **In-battle moderation lock**: The host cannot remove a player while anyone is Ready or after the all-ready transition; lobby removal exists only while nobody is Ready or after players return to the original lobby following Battle Complete
- **Lobby moderation**: The host may remove any player from the lobby before the game begins
- **Removed player**: Sees **You were removed from the lobby** and may join again only after receiving and accepting a new invitation
- **Unavailable invitation**: An invitation silently disappears as soon as its lobby starts, closes, becomes full, or otherwise becomes unavailable, preventing late acceptance
- **Multiple invitations**: Displayed as separate invitation cards; invitations do not appear while the recipient is already participating in a Friendly Battle
- **Rejoin after final round concluded**: Cannot rejoin; battle already concluded and stats recorded
- **Minimum players requirement**: Battle requires 2+ players to start; dropping below 2 connected players triggers the applicable grace period before a forfeit or void result

### 3.10 Spam Prevention
- **Rapid invite spam**: Invite every 3 seconds allowed (by design)
- **Decline 2 times from same person**: Mute option appears
- **Mute 1 minute**: Auto-expires; invites resume after 1 minute
- **Permanent disable**: Can re-enable by visiting that person's profile

---

## 4. User System & Authentication

### 4.1 Sign-Up / Sign-In
- **Sign in with Google only** (no separate email/password form)
- **First-time login flow**:
  1. User signs in with Google
  2. Popup appears requesting username selection
  3. System validates username in real-time as user types
- **No other authentication methods** (Google account required)

### 4.2 Username
- **Length**: 1-20 characters
- **Allowed characters**: Letters and numbers only
- **Real-time validation indicator**: Shows validity status when field is touched (invalid/valid)
- **Uniqueness**: System checks if username is already taken (shown during signup)
- **Case-insensitive identity and search**: Capitalization variants refer to the same username; `Yuri` prevents anyone else from claiming `yuri`, while searches using either capitalization return the account with its chosen display casing
- **Change policy**: Can change username every 90 days
- **Previous-name reservation**: After a change, the old username and all capitalization variants remain unavailable for 30 days
- **Used for**: Friend search/addition, friend request system, battle invites

### 4.3 Display Name
- **Optional**: Not set during initial signup
- **Allowed characters**: Letters and numbers only
- **Not unique**: Multiple players may use the same display name; the unique username identifies and distinguishes accounts
- **Set in**: Profile page settings
- **Default behavior**: If blank, automatically displays as username
- **Format**: Shown without "@" symbol (username is "@name", display name is "name")
- **Change policy**: Can change infinitely
- **Visibility**: Shown on profile and in social features

### 4.4 Friend Aliases
- **Personal nicknames for friends** (only visible to you)
- **Setup location**: Profile page
- **Function**: Replaces that friend's display name everywhere in your own view, including their profile, Friends, leaderboards, invitations, lobbies, battles, results, and history; their username remains unchanged
- **Privacy**: Friends cannot see the alias you've given them

---

## 5. Statistics & Progression System

### 5.1 Daily Wordle Statistics

#### Win/Loss Tracking
- **Daily Wordle Wins**: Count of successfully solved daily puzzles
- **Daily Wordle Losses**: Umbrella category subdivided into:
  - **Missed**: Days the player didn't attempt the puzzle
  - **Failed**: Days the player attempted but didn't solve within 6 attempts
- **Current Streak**: The player's active consecutive Daily Wordle win streak
- **Highest Streak**: The greatest consecutive Daily Wordle win streak the player has ever achieved
- **Display format**: 
  ```
  Daily Wordle Wins: 9
  Daily Wordle Losses: 3
    └─ Missed: 1
    └─ Failed: 2
  Current Streak: 4
  Highest Streak: 12
  ```

### 5.2 Battle Statistics
- **Umbrella category**: Friendly Battles
  - **2-Player Battles** (tracked with Win Rate percentage)
  - **3-Player Battles** (separate win/loss tracking, no win rate)
  - **4+ Player Battles** (5+ players counted within 4+ category, no win rate)
- **Battle history**: Last 20 battles shown (21+ deleted for space)

### 5.3 Streak System
- **Daily Wordle streak**: Increments on successful daily puzzle solve
- **Profile treatment**: The profile shows the streak as enlarged text with a flame icon beginning at a 1-day streak; a 0-day streak has no flame.
- **Streak color progression**: Days 1–100 move smoothly through red → orange → yellow → green → blue → violet. Day 100 and every higher streak remain at the maximum violet color.
- **Streak reset**: Resets to 0 on:
  - Missing a day (not attempting puzzle)
  - Failing to solve within 6 attempts
- **No mercy mechanics**: No freeze/revive options
- **Always visible**: Streak displays on profile regardless of privacy settings
- **Leaderboard ranking**: Primary stat for MVP leaderboard

### 5.4 Level & Experience (EXP) System
- **Progression**: Level 1 → Level 2 → Level 3 → ... (infinite, no cap)
- **EXP requirements**: Double each level
  - Level 1 → 2: 20 EXP
  - Level 2 → 3: 40 EXP
  - Level 3 → 4: 80 EXP
  - (Pattern continues doubling)
- **EXP sources** (Daily Wordle only):
  - Win: +20 EXP
  - Loss: +5 EXP
  - No attempt: 0 EXP
- **Display format**: `Level 5 | 20/320 EXP` (current progress toward next level)
- **Profile visibility**: Always public (cannot hide)

### 5.5 Recent Activity (Daily Wordle History)
- **Duration**: Last 30 days displayed
- **Layout**: Horizontal grid of cards, one per day
- **Card contents**:
  - Date/puzzle attempt number
  - All 6 attempt rows (even if solved early)
  - Letter colors: Green (correct placement), Yellow (wrong placement), Gray (not in word)
  - Guessed letters shown directly on eligible cards without requiring the viewer to open a separate detail view
- **Visibility rules**:
  - Own profile: Always see full history
  - Others' current-day cards before the viewer completes today's puzzle: Show colored progress and attempt count, hide guessed letters, and display **Not available until you finish today's Wordle**
  - Others' current-day cards after the viewer completes today's puzzle: Show guessed letters as well as colors and attempts
  - Missed days: Show blank card with "Missed" indicator
- **Privacy**: Subject to Daily Wordle History privacy toggle (can be Public/Friends/None)

---

## 6. Social Features

### 6.1 Friend System
- **Adding friends**: Search by username, send friend request
- **Friend requests**: Recipient must accept to confirm friendship
- **Friends list**: Not displayed on public profile
- **Discovery location**: Player search is available only on the Friends page
- **Search behavior**: Partial username results update after each typed character, using a short delay to avoid unnecessary requests
- **Outgoing requests**: Senders may cancel pending friend requests
- **Crossed requests**: If both players send requests to each other, they become friends automatically
- **Declined requests**: Disappear silently for the sender and do not create a resend cooldown
- **Removing friends**: Either player may remove the friendship after confirming; personal aliases are deleted immediately
- **Privacy after removal**: Removing one friend never changes either player's privacy settings or affects other friendships; the removed player simply no longer qualifies to view content set to **Friends**
- **Friend capacity**: No application-defined maximum for the MVP
- **Battle-invite blocking**: Disabling a friend's battle invitations does not remove or block the friendship itself
- **Invitation eligibility**: Only accepted friends may send battle invitations to each other
- **Navigation badges**: Friends navigation shows the pending incoming friend-request count
- **Battle-invite bubble**: Active battle invitations appear in a separate round side bubble only while invitations are pending; the bubble displays a count and expands to invitation cards

### 6.2 Battle Invite System
- **Invite frequency**: Players can send/receive invites every 3 seconds
- **Declining invites**: Players can decline battle invitations
- **Mute mechanic**: 
  - After declining an invite **2 times** from the same person, a mute option appears (popup after invite popup)
  - Mute duration: 1 minute
- **Spam protection**:
  - Players can disable all invites from a specific person permanently
  - Re-enable option: Visit that person's profile → click button to allow invites again
- **UI**: Invitation popup/notification (interaction and visual details deferred to Phase 3: UX/Wireframes)

### 6.3 Friendly Battles
- **Minimum players**: 2 players to start; falling below 2 connected players invokes the applicable reconnection rule
- **Maximum players**: 8 players per lobby, including the host
- **Host controls**: Battle creator sets all game conditions
- **Transferable host role**: Before the battle starts, the host may transfer control to another present lobby member through that player's card
- **Persistent host preferences**: The host's last-used rounds and round timer are saved to their account and preselected when they create a future lobby
- **Selectable elements**:
  - Number of rounds: 1, 3, or 5
  - Timer per round: 1-10 minutes in 30-second increments
- **Same word**: All players guess the same word simultaneously
- **Real-time progress visibility**:
  - See colored squares (green/yellow/gray) of other players' attempts
  - Do NOT see other players' letters while still able to play
  - After the viewer solves or fails their own puzzle, opponents' guessed letters become visible
  - Each opponent row appears all at once after evaluation
  - Similar to Tetrio's battle screen layout (main view + small side view of opponents)

### 6.4 Battle Scoring System

#### 2-Player Battles
- **Win condition**: First player to solve the word
- **Scoring**: Win = 1 point, Loss = 0 points
- **Immediate round end**: The round ends as soon as the first player solves; the other player cannot continue that round
- **Tiebreaker**: Time taken (who solved first by seconds)
- **Match target**: First to 1 point in a 1-round setting, first to 2 points in a 3-round setting, and first to 3 points in a 5-round setting
- **Early conclusion**: The battle ends immediately when a player reaches the selected setting's target
- **Scoreless rounds**: If neither player solves, both receive 0 points and the round still counts
- **Exact round tie**: Completion time is compared to 2 decimal places; if the players remain tied, both receive 1 point
- **Tied match after scheduled rounds**: Play sudden-death rounds until the tie is broken
- **Simultaneous target tie**: If both players reach the winning target from the same tied round, sudden death continues until one player wins a round alone
- **Disconnect handling**: A disconnected player has 30 seconds to return with their previous guesses preserved while the connected opponent and timer continue normally; if the grace period expires, the connected opponent wins the battle automatically
- **Round completion during grace**: If the connected player finishes a round during the 30-second window, the point is awarded normally; reaching the match target ends the battle, otherwise the battle advances to the between-round screen while the remaining grace time continues
- **No shared final result**: A tied 2-player match continues through sudden-death rounds until one player wins alone
- **Win rate tracking**: Percentage of battles won vs. total 2-player battles played

#### 3-Player Battles
- **Placement-based**: Ranked by who solves fastest
- **Points awarded** (per round):
  - 1st place: 5 points
  - 2nd place: 3 points
  - 3rd place: 2 points if the player solves before the timer expires
- **Time tiebreaker**: To 2 decimal places (e.g., 1.23 seconds)
- **Same time tie**: Both players earn their placement points (e.g., both 1st = both get 5 points)

#### 4+ Player Battles (includes 5+ players)
- **Placement-based**: Ranked by solve speed
- **Points awarded** (per round):
  - 1st place: 5 points
  - 2nd place: 3 points
  - 3rd place: 2 points
  - 4th place: 1 point
  - 5th-8th places: 1 point if the player solves before the timer expires
- **Time tiebreaker**: To 2 decimal places
- **Same time tie**: Both earn their placement points

#### General Battle Rules
- **Only solvers earn points**: If only 1 player solves before time limit, only they earn points
- **Multiple solvers**: If 2+ players solve, they earn points based on placement
- **Failed players**: Do not earn points for that round
- **Game voiding**: If connected participation remains below the required minimum through the applicable grace period, the battle is voided and no statistics are recorded, except for a 2-player disconnect forfeit awarded to the connected opponent
- **Leaving & rejoin**:
  - Player can leave during battle
  - Popup offered to rejoin if disconnected/left voluntarily
  - Voluntary Exit redirects to the home page while preserving the active-battle rejoin option
  - Accidental disconnection keeps the player in a reconnecting state and automatically attempts to restore the battle
  - Can rejoin any time if at least 2 players remain in game
  - If nobody remains connected, the applicable grace period runs; the game becomes unavailable only after that period expires without a valid return
  - Players remain on final leaderboard for that battle (don't disappear)
- **Progress after rejoining**: Previous guesses remain and the player continues the current round with the remaining time
- **Placement timing**: Solvers are ordered by when their correct guesses are accepted, using completion time to 2 decimal places
- **Dense ranking for ties**: Tied players share a placement and the next player receives the immediately following rank (for example: 1st, 1st, 2nd)
- **Round start**: A `3… 2… 1…` countdown precedes play, and the timer begins when the board becomes interactive
- **Finished player state**: A solver's board stops accepting input while they watch opponent progress and the live leaderboard
- **3–8 player round conclusion**: The round ends when every connected player has finished or when the timer expires, whichever occurs first; disconnected players do not delay completion
- **Stats recording**: Only recorded if battle concludes successfully with 2+ players

#### Battle History Display
- **Amount tracked**: Last 20 battles (21+ deleted)
- **Sort order**: Most recent first
- **2-Player battle card shows**:
  - Player count (2)
  - Win/Loss result
  - Score vs opponent name and their score
- **3+ Player battle card shows**:
  - Player count (3, 4, 5+)
  - Your ranking/placement
  - Dropdown to view full leaderboard
- **Leaderboard dropdown contents**:
  - Player name
  - Ranking/placement
  - Final score
  - (No detailed round-by-round info)

---

## 7. Profile Page

### 7.1 Profile Display
- **Visible information**:
  - Player-selected custom avatar, with an application-provided silhouette used when no picture has been chosen
  - Username (e.g., @username)
  - Display name
  - Optional profile bio of up to 60 characters
  - Level and EXP progress (always shown, cannot be hidden)
  - Daily Wordle streak (ALWAYS shown, cannot be hidden)
  - Statistics sections (organized, privacy-controlled)
  - Recent activity: Daily Wordle history (last 30 days, horizontal grid, privacy-controlled)
  - Battle history: Last 20 battles with dropdown details (privacy-controlled)
  - Public-by-default activity status showing **Online now** or a periodically refreshed relative last-online time in minutes, hours, and days
- **Not visible on profile**:
  - Friends list
  - Full relationship details

### 7.2 Profile Privacy Settings
- **Granular privacy toggles** (each can be set to: Public | Friends | None):
  - Daily Wordle History
  - Statistics (Daily Wordle and Friendly Battle stats)
  - Friendly Battle History
- **Activity-status privacy**: Online/last-online activity is public by default; players may hide it, in which case they always appear offline to other users
- **Always public** (cannot toggle):
  - Level and EXP progress
  - Streak
- **Friend visibility rule**: Only accepted friends can see "Friends" level content (not pending requests)
- **Privacy override**: If someone sets a feature to "None," even friends cannot see it
- **Default**: All sections visible (Public)

---

## 8. Navigation & UI Structure

### 8.1 Main Navigation
- **Home page** (main hub)
- **Sidebar** (right side, persistent on desktop and mobile)

### 8.2 Home Page Sections
1. **Daily Wordle** (button/link to play)
2. **Free Play** (button/link to play)
3. **Friendly Battle** (button/link to initiate)
4. **Leaderboards** (display/link to leaderboard page)

### 8.3 Main Navigation
1. **Home** (return to the main hub)
2. **Profile** (link to your profile)
3. **Friends** (manage friends list; badge for pending requests and battle invitations)
4. **Settings** (opens settings page)

- **Mobile behavior**: On small screens, navigation collapses behind a menu button rather than permanently occupying screen space

### 8.4 Settings Page
- **Access**: Sidebar → Settings → opens dedicated page
- **Categories** (organized sections):
  - **Sounds**: One master sound-effects toggle, On by default (no music in MVP)
  - **Appearance**: Light, Dark, or Follow Device theme; Follow Device is default; includes color-blind/high-contrast tile mode
  - **Privacy**: Toggles for visibility of Daily Wordle History, Statistics, and Battle History; Level/EXP and streak cannot be hidden
  - **Account**: Sign Out
- **Account sync**: Sound, appearance, accessibility, and privacy settings sync across the player's signed-in devices
- **Note**: Difficulty selection is NOT in settings; appears only before Free Play

### 8.5 Leaderboard Page
- **Two leaderboard options** (accessible via tabs or toggles):
  
  **Global Leaderboard**:
  - Metric: Highest streak
  - Display: Top 100 players ranked by streak (highest first), plus the current player's own rank when outside the top 100
  - Contents: Username, display name (if set), current streak
  
  **Friends Leaderboard**:
  - Metric: Highest streak among your friends
  - Display: All accepted friends ranked by streak
  - Includes friends with 0 streak (even if they haven't played Daily Wordle yet)
  - Includes the current player
  - Contents: Username, display name (if set), current streak
  - Removed friends disappear immediately

- **Default tab**: Global
- **Tie ranking**: Dense ranking (`1st, 1st, 2nd`), with tied players ordered alphabetically by username without changing their shared rank
- **Profile access**: Selecting a row opens that player's profile
- **Viewer placement**: The current player's rank remains visible in a pinned on-screen summary while scrolling, and their normal highlighted row still appears at its actual ranked position with a **You** label
- **Updates**: Apply streak, missed-day, and friendship changes immediately, with a one-minute fallback refresh
  
- **Future expansion**: Can add other rankings (level, win rate, etc.)

---

## 9. Word Selection & Curation

### 9.1 Word Pool Strategy
- **Common list**: Exact archived 2,309-word Wordle answer list
- **Rare list**: Exact archived 10,657-word Wordle accepted-guess-only list
- **Total words**: 12,966 unique accepted words with no WRDL-specific exclusions or reclassification
- **Free Play expansion**: Optional Rare selection expands Common to the complete accepted-word pool
- **Deferred implementation detail**: Define the detailed daily word-selection algorithm during Phase 5: Technical Architecture

---

## 10. Future Considerations (Not MVP)

### 10.1 Possible Game Mode Expansions
- **Dordle**: 2 words in one game
- **Quadruple**: 4 words simultaneously
- **Octordle**: 8 words simultaneously
- **Sedecordle**: 16 words simultaneously

### 10.2 Feature Enhancements
- Music (currently out of scope)
- Display name customization at signup
- Additional leaderboard rankings (level, win rate, etc.)
- Advanced battle mechanics (detailed round breakdowns, etc.)

---

## 11. Technical Considerations

### 11.1 Authentication
- **Provider**: Google authentication (presented to users as "Sign in with Google")
- **User data**: Minimal (username, display name, statistics)

### 11.2 Database Requirements
- User accounts & profile data
- Daily word rotation system
- Battle/statistics tracking
- Friend relationships & invites

### 11.3 Real-time Features
- Live battle progress (color square syncing)
- Friend invite notifications (in-app only)
- Rejoin mechanisms for battles

---

## 12. Summary of Key Design Decisions

| Feature | Decision |
|---------|----------|
| **Attempt limit** | 6 (matches traditional Wordle) |
| **Streak mercy** | No (strict reset on miss/fail) |
| **Battle minimum** | 2 players to start; disconnection grace rules apply below 2 connected players |
| **Timer flexibility** | Yes (1-10 min, host adjusts) |
| **Battle speed metric** | Time-based (not guess count) |
| **Notifications** | In-app only (no email/push) |
| **Free Play tracking** | None (personal use only) |
| **Leaderboard (MVP)** | Streak-based (Global + Friends) |
| **Sidebar position** | Right side (desktop & mobile) |
| **Privacy defaults** | All sections visible |
| **Streak visibility** | Always shown, cannot be hidden |
| **Level/EXP visibility** | Always shown, cannot be hidden |
| **2-player match target** | First to 1 point (1 round), 2 points (3 rounds), or 3 points (5 rounds) |
| **Mute mechanic** | After 2nd decline, 1-minute auto-expire |

---

**Document Status**: Phase 1 complete — Feature Specification, User Journeys, and Edge Cases documented
**Next Phase**: UX/Wireframe Planning, Visual Design System, Technical Architecture
