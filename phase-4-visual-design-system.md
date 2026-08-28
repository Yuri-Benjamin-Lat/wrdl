# WRDL — Phase 4: Visual Design System

## Document Purpose

This document defines the visual language applied to the approved Phase 3 wireframes: brand identity, color, typography, shape, depth, iconography, and motion.

**Status:** Complete — final consistency audit passed

---

## 1. Brand Foundation

### 1.1 Working Product Name

- The application name is **WRDL**.
- WRDL is always written in uppercase when used as the product name or logo.

### 1.2 Logo Concept

- The logo is a compact 2×2 arrangement of traditional square Wordle-style tiles:
  - Top-left `[0,0]`: **W**
  - Top-right `[0,1]`: **R**
  - Bottom-left `[1,0]`: **D**
  - Bottom-right `[1,1]`: **L**
- Two tiles are green and two are yellow in an alternating checkerboard pattern.
- Tiles have moderate spacing that recalls a Wordle board without separating the mark excessively.
- There is no enclosing grid outline or outer frame around the four tiles.
- The letters use a strong rounded weight and switch between dark and light treatments with the appearance theme.
- Letter size always scales proportionally with tile size, keeping the same visual ratio in compact navigation marks and larger brand presentations.
- A one-line **WRDL** wordmark may be used where the 2×2 logo would be too small or where a horizontal lockup is more appropriate.
- Navigation primarily uses the 2×2 logo by itself; sign-in and promotional surfaces may pair it with the horizontal WRDL wordmark.
- The app icon uses the warm-field treatment from Option B, with the 2×2 WRDL mark enlarged to fill the icon confidently while retaining balanced outer padding.

### 1.3 Personality

- Playful and game-like without becoming childish.
- Clean and modern enough for repeated daily use.
- Friendly rounded typography and shapes.
- Game-mode cards may be more expressive than settings, lists, and utility screens.

---

## 2. Theme Direction

### 2.1 Light Theme

- Uses a gently warm off-white page background derived from the Option B app icon, softened to avoid appearing overly yellow across large screens.
- Surfaces are slightly lighter than the page and remain clearly separated.
- Text uses a very dark green-charcoal rather than pure black.

### 2.2 Dark Theme

- Uses a subtly green-tinted soft charcoal rather than pure black or a completely neutral charcoal.
- Raised surfaces use a slightly lighter charcoal.
- Text uses a warm near-white.

### 2.3 Game Colors

- The familiar Wordle meanings remain recognizable:
  - Green: correct letter and position
  - Yellow: correct letter, wrong position
  - Gray: absent letter or inactive state
- WRDL uses its own accessible shades rather than copying another product's exact palette.
- Color meaning is also communicated through placement, labels, and high-contrast mode rather than color alone.
- Yellow is reserved primarily for Wordle feedback and the alternating brand mark rather than ordinary action buttons.
- Yellow may also appear sparingly in celebratory details, but never as the ordinary primary-action color.
- The primary green is muted and natural rather than bright or heavily saturated.
- Neutral and absent-letter tiles use warm gray so they remain harmonious with the warm light theme.

---

## 3. Typography

- The primary typeface is **Fredoka**, giving the interface a rounded, friendly, and game-like character.
- Headings and logo treatments use stronger weights; body text remains calm and highly readable.
- Timers, scores, countdowns, and aligned statistics use tabular numerals.
- Interface text avoids excessive all-caps; uppercase is reserved for the WRDL brand and short game labels where appropriate.

---

## 4. Shape and Depth

- Standard controls and content cards use moderately rounded corners.
- Home game cards and playful selection surfaces may use larger corner radii.
- Wordle game tiles retain a traditional square shape rather than rounded corners.
- Selected option cards use a green border and a gentle green-tinted surface instead of becoming fully green.
- Interactive cards and dialogs use subtle shadows for lift.
- Ordinary list rows, settings, and leaderboard groups remain comparatively flat.
- Borders remain soft and secondary to spacing, hierarchy, and surface contrast.

### 4.1 Reusable Components

