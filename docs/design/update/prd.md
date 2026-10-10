# BUMP.TRADE — Crash & Satisfaction Gameplay PRD

## 1. Core Concept

BUMP.TRADE adalah multiplayer bumper-car PvP dengan satu ekonomi utama:

> **Crash another player → steal their money.**

Tidak ada:
- passive income
- cash rain
- random money spawn
- money pickup
- free reward

Semua uang yang didapat player **harus berasal dari balance player lain**.

```text
PLAYER A
$284

      💥 CRASH

PLAYER B
$420 → $380

PLAYER A
$284 → $324
```

Economy harus selalu **zero-sum**.

---

# 2. Core Gameplay Loop

```text
DRIVE
  ↓
READ OPPONENT
  ↓
POSITION
  ↓
CRASH
  ↓
STEAL MONEY
  ↓
ESCAPE / CHASE
  ↓
COMBO
  ↓
BECOME BIG BAG
  ↓
GET HUNTED
  ↓
LIQUIDATE OPPONENT
```

Target utama adalah membuat setiap crash terasa seperti **high-impact moment**.

---

# 3. Impact System

Setiap collision menghasilkan impact berdasarkan:

- relative velocity
- collision angle
- vehicle impact stat
- target stability
- boost state
- momentum
- combo multiplier

### Impact tiers

```text
LIGHT HIT
Small impact
Small knockback
Small cash transfer

HEAVY HIT
Strong impact
Strong knockback
Higher cash transfer

PERFECT BUMP
Optimal angle + high velocity
Large knockback
High cash transfer

CRITICAL HIT
Very high impact
Extreme knockback
Large cash transfer
Strong VFX
```

Tidak semua collision harus memberikan reward besar.

Player harus **menguasai cara melakukan crash**.

---

# 4. Perfect Angle

Collision angle menjadi salah satu skill utama.

```text
BAD ANGLE
+$6

GOOD ANGLE
+$15

PERFECT ANGLE
+$35
```

### PERFECT BUMP

Condition:

- high relative velocity
- optimal impact angle
- target exposed
- tidak sedang dalam cooldown collision

Feedback:

- impact flash
- large sparks
- shockwave
- strong camera shake
- short hit-stop
- floating `$35`
- `PERFECT BUMP!`

---

# 5. High Speed Impact

Semakin tinggi velocity saat impact, semakin besar potensi damage.

Contoh:

```text
LOW SPEED
×1.0

HIGH SPEED
×1.25

MAX VELOCITY
×1.5
```

Namun high speed juga membuat:

- steering lebih sulit
- stopping distance lebih panjang
- miss lebih berbahaya

Jadi speed menjadi **risk/reward**, bukan sekadar buff.

---

# 6. Double Impact

Condition tertentu dapat menghasilkan:

**DOUBLE IMPACT**

Contoh:

```text
Normal Damage
$20

DOUBLE IMPACT
$40
```

Target:

```text
$200 → $160
```

Attacker:

```text
$100 → $140
```

Tidak ada uang tambahan dari sistem.

---

# 7. Counter Crash

Jika dua player bergerak saling berlawanan dengan velocity tinggi:

```text
YOU  →  ←  ENEMY

       💥

      COUNTER
```

Condition:

- high relative velocity
- frontal collision
- timing tepat

Reward:

- increased impact
- increased knockback
- higher cash transfer
- stronger VFX

UI:

`COUNTER CRASH!`

Ini menjadi salah satu signature moment BUMP.TRADE.

---

# 8. Bump Combo

Successful crash berturut-turut dalam waktu tertentu membentuk combo.

```text
BUMP
↓
DOUBLE BUMP
↓
TRIPLE BUMP
↓
MEGA COMBO
```

Contoh multiplier:

```text
BUMP        ×1.0
DOUBLE      ×1.25
TRIPLE      ×1.5
MEGA        ×2.0
```

Combo hanya meningkatkan **damage/cash transfer dari target**.

Tidak menciptakan uang baru.

Combo reset jika:

- terlalu lama tidak melakukan successful hit
- player terkena major impact
- player kehilangan momentum
- player keluar dari combat terlalu lama

---

# 9. Chain Crash

Player dapat membuat chain reaction.

```text
YOU
 ↓
💥 B
 ↓
💥 C
```

Jika collision pertama membuat B menabrak C:

`CHAIN BUMP`

Reward berasal dari balance B dan C masing-masing.

Tidak boleh ada duplicated reward.

---

# 10. Bank Shot

Arena wall menjadi bagian dari gameplay.

```text
YOU
 ↓
WALL
 ↘
   ENEMY
```

Condition:

- player melakukan wall bounce
- kemudian mengenai opponent dalam short timing window

Result:

`BANK SHOT`

