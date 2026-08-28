# Wordle Game — Phase 3: UX and Wireframes

## Document Purpose

This document defines the application's information architecture, responsive navigation, screen layouts, wireframes, dialogs, and interface states. It translates the approved requirements and journeys into visible, navigable screens.

**Status:** Complete — consistency audit passed

---

## 1. Information Architecture and Navigation

### 1.1 Home

- Home presents four large destination cards: Daily Wordle, Free Play, Friendly Battle, and Leaderboards.
- On mobile, the cards use a compact 2×2 grid with a fluid 1:1 square ratio to reduce scrolling.
- Cards remain readable and comfortably tappable; unusually short screens may scroll rather than compressing them excessively.
- On desktop, each Home card keeps a 1:1 square ratio and caps at approximately 250 × 250 px; the centered 2×2 grid caps at 510 px including its gap.

### 1.2 Desktop Navigation

- Main navigation remains fixed on the right while the page scrolls.
- It includes Home, Profile, Friends, and Settings.
- The player identity/avatar area opens the player's own profile.
- Settings and Leaderboards are full pages, not modals.

### 1.3 Mobile Navigation

- The application logo appears at the top-left.
- A menu button appears at the top-right.
- The menu provides Home, Profile, Friends, and Settings.
- During Daily Wordle and Free Play, navigation remains collapsed to keep attention on the board.

### 1.4 Friendly Battle Navigation

- Normal application navigation is hidden during an active Friendly Battle.
- A dedicated **Exit Battle** action remains available and uses the approved confirmation and rejoin behavior.

### 1.5 Friends Page

The Friends page contains three tabs:

- Friends
- Requests
- Find Friends

- Requests shows its pending count in the tab and Friends navigation badge.
- Battle invitations are not part of the Friends page.

### 1.6 Battle-Invitation Bubble

- A round side bubble appears only while one or more battle invitations are pending.
- The bubble shows the pending invitation count.
- Selecting it expands the active invitation cards with their Accept and Decline actions.
- When no pending invitations remain, the bubble disappears.
- Invitation cards show only inviter identity, current lobby size, Accept, and Decline; they contain no match settings or expiration countdown.
- Invitations have no timed expiration and are ordered newest first.
- Invitations silently disappear when accepted, declined, or when their lobby starts, closes, becomes full, or otherwise becomes unavailable.

### 1.7 Player Avatars

- Players may choose a custom profile picture.
- The application silhouette is used as the default placeholder.
- Selecting the player's identity area in navigation opens their profile.

---

## 2. Screen Inventory

### 2.1 Entry and Account

- Sign in
- Required username setup

### 2.2 Main Application

- Home
- Daily Wordle game and completed result
- Free Play difficulty setup, game, and result
- Leaderboards
- Friends: Friends, Requests, and Find Friends tabs
- Own profile and other-player profile
- Settings

### 2.3 Friendly Battle

- Battle setup
- Party lobby
- Active battle
- Automatic between-round standings and countdown screen
- Final leaderboard and return-to-lobby state

### 2.4 Supporting Interface States

- Battle-invitation bubble and expanded invitation cards
- Navigation menu
- Confirmation dialogs
- Loading skeletons
- Offline banner
- Page errors and maintenance page

### 2.1 Home Screen

- Desktop and mobile use a 2×2 grid of large destination cards.
- The entire card is the button; no separate Start Game or View Leaderboards action appears inside it.
- **Daily Wordle** shows Not Started, In Progress, Completed, Failed, or Missed status plus the countdown to the next Philippine-time reset.
- **Daily Wordle** and **Leaderboards** use no descriptive sentence.
- **Free Play** uses the short description **Unlimited practice.**
- **Friendly Battle** uses **Battle with friends.** and does not show online-friend counts.
- **Leaderboards** may show the player's current streak and global rank when available.
- Desktop places the conditional battle-invitation bubble beside the fixed right navigation.
- Mobile places the conditional bubble near the lower-right edge above other controls.
- The approved working brand is **WRDL**, represented by an invisible 2×2 letter grid arranged `W R / D L`. Phase 3 wireframes may retain simplified branding while Phase 4 defines its final styling.

