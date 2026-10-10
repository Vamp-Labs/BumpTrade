Berikut PRD untuk **HUD + gameplay event layer** yang mengikuti visual terakhir, tapi dibuat lebih satisfying, readable, dan punya momen chaos yang terasa seperti game arcade.

# PRD — BUMP.TRADE Gameplay HUD & Dynamic Event System

## 1. Objective

Membuat gameplay terasa **fast, chaotic, rewarding, dan fun** tanpa membuat arena atau HUD terlalu ramai.

Core feeling:

> **Drive → Bump → Steal → Survive → React → Repeat**

HUD harus selalu membantu pemain memahami:
- Berapa uang/bag saya?
- Posisi saya?
- HP kendaraan?
- Boost?
- Apa yang baru terjadi?
- Apakah ada event spesial?
- Kapan saya harus mengambil risiko?

---

# 2. HUD Layout

Gunakan layout desktop yang sudah disepakati.

### TOP LEFT — Player Bag

Menampilkan:

```text
YOUR BAG
$185     +$24
$HOOD +2.8% ▲
```

Fungsi:
- Current money/bag
- Recent gain/loss
- Stock yang sedang digunakan
- Perubahan stock

### TOP CENTER — Round Timer

```text
ROUND
01:24
```

Tidak perlu informasi tambahan di sini.

Timer harus menjadi visual anchor utama.

### TOP RIGHT — Position

```text
🏆 #3 / 8
```

Di bawahnya leaderboard mini.

Hanya tampilkan 4–5 pemain teratas + player.

Jangan terlalu besar.

---

# 3. Bottom Center — Vehicle Status

Revamp dari versi sebelumnya.

Jangan menggunakan card besar yang terasa seperti panel inventory.

Gunakan **compact HUD bar**:

```text
        🛡 HP
████████████░░ 76%

        ⚡ BOOST
██████████░░░░ 62%
```

Position:

**Bottom center**

Lebar sekitar 35–45% screen.

Style:
- Glass / translucent dark
- Thin cyan border
- Minimal glow
- Rounded corners
- Tidak menutupi kendaraan
- Tidak terlalu tinggi

HP dan Boost harus terlihat seperti satu unified vehicle status system.

---

# 4. Player Vehicle Indicator

Di atas mobil player:

```text
YOU
$185
▼
```

Indicator mengikuti kendaraan secara smooth.

Saat uang berubah:

```text
+$24
```

muncul sebentar di dekat indicator.

### Gain

```text
+$24
```

Animasi:
- scale up
- sedikit float
- fade out

### Loss

```text
-$18
```

Animasi:
- shake
- red flash
- float downward

---

# 5. BUMP FEEDBACK

Bump harus menjadi salah satu feedback paling satisfying dalam game.

Ketika player menabrak kendaraan:

### Impact

Immediately:

```text
BUMP!
-$24
```

Jangan menggunakan giant comic overlay yang menutupi gameplay.

Instead:

**World-space feedback**

- short camera shake
- impact sparks
- directional hit flash
- money particles
- small floating `-$24`
- target vehicle sedikit terdorong
- player vehicle juga recoil

### Audio

Layer:

1. metal impact
2. bass hit
3. short coin/cash sound
4. optional stock tick sound

Semua sangat pendek.

---

# 6. Money Drop System

Ketika kendaraan terkena bump:

```text
💵 💵 💵
```

Cash drops ke arena.

Cash harus mempunyai physical interaction sederhana.

Player bisa:

- bump
- collect
- steal
- chase

Cash pickup:

```text
+$18
```

Animasi:

**cash → player → absorb → counter increase**

Jangan langsung teleport tanpa visual feedback.

---

# 7. Dynamic Event System

Ini bagian utama untuk membuat match tidak terasa flat.

Setelah **60 seconds**, game memasuki:

## MARKET EVENT PHASE

Timer:

```text
MARKET EVENT
```

kemudian random event dipilih.

Event tidak selalu sama.

Contoh:

### Event A — CASH RAIN

Arena menghasilkan banyak cash.

```text
💵 CASH RAIN
```

Cash spawn selama ±8–10 detik.

Effect:
- cash falling/spawning
- arena lighting berubah
- players berebut area

Tujuan:

**high risk / high reward**

---

# 8. Super Boost Event

Random super effect drop setelah ±60 detik.

Spawn sebagai collectible besar.

Contoh:

```text
⚡ MARKET SURGE
```

Object berada di arena.

Player harus mengejar dan mengambilnya.

Ketika collected:

```text
MARKET SURGE
+30% BOOST
```

atau:

```text
MARKET SURGE
IMPACT ×2
```

atau:

```text
MARKET SURGE
STEAL ×1.5
```

Effect berlangsung beberapa detik.

### Important

Jangan membuat power-up terlalu kompleks.

Target hanya **3–4 power-up**.

---

# 9. Recommended Power-ups

## 1. TURBO

Effect:

```text
+40% SPEED
```

Duration:

6–8 sec.

Visual:
- cyan/blue trail
- stronger wheel glow

---

## 2. HEAVY HIT

Effect:

```text
IMPACT ×2
```