Effect:

- increased damage
- stronger knockback
- unique VFX
- unique sound

Bank Shot harus terasa seperti **skill shot**.

---

# 11. Wall Slam

Berbeda dengan Bank Shot.

Player menghantam opponent dan membuat opponent menghantam arena wall.

```text
YOU → 💥 ENEMY → WALL
                  💥
```

Result:

`WALL SLAM`

Damage tambahan dapat diberikan berdasarkan impact lanjutan.

Wall collision tetap memiliki batas agar tidak menjadi infinite damage loop.

---

# 12. Drift Bump

Drifting tidak memberikan uang secara langsung.

Drift digunakan untuk mendapatkan posisi yang lebih baik.

Jika drift berhasil diikuti dengan crash:

`DRIFT BUMP`

Effect:

- higher impact multiplier
- stronger VFX
- tire smoke
- skid sparks
- special sound

Goal:

> Drift bukan reward. Drift adalah setup untuk mendapatkan crash yang lebih baik.

---

# 13. Boost Crash

Boost tidak memberikan uang.

Boost meningkatkan potensi crash berikutnya.

```text
BOOST
  ↓
HIGH SPEED
  ↓
CRASH
  ↓
2× DAMAGE
```

Jika berhasil:

`BOOST CRASH`

Jika miss:

- tidak mendapatkan reward
- momentum tinggi
- kontrol lebih sulit
- bisa masuk posisi berbahaya

Boost harus terasa **high risk / high reward**.

---

# 14. Momentum Damage

Damage memperhitungkan momentum kedua kendaraan.

Contoh:

```text
Slow Player
     ↓
   CRASH
     ↓
Small Damage
```

vs.

```text
Fast Player → ← Fast Player
       💥
       ↓
Massive Impact
```

Momentum menjadi alasan player untuk:

- accelerate
- dodge
- bait opponent
- counter
- position

---

# 15. Revenge Crash

Jika player baru saja terkena crash lalu berhasil membalas dalam waktu singkat:

`REVENGE!`

Example:

```text
A → B
+$20

B → A
REVENGE
+$30
```

Multiplier hanya berlaku pada damage yang berhasil diberikan.

Tidak ada reward tambahan gratis.

---

# 16. Rich Target / Big Bag

Player dengan balance besar menjadi target utama.

Threshold contoh:

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

Visual:

- subtle glow
- money aura
- crown/bounty marker
- world-space balance lebih prominent

Jangan menggunakan giant UI marker yang mengganggu gameplay.

Goal:

> Semakin kaya kamu, semakin banyak orang ingin mengejarmu.

---

# 17. Critical Bag

Ketika balance sangat rendah:

```text
$12
CRITICAL BAG
```

Visual:

- subtle red pulse
- damaged vehicle
- warning light
- heartbeat audio

Tidak ada free recovery.

Satu-satunya cara comeback:

> **Crash someone richer.**

---

# 18. Comeback System

Tidak ada rubber-band money.

Player dengan `$10` tetap memiliki kesempatan menang karena bisa menyerang player dengan `$400`.

Example:

```text
YOU
$12

       💥

BIG BAG
$400

       ↓

YOU
$72
```

Comeback berasal dari **skill + target selection**, bukan sistem bantuan.

---

# 19. Liquidation

Jika balance mencapai `$0`:

```text
BALANCE
$0

↓
LIQUIDATED
```

Sequence:

1. critical state
2. final impact
3. balance hits zero
4. car loses control
5. lights flicker
6. sparks
7. smoke/fire
8. vehicle destruction
9. `LIQUIDATED`
10. player eliminated

Attacker mendapatkan balance yang tersisa sesuai collision calculation.

Tidak ada respawn.

---

# 20. Vehicle Destruction

Destroyed vehicle:

- cannot move
- cannot attack
- cannot receive money
- cannot return to gameplay

State:

```text
ALIVE
 ↓
CRITICAL
 ↓
ELIMINATED
 ↓
SPECTATING
```

Tidak boleh kembali ke `ALIVE`.

---

# 21. Spectator Mode

Setelah elimination:

```text
YOU ARE ELIMINATED

#6 / 8

WATCHING:
Tesla_DeGen
$360
```

Player dapat:

- follow surviving player
- cycle target
- watch final duel

Spectator mode harus tetap cinematic dan menarik.

---

# 22. Near Miss

Jika dua player hampir crash tetapi berhasil menghindar dengan jarak sangat dekat:

`CLOSE CALL!`

Feedback:

- short slow motion
- camera punch
- tire sound
- small screen effect

Tidak ada uang.

Near Miss adalah **skill feedback**, bukan reward ekonomi.

---

# 23. Pin / Corner Trap

Player dapat menjepit opponent ke wall.