### 2.2 Home Actions

- Selecting anywhere on a destination card opens that destination.
- Card titles and descriptions occupy the primary visual space, with status or player details kept secondary near the bottom.

---

## 3. Home Wireframe

The first low-fidelity wireframe covers the desktop shell, mobile header/menu, 2×2 destination grid, Daily status/countdown, leaderboard summary, and conditional invitation bubble.

---

## 4. Screen Wireframe Revisions

### 4.1 Entry

- Sign-in and username-setup content is vertically and horizontally centered on desktop and mobile.
- Account setup has no mobile navigation menu.
- On authenticated mobile screens, the logo remains left, the page label is centered, and Menu is right.
- Username setup uses a focused onboarding card with a small Wordle-tile motif, explicit field label, `@` prefix, character counter, availability feedback, 90-day change notice, and full-width Continue action.
- Character-format guidance is contextual rather than permanently displayed; it appears only after the player enters a prohibited character.
- Sign in shares the same centered Wordle-tile motif and focused-card language as username setup, containing only the welcome heading, short subtitle, and Google sign-in action.
- Authenticated mobile headers use an icon-only menu control.

### 4.2 Wordle Boards

- Daily Wordle omits the In Progress label on the game screen.
- On desktop and mobile, the on-screen keyboard always appears directly below the game board in every playable mode.
- The board and keyboard remain centered as one vertical gameplay unit and scale fluidly with the available content width.
- Mobile uses the available width while preserving comfortable margins.
- Every on-screen keyboard includes Enter and Erase.

### 4.3 Free Play Setup

- Commonality choices use playful, game-like selection surfaces rather than settings rows.
- Common, Uncommon, and Rare all remain visibly represented; Common appears selected by default as the base pool.
- Start Game aligns to the right.

### 4.4 Tabs

- Friends and Leaderboards use icon-only rounded tab controls with accessible labels.
- Settings does not use category tabs. It is one vertically scrolling page ordered Sounds, Appearance, Privacy, then Account.
- Theme and every Privacy setting use direct dropdown selectors on the right rather than separate Change buttons.
- Theme and Privacy rows do not repeat their selected value as gray descriptive text beneath the setting name.
- The Friends tab includes a sort control and defaults to online players first, followed by increasingly longer last-online times.
- The Friends-tab search filters existing friends only.
- The Requests tab contains incoming requests only and uses an empty state when none exist.
- Find Friends begins with the short prompt **Search by username**.
- After Add Friend is selected, the relationship action becomes **Cancel Request** so the sender may withdraw it directly.
- Desktop places the Friends sort control at the top-right beside search; mobile replaces it with a compact sort icon beside search.
- Incoming request cards use a check icon for Accept and a cross icon for Decline, both with accessible labels.
- Cancelling a sent friend request happens immediately without a confirmation dialog.
- A player search with no matches displays **No players found**.

### 4.5 Profile

