Tentu. Sekarang kita sudah punya **visual direction yang cukup jelas**, jadi PRD ini saya buat khusus untuk **Desktop UI/UX BUMP.TRADE**, dengan fokus pada 3 screen saja:

1. Main Menu
2. Vehicle Selection
3. Leaderboard

Tidak ada UI tambahan yang tidak diperlukan.

# BUMP.TRADE — DESKTOP UI/UX PRD

## 1. Product UI Direction

BUMP.TRADE desktop UI harus terasa seperti:

> **Premium arcade game showroom + stock-market culture**

Bukan:

> crypto dashboard / banking application / crowded game launcher

Visual principle:

> **OBJECT LOUD — UI QUIET**

3D vehicle adalah fokus utama.

UI hanya membantu user memahami:

- where am I
- what can I do
- which car am I selecting
- how strong is the car
- what is the current stock identity
- where do I stand on leaderboard

---

# 2. Target Platform

Primary target:

> Desktop browser

Recommended target:

> 16:9

Examples:

- 1920 × 1080
- 2560 × 1440
- 1440 × 900
- 1366 × 768

Design must scale responsively without breaking the hierarchy.

Minimum supported desktop viewport:

> 1280 × 720

Below this, UI may transition to a compact layout later.

---

# 3. GLOBAL VISUAL LANGUAGE

## Background

Use:

- dark navy / charcoal
- blurred environment
- subtle depth of field
- soft lights
- reflective floor
- very low environmental detail

Background exists to provide atmosphere.

It must NOT compete with UI or vehicle.

---

## Glass panels

Use:

- translucent dark glass
- low-opacity background
- subtle border
- mild blur
- very soft shadow
- slight inner highlight

Avoid:

- large opaque cards
- heavy borders
- excessive glow
- giant gradients

---

# 4. COLOR SYSTEM

### Primary

BUMP.TRADE green:

> neon / emerald green

Used for:

- primary CTA
- selected vehicle
- positive stock
- player highlight
- success

### Secondary

White:

- headings
- important numbers
- navigation

### Danger

Red:

- negative stock
- Bear vehicle
- warnings

### Accent

Blue:

- TSLA Racer
- secondary highlight

### Purple

- NVDA AI

### Gold

- Gold Whale
- first-place / champion

---

# 5. TYPOGRAPHY

Typography should feel:

> bold + condensed + arcade + modern

Hierarchy:

### H1

Large.

Example:

> LEADERBOARD

### H2

Vehicle name.

Example:

> HOOD BULL

### Body

Short descriptions.

### Data

Use compact technical typography for:

- stock
- stats
- numbers

Avoid excessive text.

---

# 6. GLOBAL HEADER

Header should remain consistent across screens.

Desktop structure:

```text id="f44jkm"
┌─────────────────────────────────────────────────────────────┐
│ BUMP.TRADE                    HOOD +2.8% TSLA -1.2% ⚙      │
└─────────────────────────────────────────────────────────────┘
```

Logo can appear:

- top-left on Main Menu
- centered on secondary screens

Market ticker remains compact.

Settings icon:

top-right.

---

# 7. MARKET TICKER

Ticker is visual flavor, not the core feature.

Example:

```text id="10tjhr"
HOOD +2.8%   TSLA -1.2%   NVDA +3.4%
```

Rules:

- small
- compact
- horizontally aligned
- never dominate screen
- no large chart
- no candlestick UI

Market information should feel like:

> environmental game flavor

not:

> trading terminal.

---

# 8. SCREEN 01 — MAIN MENU

## Objective

Immediately communicate:

> This is a bumper-car game.

and:

> I should press PLAY.

---

## Main Menu hierarchy

Order of importance:

1. Hero vehicle
2. PLAY
3. Tagline
4. Leaderboard
5. Market ticker
6. Settings

---

# 9. MAIN MENU LAYOUT

Desktop 16:9:

```text id="tqjkt8"
┌────────────────────────────────────────────────────────────┐
│ BUMP.TRADE                        TICKER          ⚙         │
│                                                            │
│                                                            │
│                 ┌───────────────────┐                     │
│                 │                   │                     │
│                 │     HERO CAR      │                     │
│                 │                   │                     │
│                 └───────────────────┘                     │
│                                                            │
│          BUMP OTHER TRADERS.                               │
│          STEAL THEIR BAG.                                  │
│                                                            │
│                    [  ▶ PLAY  ]                            │
│                                                            │
│                    LEADERBOARD                             │
└────────────────────────────────────────────────────────────┘
```

---

# 10. HERO CAR

HOOD BULL is the default hero car.

Position:

center-right or centered depending on viewport.

Size:

approximately 45–55% of viewport height.

The car should have:

- slow rotation
- subtle suspension animation
- antenna electricity
- headlights
- soft platform lighting
- subtle reflection

Do not constantly animate the camera dramatically.

Movement should be calm.

---

# 11. MAIN MENU TAGLINE

Primary copy:

> BUMP OTHER TRADERS.  
> STEAL THEIR BAG.

The text should be:

- large
- short
- high contrast

Do not add paragraphs.

---

# 12. PLAY BUTTON

Primary CTA.

Large.

Recommended:

> `▶ PLAY`

or:

> `PLAY NOW`

Visual:

- green glass/solid gradient
- subtle glow
- large click target
- clear hover state

Button should be immediately recognizable.

---

# 13. LEADERBOARD BUTTON

Secondary CTA.

Smaller than PLAY.

Example:

> `🏆 LEADERBOARD`

Dark glass.

No glow until hover.

---

# 14. MAIN MENU INTERACTION

Hover PLAY:

- slight scale
- green glow
- subtle sound
- hero car light intensity increases

Hover LEADERBOARD:

- subtle white/green highlight

No excessive animation.

---

# 15. MAIN MENU FLOW

```text id="v7bwm2"
MAIN MENU
   │
   ├── PLAY
   │      ↓
   │   VEHICLE SELECTION
   │
   └── LEADERBOARD
```

No Garage.

No Marketplace.

No Arena selection.

No Wallet.

No Profile dashboard.

---

# 16. SCREEN 02 — VEHICLE SELECTION

## Objective

Allow player to quickly:

> SEE → UNDERSTAND → CHOOSE → PLAY

The screen must feel like a premium racing-game vehicle showroom.

---

# 17. VEHICLE SELECTION PRINCIPLE

The main vehicle must remain the visual hero.

Never allow UI cards to dominate the screen.

Hierarchy:

1. 3D vehicle
2. vehicle name
3. stock identity
4. basic stats
5. vehicle carousel
6. CTA

---

# 18. VEHICLE DISPLAY AREA

Main car occupies approximately:

> 55–65% of the screen.

Use:

- large central platform
- soft spotlight
- subtle reflection
- slow rotation

Background:

blurred/dim garage or arena.

No busy environment.

---

# 19. ONLY 3 VEHICLES VISIBLE

Do NOT show all 5 vehicles simultaneously.

Show:

```text id="j3i4j0"
[ PREVIOUS ]  [ CURRENT ]  [ NEXT ]
```

Example:

```text id="w7m1dn"
HOOD BEAR     HOOD BULL     TSLA RACER
```

Current vehicle:

- largest
- brighter
- green/colored highlight
- centered

Previous/next:

- smaller
- lower opacity
- partially secondary

---

# 20. CAROUSEL BEHAVIOR

Desktop navigation:

Left arrow:

previous vehicle

Right arrow:

next vehicle

Keyboard:

←

→

Gamepad support later.

Mouse:

click side vehicle

Current vehicle smoothly transitions to center.

---

# 21. VEHICLE TRANSITION

When changing vehicle:

1. current vehicle moves slightly out
2. selected vehicle moves toward center
3. camera remains stable
4. material lighting changes
5. stock identity changes
6. stats animate to new values
7. carousel updates

Transition duration:

~300–500ms

Do NOT hard-cut between vehicles.

---

# 22. VEHICLE INFORMATION

Do not use a huge side dashboard.

Information should be integrated around/below the hero vehicle.

Recommended:

```text id="gj7g4b"
HOOD BULL
ALL-ROUNDER

$HOOD  +2.8% ▲

SPEED      ███████░░
IMPACT     ███████░░
HANDLING   ███████░░
STABILITY  ████████░
```

