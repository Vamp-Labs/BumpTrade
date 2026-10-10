# PRD — BUMP.TRADE Gameplay HUD

## 1. Objective

Revamp gameplay HUD agar:

- Gameplay arena tetap menjadi fokus utama.
- Informasi penting dapat dibaca dalam waktu singkat.
- Tidak ada panel besar yang menutupi arena.
- UI terasa seperti arcade racing/combat game modern.
- Visual tetap konsisten dengan BUMP.TRADE: dark glass, neon cyan/green, stock-market aesthetic.
- Feedback ketika terjadi **bump, damage, money drop, pickup, atau elimination** terasa jelas tanpa membuat layar terlalu ramai.

---

# 2. HUD Layout

Desktop gameplay menggunakan struktur berikut:

```text
┌──────────────────────────────────────────────────────────────┐
│ BAG / STOCK                         ROUND              RANK   │
│                                                              │
│                                                              │
│                    GAMEPLAY ARENA                             │
│                                                              │
│                                                              │
│                                                              │
│                                                              │
│                         PLAYER                               │
│                                                              │
│                 ┌─────────────────────┐                      │
│                 │   HP   █████ 76%    │                      │
│                 │ BOOST ████  62%     │                      │
│                 └─────────────────────┘                      │
└──────────────────────────────────────────────────────────────┘
```

Prioritas visual:

1. Arena / cars
2. Player state
3. Money / stock state
4. Round timer
5. Ranking
6. Event notifications

---

# 3. Top Left — Bag / Stock

Position:

**Top-left**

Purpose:

Memberikan informasi ekonomi utama player tanpa mengambil terlalu banyak space.

### Content

```text
YOUR BAG

$185      +$24

$HOOD +2.8% ▲
```

### Behavior

- `$185` = current bag / money.
- `+$24` = latest gain from interaction.
- `$HOOD +2.8% ▲` = current stock movement.
- Value update harus memiliki subtle number animation.
- Jika value naik → green.
- Jika value turun → red.
- Jangan menggunakan chart besar.

### Visual

- Compact glass panel.
- Dark translucent background.
- Thin neon border.
- Green accent.
- Rounded corners.
- Minimal glow.

Panel tidak boleh lebih besar dari sekitar **18–20% viewport width**.

---

# 4. Top Center — Round Timer

Position:

**Top-center**

Content:

```text
ROUND

01:24
```

Purpose:

Memberikan countdown yang selalu terlihat tetapi tidak mendominasi gameplay.

### Behavior

Normal:

```text
01:24
```

Last 10 seconds:

- Slight pulse.
- More noticeable typography.
- Subtle glow.

Tidak perlu full-screen warning.

---

# 5. Top Right — Player Ranking

Position:

**Top-right**

Display hanya ranking penting.

Example:

```text
🥇 Diamond_Hands     $320
🥈 Tesla_DeGen       $210
🟢 You               $185
4   Nvda_Max         $140
```

### Rules

- Maximum 4 visible players.
- Player harus selalu terlihat.
- Player row menggunakan green highlight.
- Ranking update menggunakan smooth transition.
- Jangan menampilkan 8–10 player sekaligus.
- Jika ada lebih banyak player, gunakan small expand indicator.

Example:

```text
⌄
```

Leaderboard detail tidak menjadi bagian dari gameplay HUD.

---

# 6. Player World Label

Setiap vehicle memiliki floating information label.

Example:

```text
You
$185
▼
```

Enemy:

```text
Tesla_DeGen
$210
▼
```

### Requirements

- Label mengikuti posisi kendaraan.
- Tidak terlalu besar.
- Tidak menggunakan panel besar.
- Money value menjadi informasi utama.
- HP bar hanya muncul ketika relevan.

Player label menggunakan green.

Enemy label mengikuti warna archetype / state.

---

# 7. Bottom Center — Player Status

Position:

**Bottom-center**

Ini menggantikan panel HP lama yang terlalu berada di kiri.

### Content

```text
🛡 HP     ███████████░░  76%     │
⚡ BOOST  █████████░░░░  62%
```

### Design

- Horizontal compact bar.
- Glass background.
- Width sekitar 35–45% viewport.
- Tidak terlalu tinggi.
- Tidak menutupi vehicle.
- Positioned slightly above bottom safe-area.

### HP

Green progress bar.

### Boost

Blue/cyan progress bar.

### Behavior

HP damage:

- Bar decreases smoothly.
- Brief red flash around HP bar.
- No large warning popup.

Boost:

- Smooth fill animation.
- When full → subtle glow.

---

# 8. Event Notification

Event notification tidak boleh menggunakan panel besar di sisi kanan.

Notification muncul:

**di bawah Round Timer / top-center area**, kemudian menghilang otomatis.

Example:

```text
💥 YOU BUMPED TESLA_DEGEN
+$24 DROPPED
```

atau:

```text
💀 HOOD_BEAR LIQUIDATED
```

atau:

```text
💵 YOU PICKED UP $18
```

### Position