- Online/last-online status sits at the profile header's top-right with a green or gray status dot.
- The activity-status treatment applies when viewing other players; the player's own profile omits their own online/offline status.
- On a mobile friend profile, the activity status aligns at the far right of the display-name row rather than occupying a separate row above the identity.
- The display name is the primary profile name with its pen-icon edit action immediately beside it. The unique username appears below, followed by the optional bio of up to 60 characters.
- Level and EXP use a progression strip beneath identity; streak appears as a nearby player stat.
- The streak stat uses enlarged text with a leading flame from day 1 onward and no redundant Daily Wordle caption. Zero streak shows no flame.
- Its color advances smoothly from red to orange, yellow, green, blue, and violet across days 1–100, then remains violet.
- **Recent Daily Wordles** is renamed **Daily Wordle**.
- Daily Wordle history remains a horizontal carousel on every screen size with arrows positioned at the left and right edges of the card list.
- Statistics and Friendly Battle History use section headings outside their content containers.
- The player's display name has a pen-icon action immediately to its right for inline editing.
- Selecting the player's own avatar opens a menu with View Profile Picture, Change Profile Picture, and Remove Profile Picture. Removing it restores the default silhouette.
- Privacy-controlled headings on the owner's profile include selectable audience icons for Public, Friends, and Private.
- Statistics separates Daily Wordle and Friendly Battle information.
- Daily Wordle **Losses** is an expandable row: collapsed it shows only total losses; expanded it reveals **Missed** and **Failed** counts.
- The **2-player** battle-stat row shows only win rate while collapsed; expanding it reveals separate **Wins** and **Losses** counts.
- Every Friendly Battle History entry has its own rounded match container. Its summary places the result at top-left, date at top-right, player count at bottom-left, match settings at bottom-right, and **View standings** on a third row at bottom-right.
- Every battle-history entry, including 2-player matches, includes a clearly visible expandable control for final standings. Two-player summaries show **2 players** rather than “vs Player.”
- Another player's private sections keep their headings and display **This activity is private** rather than disappearing.
- Private-state icons and **This activity is private** remain on one line when space permits.
- Before the viewer completes today's puzzle, another player's current Daily Wordle card shows its colored grid and attempt count without letters, with **Letters available after you finish today’s Wordle**.
- An accepted friend's profile provides Invite to Battle and a small options menu containing Remove Friend and Block Battle Invites.
- Invite to Battle creates and opens a new lobby with that friend ready to be invited.
- After invitations from that friend are blocked, the menu action becomes Unblock Battle Invites.

### 4.6 Leaderboards

- Leaderboards use ranked rows only and have no podium.
- Each rank is one flexible group with its rank label on the left and one or more player entries on the right.
- When several players share a rank, their entries occupy the same rank group and wrap as needed on narrower screens.
- Global contains exactly the top 100 players on one scrollable list and does not load additional players beyond that set.
- The MVP has no leaderboard search.
- The viewer's highlighted rank remains pinned near the bottom while scrolling on desktop and mobile; their normal entry also remains at its actual rank.

### 4.7 Battle Setup and Lobby

- Battle configuration and the party lobby share one screen.
- Each configuration is a horizontal row with its value control on the far right.
- Left/right arrows decrement or increment the available value.
- All configuration steppers wrap continuously between their first and last options; the round timer advances in 30-second increments from 1 to 10 minutes.
- Only the host can operate configuration controls; all lobby members see changes live.
- Redundant setting-summary bubbles are removed.
- Invite appears at the far-right of the Battle Lobby heading, not inside the host row.
- Transfer Host and other player-management actions remain hidden until the host opens a player-card context menu.
- Invite opens a friend-selection surface containing online friends only.
- The picker supports searching online friends and remains open while the host invites several people.
- Invite changes to Invited after selection, and players already present are marked In Lobby.
- Host names display a crown after the name.
- Non-host players see live setting values without editable arrow controls.
- Every present player, including the host, has a Ready / Cancel Ready action. There is no Start Game button.
- The lobby footer shows only ready players over the current lobby population, such as **2/4 ready**. When a player joins or leaves, the denominator changes with the lobby population; the eight-player maximum is not shown beside this count.
- Once at least two players are present and everyone is Ready, the synchronized `3… 2… 1…` countdown begins automatically.
- A player may cancel Ready before the countdown begins and thereby prevent the battle from starting; ready controls lock during the countdown.
- At eight players, Invite becomes the disabled label Lobby Full.
- Remove Player and Transfer Host use confirmation dialogs.
- Every lobby member has a Leave Lobby action separated from Ready.
- A newly assigned host receives a brief **You are now the host** notification.
- Explicit Exit or Leave actions appear on Daily Wordle, Free Play, Leaderboards, battle lobbies, active battles, and between-round screens.

### 4.8 Between Rounds

