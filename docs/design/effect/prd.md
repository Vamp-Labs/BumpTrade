
# BUMP.TRADE — Gameplay & Satisfying Combat PRD

## 1. Objective

Revamp the gameplay loop so every match feels:

- Fast
- Satisfying
- Risky
- Competitive
- Easy to understand
- Visually rewarding

The core fantasy is:

> **BUMP OTHER TRADERS → STEAL THEIR BAG → SURVIVE → FINISH WITH THE BIGGEST BAG**

Do not solve the problem by adding excessive UI or constant visual effects.

Effects must reinforce gameplay events and player decisions.

---

# 2. Core Gameplay Loop

The intended gameplay loop:

```text
START MATCH
    ↓
MOVE / SEARCH FOR TARGET
    ↓
BUMP ANOTHER PLAYER
    ↓
IMPACT
    ↓
TARGET DROPS MONEY
    ↓
MONEY BECOMES PHYSICAL PICKUPS
    ↓
PLAYER COLLECTS MONEY
    ↓
PLAYER BECOMES MORE VALUABLE TARGET
    ↓
MARKET EVENT / POWER ITEM
    ↓
HIGHER RISK / HIGHER REWARD
    ↓
FINAL 30 SECOND CHAOS
    ↓
MARKET CLOSED
    ↓
RESULT
```

The player should constantly have a reason to:

- Move
- Chase
- Escape
- Bump
- Collect
- Defend
- Take risks

---

# 3. Bump Impact System

The collision between two cars is the most important gameplay feedback.

A successful bump must feel significantly more satisfying than a normal collision.

## Impact sequence

### 0–150ms

Immediately on impact:

- Short camera shake
- Bright collision flash
- Sparks
- Directional impact particles
- Short heavy impact sound
- Cars visibly recoil

Do not make the camera shake excessive.

It should communicate:

> "I HIT SOMETHING."

### 150–500ms

Target loses money.

Example:

```text
BUMP!
-$24
```

Money should physically burst from the target car.

Use:

- Small cash bills
- Cash icons
- Green particles
- Short directional velocity

The money should initially travel outward from the collision point.

### 500–1000ms

Dropped money remains physically collectible.

When the player collects it:

```text
+$24
```

The money should visually travel toward the player's car or HUD.

The player's bag value updates immediately.

---

# 4. Money Drop System

Money should NOT simply teleport between players.

It needs to exist temporarily in the arena.

Example:

```text
PLAYER A
$185

        BUMP

PLAYER B
$320
      ↓
$24 $18 $12
  ↓
PHYSICAL DROPS
  ↓
PLAYER COLLECTS
  ↓
+$54
```

This creates a secondary objective after every successful bump.

Players can:

- Steal money
- Chase dropped money
- Protect their own money
- Intercept another player's dropped money

This should create emergent gameplay.

---

# 5. Bump Combo System

Introduce a temporary combo mechanic.

## Combo timing

A new successful bump must happen within approximately 5 seconds to continue the combo.

Example:

```text
BUMP
↓
DOUBLE BUMP
↓
TRIPLE BUMP
```

Possible rewards:

### 1st bump

Normal reward.

### 2nd consecutive bump

```text
DOUBLE BUMP
STEAL x2
```

### 3rd consecutive bump

```text
TRIPLE BUMP
STEAL x3
```

After the combo expires:

```text
COMBO LOST
```

Do not make the combo UI permanent.

Only show it during the event.

---

# 6. Rich Player / Bounty System

The player with a large bag should become a natural target.

Bag thresholds can create visual states.

Example:

```text
$0–100
NORMAL

$100–250
HOT

$250–500
BIG BAG

$500+
BOUNTY
```

The exact values should be configurable.

A high-value player gets subtle visual emphasis:

- Small aura
- Stronger money glow
- Optional bounty indicator
- Slightly more noticeable world marker

Do not create a large permanent HUD element.

The purpose is to communicate:

> "That player is worth attacking."

---

# 7. Market Event System

Approximately every 45–60 seconds, trigger a major Market Event.

The event must be telegraphed before it starts.

Example:

```text
3
2
1

MARKET EVENT