- Buttons use rounded-rectangle shapes rather than full pill shapes.
- Primary actions use a solid muted-green fill with light text.
- Secondary actions use a lightly filled neutral surface rather than a transparent outline.
- Destructive actions use red only when the action has a meaningful destructive consequence.
- Text fields and dropdowns use a light surface, soft border, and green focus treatment.
- Toggles use green for on and warm gray for off.
- Icon-only navigation controls use rounded-square bubbles so they remain distinct from circular avatars and battle-invitation bubbles.
- Brief confirmations appear in the upper-right on desktop and top-center on mobile.
- Confirmation feedback uses a small flipping green Wordle tile beside plain inline text, avoiding the generic rounded white toast card and accent stripe.
- Modals use a centered raised card, dimmed background, and one clearly emphasized primary action.

### 4.2 Iconography and Status Language

- Interface icons use a clean, rounded outline style.
- Desktop sidebar navigation uses full-row rounded controls. The active destination uses a solid green row with contrasting icon and text; inactive destinations remain unfilled on the neutral sidebar.
- Mobile uses the same row treatment inside its right-side navigation drawer, while standalone icon-only controls retain rounded-square surfaces.
- The default avatar is a simple head-and-shoulders silhouette on a warm-gray circle.
- Online status uses a small green dot; offline status uses a gray dot. A short text label accompanies the dot when space allows.
- A muted-yellow crown appears immediately after a host's username.
- The pending battle-invitation bubble performs one subtle bounce when it first appears and then remains still.
- Timers use the normal foreground color by default and change to red during the final 10 seconds.
- Final-ten-second timers use one subtle shake each time the displayed second changes.

---

## 5. Motion

- Buttons use a small press/depress response.
- Tile flips, synchronized countdowns, earned-point movement, and restrained confetti carry most expressive animation.
- Navigation, settings, and ordinary page transitions remain calmer.
- Motion never prevents immediate interaction and respects reduced-motion preferences.

### 5.1 Gameplay Components and Feedback

- Empty game tiles use a transparent surface with a warm-gray border.
- A tile containing an unevaluated letter keeps its neutral surface, strengthens its border, and uses the current theme's foreground text.
- Evaluated tiles use muted green for correct, muted yellow for misplaced, and warm gray for absent; letters use a high-contrast light treatment.
- The active tile receives a green border and a very small scale response when a letter is entered.
- Invalid words shake the current row and show a concise message directly above the keyboard.
- Submitted rows reveal from left to right with a short sequential tile flip.
- Wins use green-and-yellow confetti with varied density, starting positions, fall distances, drift, timing, particle shapes, and clockwise/counterclockwise rotation; failed games do not use confetti.
- Keyboard keys use softly rounded rectangles. Enter and Erase are wider than letter keys.
- Compared with the Phase 3 low-fidelity wireframes, keyboard keys receive slightly more width and slightly more space between keys.
- The keyboard remains below the board in every game mode on desktop and mobile.

---

## 6. Current Design Decisions

- Brand: **WRDL**
- Logo: moderately spaced 2×2 `W R / D L` square-tile grid with alternating green and yellow tiles
- Overall style: playful, game-like, clean, and modern
- Typography: **Fredoka**
- App icon: **Option B** — warm field with an enlarged centered WRDL mark
- Themes: warm light and soft-charcoal dark
- Primary green: muted and natural
- Light background: softly warm off-white derived from the Option B icon
- Dark background: subtly green-tinted charcoal
- Neutral tiles: warm gray
- Shape: moderately rounded, with more playful game cards
- Depth: subtle shadows on interactive cards and overlays
- Interaction: small button-press response
- Animation emphasis: gameplay feedback rather than utility navigation
- Button hierarchy: green primary, neutral secondary, and red only for necessary destructive actions
- Yellow usage: game feedback and brand mark, not ordinary buttons
- Game tiles: traditional square
- Selected cards: green outline with a soft tinted background

---

## 7. Polished Screen Application

### 7.1 Entry and Home

