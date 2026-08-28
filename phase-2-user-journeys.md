# Wordle Game — Phase 2: User Journeys and Edge Cases

## Document Purpose

This document defines how users move through the Wordle MVP, including successful paths, alternate paths, interruptions, errors, and recovery behavior. Product rules are defined in `phase-1-product-requirements.md` and are referenced here rather than duplicated unnecessarily.

**Status:** Complete — consistency audit passed

---

## 1. Account Creation, Sign-In, and Sign-Out

### 1.1 First-Time Sign-In — Successful Path

1. The visitor opens the website and selects **Sign in with Google**.
2. Google displays its account-selection or authentication interface.
3. If the visitor is already signed into Google, they can select an existing Google account and continue without re-entering credentials when Google permits it.
4. After Google authentication succeeds, the application checks whether that Google account already has a Wordle profile.
5. A first-time player is taken to required username setup and cannot access the rest of the website until setup succeeds.
6. The player enters a username containing only letters and numbers, with a length of 1–20 characters and no spaces.
7. Username uniqueness is case-insensitive. For example, `Yuri` and `yuri` are treated as the same username.
8. After a short pause in typing, the application checks availability and displays clear available, unavailable, or validation feedback.
9. When the player submits the form, the server checks availability again to prevent two users from claiming the same username simultaneously.
10. After the username is saved, the account setup is complete and the player is taken to the home page.

### 1.2 Cancelled or Failed Google Sign-In

- If the visitor closes or cancels Google authentication, they remain on the login page and see a non-blocking message such as **“Sign-in was cancelled.”**
- If authentication fails, they remain on the login page, see a clear error, and can try again.
- The application must not create a partial Wordle account when Google authentication does not succeed.

### 1.3 Interrupted Username Setup

- If Google authentication succeeds but the username cannot be saved because of a connection or server failure, the player sees an error and can retry.
- On their next successful sign-in, the player returns to username setup rather than receiving a second account or entering the website without a username.
- If the chosen username became unavailable before submission, the player stays on the setup screen and must choose another username.

### 1.4 Returning Player Sign-In

1. The player signs in with the Google account connected to their Wordle profile.
2. If they have no active multiplayer battle, they are taken to the home page.
3. If their account belongs to a battle that is still active, the application displays a **Rejoin Game?** prompt.
4. Accepting the prompt takes them back to the active battle under the applicable Phase 1 reconnection rules.
5. Declining the prompt takes them to the home page. Their treatment inside the active battle follows the battle leaving and reconnection rules.
- Unfinished Daily Wordle progress is not opened automatically; it remains saved until the player chooses Daily Wordle again, unless the Philippine-time daily reset has already occurred.
- Free Play never resumes. Returning to Free Play starts a new game.

### 1.5 Sign-Out During Play

#### Daily Wordle

- Submitted progress remains saved to the player's account for the current Philippine-time Daily Wordle day.
- Signing back in during that same day allows the player to resume by opening Daily Wordle.
- If the daily reset occurs before they return, a puzzle with at least one submitted guess becomes a Failed loss; a day with no submitted guesses becomes Missed. The new Daily Wordle then replaces it.

#### Free Play

- Signing out immediately ends the current Free Play game.
- Free Play progress is not saved locally or to the player's account.
- Refreshing, leaving, or closing the tab also ends the current Free Play game.
- A temporary network disconnection does not kick the player out or erase the board already open in memory.

#### Two-Player Battle

- Signing out is treated as a disconnection and begins the 30-second reconnection grace period.
- If the player returns in time, they resume under the Phase 1 reconnection rules.
- If they do not return in time, the connected opponent wins automatically.

#### Three-to-Eight-Player Battle

- Signing out is treated as a disconnection.
- If at least two players remain connected, the battle continues and the disconnected player may rejoin while it remains active.
- If fewer than two players remain connected, the Phase 1 20-second battle-preservation grace period begins.
- If nobody reconnects before that period expires, the battle is voided.

### 1.6 UX Decisions

- Sign-in should prioritize the fastest Google-supported returning-user flow.
- Username availability feedback should appear automatically after a short typing pause, avoiding a request on every keystroke.
- Submission always performs a final server-side uniqueness check.
- Error messages should explain what happened and provide a direct retry action without discarding valid user input.

---

## 2. Daily Wordle Journey

### 2.1 Opening Today's Puzzle

