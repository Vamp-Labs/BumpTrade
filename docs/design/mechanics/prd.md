# BUMP.TRADE — Balance, Damage & Elimination System

## 1. Core Rule

Setiap mobil memiliki **satu nyawa**, yang direpresentasikan oleh balance pemain.

Tidak ada:

- Respawn
- Second life
- Re-entry
- Revive
- HP regeneration setelah mati

Selama balance pemain masih > 0:

> Mobil masih hidup dan pemain masih bisa bermain.

Ketika balance mencapai 0:

> Pemain eliminated.

Mobil kemudian rusak/hancur secara visual dan tidak dapat dimainkan lagi.

---

# 2. Balance = Life

Balance adalah resource utama pemain.

Contoh:

```text
PLAYER
Balance: $185
```

Balance bukan hanya skor.

Balance adalah:

> **Money + Life + Target Value**

Semakin besar balance:

- Player semakin kaya
- Player semakin bernilai
- Player semakin menarik untuk diserang
- Player memiliki lebih banyak yang bisa hilang

---

# 3. Bump Economy

Pemain **tidak mendapatkan uang dari waktu, pickup random, atau passive income**.

Money hanya diperoleh dengan:

> **menabrak / merusak lawan dan mengambil sebagian balance mereka.**

Core transaction:

```text
PLAYER A
$185

      BUMP

PLAYER B
$320

      ↓

A steals $24 from B

      ↓

PLAYER A
$209

PLAYER B
$296
```

Jumlah yang dicuri harus berasal langsung dari target.

Tidak boleh menciptakan uang baru dari sistem.

---

# 4. Damage = Money Transfer

Collision memiliki dua konsekuensi:

### Attacker

Mendapat balance.

### Target

Kehilangan balance.

Formula dasar:

```text
stealAmount = damageValue
```

Kemudian:

```text
attacker.balance += stealAmount
target.balance -= stealAmount
```

Pastikan:

```text
target.balance >= 0
```

Tidak boleh menjadi negative balance.

---

# 5. Collision Damage

Tidak semua tabrakan harus memberikan jumlah yang sama.

Damage/steal dapat dipengaruhi oleh:

- Relative velocity
- Impact angle
- Attacker vehicle stats
- Target vehicle stats
- Boost state
- Combo multiplier
- Special event

Contoh sederhana:

```text
Base Impact = $10

High Speed Impact
= $18

Heavy Impact
= $25

Bull Rush Impact
= $35
```

Namun angka harus configurable.

---

# 6. No Passive Money

Jangan implementasikan:

```text
+ $1 every second
```

atau:

```text
money pickup from arena
```

sebagai sumber balance utama.

Arena cash pickup hanya boleh digunakan jika secara desain memang merupakan **money stolen from another player**.

Contoh:

Player B terkena bump:

```text
B loses $24
```

Kemudian $24 dapat:

- langsung diberikan ke attacker, atau
- menjadi physical cash drop yang harus dikumpulkan attacker.

Recommended:

> Gunakan physical cash drop untuk impact besar agar gameplay lebih satisfying.

---

# 7. Physical Money Drop

Ketika target terkena damage:

```text
TARGET
$320

      💥 BUMP

$24 leaves target
```

Kemudian:

```text
$24
$8
$6
$10
```

tersebar di sekitar impact location.

Total seluruh drop:

```text
$24
```

Bukan $48.

Tidak boleh terjadi money duplication.

---

# 8. Money Collection

Attacker harus mengumpulkan money yang dijatuhkan.

Ketika pickup:

```text
+$24
```

Balance attacker bertambah.

Target balance sudah berkurang pada saat damage terjadi.

Example:

```text
Before:

YOU       $185
TESLA     $320

BUMP

TESLA loses $24

YOU       $185
TESLA     $296

Money appears in arena

YOU collects

YOU       $209
TESLA     $296
```

Total money tetap:

```text
$505
```

Tidak ada inflation.

---

# 9. Elimination Condition

Player eliminated ketika:

```text
balance <= 0
```

Tidak ada minimum HP threshold terpisah.

Example:

```text
YOU
$12

      💥

-$12

YOU
$0
```

Immediately trigger elimination.

---

# 10. Elimination Sequence

Ketika balance mencapai 0:

### Phase 1 — Critical

```text
$0
```

HUD briefly flashes.

Vehicle receives critical damage effect.

### Phase 2 — Destruction

Approximately 0.5–1 second:

- Sparks
- Smoke
- Vehicle damage
- Lights flicker
- Strong impact VFX
- Short camera shake

### Phase 3 — Vehicle destroyed

Vehicle stops functioning.

Example:

```text
CAR DESTROYED
ELIMINATED
```

### Phase 4 — Spectator

Player can no longer control the vehicle.

Camera switches to spectator mode.

---

# 11. No Respawn

This is a strict rule.

Once:

```text
balance = 0
```

the player cannot return to gameplay.

Do NOT:

- Spawn another vehicle
- Reset balance
- Respawn at another location
- Restore HP
- Give a second life

The elimination must feel meaningful.

---

# 12. Spectator Mode

After elimination, the player remains inside the match as a spectator.

Recommended behavior:

### Camera

Follow surviving players.

Player can cycle between:

```text
← Previous Player
→ Next Player
```

or automatically follow the strongest/highest-balance player.

### HUD

Keep minimal information:

```text
ELIMINATED

You finished #6 / 8

Watching:
Tesla_DeGen
$284
```

Do not show full gameplay controls.

---

# 13. Spectator Purpose