- The top-right label includes round progress, such as **Round Complete | 2/5**.
- The screen uses the same flexible ranked-row treatment as the main Leaderboards page, including grouped ties and no podium.
- Each entry shows rank, player avatar, player name, and total points.
- Points earned in the completed round appear briefly as an animated value such as **+5**, then merge into the player's total instead of occupying a permanent column.
- The viewer's row is highlighted in place but is not pinned because friendly battles contain at most eight players.
- The ranked list uses a responsive fixed-height viewport with its own vertical scrolling, keeping the complete leaderboard and the automatic transition visible without requiring the whole page to scroll. Its visual scrollbar is hidden while wheel, trackpad, touch, and keyboard scrolling remain available.
- Every non-final round uses a fixed visible 10-second intermission, shown prominently as **Next round in 00:10** beside the round-progress label.
- The screen contains no Ready button, ready count, configurable ready-up state, or host removal action.
- Disconnected entries darken and display **Disconnected**; they return to normal if the player reconnects before the round-end transition completes.
- A player who leaves or disconnects during the intermission remains a battle participant and follows the existing reconnect rules.
- When the 10-second intermission expires, the synchronized `3… 2… 1…` countdown begins automatically without host approval.
- Two-player sudden-death screens use labels such as **Sudden Death · Round 1**. Three-to-eight-player battles never enter sudden death; tied placements use dense ranking.
- The final leaderboard uses **Battle Complete**, final placements, total points, and an individual Continue action instead of Ready controls or a countdown.
- After a player selects Continue, they return to the existing canonical Battle Setup and Lobby screen rather than a separately designed post-battle lobby. Players who remain on the final leaderboard appear there as **Waiting for player**.

### 4.9 Active Battle

- Desktop uses the same vertically stacked board-and-keyboard composition as Daily Wordle, with the keyboard always below the board.
- The player's points and live placement align left, such as **You · 5 pts · #2**; the round timer is centered and visually emphasized; round progress aligns right.
- The timer briefly shakes once whenever each of its final ten seconds counts down. It does not flash, and the motion is disabled when reduced motion is preferred.
- A synchronized `3… 2… 1…` appears as a large overlay covering the entire battle screen before every round.
- Opponent cards show only the complete 5-column × 6-row grid during normal play; they do not show separate Playing, Solved, Failed, attempt-count, or placement labels.
- In two-player battles, the single opponent board uses a larger presentation that takes advantage of the available space.
- In 3–8-player battles, the opponent-card region scrolls independently when necessary so the player's board, keyboard, timer, score, and placement remain visible. Its scrollbar is visually hidden while scrolling remains available.
- A finished opponent card uses a lightly translucent green full-card overlay showing that player's round placement and **Time Taken: MM:SS**.
- In 3–8-player battles, a disconnected opponent card uses a lightly translucent red full-card overlay showing **Disconnected** with no reconnection countdown.
- In two-player battles, the red disconnected overlay additionally shows the remaining 30-second reconnection time.
- If a player in a 3–8-player battle is both finished and disconnected, their board overlay divides equally: the green finished status occupies the top half and the red disconnected status occupies the bottom half.
- Live ranking is integrated into the player's score line and the ordering of opponent cards rather than shown in a separate large leaderboard panel.
- After the player solves or fails, their keyboard disappears, **Time Taken: MM:SS** appears below their completed board, and the opponent area expands for easier spectating.
- Once the player's own puzzle is finished, all opponent letters are revealed automatically on their boards.
- Selecting **Exit Battle** opens a mode-specific confirmation:
  - Two players: **Exit this battle?** The description explains that the player has 30 seconds to rejoin before the opponent wins the battle.
  - Three to eight players: **Exit this battle?** The description explains that the player may rejoin while the battle remains active, and that the battle may be voided if fewer than two connected players remain after the preservation period.
  - Both dialogs use **Stay** and **Exit Battle** actions.

### 4.10 Daily Wordle Result