1. The player selects **Daily Wordle** from the home page.
2. If today's puzzle is unfinished, the saved board and remaining guesses load.
3. If today's puzzle is already complete, the completed board and result are shown; the player cannot replay it.
4. If the player has not started today's puzzle, an empty 6-row by 5-column board loads.
5. The game accepts letters from both a physical keyboard and the on-screen keyboard.

### 2.2 Entering and Submitting a Guess

1. The player enters up to five letters in the active row.
2. Submitting fewer than five letters displays **“Not enough letters”** and does not consume an attempt.
3. Submitting a five-letter word outside the accepted-guess dictionary shakes the row, displays **“Not in word list,”** and does not consume an attempt.
4. A valid guess is sent to the server for confirmation before its result is committed or its tile colors are revealed.
5. If accepted, the guess consumes one attempt and its tiles flip individually to reveal green, yellow, and gray feedback.
6. The player may begin typing the next guess while the tile-flip animation is running. Input is placed in the next row, but another guess cannot be submitted until the previous guess has been confirmed and evaluated.

### 2.3 Guess Submission Connection Failure

- The interface waits for server confirmation before committing a submitted guess or revealing its colors.
- If confirmation fails because of a network problem, the attempt is not silently consumed.
- The player sees a retryable connection message while their entered word remains visible.
- Retrying the same submission must not create duplicate attempts if the server received the original request.

### 2.4 Winning Today's Puzzle

1. When the accepted guess matches the answer, the completed board and win result appear.
2. The result includes:
   - Number of guesses used
   - Current Daily Wordle streak
   - Countdown to the next Daily Wordle reset at 12:00 AM Philippine Time
   - A spoiler-free **Share Results** action
3. The player may leave and later reopen Daily Wordle to see the same completed board and result.
4. The puzzle cannot be replayed.

### 2.5 Failing Today's Puzzle

1. After six accepted guesses without solving the word, the completed board and Failed result appear.
2. The correct answer is not revealed.
3. The result includes:
   - **Failed** status
   - Updated streak
   - Countdown to the next Daily Wordle reset
   - A spoiler-free **Share Results** action
4. The player may leave and later reopen Daily Wordle to see the same completed board and result.
5. The puzzle cannot be replayed.

### 2.6 Spoiler-Free Result Sharing

- Shared results never contain the answer or guessed letters.
- The shared image contains the puzzle number, result (`1/6` through `6/6`, or `X/6`), the result details shown on the result screen, and a colored grid without letters.
- The result screen presents one **Share Results** action.
- **Share Results** generates a medium-sized, detailed, spoiler-free result image and places the image itself on the clipboard so it can be pasted into a compatible application.
- The copied image may include Wordle branding for this project, the puzzle number, result, and colored grid, but never guessed letters or the answer.
- After copying succeeds, the application displays the familiar confirmation **Copied to clipboard**.
- If the browser cannot copy images to the clipboard, the interface should explain that limitation and offer the generated image as a download fallback.

### 2.7 Daily Reset While the Game Is Open

1. At 12:00 AM Philippine Time, the open Daily Wordle screen displays a reset notification immediately.
2. If the player submitted at least one guess without finishing, the expired puzzle is recorded as Failed.
3. If no guess was submitted, the expired day is recorded as Missed, except for the free account-creation day defined in Phase 1.
4. The notification provides a button to load the new Daily Wordle.
5. Old puzzle input is disabled after the reset so no late guess can change the expired result.

---

## 3. Free Play Journey

### 3.1 Difficulty Selection

1. The player selects **Free Play** from the home page.
2. The difficulty-selection screen opens with **Common** selected by default.
3. Uncommon and Rare are independent toggles that expand the Common word pool. The player may choose Common only, Common + Uncommon, Common + Rare, or Common + Uncommon + Rare.
4. On the player's first visit, a short, non-blocking tutorial callout explains what Common, Uncommon, and Rare mean.
5. After dismissal, the explanation remains accessible through an information icon rather than appearing before every game.
6. The player selects **Start Game** to begin Free Play.

### 3.2 Playing Free Play

1. A new word is selected using the chosen commonality settings.
2. The game accepts physical-keyboard and on-screen-keyboard input.
3. Each game allows six accepted guesses and follows the same guess-validation and tile-feedback behavior as Daily Wordle.
4. Free Play does not update statistics, streaks, levels, or EXP.
5. Previously encountered words may appear again.

### 3.3 Free Play Results

After either winning or using all six guesses, the result shows:

- Correct answer
- Word commonality: Common, Uncommon, or Rare
- Number of guesses used, or `X/6` for a loss
- **Next Word** action