- **Status:** Approved for desktop and mobile.
- Sign In and Username Setup keep their primary content vertically and horizontally centered.
- Sign In and Username Setup omit secondary top-bar branding and page labels so the centered WRDL identity appears only once.
- Sign In contains only the WRDL branding, **Welcome to Wordle**, **Daily puzzles and friendly competition.**, and **Sign in with Google**.
- Username validation guidance remains hidden until invalid input is entered.
- Home retains four fully clickable square game cards with no separate Start buttons.
- The Home logo remains at the far left of the top bar; a redundant Home heading is omitted because navigation already communicates the active page.
- Desktop Home cards stop growing at their approved maximum and remain centered.
- Mobile Home uses a compact two-column 1:1 card grid.
- Home card identities use muted green for Daily Wordle, warm yellow for Free Play, deeper green-charcoal for Friendly Battle, and warm neutral with green details for Leaderboards.
- The Daily Wordle card illustration uses an accurately aligned 5×4 tile board with gray opening rows, increasing yellow/green feedback, and a fully green final row.
- The Friendly Battle card uses one enlarged swords icon without player circles.
- The Leaderboards card includes a short description and an enlarged trophy icon.
- Daily Wordle, Friendly Battle, and Leaderboards artwork share an exact bottom-right alignment with equal card-edge padding.

### 7.2 Solo Gameplay

- **Status:** Approved for desktop and mobile.
- Includes Daily Wordle gameplay/results and Free Play setup/gameplay/results.
- Game keyboards remain below the board at every viewport.
- Gameplay places more breathing room between the puzzle status and board; mobile distributes the board and keyboard farther down the available screen.
- Daily and Free Play result boards preserve the full 5×6 footprint, including unused rows.
- Result headers keep the outcome and puzzle summary on one row: an equally sized, aligned green check marks a win and a red cross marks a failure. Decorative result stars are not used.
- Mobile result layouts distribute the board and result card vertically to make fuller use of the screen.
- Daily results include **Share Results**; Free Play results do not.
- Daily failure results do not reveal the correct word.
- Free Play shows only the current puzzle rarity and does not display statistics.
- Free Play setup retains three independent word-pool selections and a right-aligned **Start** action.
- On mobile, the Free Play setup introduction sits higher rather than being vertically centered, with clear spacing before the word-pool controls.
- Mobile gameplay boards grow responsively into available space while preserving bottom breathing room beneath the keyboard.

### 7.3 Friends and Profiles

- **Status:** Approved for desktop and mobile.
- Covers Friends, Requests, Find Friends, the player's own profile, and another player's profile.
- Friends sections use the approved icon-only rounded controls; Requests retains its count badge.
- Friend rows keep identity on the left and online/last-online status at the far right.
- Friends uses an icon-only sort control on desktop and mobile; selecting it opens the full list of sort choices.
- Find Friends displays an existing **Friends** relationship as plain status text rather than a button-like container.
- Own-profile avatar actions, display-name editing, and audience controls remain directly accessible from the profile.
- The owner's profile omits their own activity status, places the pen action beside the primary display name, and uses the following line for an optional 60-character bio.
- Profile progression combines Level and EXP in a clear strip, with streak beside it.
- Profile streak presentation uses colored text with a larger solid flame for streaks of at least one day. The flame is visually dominant over the slightly smaller streak label. The hue progresses red → orange → yellow → green → blue → violet through day 100 and remains violet thereafter.
- Daily Wordle history stays horizontal with navigation arrows on both sides.
- Statistics and Friendly Battle History retain headings outside their content surfaces.
- Statistics follows the product specification: Daily Wordle shows Wins plus Losses subdivided into Missed and Failed; Friendly Battles separates 2-player, 3-player, and 4+ player records, with win rate only for 2-player battles.
- On both own and friend profiles, Daily Wordle Losses is collapsed by default and expands to Missed and Failed. The 2-player battle row shows only win rate by default and expands to Wins and Losses.
- Statistics reserves a dedicated rightmost chevron column so dropdown and non-dropdown values remain vertically aligned.
- Profile disclosure controls follow the Settings visual language with rounded surfaces, green chevrons and interaction states, and theme-aware expanded panels.
- Friendly Battle History is newest-first and presents each match in its own rounded container with a consistent result/date/player-count/settings grid.
- Every match, including 2-player battles, uses a visible **View standings** label and chevron. Two-player standings expand just like 3+ player standings.
- Friend profiles include Invite to Battle and the contextual Remove Friend / Block Battle Invites menu.
- Mobile friend profiles align activity at the far right of the display-name row; private-state icon and message use one inline treatment.
- Desktop account navigation uses the approved Home-screen sidebar treatment: neutral account block, evenly spaced navigation links, and a green active state.

### 7.4 Leaderboards and Settings