Keep it compact.

---

# 23. STOCK IDENTITY

Each vehicle has stock identity.

Example:

### HOOD BULL

`$HOOD +2.8% ▲`

### HOOD BEAR

`$HOOD -1.7% ▼`

### TSLA RACER

`$TSLA +4.2% ▲`

### NVDA AI

`$NVDA +3.4% ▲`

### GOLD WHALE

`$WHALE +1.1% ▲`

This is primarily thematic identity.

Do not require live stock-market data for the UI prototype.

---

# 24. VEHICLE STATS

Only four core stats.

Recommended:

- Speed
- Impact
- Handling
- Stability

Avoid:

- 8–15 stats
- tiny numerical details
- complicated RPG systems

Stats should be visual bars.

Example:

```text id="8tag4u"
SPEED       ███████░░  7/10
IMPACT      ███████░░  7/10
HANDLING    ███████░░  7/10
STABILITY   ████████░  8/10
```

---

# 25. VEHICLE DESCRIPTION

One short sentence maximum.

Example:

> Balanced, reliable, and ready to hit.

Do not use long paragraphs.

---

# 26. VEHICLE NAME

Large.

Example:

> HOOD BULL

Under it:

> ALL-ROUNDER

Vehicle role should be obvious immediately.

---

# 27. VEHICLE CARDS

Bottom area contains 3 cards.

Example:

```text id="2i7bsw"
[ HOOD BEAR ] [ HOOD BULL ] [ TSLA RACER ]
```

Cards show:

- small 3D render
- name
- role

Do NOT show:

- stats
- price
- long description
- multiple buttons

Current car card is highlighted.

---

# 28. VEHICLE CARD STATES

### Selected

- strongest border
- slight glow
- 100% opacity

### Nearby

- subdued
- 75% opacity

### Off-screen

hidden

This keeps the interface clean.

---

# 29. VEHICLE CTA

Only one primary action.

Recommended:

> `PLAY WITH HOOD BULL →`

When vehicle changes:

> `PLAY WITH HOOD BEAR →`

etc.

This avoids:

> SELECT → another PLAY button

The user immediately understands what happens next.

---

# 30. VEHICLE SCREEN FLOW

```text id="as7h4h"
PLAY
 ↓
VEHICLE SELECTION
 ↓
CHOOSE CAR
 ↓
PLAY WITH [CAR]
 ↓
MATCH / COUNTDOWN
 ↓
GAME
```

No additional confirmation screen is required unless matchmaking later needs one.

---

# 31. SCREEN 03 — LEADERBOARD

## Objective

Show competition and status.

The leaderboard should feel like:

> championship / arcade ranking

not spreadsheet.

---

# 32. LEADERBOARD HIERARCHY

1. Title
2. Podium
3. Top ranking list
4. User highlight

---

# 33. LEADERBOARD HEADER

Centered:

> LEADERBOARD

Subtext:

> TOP TRADERS ON THE ARENA

Keep this very simple.

No giant additional copy.

---

# 34. PODIUM

Podium is centered.

Three positions:

### #1

Largest.

Gold.

### #2

Medium.

Silver/white.

### #3

Medium.

Purple/orange depending on visual identity.

Each podium can display:

- player name
- final bag
- wins
- vehicle

---

# 35. PODIUM LAYOUT

```text id="g4j7b1"
                #1
          ┌─────────────┐
          │     CAR     │
          └─────────────┘
          DIAMOND_HANDS
              $12,450
              132 WINS

     #2                         #3
     CAR                        CAR
   PLAYER                      PLAYER
   $10,230                      $8,960
```

Main visual focus should be #1.

---

# 36. LEADERBOARD TABLE

Below podium.

Columns:

- #
- Player
- Final Bag
- Wins

Example:

```text id="0s84iw"
#    PLAYER           FINAL BAG      WINS
1    Diamond_Hands    $12,450         132
2    Hood_Trader      $10,230         118
3    Tesla_DeGen       $8,960         104
4    Nvda_Max          $7,420          98
5    Whale_Hunter      $6,880          86
6    Gme_Legend        $6,430          72
...
12   You               $2,350          24
```