Selecting **Next Word** immediately starts another game using the same difficulty settings. The results screen does not include a dedicated **Change Difficulty** button; the player may navigate back freely to return to the difficulty-selection screen and adjust the toggles.

### 3.4 Leaving an Unfinished Game

- Internal navigation away from an unfinished Free Play game displays **“You will lose this progress.”**
- The warning applies to the in-app Back action, Home, sidebar destinations, and other navigation controlled by the application.
- The warning includes **Don't remind me again**. Selecting it suppresses the warning for exactly 30 days from that moment.
- If the player confirms leaving, the current game ends and is not recorded as a loss.
- Browser refresh and tab closure may use the browser's standard leave-page warning where supported; the application cannot guarantee its custom dialog for those browser-controlled actions.
- Refreshing or reopening Free Play starts a new game automatically using the player's previous difficulty settings.

### 3.5 Temporary Network Disconnection

- Losing the network connection does not automatically navigate away, restart the game, or erase the board already held in the open page's memory.
- The interface displays an offline or reconnecting indicator while the application cannot reach the server.
- The player is not treated as having abandoned the Free Play game merely because the network disconnected.
- Any operation that requires server confirmation waits or retries safely after reconnection.
- Refreshing the page is different from reconnecting: because Free Play is not persistently saved, a refresh starts a new word using the previous difficulty settings.

---

## 4. Friends and Friend Requests

### 4.1 Friends Page and Player Search

1. The navigation label is **Friends** rather than Social because the MVP page is specifically for player discovery, friend requests, and friendship management.
2. Player search is available only on the Friends page.
3. Search results update after every character typed, with a short typing delay to keep the experience responsive without sending a request for every immediate keystroke.
4. Username search is case-insensitive: searching `yuri`, `Yuri`, or `YURI` finds the same account, displayed using the capitalization selected by its owner.
5. Each result displays:
   - Player avatar on the left, using the default silhouette when no custom picture exists
   - Username on top in larger text
   - Display name beneath the username in smaller text
   - Relationship action or status on the far right
6. The right-side control displays **Add Friend**, **Cancel Request**, or **Friends**, depending on the relationship.
7. Selecting the player information opens that player's profile page.
8. The MVP has no application-defined maximum number of friends.
9. The Friends tab defaults to activity ordering: online friends appear first, followed by offline friends from most recently active to least recently active. Friends absent for the longest time appear at the bottom.
10. A sort control provides most-recent activity, least-recent activity, oldest friendship first, newest friendship first, and alphabetical ordering.
11. The Friends-tab search field filters only the player's existing friends.
12. Long lists load an initial group and automatically load more friends as the player scrolls.

### 4.2 Sending a Friend Request

1. The player selects **Add Friend** from a search result or another player's profile.
2. The request is sent and the control changes to **Cancel Request**.
3. Selecting **Cancel Request** withdraws the pending request and returns the relationship control to **Add Friend**.
4. If both players send requests to each other before either responds, the crossed requests are automatically accepted and the players become friends.

### 4.3 Receiving and Responding to a Request

1. Incoming requests appear in the Friends page's request area.
2. The Requests tab lists incoming requests only; it does not contain a separate Sent section.
3. The recipient may select **Accept** or **Decline**.
4. Accepting creates the friendship and updates both players' relationship controls to **Friends**.
5. Declining removes the request silently; the sender receives no declined notification.
6. A declined request creates no cooldown, so another request may be sent immediately.

### 4.4 Removing a Friend

1. Either player may initiate **Remove Friend**.
2. A confirmation asks the player to confirm the removal.
3. Confirming removes the friendship for both accounts immediately.
4. Any personal alias attached to that friendship is deleted.
5. Neither player's privacy selections are modified, and all other friendships remain unchanged.
6. The removed player no longer qualifies to view sections already set to **Friends**, while remaining friends retain access normally.
7. Public information and information defined as always public remain visible to the removed player.
8. Cancelling the confirmation leaves the friendship unchanged.

### 4.5 Battle-Invitation Restrictions

- Disabling battle invitations from a particular friend blocks only that friend's battle invitations.
- The users remain friends and retain all other friendship behavior.
- Re-enabling invitations does not require sending a new friend request.
- Only accepted friends may send battle invitations; non-friends never receive an invite control.
- An accepted friend's profile menu contains **Block Battle Invites**. After blocking, the same action becomes **Unblock Battle Invites**.

---