- **Status:** Approved for desktop and mobile.
- Covers Leaderboards and Settings in light and dark themes.
- Leaderboards uses icon-only Global and Friends controls, flexible ranked rows instead of a podium, and distinctive but restrained treatments for the top three ranks.
- Tied players share one flexible rank group, while the leaderboard remains capped at 100 positions and does not include search.
- The player's own rank remains pinned near the bottom of the viewport and also appears normally when its ranked row is visible.
- The pinned personal-rank row remains fixed to the bottom in both desktop and mobile layouts, including the Friends ranking.
- The leaderboard header does not display a Top 100 or update-frequency caption.
- The Friends leaderboard does not display an explanatory “You and accepted friends” caption.
- Leaderboard streak values use the same day-based hue progression as profiles: red at day 1, transitioning through orange, yellow, green, blue, and violet by day 100, then remaining violet.
- Leaderboard streaks use a solid flame followed only by the streak number; the redundant “day/days” label is omitted.
- Each leaderboard player entry displays only the display name and username; real or full names are not shown.
- Settings is one continuous vertical page ordered as Sounds, Appearance, Privacy, and Account, without category tabs.
- Appearance and privacy choices use direct dropdowns; toggleable settings use compact switches.
- Settings dropdown fields and option menus use WRDL surfaces, green interaction states, and matching light/dark color schemes.
- The Account area includes username management and Sign out.
- Both screens include the standard Exit action and responsive desktop/mobile navigation.
- Desktop account navigation matches the approved Home-screen sidebar treatment exactly, with the active destination highlighted in green.

### 7.5 Friendly Battles

- **Status:** Approved for desktop and mobile.
- Covers Battle Setup and Lobby, Active Battle, Between-Round Standings, and Battle Complete.
- Battle settings use looping increment controls for rounds and the round timer, including 30-second timer increments. Between-round ready-up does not exist; the intermission is always the fixed automatic 10-second transition.
- Active battles keep the keyboard below the player's board in every viewport and use full-card overlays for finished and disconnected opponents.
- Between-round standings use a fixed responsive scrolling area with the visual scrollbar hidden and a prominent fixed 10-second **Next round** countdown. They contain no Ready or in-battle removal controls.
- Battle Complete uses flexible ranked groups for tied placements, displays tied scores once per group, and returns players to the canonical Battle Setup and Lobby screen.

### 7.6 Supporting Interface States

- **Status:** Approved for desktop and mobile.
- Covers battle invitations, the mobile navigation drawer, progress-loss and battle-exit confirmations, loading skeletons, offline behavior, page and blocking errors, and maintenance.
- Battle invitations use a conditional round side bubble and newest-first cards containing only inviter identity, lobby population, Accept, and Decline.
- The invitation bubble sits at the bottom-right of the content area. Opening it expands one invitation container; minimizing the container restores the round bubble.
- Mobile navigation opens from the right and contains player identity, Home, Profile, Friends, Settings, and Sign Out. It closes when the player selects the dimmed area outside the drawer; no redundant close control is shown inside it.
- The mobile drawer does not repeat a Menu heading. Desktop uses its permanently visible navigation without a drawer or darkened overlay.
- Offline state uses a persistent banner below the header and preserves each game mode's approved offline behavior.
- Standard failures retain navigation and expose clear recovery actions; battle-control and expired-authentication failures use blocking states.
- MVP error screens omit internal reference codes and technical details.

---

## 8. Final Consistency Audit

- **Status:** Passed.
- All nine polished screen groups have matching editable sources and current standalone previews.
- JavaScript syntax validation passes for every polished source.
- The approved WRDL brand, Fredoka typography, warm-light and green-charcoal dark themes, square Wordle tiles, navigation treatment, button hierarchy, and responsive behavior are consistently represented.
- Daily Wordle alone provides **Share Results**; Free Play has no sharing action or statistics.
- Friendly Battle terminology, reconnect behavior, sudden death, scoring presentation, fixed between-round timing, and return-to-lobby behavior match the approved Phase 1–3 specifications.
- Supporting states use the approved invitation bubble, mobile drawer, confirmation dialogs, loading skeletons, offline banner, recovery actions, and maintenance treatment.
- Obsolete labels, internal error reference codes, and unresolved Phase 4 review statuses have been removed.
