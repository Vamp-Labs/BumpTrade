/**
 * Procedural Web Audio synthesizer for arcade bumper car audio.
 * Zero external asset dependency; generates punchy arcade sounds dynamically.
 */

export class CarAudio {
  private ctx?: AudioContext;
  private engineOsc?: OscillatorNode;
  private engineGain?: GainNode;
  private isEnabled: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user interaction
    const initAudio = () => {
      if (!this.ctx) {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          this.ctx = new AudioContextClass();
          this.setupEngineSynth();
          this.isEnabled = true;
        } catch (e) {
          console.warn('[CarAudio] Web Audio API not supported or blocked.', e);
        }
      } else if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('keydown', initAudio);
      window.removeEventListener('pointerdown', initAudio);
    };

    window.addEventListener('keydown', initAudio);
    window.addEventListener('pointerdown', initAudio);
  }

  private setupEngineSynth(): void {
    if (!this.ctx) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();

    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime); // Low idle hum
    this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    // Subtle low-pass filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, this.ctx.currentTime);

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
  }

  public updateEngine(speedNormalized: number, isBoosting: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain) return;
    const now = this.ctx.currentTime;
    const targetFreq = 50 + speedNormalized * 120 + (isBoosting ? 60 : 0);
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.engineGain.gain.setTargetAtTime(0.03 + speedNormalized * 0.04, now, 0.08);
  }

  public playImpactSound(intensity: number): void {
    if (!this.ctx || !this.isEnabled) return;
    const now = this.ctx.currentTime;

    // 1. Low Thud (Punch)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 + intensity * 60, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.25);

    const volume = Math.min(0.2 + intensity * 0.4, 0.6);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);

    // 2. Metallic Clang / Bumper Snap
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'square';
    snapOsc.frequency.setValueAtTime(420 + intensity * 200, now);
    snapOsc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

    snapGain.gain.setValueAtTime(volume * 0.35, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    snapOsc.connect(snapGain);
    snapGain.connect(this.ctx.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.15);
  }

  public playBoostSound(): void {
    if (!this.ctx || !this.isEnabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(550, now + 0.25);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  public dispose(): void {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch (_) {}
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch (_) {}
    }
  }
}