## 5. Profiles, Privacy, and Player Search

### 5.1 Profile Identity

- Players may choose a custom profile picture.
- The application's silhouette avatar is the default placeholder when a player has not selected a picture.
- Google profile pictures are not imported automatically.
- The profile always shows the username, display name, level/EXP, and streak.
- The profile streak omits a redundant Daily Wordle caption. It uses enlarged colored text and shows a flame only from day 1 onward.
- Streak color progresses continuously from red at day 1 through orange, yellow, green, blue, and violet by day 100; day 100+ remains violet.
- Players may add an optional bio of up to 60 characters; it appears below the username on their profile.
- The player's own profile does not repeat their online/offline activity status because it provides no useful information to its owner.
- Display names may contain letters and numbers only.
- Display names are not unique. Multiple players may share the same display name because account identity and player search use the unique username.
- On the player's own profile, a pen icon beside the display name starts display-name editing.
- Selecting the player's own avatar opens **View Profile Picture**, **Change Profile Picture**, and **Remove Profile Picture** actions.
- Removing a custom picture restores the application's default silhouette avatar; the remove action is unavailable while the default avatar is already in use.

### 5.2 Username Changes

1. The player may request a username change from their own profile settings.
2. Before confirmation, the application warns that the username cannot be changed again for 90 days.
3. The new username must pass the same case-insensitive validation and availability checks used during account creation.
4. The player's previous username and every capitalization variant remain reserved for 30 days after the change to reduce impersonation risk.

### 5.3 Daily Wordle History Cards

- Eligible history cards display all six rows, tile colors, and guessed letters directly without a separate selectable detail view.
- The profile owner always sees their complete cards.
- A viewer who has not completed today's Daily Wordle may still see another player's current colored progress and number of attempts when privacy permits.
- For that current-day card, guessed letters are hidden and **Not available until you finish today's Wordle** is displayed.
- Once the viewer completes today's Daily Wordle, the other player's current-day guessed letters become visible.
- Past-day guessed letters remain subject to the profile owner's Daily Wordle History privacy setting.

### 5.4 Privacy Controls

The following settings operate independently:

- Daily Wordle History: Public / Friends / None
- Statistics: Public / Friends / None
- Friendly Battle History: Public / Friends / None

Level, EXP, and streak are always public and have no visibility controls.

- Changes save immediately without a separate Save button.
- When viewing their own profile, players always see all their information regardless of the selected audience.
- The owner's view displays a small audience indicator for privacy-controlled sections.
- When another viewer lacks access, the section displays a short private-state message rather than appearing broken or silently missing.

### 5.5 Friendship and Privacy

- Removing a friend does not alter any privacy selection.
- It changes only whether the removed player qualifies for content set to **Friends**.
- Other friendships and their access remain unchanged.

### 5.6 Online and Last-Online Activity

- Activity status is public by default, so any profile viewer may see **Online now** while the player is actively connected.
- After the player goes offline, viewers see a relative time such as **Last online 1 minute ago**.
- The displayed relative time refreshes periodically while visible.
- Absences under one hour are displayed in whole minutes; after one hour, the display advances in whole hours, such as **Last online 1 hour ago** and later **Last online 2 hours ago**.
- Longer absences advance to whole days when appropriate.
- The player may hide their online/last-online activity through a privacy toggle.
- When activity is hidden, the player always appears offline to everyone else and no last-online time is shown.
- Hiding activity does not affect the player's ability to use the application or see other information they are otherwise permitted to view.

---

## 6. Battle Creation, Invitations, and Lobby

### 6.1 Starting Battle Creation

- A player may create a battle from **Friendly Battle** on the home page.
- A player may also challenge an accepted friend directly from that friend's profile; this opens the same creation flow with that friend ready to be invited.
- Only accepted friends may be invited.

### 6.2 Battle Settings

The host configures:

- Match length: 1, 3, or 5 scheduled rounds
- Round timer: 1–10 minutes in 30-second increments

- These settings may be chosen before entering the lobby and adjusted by the host while still in the lobby.
- Changing a setting does not reset any player's Ready status.
- The final settings visible when the all-ready countdown begins govern the battle.
- The host's most recently used rounds and round timer are saved to their account.
- Each left/right configuration control cycles continuously: advancing past the last option returns to the first option, and moving backward from the first returns to the last.
- Those values are preselected when that player creates another lobby in the future, but remain editable before the next battle starts.

### 6.3 Lobby Invitations

