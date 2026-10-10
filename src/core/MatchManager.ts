import { EventBus } from './EventBus';
import { SoundManager } from '../audio/SoundManager';
import { ArenaEvents } from '../arena/ArenaEvents';
import { PowerUpManager } from '../pickups/PowerUpManager';
import { PickupManager } from '../pickups/PickupManager';
import { GameplayHUD } from '../ui/GameplayHUD';

export type MatchState = 'NOT_STARTED' | 'IN_PROGRESS' | 'FREEZE' | 'COMPLETED';

export class MatchManager {
  private totalDuration: number = 90.0; // 90 seconds standard round
  private timeRemaining: number = 90.0;
  private state: MatchState = 'NOT_STARTED';

  // Subsystems
  private arenaEvents: ArenaEvents;
  private powerUpManager: PowerUpManager;
  private pickupManager: PickupManager;
  private gameplayHUD: GameplayHUD;
  private hitStopHook?: (duration: number) => void;

  // Trigger flags to ensure events execute once per round
  private triggered20sFire: boolean = false;
  private triggered40sFire: boolean = false;
  private triggeredMarketDrop: boolean = false;
  private triggeredDoubleStealSurge: boolean = false;
  private triggeredMinorEvent: boolean = false;
  private triggeredFinal20: boolean = false;
  private lastTickedSecond: number = -1;
  private telegraphedSurgeSecond: number = -1;
  private telegraphedMarketDropSecond: number = -1;

  // Final 20s pyrotechnic timer
  private finalFrenzyFireTimer: number = 0;

  constructor(
    arenaEvents: ArenaEvents,
    powerUpManager: PowerUpManager,
    pickupManager: PickupManager,
    gameplayHUD: GameplayHUD,
    hitStopHook?: (duration: number) => void
  ) {
    this.arenaEvents = arenaEvents;
    this.powerUpManager = powerUpManager;
    this.pickupManager = pickupManager;
    this.gameplayHUD = gameplayHUD;
    this.hitStopHook = hitStopHook;
  }

  public setHitStopHook(hook: (duration: number) => void): void {
    this.hitStopHook = hook;
  }

  public getPickupManager(): PickupManager {
    return this.pickupManager;
  }

  public startMatch(): void {
    this.timeRemaining = this.totalDuration;
    this.state = 'IN_PROGRESS';
    this.resetEventFlags();

    this.gameplayHUD.setRoundTime(this.totalDuration);
    this.gameplayHUD.resetRoundTimer();

    // Spawn 2 initial powerups into arena at round start
    this.powerUpManager.spawnRandomPowerUp(-9, -6);
    this.powerUpManager.spawnRandomPowerUp(9, 6);

    EventBus.get().emit('match_started', { duration: this.totalDuration });
    console.log('[MatchManager] Match started (90s)');
  }

  public resetMatch(): void {
    this.timeRemaining = this.totalDuration;
    this.state = 'IN_PROGRESS';
    this.resetEventFlags();
    this.powerUpManager.clearAll();

    this.gameplayHUD.setRoundTime(this.totalDuration);
    this.gameplayHUD.resetRoundTimer();

    this.powerUpManager.spawnRandomPowerUp(-9, -6);
    this.powerUpManager.spawnRandomPowerUp(9, 6);

    EventBus.get().emit('match_started', { duration: this.totalDuration });
  }

  private resetEventFlags(): void {
    this.triggered20sFire = false;
    this.triggered40sFire = false;
    this.triggeredMarketDrop = false;
    this.triggeredDoubleStealSurge = false;
    this.triggeredMinorEvent = false;
    this.triggeredFinal20 = false;
    this.lastTickedSecond = -1;
    this.telegraphedSurgeSecond = -1;
    this.telegraphedMarketDropSecond = -1;
    this.finalFrenzyFireTimer = 0;
  }