- The completed board remains visible after the final tile-flip animation and always preserves the complete 5-column × 6-row layout; rows not used during a successful solve remain visible as empty tiles.
- The on-screen keyboard is removed because the completed puzzle accepts no more input.
- On wide desktop screens, the result panel may appear beside the completed board after the keyboard is removed.
- On narrow desktop and mobile screens, the result panel moves below the board.
- The result panel appears automatically with a small entrance animation; no confirmation action is required.
- A win may use a short confetti celebration that does not obstruct the board for long and respects reduced-motion preferences.
- A winning result shows **You got it!**, the result from `1/6` through `6/6`, the current streak, and the next-puzzle countdown.
- A failed result shows **Failed**, `X/6`, the updated streak, and the next-puzzle countdown. It does not reveal the correct word.
- Neither result displays EXP earned or level progress.
- The screen has one primary sharing action named **Share Results**. It directly copies a generated spoiler-free image to the clipboard without opening a preview.
- The copied image contains the colored result grid without guessed letters, plus the approved result text and details.
- A successful copy displays **Copied to clipboard** as a brief interface confirmation.
- If image copying is unsupported, the player sees an explanation and may download the generated image instead.
- No dedicated Back to Home action appears; the player uses the normal application navigation.
- Reopening the completed Daily Wordle restores the same completed board and result layout.

### 4.11 Free Play Game and Result

- Free Play gameplay reuses the responsive Daily Wordle board-and-keyboard layout.
- A centered game-screen label identifies only the current puzzle word's rarity: **Common**, **Uncommon**, or **Rare**. It does not list all word pools selected for the session.
- After a win or failure, the complete 5-column × 6-row board remains visible, the keyboard is removed, and the result panel may appear beside the board on wide screens.
- On narrow desktop and mobile screens, the result panel moves below the board.
- A win shows **You got it!** and may use the same short, reduced-motion-aware confetti treatment as Daily Wordle.
- A failure shows **Better luck next time**.
- Both result states show the result (`1/6` through `6/6`, or `X/6`), the correct answer, and whether the answer is Common, Uncommon, or Rare.
- The primary **Next Word** action immediately starts a fresh board using the same selected word pools, without a countdown or return to setup.
- Free Play has no **Share Results** action and displays no statistics, streak, EXP, or level progress.
- The player uses normal navigation to return to Free Play setup and adjust word-pool selections; there is no dedicated Change Difficulty action on the result panel.

### 4.12 Shared States and Navigation

- The mobile menu icon opens a drawer from the right containing player identity, Home, Profile, Friends, Settings, and Sign Out.
- Leaving unfinished Free Play opens **Leave this game?** with **Your current Free Play progress will be lost**, the actions **Cancel** and **Leave**, and an optional **Don't show this again for 30 days** choice.
- Daily Wordle navigation requires no progress-loss confirmation because its progress is saved.
- Profiles, Friends, and Leaderboards use skeleton placeholders shaped like their real content while the application is retrieving data. The placeholder is replaced immediately by usable content or an error state.
- A persistent **You're offline** banner sits immediately below the page header and disappears after successful reconnection.
- Daily Wordle is unavailable without internet, but saved progress is retained for reconnection. An already-open Free Play game remains usable, while Friendly Battle enters its reconnection state.
- Standard page failures replace page content while keeping navigation available and provide **Try Again** and **Return Home**.
- Daily Wordle loading failure shows **Unable to load today's puzzle**, **Check your connection and try again**, **Try Again**, and **Exit**.
- An older battle connection receives a blocking **Battle opened elsewhere** overlay with **This screen can no longer control the battle** and **Return Home**.
- Expired authentication uses a blocking **Sign in with Google** prompt and returns the player to the appropriate recoverable screen afterward.
- Immediate setting saves show **Saved** for approximately two seconds in the lower-right on desktop and near the bottom-center on mobile.
- Maintenance uses a dedicated page with **Wordle is temporarily unavailable**, **We're performing maintenance. Please try again shortly**, and **Try Again**.