1. The host may invite multiple friends at once. Only online friends appear in the lobby invitation picker.
2. The host may optionally send additional invitations from inside the lobby while fewer than eight total player slots are occupied.
3. Invitations have no timed expiration and display no expiration countdown.
4. An invitation remains until accepted or declined, or until its lobby starts, closes, becomes full, or otherwise becomes unavailable.
5. Multiple simultaneous invitations appear as separate invitation cards instead of overlapping popups, ordered newest first.
6. Each invitation card shows the inviter's avatar and username, current lobby size, Accept, and Decline. It does not show rounds, round timer, or expiration information.
7. If the recipient is already participating in a Friendly Battle, new invitation popups are suppressed.
8. When a lobby starts or becomes unavailable, its outstanding invitation cards silently disappear without an unavailable-lobby message.
9. The invitation picker supports searching the displayed online friends, remains open while several friends are invited, changes Invite to **Invited**, and marks players already present as **In Lobby**.

### 6.4 Accepting or Declining

- Accepting an active invitation joins the player to the lobby and changes their status to **Joined**.
- Accepting from Daily Wordle preserves the player's current Daily progress before navigating to the lobby.
- Accepting from an unfinished Free Play game first uses the existing **You will lose this progress** confirmation.
- Declining removes that invitation from the recipient's interface immediately.
- The inviter may send another invitation after the existing three-second interval.
- After two declines from the same inviter, the existing one-minute mute option is offered.

### 6.5 Lobby Membership and Ready State

- The lobby supports 2–8 players including the host.
- Player cards show Waiting, Joined, or Ready status. The host retains a crown after the host's name and participates in ready-up like every other present player.
- Pending invitations do not count toward the ready requirement.
- Changing lobby settings does not reset existing Ready statuses.
- Every present player, including the host, has a **Ready / Cancel Ready** toggle. There is no host-only **Start Game** control.
- The ready indicator shows ready players over the current lobby population, such as **2/4 ready**. If another player joins, it becomes **2/5 ready**; the eight-player maximum is not displayed beside the count.
- Once at least two players are present and every present player is Ready, the synchronized `3… 2… 1…` start countdown begins automatically.
- A player may select **Cancel Ready** before the countdown begins, which prevents the start condition. Ready controls lock once the countdown begins.
- If another player joins before the countdown begins, the newcomer enters as Not Ready and the all-ready condition is no longer satisfied.
- A player who was removed and later reinvited returns as Not Ready.
- At eight players, the host's Invite action becomes disabled and reads **Lobby Full**.
- Starting the battle removes all outstanding invitations for that lobby.

### 6.6 Removing a Lobby Member

1. The host may remove a player before the battle starts.
2. Removing uses a confirmation such as **Remove Mika from the lobby?** with Cancel and Remove actions.
3. The removed player sees **You were removed from the lobby**.
4. Their previous invitation no longer grants access.
5. They may join that lobby again only if the host sends a new invitation and they accept it.

### 6.7 Host Transfer

- If the host leaves, host control transfers to the second player who joined the lobby.
- If the second player who joined is no longer present, control transfers to the earliest-joined player who is still present.
- The host may manually transfer the role before the battle starts:
  1. The host selects another present player's lobby card.
  2. A small modal offers **Transfer Host**.
3. After confirmation, the selected player becomes host and receives all lobby host controls.
  4. The former host remains in the lobby as a regular member.
5. Existing settings, invitations, player order, and Ready statuses remain unchanged.
- The transfer confirmation says **Make Mika the host?** and explains that the current host will lose control of lobby settings.
- A player who becomes host automatically receives a small **You are now the host** notification.

### 6.8 Setting Changes

- Changing settings does not reset Ready statuses.
- No general settings-changed notice is shown to lobby members.
- The updated settings remain visible in the lobby and the final visible values govern the battle when it starts.

---

## 7. Battle Rounds, Scoring, and Intermissions

### 7.1 Starting a Round

1. After the battle begins, all participating players see a synchronized `3… 2… 1…` countdown.
2. Input remains disabled during the countdown.
3. The board becomes interactive for everyone at the same synchronized start time.
4. The selected round timer begins exactly when the board becomes playable.

### 7.2 Active Gameplay

- All participants receive the same answer word.
- Players submit guesses under the same validation and color-feedback rules as Daily Wordle.
- While a player is still active, opponent views show colored progress without revealing guessed letters.
- Each newly evaluated opponent row appears all at once rather than animating tile-by-tile.
- The live leaderboard updates as players solve.
- When a player solves, their board stops accepting input and they remain on the battle screen to watch opponent progress and the leaderboard.
- Once a player's own puzzle ends by solving or failing, opponents' guessed letters become visible to that player because they can no longer use the information in their own round.