```text
WALL
████████

YOU → ENEMY
```

State:

`PINNED`

Duration pendek, sekitar 1–1.5 detik.

Tujuan:

- membuka kesempatan crash
- membuat positioning penting

Tidak boleh infinite stun-lock.

---

# 24. Final Duel

Ketika hanya tersisa 2 player:

```text
FINAL DUEL

YOU $184

VS

ENEMY $240
```

Arena berubah:

- lighting lebih intense
- music intensity meningkat
- camera sedikit lebih dramatic
- UI lebih minimal

Tidak ada uang gratis.

Balance tetap berasal dari collision.

---

# 25. Match Flow

Contoh match 2:40–3:00.

```text
00:00–00:20
EARLY GAME
Move / position / first contact

00:20–01:00
BUILD & CHASE
First serious crashes

01:00–01:20
COMBAT
Combos / counters / bank shots

01:20–02:00
HIGH RISK
Big bags become targets

02:00–02:30
CHAOS
More aggressive fights

02:30–03:00
FINAL 30
High intensity

00:10
FINAL COUNTDOWN

00:00
MARKET CLOSED
```

---

# 26. HUD

HUD harus tetap minimal.

### Top Left

```text
YOUR BAG
$284
+$35

$HOOD +2.8% ▲
```

### Top Center

```text
ROUND
01:24
```

### Top Right

```text
#3 / 8

1  Diamond_Hands $520
2  Tesla_DeGen   $360
3  You           $284
4  Nvda_Max      $210
```

### Bottom Center

```text
HP       █████████░ 76%
BOOST    ██████░░░░ 62%
```

### Context notification

```text
💥 PERFECT BUMP
+$35
```

Tidak ada permanent notification panel.

---

# 27. Crash Feedback Stack

Setiap crash penting harus menggunakan kombinasi:

```text
PHYSICS
   +
CAMERA
   +
VFX
   +
AUDIO
   +
UI
```

Contoh Perfect Bump:

```text
Impact
 ↓
Knockback
 ↓
Hit-stop 80–120ms
 ↓
Camera shake
 ↓
Sparks
 ↓
Shockwave
 ↓
Cash particles
 ↓
+$35
 ↓
PERFECT BUMP
```

Semua feedback harus sangat singkat dan readable.

---

# 28. Core Principle

**Do not add effects just because they look cool.**

Setiap effect harus menjawab salah satu:

- Apakah saya berhasil?
- Berapa uang yang saya dapat?
- Seberapa kuat crash saya?
- Apakah saya dalam bahaya?
- Siapa target terbaik?
- Apakah saya hampir mati?

Kalau tidak membantu gameplay, jangan ditampilkan.

---

# 29. Economy Rules

### MUST

- Crash player → steal money
- Target loses exactly what attacker gains
- Balance can reach `$0`
- Zero balance = elimination
- Rich players become valuable targets
- Comeback comes from attacking other players

### MUST NOT

- ❌ Cash rain
- ❌ Passive income
- ❌ Random money spawn
- ❌ Money pickup from nowhere
- ❌ Free comeback
- ❌ Respawn money
- ❌ Duplicate reward
- ❌ Inflation

**Core rule:**

```text
TOTAL MONEY IN MATCH
MUST REMAIN CONSTANT
```

Money hanya berpindah dari satu player ke player lain.

---

# 30. Priority Implementation

### Phase 1 — Core Feel

1. Impact tiers
2. High-speed impact
3. Perfect Angle
4. Double Impact
5. Camera shake
6. Hit-stop
7. Sparks / shockwave
8. Cash feedback

### Phase 2 — Skill

9. Counter Crash
10. Momentum Damage
11. Drift Bump
12. Boost Crash
13. Bank Shot
14. Wall Slam

### Phase 3 — Combat Depth

15. Bump Combo
16. Chain Crash
17. Revenge Crash
18. Pin / Corner Trap
19. Near Miss

### Phase 4 — Economy Pressure

20. Big Bag
21. Bounty
22. Critical Bag
23. Liquidation
24. Vehicle Destruction
25. Spectator

### Phase 5 — Match Drama

26. Final 30 seconds
27. Final Duel
28. Final Countdown
29. Match-end presentation

---

# 31. Desired Player Experience

Pemain harus bisa mengalami cerita seperti:

> **"$12 left. Tesla is chasing me. I dodge, drift around the corner, hit the wall, Bank Shot into Tesla, Perfect Angle, Double Impact, steal $80, then chase the $500 Big Bag and liquidate him with 3 seconds left."**

Kalau player bisa menghasilkan cerita seperti itu secara **natural dari gameplay**, BUMP.TRADE sudah punya fondasi gameplay yang sangat kuat dan juga **sangat clip-able**.