Duration:

8 sec.

Visual:
- orange/gold impact aura
- larger collision sparks

Ini mendorong pemain mencari target.

---

## 3. CASH MAGNET

Effect:

```text
CASH RANGE ×3
```

Duration:

8 sec.

Cash di sekitar player tertarik ke kendaraan.

Visual:

cash particles → vehicle.

Sangat satisfying.

---

## 4. SHIELD

Effect:

```text
NO CASH LOSS
```

Duration:

5 sec.

Visual:
- transparent energy shield
- impact creates visible ripple

Ini memberikan defensive decision.

---

# 10. Arena Fire Event

Ide **api keluar dari arena setiap ±20 detik** bagus sebagai decoration.

Tapi jangan membuatnya selalu identik.

Gunakan sebagai **arena pulse**.

Contoh:

```text
every ~20 sec
```

Arena melakukan:

**PHASE 1**

Lights dim sedikit.

**PHASE 2**

Warning lights.

**PHASE 3**

Fire bursts keluar dari beberapa sisi arena.

**PHASE 4**

Arena kembali normal.

Total:

~2–3 sec.

### Important

Api bukan damage.

Ini hanya:

> **spectacle / atmosphere**

Tujuannya membuat arena terasa hidup.

---

# 11. Random Arena Events

Saya rekomendasikan menambah beberapa event ringan.

Tidak semuanya harus gameplay-impacting.

### EVENT 1 — FIRE BURST

Decorative.

Arena side walls mengeluarkan api.

---

### EVENT 2 — MARKET FLASH

Semua billboard stock berubah cepat.

```text
$HOOD ▲
$TSLA ▼
$NVDA ▲
```

Duration:

2 sec.

---

### EVENT 3 — CASH PULSE

Arena mengeluarkan burst cash.

Players harus berebut.

---

### EVENT 4 — BLACKOUT

Arena lighting mati selama ~1 sec.

Kemudian:

**BOOM**

semua neon menyala kembali.

Tidak mengganggu control.

---

### EVENT 5 — MARKET CRASH

Stock ticker tiba-tiba berubah:

```text
HOOD -3.8%
```

kemudian arena lighting menjadi red.

Tidak harus memberikan damage.

Ini lebih ke psychological pressure.

---

# 12. Event Frequency

Jangan membuat event terlalu sering.

Target:

```text
0–60 sec
Normal gameplay

60 sec
First major event

60–80 sec
Minor arena events

80–100 sec
Power-up / cash event

100+ sec
Higher event frequency
```

Semakin lama match berjalan:

**semakin chaotic.**

Ini menciptakan natural tension curve.

---

# 13. Final 20 Seconds

Ini harus menjadi **peak moment**.

Ketika timer:

```text
00:20
```

HUD berubah sedikit.

```text
FINAL 20
```

Arena:

- lights intensify
- fire bursts lebih sering
- cash drops sedikit meningkat
- power-up chance meningkat
- music intensity naik
- camera effects sedikit lebih aggressive

Tetapi **jangan membuat UI memenuhi layar.**

---

# 14. Final 10 Seconds

Timer:

```text
00:10
```

Mulai pulse.

```text
10
9
8
7
...
```

HUD tetap minimal.

Arena menjadi lebih intense.

Player harus merasa:

> **"Gue masih bisa menang."**

---

# 15. Match End

Saat:

```text
00:00
```

Semua gameplay berhenti.

Short freeze:

**0.3–0.5 sec**

Kemudian transition ke result.

Jangan langsung menampilkan full result UI.

Gunakan:

```text
ROUND COMPLETE
```

kemudian result screen.

---

# 16. UX Principle

Prioritas informasi:

### Always visible

1. Bag
2. Timer
3. Position
4. HP
5. Boost

### Contextual

6. Bump feedback
7. Money gain/loss
8. Power-up
9. Event notification

### Never persistent

- Large notification cards
- Radar/minimap
- Huge BUMP text
- Excessive stock information
- Decorative UI legends

---

# 17. Visual Direction

Overall:

**Glass + Neon + Arcade Financial Market**

Tetapi:

> **3D arena = hero**  
> **HUD = support**

HUD harus terasa seperti bagian dari game, bukan dashboard trading.

Gunakan:
- translucent black
- cyan
- green
- yellow/gold
- red only for danger/loss
- thin borders
- subtle glow

Avoid:
- giant opaque cards
- excessive gradients
- excessive icons
- multiple competing panels
- constant animations

---

# 18. Core Gameplay Loop

Final loop:

```text
DRIVE
 ↓
CHASE
 ↓
BUMP
 ↓
STEAL CASH
 ↓
COLLECT CASH
 ↓
AVOID OPPONENTS
 ↓
RANDOM EVENT
 ↓
POWER-UP
 ↓
CHAOS
 ↓
FINAL 20 SEC
 ↓
SURVIVE
 ↓
RESULT
```

### Target feeling

**Every 10–20 seconds something interesting should happen, but the player should never feel that the UI is interrupting the game.**

The arena, cars, cash, particles, sound, and camera should provide most of the excitement; **HUD only communicates what matters.**