### 7.3 Two-Player Round Conclusion

- The round ends immediately when the first player submits the accepted correct answer.
- The solver receives 1 point and the other player receives 0 points.
- If neither player solves before the timer expires, the round ends 0–0 and still consumes a scheduled round.
- Exact simultaneous solutions follow the existing two-decimal timing and shared-point rules.

### 7.4 Three-to-Eight-Player Round Conclusion

- A round ends when every currently connected player has finished or the timer expires, whichever occurs first.
- Disconnected players do not count as unfinished and do not delay the end of the round.
- A disconnected participant may still rejoin and play if the round remains active.
- Solvers receive placement points according to the Phase 1 scoring table; failed players receive no points.

### 7.5 Between-Round Leaderboard and Automatic Intermission

- The leaderboard screen appears for a fixed 10-second intermission after every non-final round.
- It visibly shows **Next round in 00:10** and counts down to zero.
- There are no between-round Ready buttons, ready counts, configurable ready-up setting, or host removal actions.
- The host cannot remove any participant while a battle is in progress.
- A player who leaves or disconnects during this screen is marked **Disconnected** while the intermission continues normally.
- When the intermission expires, every battle participant remains included and the synchronized `3… 2… 1…` round countdown begins automatically.

### 7.6 Sudden Death

- Sudden death applies only to tied 2-player battles. Ties in 3–8-player battles use dense ranking and do not create sudden-death rounds.
- Sudden-death rounds use the same word-selection rules, round timer, fixed 10-second intermission, and synchronized start countdown as the original battle.
- Sudden death continues under the Phase 1 tie rules until a winner is determined.

### 7.7 Final Leaderboard and Party Continuation

1. After the final or deciding round, the final leaderboard appears.
2. Each player has an individual **Continue** button.
3. Selecting Continue returns that player to the party lobby.
4. Lobby player cards show **Waiting for player** for anyone who is still viewing the final leaderboard.
5. The party remains together, allowing the current host to configure and start another battle without sending invitations again.

---

## 8. Disconnecting, Rejoining, and Host Transfer

### 8.1 Two-Player Disconnection

1. When one player disconnects, a 30-second reconnection timer begins.
2. The battle does not pause: the round timer continues and the connected player may keep entering guesses.
3. The disconnected player's existing guesses and battle membership remain preserved during the grace period.
4. If the player returns within 30 seconds, they reconnect directly to the screen and state currently active for the battle.
5. No additional `3… 2… 1…` countdown occurs because the battle never paused.
6. If the player does not return in time, the connected opponent wins the entire battle and the outcome counts as a normal win and loss in battle statistics.

### 8.2 Three-to-Eight-Player Disconnection

- If at least two players remain connected, the battle and timer continue normally.
- A disconnected player has no individual rejoin deadline while the battle remains active.
- They may return with their previous guesses preserved and the time currently remaining.
- If the battle drops below two connected players, a 20-second preservation timer begins without pausing the battle or round timer.
- If another participant returns within 20 seconds, the battle continues normally.
- If nobody returns, the battle is voided and all of its earned points and statistics are discarded.

### 8.3 Rejoining the Synchronized Battle State

- Refreshing during a battle automatically attempts to reconnect the player to that exact battle before offering a separate rejoin choice.
- A returning player lands on whichever synchronized screen is currently active for the battle.
- If the battle is mid-round, they return to the active board with existing guesses and remaining time.
- If everyone is on the automatic between-round leaderboard intermission, that is the screen they receive.
- If everyone is viewing the final leaderboard, they receive the final leaderboard.
- Rejoining never restarts a completed phase or gives the player extra time.

### 8.4 Host Disconnection

#### Two-Player Battle

- The host retains the role during the 30-second reconnection window.
- If the host reconnects, the battle continues normally.
- If the host does not return, the battle ends and the connected opponent wins.
- The winner is redirected to the party lobby and becomes its host.

#### Three-to-Eight-Player Battle

- Host control transfers immediately rather than waiting for the disconnected host.
- Succession follows the established joined-order rules.
- The new host receives a small side notification informing them that they are now host.
- If the previous host reconnects, they return as a regular participant unless the current host manually transfers the role back.

### 8.5 Voluntary Exit