```text
              ROUND
             01:24

       ┌─────────────────────┐
       │ 💥 BUMPED TESLA     │
       │    +$24 DROPPED     │
       └─────────────────────┘
```

### Animation

Enter:

- Small slide/fade from top.

Active:

- 0.8–1.5 sec.

Exit:

- Fade out.

Maximum:

**1 notification at a time.**

Jika event terjadi berturut-turut, gunakan queue.

---

# 9. Bump Feedback

Bump adalah core gameplay mechanic sehingga feedback harus kuat.

Ketika player menabrak vehicle:

### World feedback

- Impact particles.
- Sparks.
- Short camera shake.
- Vehicle recoil.
- Neon impact ring.
- Money particles jika ada money drop.

### UI feedback

Show:

```text
BUMP!
+$24
```

atau:

```text
BUMP!
-$18
```

Typography besar tetapi hanya muncul sebentar.

Duration:

**~700–1000ms**

Tidak boleh menjadi permanent UI.

---

# 10. Money Drop Feedback

Ketika money jatuh dari vehicle:

World:

```text
💵 +$24
```

Money objects muncul di arena.

UI:

```text
+$24
```

Number animation:

```text
$185
↓
$209
```

Gunakan smooth interpolation, bukan instant number replacement.

---

# 11. Damage Feedback

Ketika player menerima damage:

- HP bar briefly flashes.
- Small red screen-edge vignette.
- Vehicle sparks.
- Camera shake proportional to impact.

Jangan menggunakan full-screen red overlay.

Example:

```text
HP 76%
████████████░░
```

menjadi:

```text
HP 58%
█████████░░░░░
```

---

# 12. Elimination Feedback

Jika player melakukan elimination:

Notification:

```text
💀 HOOD_BEAR
LIQUIDATED
```

Then:

```text
+$48
```

Animation:

- Short impact burst.
- Green/gold accent.
- Money particles.
- Ranking update.

Tidak perlu modal popup.

---

# 13. Stock Movement Feedback

Stock movement adalah bagian penting dari gameplay tetapi harus tetap secondary.

Normal:

```text
$HOOD +2.8% ▲
```

Positive movement:

- Green.
- Small upward arrow.

Negative:

```text
$HOOD -1.4% ▼
```

- Red.

Large movement:

```text
$HOOD +8.4% ▲
```

- Brief glow/pulse.

Jangan menampilkan chart besar selama gameplay.

---

# 14. Remove / Avoid

Remove elemen berikut dari gameplay HUD:

- Large minimap/radar.
- Large right-side event feed.
- Large bottom-left HP panel.
- Large stock chart.
- Permanent legend.
- Excessive decorative panels.
- Multiple simultaneous notifications.
- Full-screen damage overlays.
- Large instruction panels after gameplay starts.

Arena harus tetap terlihat sekitar **85–90% dari viewport**.

---

# 15. UI Hierarchy

Prioritas informasi:

### P0 — Always visible

- Player vehicle
- Bag / money
- Round timer
- Player rank
- HP
- Boost

### P1 — Contextual

- Stock movement
- Enemy money
- Bump feedback
- Money pickup
- Damage feedback

### P2 — Temporary

- Elimination
- Ranking change
- Major stock movement

---

# 16. Animation Principles

Semua HUD animation harus cepat dan subtle.

### Number changes

Use:

```text
$185 → $209
```

dengan interpolation.

### Panels

Use:

- 150–250ms fade/slide.
- No exaggerated bounce.

### Impact

Use:

- Camera shake.
- Scale punch.
- Particle burst.

### Notification

Use:

```text
fade-in → hold → fade-out
```

Tidak boleh permanent.

---

# 17. Glass UI Style

HUD menggunakan:

- Dark transparent glass.
- Blur/backdrop.
- Thin border.
- Small neon glow.
- High contrast typography.
- Minimal decoration.

Base:

```text
rgba(5, 15, 20, 0.65)
```

Border:

```text
1px neon cyan/green
```

Green:

```text
#00F5A0
```

Cyan:

```text
#00D9FF
```

Red:

```text
#FF3B5F
```

Yellow/gold:

```text
#FFC928
```

---

# 18. Responsive Behavior

Desktop:

- Full HUD.
- Top-left Bag.
- Top-center Round.
- Top-right Rank.
- Bottom-center HP/Boost.

Tablet:

- Reduce panel width.
- Reduce ranking to top 3.

Mobile:

- Bag → compact.
- Ranking → collapsible.
- HP/Boost → bottom-center.
- Notifications → center-top.
- Maintain gameplay visibility.

---

# 19. Final Gameplay Experience

Target experience:

**Player melihat arena terlebih dahulu, HUD hanya memberikan informasi yang dibutuhkan untuk membuat keputusan.**

The screen should communicate immediately:

```text
How much money do I have?
        ↓
What stock am I using?
        ↓
How much HP do I have?
        ↓
How much boost do I have?
        ↓
What is my rank?
        ↓
What just happened?
```

HUD harus terasa seperti bagian dari game, bukan dashboard yang ditempelkan di atas game.

**Core principle:**

> **Gameplay first. Information second. Decoration last.**