---

# 37. USER HIGHLIGHT

The user's row must always be easy to find.

Use:

- green border
- subtle green background
- brighter text

Example:

```text id="f2m6y0"
12    YOU                  $2,350      24
```

---

# 38. LEADERBOARD DATA ACCESS

When user is ranked far down the list:

Do not force them to scroll through every player.

Show:

> Top players + user's current position

Example:

```text id="ps0soi"
1
2
3
...
10
...
127  YOU
```

This is more useful than displaying hundreds of rows.

---

# 39. FILTERS

Keep only three lightweight tabs:

> ALL TIME | THIS WEEK | FRIENDS

They should sit near the title or table header.

Do not create a large filter sidebar.

---

# 40. LEADERBOARD BACKGROUND

Background:

- dark
- blurred
- very low detail
- slight arena lighting

Podium is the visual focus.

No large animated billboards behind the podium.

---

# 41. LEADERBOARD CAR VISUALS

Top 3 cars should use their actual selected vehicle models.

Example:

#1 player uses Gold Whale

→ show Gold Whale

#2 player uses Hood Bear

→ show Hood Bear

#3 player uses NVDA AI

→ show NVDA AI

This reinforces the vehicle ecosystem.

---

# 42. GLOBAL GLASS UI RULES

Use translucent glass only where needed.

Good:

- buttons
- stat panels
- carousel cards
- leaderboard table
- ticker

Avoid glassifying everything.

The background should remain visible through larger regions.

---

# 43. UI OPACITY

Suggested direction:

background glass:

low opacity

secondary panels:

medium-low

primary CTA:

high contrast

Avoid making every panel equally opaque.

---

# 44. BORDER STYLE

Use:

- 1px subtle border
- slight glow only on active state

Selected:

green

Danger:

red

Gold:

champion

Neutral:

white/gray

---

# 45. BUTTON STYLE

Primary:

solid/glowing green

Secondary:

dark glass

Hover:

small scale + glow

Pressed:

slight scale-down

No giant animated gradients.

---

# 46. ANIMATION PRINCIPLES

Animations should feel:

> premium + responsive

Not:

> flashy + distracting

Use:

- 200–500ms transitions
- smooth easing
- small scale changes
- opacity fades
- subtle glow

Avoid:

- bounce everywhere
- excessive particles
- screen transitions that take too long

---

# 47. MAIN MENU ANIMATION

Hero car:

slow idle movement

Antenna:

electric flicker

Headlights:

subtle pulse

Platform:

very slow rotation/light sweep

PLAY:

subtle idle glow

---

# 48. VEHICLE SELECTION ANIMATION

When switching:

- camera stays stable
- cars slide/rotate
- stat bars animate
- stock chip updates
- card selection moves

The animation should make vehicle selection feel physical.

---

# 49. LEADERBOARD ANIMATION

On screen entry:

podium fades/slides in

Top player:

slight spotlight

Table:

small staggered fade

User row:

subtle highlight pulse

Do not animate table rows continuously.

---

# 50. RESPONSIVE DESKTOP

At:

1920×1080

Use full composition.

At:

1440×900

reduce spacing.

At:

1280×720

reduce:

- hero car size
- vertical padding
- typography
- card height

Never hide:

PLAY

main car

vehicle name

primary CTA

leaderboard user position

---

# 51. UI COMPONENT STRUCTURE

Recommended conceptual components:

```text id="j4u9y1"
MainMenu
├── Header
│   ├── Logo
│   ├── MarketTicker
│   └── SettingsButton
│
├── HeroVehicle
├── Tagline
├── PlayButton
└── LeaderboardButton
```

Vehicle Selection:

```text id="h5z8v4"
VehicleSelection
├── Header
├── BackButton
├── HeroVehicleViewer
├── VehicleInfo
├── StockIdentity
├── VehicleStats
├── VehicleCarousel
└── PlayVehicleButton
```

Leaderboard:

```text id="7v9k0q"
Leaderboard
├── Header
├── BackButton
├── Title
├── FilterTabs
├── Podium
├── RankingTable
└── CurrentPlayerHighlight
```