- Selecting **Exit Battle** redirects the player to the home page.
- In a two-player battle, the confirmation explains that the player has 30 seconds to rejoin before the opponent wins the battle.
- In a 3–8-player battle, the confirmation explains that the player may rejoin while the battle remains active and that the battle may be voided if fewer than two players remain connected after the preservation period.
- Both versions use **Stay** and **Exit Battle** actions.
- The active-battle rejoin option remains available under the same timing and battle-preservation rules as an accidental disconnection.
- In a two-player battle, the 30-second return window applies; expiration awards the opponent the win.
- In a 3–8-player battle, the player may return while the battle remains active; if fewer than two players remain, the 20-second preservation timer applies.
- Unlike voluntary Exit, an accidental connection loss keeps the battle interface in a reconnecting state and automatically attempts to restore the connection.

### 8.6 Round Completion During a Two-Player Grace Period

- The connected player may finish the current round while the opponent's 30-second timer continues.
- The connected player receives the round point normally.
- If that point reaches the match-winning target, the connected player wins and the battle ends immediately.
- Otherwise, the battle advances to the automatic 10-second between-round leaderboard intermission while the remaining reconnection time continues.
- A returning opponent enters the currently active screen.
- If the grace period expires first, the connected player wins the entire battle.

---

## 9. Leaderboards

### 9.1 Opening Leaderboards

1. The player selects **Leaderboards** from the home page.
2. The page opens on the **Global** tab by default.
3. The player may switch between Global and Friends without leaving the page.
4. The MVP does not provide leaderboard search.

### 9.2 Global Leaderboard

- Displays the top 100 players ordered by current Daily Wordle streak.
- The list contains 100 players and does not load additional players beyond that set; dense ties may cause the final displayed rank number to be lower than 100.
- If the viewer is outside the top 100, their own rank is shown separately so they can still see their position.
- Selecting any player row opens that player's profile.

### 9.3 Friends Leaderboard

- Includes the viewer and every accepted friend.
- Friends with a zero streak remain included.
- Removing a friend removes that player from the Friends leaderboard immediately without changing any privacy settings or other friendships.
- Selecting a row opens that player's profile.

### 9.4 Ranking Ties

- Players with equal streaks share a rank using dense ranking, such as `1st, 1st, 2nd`.
- Players within the same tied rank are ordered alphabetically by case-insensitive username.
- Alphabetical ordering does not change the shared rank.

### 9.5 Row Contents

The intended MVP row contains:

- Rank
- Application silhouette avatar
- Username
- Display name
- Current streak

- Level is not included.

### 9.6 Update Behavior

- Update immediately when a Daily Wordle result changes a streak.
- Update immediately when the Philippine-time reset records missed days.
- Update the Friends leaderboard immediately when a friendship changes.
- Use a one-minute refresh as a fallback if a real-time update is missed.

### 9.7 Current-Player Placement

- The viewer's own row has a subtle highlight and **You** label.
- A pinned summary keeps the viewer's current rank visible on screen while the leaderboard is scrolled.
- The viewer's normal row remains in the ranked list at its actual position, even while the pinned summary is visible.
- If the viewer is outside the Global top 100, the pinned or separate own-rank row still shows their global placement.

---

## 10. Settings and Navigation

### 10.1 Settings Page

The dedicated Settings page contains Sounds, Appearance, Privacy, and Account sections. Changes save immediately without a separate Save button.

### 10.2 Sounds

- The MVP uses one master sound-effects On/Off toggle.
- Sound effects default to On.
- Separate volume or effect-category controls are deferred beyond the MVP.

### 10.3 Appearance and Accessibility

- Theme options are Light, Dark, and Follow Device.
- Follow Device is the default.
- The MVP includes a color-blind/high-contrast tile mode so correct, misplaced, and absent letters remain distinguishable without relying only on the standard green and yellow colors.
- Sound, theme, and high-contrast selections sync to the player's account across devices.

### 10.4 Privacy

The section includes:

- Daily Wordle History: Public / Friends / None
- Statistics: Public / Friends / None
- Friendly Battle History: Public / Friends / None
- Online/last-online activity visibility

- Content-audience settings default to Public.
- Online/last-online activity is also visible publicly by default.
- Turning activity visibility off makes the player appear offline to everyone and hides the last-online time.
- Privacy changes apply immediately and sync across signed-in devices.

### 10.5 Account and Sign Out

- The Account section includes **Sign Out**.
- Signing out follows the Daily Wordle, Free Play, and active-battle behavior already defined in the authentication and reconnection journeys.
- Additional account-management features remain future work.

