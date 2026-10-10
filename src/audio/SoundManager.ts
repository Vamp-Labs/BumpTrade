/**
 * Procedural Web Audio API Sound Synthesizer for BUMP.TRADE.
 * 100% procedural Web Audio API; zero external audio asset dependencies.
 * Produces crisp, arcade-punchy synthesized audio for combat, pickups, events, and tension.
 */

export class SoundManager {
  private static instance: SoundManager;
  private ctx?: AudioContext;
  private isUnlocked: boolean = false;
  private masterGain?: GainNode;

  private constructor() {
    this.setupUnlockListeners();
  }

  public static get(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private setupUnlockListeners(): void {
    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.isUnlocked = true;
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('click', unlock);
    };

    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('click', unlock);
  }

  public isAudioUnlocked(): boolean {
    return this.isUnlocked;
  }

  private ensureContext(): boolean {
    if (!this.ctx) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
        this.isUnlocked = true;
      } catch (e) {
        console.warn('[SoundManager] Web Audio API blocked or unsupported', e);
        return false;
      }
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return true;
  }

  /**
   * Heavy metallic bump & bass thud on vehicle collision.
   * Multi-layered: sub-bass punch, crunchy metallic clang, and snappy impact pop.
   */
  public playImpact(intensity: number, tier: string = 'LIGHT'): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const clampedIntensity = Math.min(Math.max(intensity, 0.1), 1.0);

    const isCounter = tier === 'COUNTER';
    const isCritical = tier === 'CRITICAL';
    const isPerfect = tier === 'PERFECT';
    const isHeavy = tier === 'HEAVY';

    // 1. Sub-Bass Thud (punchy 808-style body hit with heavy drop)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';

    const startFreq = isCounter ? 260 : isCritical ? 240 : isPerfect ? 210 : isHeavy ? 180 : 140;
    subOsc.frequency.setValueAtTime(startFreq + clampedIntensity * 60, now);
    subOsc.frequency.exponentialRampToValueAtTime(22, now + (isCounter ? 0.38 : 0.32));

    const subVol = (isCounter ? 0.95 : isCritical ? 0.82 : isPerfect ? 0.74 : isHeavy ? 0.58 : 0.35) * clampedIntensity;
    subGain.gain.setValueAtTime(subVol, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + (isCounter ? 0.40 : 0.35));

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.40);

    // 2. Metallic Bumper Clang & Snap (Dual detuned square/saw oscillators for metallic friction)
    const mOsc1 = this.ctx.createOscillator();
    const mOsc2 = this.ctx.createOscillator();
    const mGain = this.ctx.createGain();
    const mFilter = this.ctx.createBiquadFilter();

    mOsc1.type = 'sawtooth';
    mOsc2.type = 'square';
    const baseMetalFreq = isCounter ? 740 : isCritical ? 640 : isPerfect ? 580 : isHeavy ? 520 : 420;
    mOsc1.frequency.setValueAtTime(baseMetalFreq, now);
    mOsc1.frequency.exponentialRampToValueAtTime(75, now + 0.20);
    mOsc2.frequency.setValueAtTime(baseMetalFreq * 1.54, now); // Dissonant metallic snap
    mOsc2.frequency.exponentialRampToValueAtTime(95, now + 0.20);

    mFilter.type = 'bandpass';
    mFilter.frequency.setValueAtTime(isCounter ? 1800 : isPerfect ? 1600 : 1400, now);
    mFilter.Q.setValueAtTime(4.0, now);

    const metalVol = (isCounter ? 0.58 : isCritical ? 0.48 : isPerfect ? 0.42 : isHeavy ? 0.34 : 0.22) * clampedIntensity;
    mGain.gain.setValueAtTime(metalVol, now);
    mGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    mOsc1.connect(mFilter);
    mOsc2.connect(mFilter);
    mFilter.connect(mGain);
    mGain.connect(this.masterGain);

    mOsc1.start(now);
    mOsc2.start(now);
    mOsc1.stop(now + 0.22);
    mOsc2.stop(now + 0.22);

    // 3. Crisp transient impact click & snap
    this.playNoiseTransient(isCounter ? 0.08 : 0.05, (isCounter ? 0.5 : 0.38) * clampedIntensity);
  }

  /**
   * Pitch-escalating audio chimes for consecutive bump combos.
   */
  public playComboBump(comboCount: number): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (comboCount <= 1) {
      // Normal bump reinforcement
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.2);
      return;
    }

    if (comboCount === 2) {
      // Double Bump: energetic rising chord (G5, B5, D6)
      const notes = [783.99, 987.77, 1174.66];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.045;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.08, start + 0.25);
        gain.gain.setValueAtTime(0.24, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(start);
        osc.stop(start + 0.32);
      });
      return;
    }

    // Triple Bump+: soaring crystal fanfare (C6, E6, G6, C7) with pitch scaling
    const pitchShift = Math.min((comboCount - 3) * 120, 480);
    const notes = [1046.5 + pitchShift, 1318.5 + pitchShift, 1567.98 + pitchShift, 2093.0 + pitchShift];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.04;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, start + 0.35);
      gain.gain.setValueAtTime(0.26, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.42);
    });
  }

  /**
   * Telegraphed market event anticipatory ping (3... 2... 1...).
   */
  public playMarketTelegraph(count: number, isFinal: boolean = false): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (isFinal) {
      // Major Event Start Fanfare
      const chords = [523.25, 659.25, 783.99, 1046.5];
      chords.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        gain.gain.setValueAtTime(0.28, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.5);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.5);
      });
      return;
    }

    // Ping countdown tone: pitch rises as count counts down (3 -> 2 -> 1)
    const baseFreq = count === 1 ? 880 : count === 2 ? 660 : 440;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.15, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Cash collection chime / coin tink.
   * Crystalline high-frequency twin sine chime.
   */
  public playCashPickup(value: number = 10): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Pitch rises slightly for higher denomination pickups
    const pitchBonus = Math.min(value * 8, 300);
    const freq1 = 1480 + pitchBonus;
    const freq2 = 1975 + pitchBonus;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freq1, now);
    osc1.frequency.exponentialRampToValueAtTime(freq1 * 1.05, now + 0.12);
    osc2.frequency.setValueAtTime(freq2, now + 0.03); // Slight arpeggiated stagger
    osc2.frequency.exponentialRampToValueAtTime(freq2 * 1.05, now + 0.18);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now + 0.03);
    osc1.stop(now + 0.22);
    osc2.stop(now + 0.22);
  }

  /**
   * Cash scatter sound (rapid coin tinkles on impact).
   */
  public playCashScatter(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 4; i++) {
      const delay = i * 0.035;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2200 + Math.random() * 800, now + delay);

      gain.gain.setValueAtTime(0.08, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + delay);
      osc.stop(now + delay + 0.06);
    }
  }

  /**
   * Turbo engine whoosh / boost whine.
   */
  public playTurbo(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(2800, now + 0.35);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  /**
   * Power-up spawn announcement chime.
   */
  public playPowerupSpawn(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const freqs = [350, 523.25, 783.99, 1046.5]; // C4, C5, G5, C6
    freqs.forEach((f, idx) => {
      const start = now + idx * 0.06;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  /**
   * Power-up pickup fanfare with distinct character per power-up type.
   */
  public playPowerupCollect(type: string): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    let notes = [523.25, 659.25, 783.99, 1046.5]; // C major
    if (type === 'TURBO') {
      notes = [440, 659.25, 880, 1318.5]; // Fast A minor/E
    } else if (type === 'HEAVY_HIT' || type === 'TITAN') {
      notes = [110, 220, 330, 440]; // Deep aggressive brass rumble
    } else if (type === 'CASH_MAGNET') {
      notes = [587.33, 739.99, 880, 1174.66]; // Radiant magnet synth
    } else if (type === 'SHIELD') {
      notes = [493.88, 659.25, 987.77, 1318.5]; // Crystalline harmonic shield
    }

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.055;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = (type === 'HEAVY_HIT' || type === 'TITAN') ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, startTime + 0.35);

      gain.gain.setValueAtTime(0.22, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }

  /**
   * TITAN RAM activation grow sound: Deep resonant sub-bass sweep & brass synth swell.
   */
  public playTitanGrow(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(75, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.55);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, now);
    filter.frequency.linearRampToValueAtTime(420, now + 0.25);
    filter.frequency.exponentialRampToValueAtTime(70, now + 0.65);

    subGain.gain.setValueAtTime(0.01, now);
    subGain.gain.linearRampToValueAtTime(0.45, now + 0.2);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    subOsc.connect(filter);
    filter.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc.start(now);
    subOsc.stop(now + 0.65);
  }

  /**
   * TITAN RAM impact shockwave: Earth-shattering heavy bass drop.
   */
  public playTitanImpact(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.45);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.48);
  }

  /**
   * Shield deflection ping when damage / cash loss is absorbed.
   */
  public playShieldDeflect(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.28);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  /**
   * Cash Magnet active hum / pulse.
   */
  public playMagnetPulse(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Fire whoosh on arena flame bursts (volumetric roaring flame).
   */
  public playFireBurst(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // 1. Low frequency fire rumble
    const rumbleOsc = this.ctx.createOscillator();
    const rumbleGain = this.ctx.createGain();
    rumbleOsc.type = 'sawtooth';
    rumbleOsc.frequency.setValueAtTime(48, now);
    rumbleOsc.frequency.linearRampToValueAtTime(64, now + 1.2);
    rumbleOsc.frequency.linearRampToValueAtTime(36, now + 2.5);

    rumbleGain.gain.setValueAtTime(0.001, now);
    rumbleGain.gain.linearRampToValueAtTime(0.24, now + 0.3);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);

    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumbleOsc.start(now);
    rumbleOsc.stop(now + 2.5);

    // 2. White noise whoosh
    this.playFilteredNoise(1.8, 450, 0.22);
  }

  /**
   * Final 10s urgent ticking heartbeat / alarm.
   */
  public playFinalTenCountdown(secondsLeft: number): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (secondsLeft <= 3) {
      // High urgent critical double-alarm
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(980, now);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.14);
    } else {
      // Tension heartbeat thud
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.type = 'triangle';
      kickOsc.frequency.setValueAtTime(130, now);
      kickOsc.frequency.exponentialRampToValueAtTime(40, now + 0.18);

      kickGain.gain.setValueAtTime(0.35, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      kickOsc.connect(kickGain);
      kickGain.connect(this.masterGain);
      kickOsc.start(now);
      kickOsc.stop(now + 0.22);
    }
  }

  /**
   * Major Market Event alert sound (Cash Rain, Market Crash, Surge).
   */
  public playMarketEvent(eventName: string): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const isNegative = eventName.toLowerCase().includes('crash');
    const chords = isNegative ? [440, 415.3, 370] : [523.25, 659.25, 783.99, 1046.5];

    chords.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = isNegative ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.18, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.6);
    });
  }

  /**
   * Round complete finish fanfare chord.
   */
  public playRoundComplete(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    chord.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 1.2);
    });
  }

  /**
   * Procedural audio synthesizers for skill crash signature moments:
   * COUNTER_CRASH, BANK_SHOT, WALL_SLAM, DRIFT_BUMP, BOOST_CRASH, DOUBLE_IMPACT, REVENGE, CHAIN_BUMP.
   */
  public playSkillCrash(type: string): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    switch (type) {
      case 'COUNTER_CRASH': {
        // High explosive sub-bass punch + crunchy transient snap
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sawtooth';
        sub.frequency.setValueAtTime(280, now);
        sub.frequency.exponentialRampToValueAtTime(20, now + 0.42);
        subGain.gain.setValueAtTime(0.75, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        sub.connect(subGain);
        subGain.connect(this.masterGain);
        sub.start(now);
        sub.stop(now + 0.45);
        this.playNoiseTransient(0.09, 0.6);
        break;
      }

      case 'BANK_SHOT': {
        // Metallic ricochet acoustic ping sweeping upward + sparkling crystalline chime
        const ric = this.ctx.createOscillator();
        const ricGain = this.ctx.createGain();
        ric.type = 'triangle';
        ric.frequency.setValueAtTime(880, now);
        ric.frequency.exponentialRampToValueAtTime(1480, now + 0.12);
        ricGain.gain.setValueAtTime(0.35, now);
        ricGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        ric.connect(ricGain);
        ricGain.connect(this.masterGain);
        ric.start(now);
        ric.stop(now + 0.28);

        // High shimmer chime
        const chime = this.ctx.createOscillator();
        const cGain = this.ctx.createGain();
        chime.type = 'sine';
        chime.frequency.setValueAtTime(1975.5, now + 0.08); // B6
        cGain.gain.setValueAtTime(0.22, now + 0.08);
        cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        chime.connect(cGain);
        cGain.connect(this.masterGain);
        chime.start(now + 0.08);
        chime.stop(now + 0.35);
        break;
      }

      case 'WALL_SLAM': {
        // Heavy concrete & steel crunch (low noise burst + deep sub drop)
        const wallSub = this.ctx.createOscillator();
        const wallGain = this.ctx.createGain();
        wallSub.type = 'triangle';
        wallSub.frequency.setValueAtTime(160, now);
        wallSub.frequency.exponentialRampToValueAtTime(28, now + 0.38);
        wallGain.gain.setValueAtTime(0.65, now);
        wallGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        wallSub.connect(wallGain);
        wallGain.connect(this.masterGain);
        wallSub.start(now);
        wallSub.stop(now + 0.4);
        this.playFilteredNoise(0.35, 550, 0.45);
        break;
      }

      case 'DRIFT_BUMP': {
        // Screeching tire chirp blending into crisp bumper snap
        const chirp = this.ctx.createOscillator();
        const cGain = this.ctx.createGain();
        chirp.type = 'sawtooth';
        chirp.frequency.setValueAtTime(2200, now);
        chirp.frequency.exponentialRampToValueAtTime(1200, now + 0.18);
        cGain.gain.setValueAtTime(0.28, now);
        cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        chirp.connect(cGain);
        cGain.connect(this.masterGain);
        chirp.start(now);
        chirp.stop(now + 0.22);
        break;
      }

      case 'BOOST_CRASH': {
        // Rocket whoosh into heavy sub-bass drop
        this.playFilteredNoise(0.35, 1200, 0.4);
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(240, now + 0.04);
        sub.frequency.exponentialRampToValueAtTime(32, now + 0.4);
        subGain.gain.setValueAtTime(0.75, now + 0.04);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        sub.connect(subGain);
        subGain.connect(this.masterGain);
        sub.start(now + 0.04);
        sub.stop(now + 0.42);
        break;
      }

      case 'DOUBLE_IMPACT': {
        // Rapid double 808 kick punch
        [0, 0.065].forEach((offset) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(190, now + offset);
          osc.frequency.exponentialRampToValueAtTime(35, now + offset + 0.2);
          gain.gain.setValueAtTime(0.6, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.22);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + offset);
          osc.stop(now + offset + 0.22);
        });
        break;
      }

      case 'REVENGE': {
        // Victorious ascending fanfare triad (D5 -> F#5 -> A5 -> D6)
        const notes = [587.33, 739.99, 880.0, 1174.66];
        notes.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0.24, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.35);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.35);
        });
        break;
      }

      case 'CHAIN_BUMP': {
        // Domino rapid multi-tap percussion
        [0, 0.05, 0.1].forEach((offset, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(600 + idx * 200, now + offset);
          osc.frequency.exponentialRampToValueAtTime(150, now + offset + 0.08);
          gain.gain.setValueAtTime(0.22, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + offset);
          osc.stop(now + offset + 0.1);
        });
        break;
      }
    }
  }

  /**
   * High-speed aerodynamic wind whoosh for Near Miss / Close Call (PRD Section 22).
   */
  public playNearMiss(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Aerodynamic whoosh
    this.playFilteredNoise(0.28, 1400, 0.32);

    // Micro tire whip
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Pinned against wall alert buzz (PRD Section 23).
   */
  public playPinAlarm(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(420, now);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Dramatic Final Duel stinger when only 2 cars remain (PRD Section 24).
   */
  public playFinalDuel(): void {
    if (!this.ensureContext() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Deep sub drone
    const drone = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    drone.type = 'sawtooth';
    drone.frequency.setValueAtTime(55, now);
    droneGain.gain.setValueAtTime(0.01, now);
    droneGain.gain.linearRampToValueAtTime(0.4, now + 0.3);
    droneGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, now);
    filter.frequency.linearRampToValueAtTime(280, now + 0.6);
    filter.frequency.exponentialRampToValueAtTime(70, now + 1.8);

    drone.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(this.masterGain);
    drone.start(now);
    drone.stop(now + 1.8);

    // High tension bell ping
    const bell = this.ctx.createOscillator();
    const bellGain = this.ctx.createGain();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(1760, now + 0.1);
    bellGain.gain.setValueAtTime(0.3, now + 0.1);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    bell.connect(bellGain);
    bellGain.connect(this.masterGain);
    bell.start(now + 0.1);
    bell.stop(now + 1.2);
  }

  private playNoiseTransient(duration: number, volume: number): void {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1400, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start();
  }

  private playFilteredNoise(duration: number, centerFreq: number, volume: number): void {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerFreq, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
  }
}