  public update(dt: number): void {
    if (this.state !== 'IN_PROGRESS') return;

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    const elapsed = this.totalDuration - this.timeRemaining;

    // --- 1. PERIODIC 20s ARENA PULSES (0-60s) ---
    // Pulse 1 at ~20s elapsed
    if (elapsed >= 20.0 && !this.triggered20sFire) {
      this.triggered20sFire = true;
      this.arenaEvents.triggerFireBurst();
      this.gameplayHUD.enqueueNotification('🔥', 'ARENA HAZARD: FIRE BURST', 'PYROTECHNICS ACTIVE', 'info');
    }

    // Pulse 2 at ~40s elapsed
    if (elapsed >= 40.0 && !this.triggered40sFire) {
      this.triggered40sFire = true;
      this.arenaEvents.triggerFireBurst();
      this.gameplayHUD.enqueueNotification('🔥', 'ARENA HAZARD: FIRE BURST', 'PYROTECHNICS ACTIVE', 'info');
    }

    // --- 2. MARKET DROP: 3s TELEGRAPH & SPAWN (at 50s elapsed) ---
    // Telegraph 3 seconds in advance (47.0s - 50.0s elapsed)
    if (elapsed >= 47.0 && elapsed < 50.0 && !this.triggeredMarketDrop) {
      const countdown = Math.ceil(50.0 - elapsed);
      if (countdown !== this.telegraphedMarketDropSecond && countdown > 0) {
        this.telegraphedMarketDropSecond = countdown;
        SoundManager.get().playMarketTelegraph(countdown);
        EventBus.get().emit('market_event_telegraph', {
          secondsLeft: countdown,
          eventName: 'MARKET DROP',
          subtitle: '4 MYSTERY POWER-UPS SPAWNING',
          isFinal: false,
        });
      }
    }

    if (elapsed >= 50.0 && !this.triggeredMarketDrop) {
      this.triggeredMarketDrop = true;
      SoundManager.get().playMarketTelegraph(0, true);
      this.powerUpManager.spawnMarketDropBatch();
      EventBus.get().emit('market_event_telegraph', {
        secondsLeft: 0,
        eventName: 'MARKET DROP',
        subtitle: '4 POWER-UPS ACTIVE IN ARENA!',
        isFinal: true,
      });
      this.gameplayHUD.enqueueNotification('⚡', 'MARKET DROP INCOMING', '4 POWER-UPS SPAWNED IN ARENA', 'info');
    }

    // --- 3. FIRST MAJOR MARKET EVENT: DOUBLE STEAL SURGE (~60s elapsed / 30s left) ---
    // Telegraph 3 seconds in advance (57.0s - 60.0s elapsed)
    if (elapsed >= 57.0 && elapsed < 60.0 && !this.triggeredDoubleStealSurge) {
      const countdown = Math.ceil(60.0 - elapsed);
      if (countdown !== this.telegraphedSurgeSecond && countdown > 0) {
        this.telegraphedSurgeSecond = countdown;
        SoundManager.get().playMarketTelegraph(countdown);
        EventBus.get().emit('market_event_telegraph', {
          secondsLeft: countdown,
          eventName: 'DOUBLE STEAL SURGE',
          subtitle: 'RAM IMPACTS WILL EXTRACT 2× CASH',
          isFinal: false,
        });
      }
    }

    if (elapsed >= 60.0 && !this.triggeredDoubleStealSurge) {
      this.triggeredDoubleStealSurge = true;
      SoundManager.get().playMarketTelegraph(0, true);
      this.arenaEvents.triggerDoubleStealSurge();
      EventBus.get().emit('market_event_telegraph', {
        secondsLeft: 0,
        eventName: 'DOUBLE STEAL SURGE',
        subtitle: 'ALL RAM IMPACTS EXTRACT 2× CASH!',
        isFinal: true,
      });
      this.gameplayHUD.enqueueNotification('⚡', 'DOUBLE STEAL SURGE', 'ALL IMPACTS EXTRACT 2× CASH!', 'info');
    }

    // Minor event at ~66s elapsed (Market Flash or Market Crash)
    if (elapsed >= 66.0 && !this.triggeredMinorEvent) {
      this.triggeredMinorEvent = true;
      if (Math.random() > 0.5) {
        this.arenaEvents.triggerMarketCrash();
        this.gameplayHUD.enqueueNotification('⚠️', 'MARKET CRASH', '$HOOD -6.4% ▼ // PRESSURE RISING', 'info');
      } else {
        this.arenaEvents.triggerMarketFlash();
        this.gameplayHUD.enqueueNotification('📈', 'MARKET FLASH', '$NVDA ▲ +18.7%  |  $HOOD ▲', 'info');
      }
    }

    // --- 4. FINAL 20 SECONDS (00:20 remaining) ---
    if (this.timeRemaining <= 20.0 && !this.triggeredFinal20) {
      this.triggeredFinal20 = true;
      this.arenaEvents.triggerFireBurst();
      this.gameplayHUD.enqueueNotification('🚨', 'FINAL 20 SECONDS!', 'MAXIMUM VOLATILITY & PYROS', 'info');
      EventBus.get().emit('final_20_started');
    }

    // Escalating pyrotechnics during Final 20
    if (this.triggeredFinal20 && this.timeRemaining > 10.0) {
      this.finalFrenzyFireTimer += dt;
      if (this.finalFrenzyFireTimer >= 6.5) {
        this.finalFrenzyFireTimer = 0;
        if (!this.arenaEvents.isFireActive()) {
          this.arenaEvents.triggerFireBurst();
        }
      }
    }

    // --- 5. FINAL 10 SECONDS PULSING COUNTDOWN (00:10 remaining) ---
    if (this.timeRemaining <= 10.0 && this.timeRemaining > 0) {
      const currentIntSecond = Math.ceil(this.timeRemaining);
      if (currentIntSecond !== this.lastTickedSecond) {
        this.lastTickedSecond = currentIntSecond;
        SoundManager.get().playFinalTenCountdown(currentIntSecond);
        this.gameplayHUD.showCountdownTick(currentIntSecond);
      }
    }

    // --- 6. MATCH END (00:00) ---
    if (this.timeRemaining <= 0 && this.state === 'IN_PROGRESS') {
      this.handleMatchComplete();
    }
  }

  private handleMatchComplete(): void {
    this.state = 'FREEZE';
    console.log('[MatchManager] Round Complete! Triggering freeze & stinger');

    // 0.4s action freeze hit-stop
    if (this.hitStopHook) {
      this.hitStopHook(0.4);
    }

    // Triumphant round end stinger audio
    SoundManager.get().playRoundComplete();

    // Show ROUND COMPLETE banner on HUD
    this.gameplayHUD.showRoundCompleteBanner();

    // Transition to Match Podium Result screen after brief 0.5s freeze
    setTimeout(() => {
      this.state = 'COMPLETED';
      EventBus.get().emit('match_completed');
      this.gameplayHUD.showResultModal();
    }, 550);
  }

  public endMatchEarly(): void {
    if (this.state === 'IN_PROGRESS') {
      this.handleMatchComplete();
    }
  }

  public getTimeRemaining(): number {
    return this.timeRemaining;
  }

  public getElapsedTime(): number {
    return this.totalDuration - this.timeRemaining;
  }

  public getState(): MatchState {
    return this.state;
  }
}