Spectating should allow the player to:

- Watch the rest of the match
- Understand how other players play
- See who wins
- Experience the final moments

This avoids the feeling:

> "I died, now the game is completely over."

Instead:

> "I lost, but I can watch the market collapse."

---

# 14. Balance as Risk

The system creates an important strategic decision.

High balance:

```text
+$500
```

means:

- You are winning
- But you are the biggest target

Low balance:

```text
$40
```

means:

- You are close to elimination
- But there is less value to steal from you

Therefore:

> Being #1 is powerful but dangerous.

This should be reflected visually.

---

# 15. Rich Player Targeting

Players with large balances should have subtle world indicators.

Example:

```text
DIAMOND_HANDS
$520
👑
```

But avoid permanent large UI.

The world should communicate:

> "That player has a lot of money."

Possible effects:

- Slight glow
- Crown marker for #1
- Stronger bag indicator
- Subtle money particles

---

# 16. Critical Balance State

When player balance becomes very low:

```text
$25
```

enter:

```text
CRITICAL BAG
```

Visual feedback:

- Subtle red pulse
- Vehicle warning light
- HUD emphasis

Do not make it annoying.

Purpose:

> Player immediately understands they are one bad collision away from elimination.

---

# 17. Zero Balance State

At exactly:

```text
$0
```

trigger:

```text
LIQUIDATED
```

Suggested presentation:

```text
LIQUIDATED

YOUR BAG HIT $0

#6 / 8
```

Vehicle destruction follows immediately.

---

# 18. Combat Philosophy

The game should never feel like a traditional racing game where:

```text
Car HP
↓
Health potion
↓
Respawn
↓
Continue
```

Instead:

```text
Your money
     =
Your life
     =
Your target
```

Every collision changes the economic state of the match.

---

# 19. Example Match

### Start

```text
YOU       $100
HOOD      $100
TESLA     $100
NVDA      $100
```

### You hit Tesla

```text
YOU       +$18 → $118
TESLA     -$18 → $82
```

### Tesla hits you

```text
YOU       -$12 → $106
TESLA     +$12 → $94
```

### You chain another bump

```text
YOU       +$25 → $131
TESLA     -$25 → $69
```

### Tesla gets attacked by another player

```text
TESLA
$69 → $42
```

### Tesla gets hit again

```text
$42 → $0
```

Tesla:

```text
💥 DESTROYED

ELIMINATED
```

Tesla cannot respawn.

---

# 20. Match Economy Rule

The system must maintain:

```text
Total player balances
=
constant
```

unless there is an explicitly designed economy event.

For normal gameplay:

```text
Attacker +$X
Target    -$X
```

Therefore the game is fundamentally a **zero-sum PvP economy**.

This is important because the winner should not simply be whoever generates the most money.

The winner should be the player who:

> **successfully takes money from everyone else while protecting their own balance.**

---

# 21. Interaction With Market Events

Market Events must respect the same economy.

For example:

### BULL RUSH

Does not create free money.

Instead:

```text
Impact × 1.5
```

So the player can steal more money from opponents through successful collisions.

### CASH RAIN

If implemented, money should come from an existing player's dropped balance or a clearly defined finite event pool.

Do not accidentally create infinite money.

---

# 22. Interaction With Combo

Combo increases the amount transferred from the target.

Example:

```text
Normal Bump
$10

Double Bump
$15

Triple Bump
$20
```

But every extra dollar must still come from the target.

Never allow:

```text
Target $10
Attacker gets $20
Target becomes $0
```

unless the system explicitly caps and resolves the transaction.

Recommended:

```text
stealAmount = min(calculatedDamage, target.balance)
```

---

# 23. Vehicle Destruction

The vehicle should visually communicate its remaining life through its balance state.

### Healthy

Normal vehicle.

### Low balance

Subtle warning:

- Flickering lights
- Small smoke
- Warning particles

### Critical

More visible damage.

### $0

Full destruction:

- Sparks
- Smoke
- Fire
- Vehicle shutdown
- Lights turn off
- Spectator camera

This makes the player's economic state physically visible through the vehicle.

---

# 24. Three.js State Model

Recommended player state:

```ts
interface PlayerState {
  id: string;
  balance: number;
  isAlive: boolean;
  isEliminated: boolean;
  comboCount: number;
  comboExpiresAt: number;
  vehicleId: string;
}
```

Core rule:

```ts
if (player.balance <= 0) {
  eliminatePlayer(player);
}
```

Elimination should be a one-way state transition:

```text
ALIVE
  ↓
CRITICAL
  ↓
ELIMINATED
  ↓
SPECTATING
```

Never:

```text
ELIMINATED → ALIVE
```

during the same match.

---

# 25. Definition of Done

The system is complete when:

- There is no respawn.
- Each vehicle has one life.
- Balance represents that life.
- Players only gain money by damaging/bumping opponents.
- Damage directly removes money from the target.
- Money can visually drop into the arena.
- The attacker can collect the dropped money.
- Total normal match economy remains zero-sum.
- A player reaching $0 is immediately eliminated.
- The destroyed vehicle cannot be controlled again.
- Eliminated players enter spectator mode.
- Low balance creates tension.
- High balance creates a valuable target.
- The final surviving players naturally become increasingly aggressive.
- The winner is the player with the highest remaining balance when the market closes.

## Core Design Statement

> **Your car isn't your life bar. Your BAG is your life.**

> **Hit players to take their money. Protect your own. Reach $0 and you're out.**

> **No respawns. No free money. Every dollar has to come from another trader.**
