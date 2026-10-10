import { EventBus } from '../core/EventBus';
import { SoundManager } from '../audio/SoundManager';

export interface ComboState {
  comboCount: number;
  multiplier: number;
  timeLeft: number;
  maxWindow: number;
  title: string;
  subtitle: string;
  isCombo: boolean;
}

export class ComboManager {
  private static instance: ComboManager;

  private comboCount: number = 0;
  private comboTimer: number = 0;
  private readonly comboWindow: number = 4.5; // 4.5s window per PRD Section 8

  private constructor() {}

  public static get(): ComboManager {
    if (!ComboManager.instance) {
      ComboManager.instance = new ComboManager();
    }
    return ComboManager.instance;
  }

  /**
   * Registers a bump event.
   * If the player was the attacker, progresses the consecutive bump combo.
   */
  public registerBump(attackerId: string, _victimId: string): ComboState {
    const isPlayer = attackerId === 'player_car';

    if (!isPlayer) {
      return this.getState();
    }

    if (this.comboTimer > 0) {
      this.comboCount += 1;
    } else {
      this.comboCount = 1;
    }

    this.comboTimer = this.comboWindow;

    const state = this.getState();

    // Trigger escalating audio chimes
    SoundManager.get().playComboBump(this.comboCount);

    // Emit event for UI & combat subsystems
    EventBus.get().emit('combo_updated', state);

    return state;
  }

  /**
   * Resets combo if player receives a major impact as victim (PRD Section 8).
   */
  public onPlayerHitAsVictim(tier: string): void {
    if (this.comboCount <= 0) return;
    if (tier === 'HEAVY' || tier === 'PERFECT' || tier === 'CRITICAL') {
      const prev = this.comboCount;
      this.comboCount = 0;
      this.comboTimer = 0;
      if (prev >= 2) {
        EventBus.get().emit('combo_lost', {
          lastCombo: prev,
          reason: 'MAJOR_IMPACT',
        });
      }
    }
  }

  public update(dt: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;

      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        const previousCount = this.comboCount;
        this.comboCount = 0;

        if (previousCount >= 2) {
          EventBus.get().emit('combo_lost', {
            lastCombo: previousCount,
            reason: 'TIMEOUT',
          });
        }
      }
    }
  }

  public reset(): void {
    this.comboCount = 0;
    this.comboTimer = 0;
    EventBus.get().emit('combo_reset');
  }

  public getMultiplier(): number {
    // Multipliers per PRD Section 8: BUMP x1.0, DOUBLE x1.25, TRIPLE x1.5, MEGA x2.0
    if (this.comboCount <= 1) return 1.0;
    if (this.comboCount === 2) return 1.25;
    if (this.comboCount === 3) return 1.5;
    return 2.0; // 4+ MEGA COMBO
  }

  public getState(): ComboState {
    const mult = this.getMultiplier();
    let title = 'BUMP!';
    let subtitle = 'STEAL ×1.0';

    if (this.comboCount === 2) {
      title = '🔥 DOUBLE BUMP!';
      subtitle = 'STEAL ×1.25 MULTIPLIER';
    } else if (this.comboCount === 3) {
      title = '⚡ TRIPLE BUMP!';
      subtitle = 'STEAL ×1.5 MULTIPLIER';
    } else if (this.comboCount >= 4) {
      title = '💥 MEGA COMBO!';
      subtitle = 'STEAL ×2.0 MULTIPLIER';
    }

    return {
      comboCount: this.comboCount,
      multiplier: mult,
      timeLeft: Math.max(0, this.comboTimer),
      maxWindow: this.comboWindow,
      title,
      subtitle,
      isCombo: this.comboCount >= 2,
    };
  }
}
