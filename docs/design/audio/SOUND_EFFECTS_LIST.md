# BUMP.TRADE — COMPLETE SOUND EFFECTS SPECIFICATION & ASSET REPLACEMENT LIST

> **Document Type:** Production Audio Asset Specification & Replacement Guide  
> **Target Engine:** BUMP.TRADE (Three.js + Rapier3D + Web Audio API)  
> **Purpose:** Comprehensive inventory of all in-game sound effects, trigger conditions, procedural parameters, and technical replacement specifications for custom audio files (`.wav`, `.ogg`, `.mp3`).

---

## 1. Executive Summary & Audio Architecture

Currently, BUMP.TRADE operates with **100% procedural Web Audio API synthesis** across two core classes:
- [`src/audio/SoundManager.ts`](file:///home/cn/Projects/Personal/3d/src/audio/SoundManager.ts): Global arcade FX (combat, multi-tier collisions, streaks, pickups, arena events, power-ups, tension).
- [`src/vehicles/CarAudio.ts`](file:///home/cn/Projects/Personal/3d/src/vehicles/CarAudio.ts): Real-time vehicle dynamics (speed-modulated engine oscillator, boost whine, localized bumper snap).

This document catalogs **every single sound effect** currently implemented and planned, providing the exact trigger, procedural sound signature, and **production replacement asset specifications** (target duration, frequency spectrum, style reference, and suggested filename).

---

## 2. Recommended Directory Structure & Format Standards

When replacing the procedural synthesizers with pre-recorded audio assets, place all audio files into `public/audio/`:

```
public/
└── audio/
    ├── sfx/
    │   ├── combat/
    │   │   ├── impact_light.wav
    │   │   ├── impact_heavy.wav
    │   │   ├── impact_critical.wav
    │   │   ├── titan_impact.wav
    │   │   └── shield_deflect.wav
    │   ├── combos/
    │   │   ├── combo_bump_1.wav
    │   │   ├── combo_bump_2.wav
    │   │   └── combo_bump_3.wav
    │   ├── pickups/
    │   │   ├── cash_pickup.wav
    │   │   └── cash_scatter.wav
    │   ├── powerups/
    │   │   ├── powerup_spawn.wav
    │   │   ├── powerup_collect_turbo.wav
    │   │   ├── powerup_collect_titan.wav
    │   │   ├── powerup_collect_magnet.wav
    │   │   ├── powerup_collect_shield.wav
    │   │   ├── turbo_whoosh.wav
    │   │   ├── titan_grow.wav
    │   │   └── magnet_pulse.wav
    │   ├── events/
    │   │   ├── telegraph_ping.wav
    │   │   ├── event_start_fanfare.wav
    │   │   ├── market_surge.wav
    │   │   ├── market_crash.wav
    │   │   ├── fire_burst.wav
    │   │   ├── countdown_heartbeat.wav
    │   │   ├── countdown_critical.wav
    │   │   └── round_complete.wav
    │   ├── vehicle/
    │   │   ├── engine_loop.wav
    │   │   ├── engine_boost.wav
    │   │   ├── vehicle_thud.wav
    │   │   ├── tire_skid.wav
    │   │   └── car_liquidated.wav
    │   └── ui/
    │       ├── ui_click.wav
    │       ├── ui_hover.wav
    │       └── ui_select_swipe.wav
```

### Technical Audio Asset Requirements:
- **Format:** Uncompressed 24-bit / 16-bit **WAV** (or web-optimized 44.1kHz **OGG** / **MP3** fallback).
- **Sample Rate:** `44,100 Hz` or `48,000 Hz`.
- **Channel Format:**
  - **Mono:** Positional sounds (impacts, engine, pickups, fire pillars) for 3D spatial panning.
  - **Stereo:** Global events, UI clicks, combo fanfares, and countdown alarms.
- **Normalization:** Mastered with peak ceiling at `-1.0 dBFS` to prevent clipping when multiple collisions occur simultaneously.

---

## 3. Master Sound Effects Catalog

### Category A: Combat & Vehicular Collisions

| SFX ID | Function / Method | Trigger Event | Current Procedural Synthesis | Recommended Asset Spec | Target Duration | Style Reference & Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sfx_impact_light` | `SoundManager.playImpact(i, 'LIGHT')` | Glancing or low-speed collision between bumper cars or bumper with wall. | Triangle sub-thud (140 Hz → 26 Hz) + detuned 420 Hz saw/square metallic clang + noise click (0.05s). | `impact_light.wav` | `0.18s – 0.25s` | Tight rubber bumper thud, light chassis pop, hollow arcade tap. Low distortion. |
| `sfx_impact_heavy` | `SoundManager.playImpact(i, 'HEAVY')` | High-speed direct bumper crash; or arena blackout power reboot. | Sub-bass punch (180 Hz → 26 Hz) + 520 Hz metallic crunch (bandpass 1.4 kHz, Q=4.0). | `impact_heavy.wav` | `0.30s – 0.45s` | Hard punchy 808 sub kick layered with metal fender crash, snappy compression. |
| `sfx_impact_critical` | `SoundManager.playImpact(i, 'CRITICAL')` | Max velocity T-bone smash, fatal hit, or major vehicle wreck. | Massive sub drop (220 Hz → 26 Hz) + dual saw/square clang (620 Hz + 950 Hz dissonance) + transient snap. | `impact_critical.wav` | `0.50s – 0.70s` | Explosive arcade smash, heavy sub-bass boom, shattered debris crunch, resonant metallic ring. |
| `sfx_titan_impact` | `SoundManager.playTitanImpact()` | Titan Ram enlarged vehicle smashes into an opponent. | Sub-bass drop (triangle 120 Hz → 20 Hz at 0.65 volume). | `titan_impact.wav` | `0.60s – 0.85s` | Earthquake shockwave, bowling ball strike, monster truck hydraulic crush with deep sub rumble. |
| `sfx_shield_deflect` | `SoundManager.playShieldDeflect()` | Shielded car hit by enemy; protects money bag and absorbs damage. | Sine sweep from 1200 Hz down to 400 Hz (0.28s). | `shield_deflect.wav` | `0.30s – 0.45s` | Sci-fi energy barrier deflection, glassy plasma bounce, high-tech forcefield ricochet ping. |

---

### Category B: Consecutive Bump Combos & Multipliers

| SFX ID | Function / Method | Trigger Event | Current Procedural Synthesis | Recommended Asset Spec | Target Duration | Style Reference & Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sfx_combo_bump_1` | `SoundManager.playComboBump(1)` | 1st bump hit on enemy car. | Sine sweep C5 (523 Hz) → E5 (659 Hz), 0.20s. | `combo_bump_1.wav` | `0.18s – 0.25s` | Clean affirmative arcade blip, punchy reward tone. |
| `sfx_combo_bump_2` | `SoundManager.playComboBump(2)` | 2nd consecutive bump in < 5.0s (`🔥 DOUBLE BUMP! STEAL ×2`). | Rising chord arpeggio G5 (784 Hz), B5 (988 Hz), D6 (1175 Hz), 0.32s. | `combo_bump_2.wav` | `0.30s – 0.40s` | Energetic rising 2-tone arcade synth sting, upbeat multiplier trigger sound. |
| `sfx_combo_bump_3` | `SoundManager.playComboBump(3+)` | 3rd+ consecutive bump in < 5.0s (`⚡ TRIPLE BUMP! STEAL ×3`). | Soaring crystal fanfare C6, E6, G6, C7 (1046 Hz–2093 Hz) + pitch scaling (+120 Hz per streak tier). | `combo_bump_3.wav` | `0.45s – 0.60s` | High-octane arcade hyperpop crystal fanfare, triumphant chime, celebratory streak bell. |

---

### Category C: Pickups & Economy

| SFX ID | Function / Method | Trigger Event | Current Procedural Synthesis | Recommended Asset Spec | Target Duration | Style Reference & Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sfx_cash_pickup` | `SoundManager.playCashPickup(value)` | Vehicle runs over or magnetizes dropped cash bills. | Twin high-sine crystal chime (1480 Hz + 1975 Hz) + pitch bonus up to +300 Hz for high-value bills. | `cash_pickup.wav` | `0.15s – 0.22s` | Sparkling casino coin tink, Mario-style crystalline coin blip, clean metallic payout snap. |
| `sfx_cash_scatter` | `SoundManager.playCashScatter()` | High-impact collision knocks cash out of victim's bag into arena. | 4 rapid staggered high sine tinkles (2200 Hz–3000 Hz, 0.035s delay each). | `cash_scatter.wav` | `0.30s – 0.45s` | Rapid burst of coins/poker chips spilling across asphalt, loose bills fluttering burst. |

---

### Category D: Power-Ups & Abilities (Lucky Box)

| SFX ID | Function / Method | Trigger Event | Current Procedural Synthesis | Recommended Asset Spec | Target Duration | Style Reference & Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sfx_powerup_spawn` | `SoundManager.playPowerupSpawn()` | A Lucky Box crate spawns into the arena. | 4-note ascending arcade alert chime (350 Hz, 523 Hz, 784 Hz, 1046 Hz). | `powerup_spawn.wav` | `0.35s – 0.50s` | Mystery box drop chime, shimmering arcade notification, magical spawn beacon. |
| `sfx_powerup_turbo` | `SoundManager.playPowerupCollect('TURBO')` | Picking up TURBO Lucky Box (+40% speed, glowing cyan trail). | Fast ascending A minor/E arpeggio (440 Hz, 659 Hz, 880 Hz, 1318 Hz). | `powerup_collect_turbo.wav` | `0.40s – 0.55s` | High-energy nitro charge-up, electric whip crack, cyber-boost intake swell. |
| `sfx_powerup_titan` | `SoundManager.playPowerupCollect('HEAVY_HIT' / 'TITAN')` | Picking up TITAN RAM Lucky Box (1.75× vehicle size, 2.5× knockback). | Aggressive deep brass sawtooth chords (110 Hz, 220 Hz, 330 Hz, 440 Hz). | `powerup_collect_titan.wav` | `0.50s – 0.70s` | Deep distorted synth brass horn, monster truck powerup growl, heavy mech boot powerup. |
| `sfx_powerup_magnet` | `SoundManager.playPowerupCollect('CASH_MAGNET')` | Picking up CASH MAGNET Lucky Box (3× cash suction radius). | Radiant harmonic synth chord (587 Hz, 740 Hz, 880 Hz, 1175 Hz). | `powerup_collect_magnet.wav` | `0.40s – 0.60s` | Magnetic vortex charging sound, electromagnetic shimmer, tractor beam powerup. |
| `sfx_powerup_shield` | `SoundManager.playPowerupCollect('SHIELD')` | Picking up DEFENSE SHIELD Lucky Box (100% loss immunity, 50% damage reduction). | Crystalline harmonic shield chord (494 Hz, 659 Hz, 988 Hz, 1318 Hz). | `powerup_collect_shield.wav` | `0.45s – 0.65s` | Shimmering holographic energy shield deploy, crystal glass chime, sci-fi barrier activation. |
| `sfx_turbo_whoosh` | `SoundManager.playTurbo()` | Triggering manual or power-up boost acceleration. | Sawtooth wave 140 Hz → 680 Hz swept through opening lowpass filter (400 Hz → 2800 Hz). | `turbo_whoosh.wav` | `0.45s – 0.65s` | Jet-turbine spool whoosh, nitrous rocket flare with high-end pressurized air exhaust. |
| `sfx_titan_grow` | `SoundManager.playTitanGrow()` | Vehicle expands physically from normal scale to 1.75× Titan size. | Resonant sub-bass sweep (sawtooth 75 Hz → 32 Hz) with bandpass filter swell (160 Hz → 420 Hz → 70 Hz). | `titan_grow.wav` | `0.65s – 0.90s` | Heavy mechanical hydraulic expansion groan, sub-bass riser, kaiju-weight transformation swell. |
| `sfx_magnet_pulse` | `SoundManager.playMagnetPulse()` | Cash bills being pulled inward by magnetic forcefield. | Sine wave 320 Hz → 640 Hz (0.18s). | `magnet_pulse.wav` | `0.15s – 0.25s` | Subtle rhythmic electromagnetic pulse / high-tech tractor beam chirp. |

---

### Category E: Match Timeline, Telegraphs & Atmospheric Arena Events

| SFX ID | Function / Method | Trigger Event | Current Procedural Synthesis | Recommended Asset Spec | Target Duration | Style Reference & Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sfx_telegraph_ping` | `SoundManager.playMarketTelegraph(count)` | 3s, 2s, 1s countdown before Major Market Event kickoff. | Pitch-escalating sine ping (880 Hz for 1s, 660 Hz for 2s, 440 Hz for 3s). | `telegraph_ping.wav` | `0.15s – 0.20s` | Clean high-contrast UI countdown blip, tension timer beep. |
| `sfx_event_start_fanfare` | `SoundManager.playMarketTelegraph(0, true)` | Market Event launches at 0s (e.g. Double Steal Surge begins). | Ascending Major event kickoff fanfare chord (523 Hz, 659 Hz, 784 Hz, 1046 Hz). | `event_start_fanfare.wav` | `0.60s – 0.90s` | High-energy arcade event siren, brass synth kickoff sting, race start flourish. |
| `sfx_market_surge` | `SoundManager.playMarketEvent('surge' / 'market_flash')` | Bullish surge event, ticker strobe pulse. | Uplifting 4-note triangle chord sequence (523 Hz, 659 Hz, 784 Hz, 1046 Hz). | `market_surge.wav` | `0.70s – 1.00s` | Bull market rally synth fanfare, energetic market ticker alert, uplifting chime. |
| `sfx_market_crash` | `SoundManager.playMarketEvent('market_crash')` | Market Crash event; red hazard strobe pulse. | Dissonant descending sawtooth chord (440 Hz, 415 Hz, 370 Hz). | `market_crash.wav` | `0.70s – 1.00s` | Emergency klaxon alarm horn, descending dark alarm drone, market crash alert. |
| `sfx_fire_burst` | `SoundManager.playFireBurst()` | Periodic flame eruption from perimeter arena wall pillars (every 20s). | Low sawtooth flame rumble (48 Hz → 64 Hz → 36 Hz) + bandpass filtered white noise whoosh (450 Hz, 1.8s). | `fire_burst.wav` | `1.50s – 2.20s` | Stadium pyrotechnic flame thrower ignition whoosh + heavy rolling fire roar. |
| `sfx_countdown_heartbeat` | `SoundManager.playFinalTenCountdown(s)` (s > 3) | Round timer in final 10s: 10s down to 4s remaining. | Deep triangle sub-kick thud (130 Hz down to 40 Hz, 0.22s). | `countdown_heartbeat.wav` | `0.22s – 0.30s` | Heavy cinematic heartbeat kick, low sub-bass thump creating impending round end tension. |
| `sfx_countdown_critical` | `SoundManager.playFinalTenCountdown(s)` (s <= 3) | Round timer in final 3 seconds: 3s, 2s, 1s remaining. | Sharp urgent square-wave double-alarm (980 Hz, 0.14s). | `countdown_critical.wav` | `0.12s – 0.18s` | Urgent digital buzzer / high-pitch arcade hurry-up pip. |
| `sfx_round_complete` | `SoundManager.playRoundComplete()` | Round timer reaches 00:00 (Round Finished). | 5-note victory chord (C5, E5, G5, C6, E6: 523 Hz–1318 Hz, 1.2s sustain). | `round_complete.wav` | `1.50s – 2.50s` | Triumphant round end whistle/buzzer finish + celebratory arcade synth resolution. |

---

### Category F: Real-Time Vehicle Dynamics (`CarAudio.ts`)

| SFX ID | Function / Method | Trigger Event | Current Procedural Synthesis | Recommended Asset Spec | Target Duration | Style Reference & Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sfx_engine_loop` | `CarAudio.setupEngineSynth()`, `updateEngine()` | Continuous vehicle running / driving loop. | Continuous sawtooth wave (45 Hz–170 Hz) + lowpass filter (260 Hz), pitch modulated by vehicle speed. | `engine_loop.wav` | `2.0s – 4.0s` (Seamless Loop) | Stylized electric bumper car motor whine, brushless RC motor drone with smooth pitch modulation. |
| `sfx_vehicle_thud` | `CarAudio.playImpactSound(intensity)` | Local car body impact thud on obstacles. | Triangle sub-thud (140 Hz–200 Hz down to 25 Hz) + square snap (420 Hz–620 Hz). | `vehicle_thud.wav` | `0.20s – 0.30s` | Snappy chassis thud, rubber bumper compression bump. |
| `sfx_vehicle_boost_whine` | `CarAudio.playBoostSound()` | Vehicle activates nitro boost. | Sine sweep (180 Hz → 550 Hz, 0.35s). | `engine_boost.wav` | `0.35s – 0.50s` | Electric turbine spin-up, capacitive discharge whine. |
| `sfx_tire_skid` | `CarVFX.playTireSkid()` | High-speed lateral drifting / handbrake slide. | (Visual tire marks currently; audio placeholder). | `tire_skid.wav` | `0.30s – 0.50s` (or loopable) | Asphalt tire screech, rubber friction slide. |
| `sfx_car_liquidated` | `CarController.takeDamage()` ($0 balance) | Car hits $0 cash balance (Eliminated / wreck shutdown). | (Calls `playImpact(1.0, 'CRITICAL')` currently). | `car_liquidated.wav` | `0.80s – 1.20s` | Mechanical engine shutdown grind, electrical power-down buzz, short-circuit fizzle. |

---

### Category G: User Interface & Menu Navigation (`OnboardingUI.ts`, `GameplayHUD.ts`)

| SFX ID | Function / Event | Trigger Event | Current Procedural Synthesis | Recommended Asset Spec | Target Duration | Style Reference & Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sfx_ui_click` | Button Click | User clicks `PLAY`, `LEADERBOARD`, `BACK`, or tab selector. | Silent / default browser click. | `ui_click.wav` | `0.04s – 0.08s` | Crisp tactile arcade button click, clean micro-switch snap. |
| `sfx_ui_hover` | Button Hover | Mouse hovers over interactive cards or CTA buttons. | Silent. | `ui_hover.wav` | `0.03s – 0.06s` | Subtle glass tap, high-frequency tick. |
| `sfx_ui_select_swipe` | Vehicle Carousel Navigation | Switching vehicles in Showroom with `<` / `>` or arrow keys. | Silent. | `ui_select_swipe.wav` | `0.15s – 0.25s` | Clean pneumatic whoosh, smooth tech UI card slider swipe. |

---

## 4. Implementation Code Architecture for Audio Replacement

To swap from the current procedural synthesizers to preloaded audio assets, the recommended pattern is an **Audio Buffer Cache** using the standard Web Audio API (`AudioBufferSourceNode`), which retains zero latency, full volume gain staging, and 3D spatial panning capabilities.

### Sample Drop-In Replacement Adapter (`src/audio/AudioLoader.ts`):

```typescript
export class AudioAssetManager {
  private static instance: AudioAssetManager;
  private ctx: AudioContext;
  private buffers: Map<string, AudioBuffer> = new Map();
  private masterGain: GainNode;

  private constructor() {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  public static get(): AudioAssetManager {
    if (!AudioAssetManager.instance) {
      AudioAssetManager.instance = new AudioAssetManager();
    }
    return AudioAssetManager.instance;
  }

  /**
   * Preload audio files into memory
   */
  public async loadSound(id: string, url: string): Promise<void> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers.set(id, decoded);
    } catch (err) {
      console.warn(`[Audio] Failed to load sound '${id}' from ${url}:`, err);
    }
  }

  /**
   * Play preloaded one-shot sound with volume and pitch control
   */
  public play(id: string, options: { volume?: number; pitch?: number; loop?: boolean } = {}): AudioBufferSourceNode | null {
    const buffer = this.buffers.get(id);
    if (!buffer) {
      console.warn(`[Audio] Sound '${id}' not found in cache.`);
      return null;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options.pitch ?? 1.0;
    source.loop = options.loop ?? false;

    const gain = this.ctx.createGain();
    gain.gain.value = options.volume ?? 1.0;

    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(0);

    return source;
  }
}
```

---

## 5. Verification Checklist for Sound Replacement

When replacing audio assets, verify that:
1. **Low Latency (<15ms):** Sounds trigger instantly on collision and button click without perceptible delay.
2. **Polyphony / Concurrency:** High-speed multi-car pileups trigger up to 6–8 simultaneous hits without audio popping, crackling, or browser clipping.
3. **Loop Smoothness:** The `engine_loop.wav` must have zero zero-crossing clicks at loop endpoints.
4. **Volume Balancing:** Background engine sounds do not overpower pickup chimes or critical bump alerts.
5. **Mobile / Browser Audio Policy:** User interaction (`pointerdown`, `keydown`, or clicking `PLAY`) safely unlocks the Web Audio context before playback.