### 10.6 Main Navigation

The primary navigation contains:

- Home
- Profile
- Friends
- Settings

- Home returns to the main hub from any non-game page.
- On desktop, this navigation appears on the right side.
- On smaller mobile screens, it collapses behind a right-side drawer opened by the menu icon. The drawer contains player identity, Home, Profile, Friends, Settings, and Sign Out.
- Friends displays a badge for pending incoming friend requests.
- Battle invitations use a separate round side bubble that appears only while one or more invitations are pending; selecting it expands the pending invitation cards.

### 10.7 Pending Requests and Invitations

- A pending friend request is not a friendship until accepted.
- Pending users receive no Friends-level profile access.
- Pending users cannot invite each other to Friendly Battles.
- Only accepted friends may send battle invitations.

### 10.8 Navigation Away from Games

- **Daily Wordle**: Leaving requires no warning because current-day progress is saved.
- **Free Play**: Internal navigation shows **Leave this game?** with the description **Your current Free Play progress will be lost**, the actions **Cancel** and **Leave**, and an optional **Don't show this again for 30 days** choice.
- **Active battle**: Navigating away displays an Exit Battle confirmation before returning home; confirming preserves the applicable active-battle rejoin behavior.

---

## 11. Errors, Loading States, and Final Consistency Audit

### 11.1 Loading Feedback

- Profiles, Friends, and Leaderboards use skeleton loaders shaped like the content that is loading.
- Short game operations may use a compact spinner or processing state.
- Loading indicators disappear as soon as usable content or an error state is available.

### 11.2 Standard Page Failure

When a normal page cannot load, the error state provides:

- A short plain-language explanation
- **Try Again**
- **Return Home**

MVP error screens do not display internal reference codes or technical details. Players recover through the provided actions such as **Try Again** and **Return Home**.

### 11.3 Offline State

- When the application detects no connection, a persistent **You're offline** banner appears.
- The banner remains visible while the user continues interacting without a connection.
- It disappears automatically after a successful reconnection.
- Daily Wordle cannot be played without an internet connection; saved progress is retained and the puzzle becomes available again after reconnection.
- An already-open Free Play game remains usable while the page stays open.
- Friendly Battle enters the applicable reconnection state.
- Other network-dependent actions wait, fail safely, or provide a retry action rather than silently losing input.

### 11.4 Daily Wordle Loading Failure

- Daily Wordle cannot begin until the authoritative daily puzzle and saved state load successfully.
- Failure displays **Unable to load today's puzzle — Try Again**.
- The application must not substitute a locally guessed answer or allow inconsistent daily puzzles.

### 11.5 Battle Availability Messages

Use direct messages for unavailable actions:

- **You were removed from this lobby**
- **This battle is no longer available**

### 11.6 One Active Battle Connection

- An account may control an active battle from only one browser tab or device at a time.
- Opening the same active battle from a newer connection first shows **Battle active elsewhere** with a **Continue here** action.
- Selecting **Continue here** transfers control to the newer connection.
- The older connection then stops accepting battle input and displays **Battle opened elsewhere**.
- This prevents duplicate guesses and conflicting player actions.

### 11.7 Expired Authentication

- If Google authentication expires, the application requests sign-in again.
- Recoverable Daily Wordle state remains saved.
- Active battle membership and reconnection follow the established battle rules.
- The application returns the player to the appropriate recoverable state after successful authentication.

### 11.8 Saved Confirmation

- Successful immediate-save setting changes show **Saved** for approximately two seconds in the lower-right on desktop and near the bottom-center on mobile.
- The confirmation does not block further interaction.

### 11.9 Maintenance

- Planned or detected service-wide maintenance displays a dedicated maintenance page instead of a partially broken interface.
- The page provides a plain-language status and a retry or reload action when appropriate.

### 11.10 Duplicate-Action Protection

- A retryable or submitting button becomes temporarily unavailable while its request is processing.
- Visual feedback shows that the action is underway.
- Re-enabling occurs after success or a retryable failure.
- Server operations must also reject duplicate submissions when repeated requests arrive.

### 11.11 Final Audit

Phase 1 and Phase 2 were reviewed for contradictory rules, obsolete TBDs, inconsistent terminology, and examples that no longer match the finalized behavior. Obsolete monthly warning resets, immediate battle-void wording, a shared 2-player final win, and the outdated between-round Continue flow were corrected to match the approved journeys.