---

# 52. 3D VEHICLE VIEWER

Vehicle selection should use the actual GLB asset.

Viewer should support:

- slow automatic rotation
- mouse drag rotation
- arrow navigation
- subtle camera zoom

Do not rotate the entire UI.

Only the 3D vehicle.

---

# 53. VEHICLE LIGHTING

Use a showroom lighting setup.

Three primary components:

### Key

soft white

### Rim

vehicle-specific color

### Environment

dark blue/gray

Do not rely on the arena environment.

Vehicle selection should look good even with minimal background.

---

# 54. STOCK CARD

Stock indicator should remain small.

Example:

```text id="6rb4kn"
$HOOD
+2.8% ▲
```

This can sit beside the vehicle name.

Do not make it a giant chart.

---

# 55. UX PRIORITY

The user journey must feel:

### Main Menu

> “I want to play.”

### Vehicle Selection

> “I want this car.”

### Leaderboard

> “I want to beat these players.”

Every screen should support one emotional objective.

---

# 56. NAVIGATION

Main Menu:

PLAY

LEADERBOARD

Vehicle Selection:

BACK

PLAY WITH [CAR]

Leaderboard:

BACK

No nested navigation.

---

# 57. ACCESSIBILITY

Maintain:

- high text contrast
- clear button states
- distinguishable stock colors
- readable stat bars
- keyboard navigation
- hover and focus states

Do not rely only on green/red to communicate state.

Use:

- arrows
- icons
- text

as additional indicators.

---

# 58. PERFORMANCE

UI should not impact 3D performance.

Avoid:

- large background videos
- dozens of animated DOM elements
- heavy blur layers
- excessive CSS filters

The main vehicle should remain smooth at:

> 60 FPS target

---

# 59. DESKTOP EXPERIENCE RULE

Desktop has a lot of horizontal space.

Use that space for:

> vehicle presentation

not:

> more UI.

This is why Vehicle Selection uses only three visible vehicle choices.

---

# 60. FINAL UI FLOW

```text id="6og1rp"
                 MAIN MENU
                    │
          ┌─────────┴─────────┐
          │                   │
        PLAY            LEADERBOARD
          │                   │
          ▼                   ▼
  VEHICLE SELECTION          RANKING
          │                   │
          ▼                   │
   PLAY WITH [CAR]            │
          │                   │
          ▼                   │
      MATCH FOUND             │
          │                   │
          ▼                   │
       GAMEPLAY               │
                              │
          └───────────────────┘
```

---

# 61. MVP UI SCOPE

Only implement:

### Main Menu

- PLAY
- LEADERBOARD
- Settings icon
- market ticker
- hero car
- tagline

### Vehicle Selection

- 3D vehicle viewer
- 3 visible cars
- arrows
- vehicle identity
- stock chip
- 4 stats
- carousel
- play button

### Leaderboard

- title
- 3 filters
- podium
- ranking table
- current-player highlight
- back button

Nothing else.

---

# 62. DO NOT IMPLEMENT

Do NOT add:

- Garage
- Inventory
- Store
- Shop
- Skins menu
- Wallet
- Token dashboard
- Trading chart
- Mission system
- Battle pass
- Daily rewards
- Friends page
- Detailed profile page
- Arena selector
- Game mode selector

Those features can be added later if the product requires them.

---

# 63. FINAL UX PRINCIPLE

The desktop experience should feel like:

> **Open → See the car → PLAY**

then:

> **Choose the car → PLAY**

then:

> **Fight → WIN → return**

The interface should never feel like the player came to operate a financial application.

It should feel like:

> **an arcade game wearing a stock-market skin.**

---

## FINAL VISUAL REFERENCE

Use the latest approved desktop visual as the visual source of truth:

**Main Menu**
→ hero HOOD BULL + PLAY + LEADERBOARD

**Vehicle Selection**
→ central vehicle + 3-car carousel + compact stock/stats + `PLAY WITH [CAR]`

**Leaderboard**
→ centered podium + ranking table underneath + highlighted user

The latest desktop composition should be treated as the **UI layout reference**, while exact dimensions, spacing, and typography can be refined during implementation.
