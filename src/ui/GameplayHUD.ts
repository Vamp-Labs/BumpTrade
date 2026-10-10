import * as THREE from 'three';
import { HeroCar } from '../vehicles/HeroCar';
import { VehicleType, VehicleArchetypeConfig } from '../vehicles/VehicleTypes';
import { EventBus } from '../core/EventBus';
import { CollisionEvent } from '../collision/CollisionTypes';
import { PowerUpType, POWER_UP_CONFIGS } from '../pickups/PowerUpTypes';
import { ComboManager, ComboState } from '../combat/ComboManager';
import { BountySystem } from '../combat/BountySystem';
import { MotionFX } from './MotionFX';
import './GameplayHUD.css';

interface NotificationItem {
  icon: string;
  title: string;
  subtitle: string;
  type: 'bump' | 'pickup' | 'liquidation' | 'info';
}

export interface RankingRowData {
  id: string;
  name: string;
  cash: number;
  isPlayer: boolean;
  rank: number;
  isEliminated?: boolean;
  bountyTier?: string;
}

interface FloatingTextItem {
  id: string;
  el: HTMLElement;
  position: THREE.Vector3;
  amount: number;
  isGain: boolean;
  age: number;
  duration: number;
  textPrefix?: string;
}

export class GameplayHUD {
  private container: HTMLElement;
  private isVisible: boolean = false;

  // Bag Card DOM handles
  private bagAmountEl: HTMLElement;
  private bagDeltaEl: HTMLElement;
  private stockTickerEl: HTMLElement;
  private stockChangeEl: HTMLElement;
  private stockIconEl: HTMLElement;
  private bagCardEl!: HTMLElement;
  private criticalBagTagEl!: HTMLElement;

  // Spectator Card DOM handles
  private spectatorCardEl!: HTMLElement;
  private spectatorFinishEl!: HTMLElement;
  private spectatorTargetNameEl!: HTMLElement;
  private spectatorTargetCashEl!: HTMLElement;
  private spectatorCrownEl!: HTMLElement;
  public onSpectatorCyclePrev?: () => void;
  public onSpectatorCycleNext?: () => void;

  // Timer DOM handles
  private timerDigitsEl: HTMLElement;
  private timerContainerEl: HTMLElement;
  private roundDuration: number = 90.0; // 90 seconds standard round
  private roundTimer: number = 90.0;
  private onlineMode: boolean = false;
  private onlineRoundSeconds: number = 0;
  private onlineRanking: RankingRowData[] | null = null;
  private onlineNames: Map<string, string> = new Map();

  // Bump Combo Banner DOM handles
  private comboBannerEl: HTMLElement;
  private comboTitleEl: HTMLElement;
  private comboSubEl: HTMLElement;
  private comboFillEl: HTMLElement;
  private comboBannerTimeout?: number;

  // Market Event Telegraph DOM handles
  private telegraphBannerEl: HTMLElement;
  private telegraphCountdownEl: HTMLElement;
  private telegraphTitleEl: HTMLElement;
  private telegraphSubEl: HTMLElement;
  private telegraphTimeout?: number;

  // Ranking Card DOM handles
  private rankPosEl: HTMLElement;
  private rankingListEl: HTMLElement;
  private rankingExpandBtn: HTMLElement;
  private isRankingExpanded: boolean = false;

  // Dual Status Bar DOM handles
  private statusBarEl: HTMLElement;
  private hpFillEl: HTMLElement;
  private hpPctEl: HTMLElement;
  private boostSegmentEl: HTMLElement;
  private boostFillEl: HTMLElement;
  private boostPctEl: HTMLElement;

  // Damage Vignette DOM handle
  private damageVignetteEl: HTMLElement;
  private damageFlashTimeout?: number;

  // Center Notifications & Popups
  private notifCardEl: HTMLElement;
  private notifMainEl: HTMLElement;
  private notifSubEl: HTMLElement;
  private bumpPopupEl: HTMLElement;
  private bumpTextEl: HTMLElement;
  private bumpCashEl: HTMLElement;

  // Ephemeral Notification Queue
  private notifQueue: NotificationItem[] = [];
  private isNotifActive: boolean = false;
  private bumpPopupTimeout?: number;

  // In-World Nameplates & Floating Numbers
  private worldLabelsContainer: HTMLElement;
  private worldLabels: Map<string, HTMLElement> = new Map();
  private floatingTexts: FloatingTextItem[] = [];
  private tempProjectVec: THREE.Vector3 = new THREE.Vector3();

  // Active Power-Ups Row
  private powerupsBarEl: HTMLElement;

  // Final 10s Countdown Tick & Round Complete Banner
  private countdownTickEl: HTMLElement;
  private roundCompleteBannerEl: HTMLElement;

  // Match Result Podium Modal
  private resultModalEl: HTMLElement;
  private resultPodiumEl: HTMLElement;
  private btnPlayAgain: HTMLElement;
  private btnGarage: HTMLElement;
  private lastRankings: RankingRowData[] = [];

  // Callbacks for Result Modal
  public onPlayAgain?: () => void;
  public onReturnToGarage?: () => void;

  // Live Cars Registry for Dead Vehicle Detection
  private currentCarsMap: Map<string, HeroCar> = new Map();

  private isCarEliminated(id?: string): boolean {
    if (!id) return false;
    const car = this.currentCarsMap.get(id);
    return car ? car.controller.isEliminated() : false;
  }

  // Cash lerping
  private currentDisplayedCash: number = 85;
  private targetCash: number = 85;
  private deltaFadeTimeout?: number;

  // Stock movement simulation
  private stockTicker: string = '$HOOD';
  private stockDeltaPct: number = 2.8;
  private isStockPositive: boolean = true;
  private stockJitterTimer: number = 0;

  // Controls guide
  private controlsPanelEl: HTMLElement;
  private controlsToggleBtn: HTMLElement;
  private isControlsOpen: boolean = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'gameplay-hud';
    this.container.className = 'hidden';

    this.buildDOM();
    document.body.appendChild(this.container);

    // Initial handles
    this.bagAmountEl = this.container.querySelector('#hud-bag-amount')!;
    this.bagDeltaEl = this.container.querySelector('#hud-bag-delta')!;
    this.stockTickerEl = this.container.querySelector('#hud-stock-ticker')!;
    this.stockChangeEl = this.container.querySelector('#hud-stock-change')!;
    this.stockIconEl = this.container.querySelector('#hud-stock-icon')!;
    this.bagCardEl = this.container.querySelector('.hud-bag-card')!;
    this.criticalBagTagEl = this.container.querySelector('#hud-critical-bag-tag')!;

    this.spectatorCardEl = this.container.querySelector('#hud-spectator-card')!;
    this.spectatorFinishEl = this.container.querySelector('#hud-spectator-finish')!;
    this.spectatorTargetNameEl = this.container.querySelector('#hud-spectator-name')!;
    this.spectatorTargetCashEl = this.container.querySelector('#hud-spectator-cash')!;
    this.spectatorCrownEl = this.container.querySelector('#hud-spectator-crown')!;

    const specPrev = this.container.querySelector('#hud-spec-prev');
    const specNext = this.container.querySelector('#hud-spec-next');
    if (specPrev) specPrev.addEventListener('click', (e) => { e.stopPropagation(); if (this.onSpectatorCyclePrev) this.onSpectatorCyclePrev(); });
    if (specNext) specNext.addEventListener('click', (e) => { e.stopPropagation(); if (this.onSpectatorCycleNext) this.onSpectatorCycleNext(); });

    this.timerContainerEl = this.container.querySelector('#hud-round-timer')!;
    this.timerDigitsEl = this.container.querySelector('#hud-timer-digits')!;

    this.comboBannerEl = this.container.querySelector('#hud-combo-banner')!;
    this.comboTitleEl = this.container.querySelector('#hud-combo-title')!;
    this.comboSubEl = this.container.querySelector('#hud-combo-sub')!;
    this.comboFillEl = this.container.querySelector('#hud-combo-fill')!;

    this.telegraphBannerEl = this.container.querySelector('#hud-market-telegraph')!;
    this.telegraphCountdownEl = this.container.querySelector('#hud-telegraph-countdown')!;
    this.telegraphTitleEl = this.container.querySelector('#hud-telegraph-title')!;
    this.telegraphSubEl = this.container.querySelector('#hud-telegraph-sub')!;

    this.rankPosEl = this.container.querySelector('#hud-rank-pos')!;
    this.rankingListEl = this.container.querySelector('#hud-ranking-list')!;
    this.rankingExpandBtn = this.container.querySelector('#hud-ranking-expand')!;

    this.statusBarEl = this.container.querySelector('#hud-status-bar')!;
    this.hpFillEl = this.container.querySelector('#hud-hp-fill')!;
    this.hpPctEl = this.container.querySelector('#hud-hp-pct')!;
    this.boostSegmentEl = this.container.querySelector('#hud-boost-segment')!;
    this.boostFillEl = this.container.querySelector('#hud-boost-fill')!;
    this.boostPctEl = this.container.querySelector('#hud-boost-pct')!;

    this.damageVignetteEl = this.container.querySelector('#hud-damage-vignette')!;

    this.notifCardEl = this.container.querySelector('#hud-notification-card')!;
    this.notifMainEl = this.container.querySelector('#hud-notification-main')!;
    this.notifSubEl = this.container.querySelector('#hud-notification-sub')!;

    this.bumpPopupEl = this.container.querySelector('#hud-bump-popup')!;
    this.bumpTextEl = this.container.querySelector('#hud-bump-text')!;
    this.bumpCashEl = this.container.querySelector('#hud-bump-cash')!;

    this.worldLabelsContainer = this.container.querySelector('#hud-world-labels-container')!;

    this.powerupsBarEl = this.container.querySelector('#hud-powerups-bar')!;
    this.countdownTickEl = this.container.querySelector('#hud-countdown-tick')!;
    this.roundCompleteBannerEl = this.container.querySelector('#hud-round-complete-banner')!;

    this.resultModalEl = this.container.querySelector('#hud-result-modal')!;
    this.resultPodiumEl = this.container.querySelector('#hud-result-podium')!;
    this.btnPlayAgain = this.container.querySelector('#hud-btn-play-again')!;
    this.btnGarage = this.container.querySelector('#hud-btn-garage')!;

    this.controlsPanelEl = this.container.querySelector('#controls-guide-panel')!;
    this.controlsToggleBtn = this.container.querySelector('#controls-toggle-btn')!;

    this.setupEventListeners();
    this.setupControlsToggle();
    this.setupResultModalActions();
  }

  private buildDOM(): void {
    this.container.innerHTML = `
      <!-- Red screen edge vignette flash on damage -->
      <div class="hud-damage-vignette" id="hud-damage-vignette"></div>

      <!-- In-world floating car nameplates layer -->
      <div class="hud-world-labels-container" id="hud-world-labels-container"></div>

      <!-- TOP-LEFT: Bag / Stock Card -->
      <div class="hud-bag-card">
        <div class="hud-bag-header">
          <span class="hud-bag-title">YOUR BAG</span>
        </div>
        <div class="hud-bag-main">
          <span class="hud-bag-amount" id="hud-bag-amount">$85</span>
          <span class="hud-bag-delta positive faded" id="hud-bag-delta">+$0</span>
        </div>
        <div class="hud-stock-badge">
          <span class="hud-stock-icon" id="hud-stock-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </span>
          <span class="hud-stock-ticker" id="hud-stock-ticker">$HOOD</span>
          <span class="hud-stock-change positive" id="hud-stock-change">+2.8% ▲</span>
        </div>
        <div class="hud-critical-bag-tag hidden" id="hud-critical-bag-tag">
          ⚠️ CRITICAL: ONE HIT FROM LIQUIDATION
        </div>
      </div>

      <!-- TOP-CENTER: Premium Floating Glass Countdown Pill -->
      <div class="hud-round-timer" id="hud-round-timer">
        <span class="hud-timer-badge">ROUND</span>
        <span class="hud-timer-dot">•</span>
        <span class="hud-timer-digits" id="hud-timer-digits">01:30</span>
      </div>

      <!-- SPECTATOR MODE CARD (PRD Section 12) -->
      <div class="hud-spectator-card hidden" id="hud-spectator-card" style="display: none;">
        <div class="hud-spectator-header">
          <span class="hud-spectator-skull">💀</span>
          <span class="hud-spectator-badge">LIQUIDATED</span>
          <span class="hud-spectator-divider">•</span>
          <span class="hud-spectator-finish" id="hud-spectator-finish">Finished #4 / 5</span>
        </div>
        <div class="hud-spectator-watching">
          <span class="hud-spectator-label">WATCHING:</span>
          <span class="hud-spectator-name" id="hud-spectator-name">Diamond_Hands</span>
          <span class="hud-spectator-cash" id="hud-spectator-cash">$420</span>
          <span class="hud-spectator-crown" id="hud-spectator-crown">👑</span>
        </div>
        <div class="hud-spectator-nav">
          <button class="hud-spec-nav-btn" id="hud-spec-prev" title="Previous Survivor">◄</button>
          <span class="hud-spec-hint">Use ◄ / ► or A / D to cycle</span>
          <button class="hud-spec-nav-btn" id="hud-spec-next" title="Next Survivor">►</button>
        </div>
      </div>

      <!-- TOP-CENTER (BELOW TIMER): Bump Combo Banner -->
      <div class="hud-combo-banner hidden" id="hud-combo-banner">
        <div class="hud-combo-content">
          <div class="hud-combo-title" id="hud-combo-title">🔥 DOUBLE BUMP!</div>
          <div class="hud-combo-sub" id="hud-combo-sub">STEAL ×2</div>
        </div>
        <div class="hud-combo-track">
          <div class="hud-combo-fill" id="hud-combo-fill" style="width: 100%;"></div>
        </div>
      </div>

      <!-- CENTER: Telegraphed Market Event Banner -->
      <div class="hud-market-telegraph hidden" id="hud-market-telegraph">
        <div class="hud-telegraph-card">
          <div class="hud-telegraph-header">
            <span class="hud-telegraph-pulse-dot"></span>
            <span class="hud-telegraph-badge">MARKET EVENT INCOMING</span>
          </div>
          <div class="hud-telegraph-countdown" id="hud-telegraph-countdown">3</div>
          <div class="hud-telegraph-title" id="hud-telegraph-title">⚡ DOUBLE STEAL SURGE!</div>
          <div class="hud-telegraph-sub" id="hud-telegraph-sub">ALL RAM IMPACTS EXTRACT 2× CASH</div>
        </div>
      </div>

      <!-- CENTER: Ephemeral Event Notifications -->
      <div class="hud-notification-container" id="hud-notification-container">
        <div class="hud-notification-card" id="hud-notification-card">
          <div class="hud-notification-main" id="hud-notification-main">💥 YOU BUMPED TESLA_DEGEN</div>
          <div class="hud-notification-sub" id="hud-notification-sub">+$24 DROPPED</div>
        </div>
      </div>

      <!-- ARCADE IMPACT PUNCH: BUMP! popup -->
      <div class="hud-bump-popup" id="hud-bump-popup">
        <div class="hud-bump-text" id="hud-bump-text">BUMP!</div>
        <div class="hud-bump-cash positive" id="hud-bump-cash">+$24</div>
      </div>

      <!-- TOP-RIGHT: Player Ranking Card -->
      <div class="hud-ranking-card" id="hud-ranking-card">
        <div class="hud-ranking-header">
          <div class="hud-rank-pill">
            <span class="hud-trophy-icon">🏆</span>
            <span id="hud-rank-pos">#3 / 5</span>
          </div>
          <span class="hud-ranking-title">LEADERBOARD</span>
        </div>
        <div class="hud-ranking-list" id="hud-ranking-list"></div>
        <div class="hud-ranking-expand" id="hud-ranking-expand" title="Toggle full ranking">
          <span>⌄</span>
        </div>
      </div>

      <!-- BOTTOM-CENTER: Dual Status Bar (HP & Boost) -->
      <div class="hud-status-bar" id="hud-status-bar">
        <!-- 🛡 HP -->
        <div class="hud-status-segment hud-hp-segment" id="hud-hp-segment">
          <div class="hud-status-icon hud-hp-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/>
            </svg>
          </div>
          <span class="hud-status-label">$BAG</span>
          <div class="hud-bar-track">
            <div class="hud-bar-fill hud-hp-fill" id="hud-hp-fill" style="width: 100%;"></div>
          </div>
          <span class="hud-status-pct" id="hud-hp-pct">100%</span>
        </div>

        <div class="hud-status-divider"></div>

        <!-- ⚡ BOOST -->
        <div class="hud-status-segment hud-boost-segment" id="hud-boost-segment">
          <div class="hud-status-icon hud-boost-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M11 21h-1l1-7H7.5c-.88 0-.33-.75-.31-.78C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .77.34.62.64L11 21z"/>
            </svg>
          </div>
          <span class="hud-status-label">BOOST</span>
          <div class="hud-bar-track">
            <div class="hud-bar-fill hud-boost-fill" id="hud-boost-fill" style="width: 100%;"></div>
          </div>
          <span class="hud-status-pct" id="hud-boost-pct">100%</span>
        </div>
      </div>

      <!-- BOTTOM-LEFT: Non-intrusive Collapsible Controls Guide -->
      <div class="controls-guide-compact" id="controls-guide-compact">
        <div class="controls-toggle-btn" id="controls-toggle-btn">
          <span class="key-hint">H</span> CONTROLS
        </div>
        <div class="controls-guide-panel hidden" id="controls-guide-panel">
          <div><span class="key">W</span> / <span class="key">S</span> — ACCELERATE / REVERSE</div>
          <div><span class="key">A</span> / <span class="key">D</span> — STEER LEFT / RIGHT</div>
          <div><span class="key">SPACE</span> — BOOST (HIGH SPEED + HEAVY IMPACT)</div>
          <div><span class="key">V</span> — CYCLE PLAYER VEHICLE</div>
          <div><span class="key">B</span> — CYCLE OPPONENT ARCHETYPE</div>
          <div><span class="key">T</span> — TOGGLE OPPONENT AI (COMBAT / PRACTICE)</div>
          <div><span class="key">C</span> — TOGGLE CAMERA (OVERVIEW / CHASE / INSPECT)</div>
          <div><span class="key">R</span> — RESET CARS TO CENTER</div>
          <div><span class="key">F1</span> or <span class="key">\`</span> — TOGGLE DEBUG INFO</div>
        </div>
      </div>

      <!-- ACTIVE POWER-UPS BADGES ROW (Below status bar) -->
      <div class="hud-powerups-bar" id="hud-powerups-bar"></div>

      <!-- FINAL 10s COUNTDOWN TICK PUNCH -->
      <div class="hud-countdown-tick" id="hud-countdown-tick">10</div>

      <!-- ROUND COMPLETE BANNER -->
      <div class="hud-round-complete-banner" id="hud-round-complete-banner">
        <div class="hud-complete-glitch">ROUND COMPLETE</div>
        <div class="hud-complete-sub">FINAL SETTLEMENT CALCULATED</div>
      </div>

      <!-- MATCH RESULT PODIUM MODAL (Panel 11 style) -->
      <div class="hud-result-modal hidden" id="hud-result-modal">
        <div class="hud-result-backdrop"></div>
        <div class="hud-result-card">
          <div class="hud-result-header">
            <div class="hud-result-trophy">🏆</div>
            <div class="hud-result-title">MATCH RESULT</div>
            <div class="hud-result-subtitle">ROUND 01 SETTLEMENT COMPLETED</div>
          </div>
          <div class="hud-result-podium" id="hud-result-podium"></div>
          <div class="hud-result-actions">
            <button class="hud-btn hud-btn-play-again" id="hud-btn-play-again">
              <span>🔄 PLAY AGAIN</span>
            </button>
            <button class="hud-btn hud-btn-garage" id="hud-btn-garage">
              <span>🏎 CHANGE VEHICLE</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private setupControlsToggle(): void {
    this.controlsToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleControlsGuide();
    });

    this.rankingExpandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isRankingExpanded = !this.isRankingExpanded;
      this.rankingExpandBtn.querySelector('span')!.innerText = this.isRankingExpanded ? '⌃' : '⌄';
    });

    window.addEventListener('keydown', (e) => {
      if (!this.isVisible) return;
      if (e.key === 'h' || e.key === 'H') {
        this.toggleControlsGuide();
      }
    });
  }

  public toggleControlsGuide(): void {
    this.isControlsOpen = !this.isControlsOpen;
    if (this.isControlsOpen) {
      this.controlsPanelEl.classList.remove('hidden');
      this.controlsPanelEl.style.display = 'block';
    } else {
      this.controlsPanelEl.classList.add('hidden');
      this.controlsPanelEl.style.display = 'none';
    }
  }

  private setupEventListeners(): void {
    // 1. Collision Events (PRD Crash & Feedback Stack)
    EventBus.get().on<CollisionEvent>('collision', (event) => {
      if (!this.isVisible) return;

      // RULE: When hitting a wall, do NOT add any text effect
      if (event.isWall || event.victimId === 'wall' || event.attackerId === 'wall') {
        return;
      }

      // RULE: When hitting a player that is already dead, do NOT add any text effect
      if (event.isVictimDead || event.isAttackerDead) {
        return;
      }
      if (this.isCarEliminated(event.victimId) || this.isCarEliminated(event.attackerId)) {
        return;
      }

      const isPlayerAttacker = event.attackerId === 'player_car';
      const isPlayerVictim = event.victimId === 'player_car';

      const stolenCash = event.stolenCash ?? (event.tier === 'CRITICAL' ? 35 : event.tier === 'PERFECT' ? 35 : event.tier === 'HEAVY' ? 20 : 8);
      const comboCount = event.comboCount ?? 1;
      const multiplier = event.comboMultiplier ?? 1.0;
      const primarySkill = event.skillMoments && event.skillMoments.length > 0 ? event.skillMoments[0] : undefined;

      let title = 'BUMP!';
      if (primarySkill) {
        title = this.formatSkillTitle(primarySkill);
      } else if (event.tier === 'PERFECT') {
        title = 'PERFECT BUMP!';
      } else if (event.tier === 'CRITICAL') {
        title = 'CRITICAL HIT!';
      } else if (event.tier === 'HEAVY') {
        title = 'HEAVY HIT!';
      }

      if (isPlayerAttacker) {
        const victimName = this.formatVehicleHandle(event.victimId);

        this.triggerBumpPopup(stolenCash, true, title, primarySkill, comboCount, multiplier);

        // World floating text with skill prefix
        let floatPrefix = '';
        if (primarySkill === 'COUNTER_CRASH') floatPrefix = 'COUNTER! ';
        else if (primarySkill === 'PERFECT_BUMP' || event.tier === 'PERFECT') floatPrefix = 'PERFECT! ';
        else if (primarySkill === 'BANK_SHOT') floatPrefix = 'BANK SHOT! ';
        else if (primarySkill === 'DRIFT_BUMP') floatPrefix = 'DRIFT! ';
        else if (primarySkill === 'BOOST_CRASH') floatPrefix = 'BOOST! ';
        else if (primarySkill === 'DOUBLE_IMPACT') floatPrefix = 'DOUBLE! ';
        else if (primarySkill === 'REVENGE') floatPrefix = 'REVENGE! ';
        else if (primarySkill === 'CHAIN_BUMP') floatPrefix = 'CHAIN! ';
        else if (comboCount >= 3) floatPrefix = 'TRIPLE ';
        else if (comboCount === 2) floatPrefix = 'DOUBLE ';

        this.spawnFloatingText(event.position, stolenCash, true, floatPrefix);

        const icon = primarySkill === 'COUNTER_CRASH' ? '⚡'
          : (primarySkill === 'PERFECT_BUMP' || event.tier === 'PERFECT') ? '🎯'
          : primarySkill === 'BANK_SHOT' ? '🎱'
          : primarySkill === 'BOOST_CRASH' ? '🚀'
          : primarySkill === 'DRIFT_BUMP' ? '💨'
          : primarySkill === 'REVENGE' ? '🔥'
          : comboCount >= 2 ? '⚡' : '💥';

        const comboTag = comboCount >= 2 ? `[×${multiplier} STEAL] ` : '';
        this.enqueueNotification(
          icon,
          `${comboTag}${title} ON ${victimName.toUpperCase()}`,
          `+$${stolenCash} EXTRACTED`,
          'bump'
        );
      } else if (isPlayerVictim) {
        const attackerName = this.formatVehicleHandle(event.attackerId);
        this.triggerDamageFlash();
        this.triggerBumpPopup(stolenCash, false, title, primarySkill);
        this.spawnFloatingText(event.position, stolenCash, false, `${title.replace('!', '')} `);
        this.enqueueNotification(
          '💥',
          `${title} BY ${attackerName.toUpperCase()}`,
          `-$${stolenCash} TRANSFERRED`,
          'bump'
        );
      }
    });

    // 1a. Skill Moments (WALL SLAM, CLOSE CALL, PINNED, FINAL DUEL)
    EventBus.get().on('skill_moment', (data: any) => {
      if (!this.isVisible) return;

      // RULE: When hitting a wall, do NOT add any text effect
      if (data.type === 'WALL_SLAM') {
        return;
      }

      // RULE: When player involved is already dead, do NOT add any text effect
      if (data.victimId && this.isCarEliminated(data.victimId)) {
        return;
      }
      if (data.attackerId && this.isCarEliminated(data.attackerId)) {
        return;
      }

      const isPlayerAttacker = data.attackerId === 'player_car';
      const isPlayerVictim = data.victimId === 'player_car';

      if (data.type === 'CLOSE_CALL') {
        this.triggerBumpPopup(0, true, 'CLOSE CALL!', 'CLOSE_CALL');
        this.enqueueNotification('💨', 'CLOSE CALL!', 'HIGH-SPEED NEAR MISS (<0.5m)', 'info');
      } else if (data.type === 'PINNED') {
        if (isPlayerVictim) {
          this.enqueueNotification('⚠️', 'CORNER TRAP!', 'PINNED AGAINST ARENA WALL', 'info');
        } else if (isPlayerAttacker) {
          this.enqueueNotification('🎯', 'CORNER TRAP!', 'OPPONENT PINNED AGAINST WALL', 'info');
        }
      }
    });

    // 1a2. Final Duel Announcement
    EventBus.get().on('final_duel', (data: { opponentName: string; opponentCash: number; playerCash: number }) => {
      if (!this.isVisible) return;
      this.triggerBumpPopup(0, true, 'FINAL DUEL!', 'FINAL_DUEL');
      this.enqueueNotification('⚔️', 'FINAL DUEL ACTIVE', `YOU ($${data.playerCash}) VS ${data.opponentName.toUpperCase()} ($${data.opponentCash})`, 'info');
    });

    // 1b. Bump Combo Updates
    EventBus.get().on('combo_updated', (state: ComboState) => {
      if (!this.isVisible) return;
      this.showComboBanner(state);
    });

    EventBus.get().on('combo_lost', (data: { lastCombo: number }) => {
      if (!this.isVisible) return;
      this.showComboLost(data.lastCombo);
    });

    // 1c. Bounty Tier Updates
    EventBus.get().on('bounty_tier_changed', (data: any) => {
      if (!this.isVisible) return;
      if (data.newTier === 'BOUNTY' || data.newTier === 'BIG_BAG') {
        const icon = data.newTier === 'BOUNTY' ? '👑' : '💰';
        this.enqueueNotification(
          icon,
          `${data.carName.toUpperCase()} REACHED ${data.info.label}!`,
          `VALUABLE TARGET ($${data.balance})`,
          'info'
        );
      }
    });

    // 1d. Telegraphed Market Events (3... 2... 1... DOUBLE STEAL SURGE!)
    EventBus.get().on('market_event_telegraph', (data: { secondsLeft: number; eventName: string; subtitle: string; isFinal: boolean }) => {
      if (!this.isVisible) return;
      this.showMarketTelegraph(data);
    });

    // 2. Money Collected
    EventBus.get().on('money_collected', (data: { carId: string; amount: number; position: THREE.Vector3 }) => {
      if (!this.isVisible) return;
      if (data.carId === 'player_car') {
        this.showDeltaGain(data.amount);
        this.spawnFloatingText(data.position, data.amount, true);
        this.enqueueNotification(
          '💵',
          `YOU PICKED UP $${data.amount}`,
          'PORTFOLIO VALUE SURGE',
          'pickup'
        );
      }
    });

    // 3. Power-Up Collected (Lucky Box Mystery Crate)
    EventBus.get().on('powerup_collected', (data: { carId: string; isPlayer: boolean; type: PowerUpType; config: any }) => {
      if (!this.isVisible) return;
      const prefix = data.isPlayer ? 'YOU' : this.formatVehicleHandle(data.carId).toUpperCase();
      this.enqueueNotification(
        '🎁',
        `LUCKY BOX: ${data.config.name} ACTIVATED!`,
        `${prefix} GAINED ${data.config.description}`,
        'pickup'
      );
    });

    // 4. Dynamic Arena Events
    EventBus.get().on('arena_event', (data: { type: string; title: string; subtitle: string }) => {
      if (!this.isVisible) return;
      this.enqueueNotification('📢', data.title, data.subtitle, 'info');
    });

    // 5. Vehicle Liquidated
    EventBus.get().on('vehicle_liquidated', (data: { carId: string; pitLocation: { x: number; z: number } }) => {
      if (!this.isVisible) return;
      const isPlayer = data.carId === 'player_car';
      if (isPlayer) {
        this.triggerDamageFlash();
        this.enqueueNotification(
          '💀',
          'MARGIN CALL! YOU ARE LIQUIDATED!',
          'FALLEN INTO THE MARGIN VOID',
          'liquidation'
        );
      } else {
        const oppName = this.formatVehicleHandle(data.carId);
        this.enqueueNotification(
          '💀',
          `${oppName.toUpperCase()} LIQUIDATED`,
          '+$30 BOUNTY SCATTER IN PIT',
          'liquidation'
        );
      }
    });
  }

  private setupResultModalActions(): void {
    this.btnPlayAgain.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideResultModal();
      if (this.onPlayAgain) this.onPlayAgain();
    });

    this.btnGarage.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideResultModal();
      if (this.onReturnToGarage) this.onReturnToGarage();
    });
  }

  public showCountdownTick(seconds: number): void {
    this.countdownTickEl.innerText = seconds.toString();
    this.countdownTickEl.classList.remove('pulse');
    void this.countdownTickEl.offsetWidth; // Trigger reflow for clean re-trigger
    this.countdownTickEl.classList.add('pulse');

    // MotionFX Heartbeat Spring
    MotionFX.elasticTick(this.countdownTickEl, { scalePeak: 1.45, duration: 0.28 });
    MotionFX.elasticTick(this.timerDigitsEl, { scalePeak: 1.22, duration: 0.24 });
  }

  public showRoundCompleteBanner(): void {
    this.roundCompleteBannerEl.classList.add('show');
    MotionFX.zoomSlam(this.roundCompleteBannerEl, { scaleFrom: 2.2, duration: 0.45 });
  }

  public showResultModal(): void {
    this.roundCompleteBannerEl.classList.remove('show');
    this.resultPodiumEl.innerHTML = this.lastRankings.map((entry) => {
      const isFirst = entry.rank === 1;
      const crown = isFirst ? ' 👑' : '';
      const badgeClass = entry.rank <= 3 ? `rank-${entry.rank}` : '';
      return `
        <div class="hud-result-row ${entry.isPlayer ? 'player-row' : ''} ${isFirst ? 'first-place' : ''}">
          <div class="hud-result-rank">
            <span class="hud-result-badge ${badgeClass}">${entry.rank}</span>
            <span class="hud-result-name">${entry.name}${crown}</span>
          </div>
          <span class="hud-result-cash">$${entry.cash}</span>
        </div>
      `;
    }).join('');

    this.resultModalEl.classList.remove('hidden');
    this.resultModalEl.style.display = 'flex';
    this.spectatorCardEl.classList.add('hidden');
    this.spectatorCardEl.style.display = 'none';

    // MotionFX modal pop and staggered row drops
    const cardEl = this.resultModalEl.querySelector('.hud-result-card') as HTMLElement;
    if (cardEl) {
      MotionFX.modalZoomIn(cardEl, { duration: 0.38 });
    }
    const rows = Array.from(this.resultPodiumEl.querySelectorAll('.hud-result-row')) as HTMLElement[];
    if (rows.length > 0) {
      MotionFX.staggerDrop(rows, { staggerDelay: 0.08, duration: 0.35 });
    }
  }

  public hideResultModal(): void {
    this.resultModalEl.classList.add('hidden');
    this.resultModalEl.style.display = 'none';
    this.roundCompleteBannerEl.classList.remove('show');
  }

  public setSpectatorMode(active: boolean, finishedRank?: number, totalCount?: number): void {
    if (active) {
      this.spectatorCardEl.classList.remove('hidden');
      this.spectatorCardEl.style.display = 'flex';
      if (finishedRank !== undefined && totalCount !== undefined) {
        this.spectatorFinishEl.innerText = `Finished #${finishedRank} / ${totalCount}`;
      }
      this.bagCardEl.classList.add('spectator-dim');
    } else {
      this.spectatorCardEl.classList.add('hidden');
      this.spectatorCardEl.style.display = 'none';
      this.bagCardEl.classList.remove('spectator-dim');
    }
  }

  public updateSpectatorTarget(name: string, cash: number, hasCrown: boolean): void {
    this.spectatorTargetNameEl.innerText = name;
    this.spectatorTargetCashEl.innerText = `$${cash}`;
    this.spectatorCrownEl.style.display = hasCrown ? 'inline-block' : 'none';
  }

  public spawnFloatingText(position: THREE.Vector3, amount: number, isGain: boolean, textPrefix?: string): void {
    // RULE: When amount is 0 or less with no text prefix (or dead car/wall), do NOT add any text effect
    if (amount <= 0 && (!textPrefix || textPrefix.trim() === '')) {
      return;
    }

    const el = document.createElement('div');
    el.className = `hud-world-float ${isGain ? 'gain' : 'loss'}`;
    const sign = isGain ? '+' : '-';
    el.innerText = textPrefix ? `${textPrefix}${sign}$${amount}` : `${sign}$${amount}`;
    this.worldLabelsContainer.appendChild(el);

    this.floatingTexts.push({
      id: `float_${Math.random()}`,
      el,
      position: position.clone(),
      amount,
      isGain,
      age: 0,
      duration: 1.25,
      textPrefix,
    });
  }

  private updateFloatingTexts(dt: number, camera: THREE.Camera): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const item = this.floatingTexts[i];
      item.age += dt;
      if (item.age >= item.duration) {
        item.el.remove();
        this.floatingTexts.splice(i, 1);
        continue;
      }

      // Float upwards over time
      const worldY = item.position.y + 0.6 + item.age * 1.2;
      this.tempProjectVec.set(item.position.x, worldY, item.position.z);
      this.tempProjectVec.project(camera);

      if (this.tempProjectVec.z > 1.0 || this.tempProjectVec.z < -1.0) {
        item.el.style.display = 'none';
        continue;
      }

      const screenX = (this.tempProjectVec.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-this.tempProjectVec.y * 0.5 + 0.5) * window.innerHeight;

      const progress = item.age / item.duration;
      const opacity = Math.max(0, 1.0 - progress);

      // Elastic spring bounce curve: punchy overshoot on spawn, settles to 1.0, then smooth exit
      let scale = 1.0;
      if (item.age < 0.28) {
        const t = item.age / 0.28;
        scale = 0.4 + 0.95 * Math.sin(t * Math.PI * 0.5) + 0.4 * Math.sin(t * Math.PI);
      } else {
        const remaining = (item.duration - item.age) / (item.duration - 0.28);
        scale = 0.85 + 0.15 * remaining;
      }

      item.el.style.display = 'block';
      item.el.style.opacity = opacity.toFixed(2);
      item.el.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -100%) scale(${scale.toFixed(2)})`;
    }
  }

  private updatePowerUpsBar(playerCar: HeroCar): void {
    const active = playerCar.controller.getActivePowerUps();
    if (active.length === 0) {
      this.powerupsBarEl.innerHTML = '';
      return;
    }

    this.powerupsBarEl.innerHTML = active.map((pu) => {
      const config = POWER_UP_CONFIGS[pu.type];
      return `
        <div class="hud-powerup-badge badge-${pu.type}">
          <span>${config.icon}</span>
          <span>${config.badgeText}</span>
          <span class="badge-timer">${pu.remaining.toFixed(1)}s</span>
        </div>
      `;
    }).join('');
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (visible) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
    }
  }

  public setOnlineMode(active: boolean): void {
    this.onlineMode = active;
    if (!active) {
      this.onlineRanking = null;
      this.onlineNames.clear();
    }
  }

  public setOnlineRoundSeconds(seconds: number): void {
    this.onlineRoundSeconds = Math.max(0, seconds);
  }

  public setOnlineRanking(rows: RankingRowData[]): void {
    this.onlineRanking = rows;
  }

  public setOnlineNames(names: Map<string, string>): void {
    this.onlineNames = names;
  }

  public setRoundTime(seconds: number): void {
    this.roundDuration = seconds;
    this.roundTimer = seconds;
  }

  public resetRoundTimer(): void {
    this.roundTimer = this.roundDuration;
  }

  public setVehicle(config: VehicleArchetypeConfig): void {
    const stockInfo = this.getStockConfig(config.type);
    this.stockTicker = stockInfo.ticker;
    this.stockDeltaPct = stockInfo.basePct;
    this.isStockPositive = stockInfo.isPositive;

    this.stockTickerEl.innerText = this.stockTicker;
    this.stockChangeEl.innerText = `${this.stockDeltaPct > 0 ? '+' : ''}${this.stockDeltaPct.toFixed(1)}% ${this.isStockPositive ? '▲' : '▼'}`;
    this.stockChangeEl.className = `hud-stock-change ${this.isStockPositive ? 'positive' : 'negative'}`;
    this.stockIconEl.innerHTML = stockInfo.iconSvg;
  }

  private getStockConfig(type: VehicleType) {
    switch (type) {
      case 'hood_bull':
        return {
          ticker: '$HOOD',
          basePct: 2.8,
          isPositive: true,
          iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
        };
      case 'hood_bear':
        return {
          ticker: '$HOOD',
          basePct: -1.7,
          isPositive: false,
          iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
        };
      case 'tsla_racer':
        return {
          ticker: '$TSLA',
          basePct: 4.2,
          isPositive: true,
          iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>`,
        };
      case 'nvda_ai':
        return {
          ticker: '$NVDA',
          basePct: 3.4,
          isPositive: true,
          iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
        };
      case 'gold_whale':
        return {
          ticker: '$WHALE',
          basePct: 6.9,
          isPositive: true,
          iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4-6.2-4.5h7.6z"/></svg>`,
        };
      case 'gme_ape':
        return {
          ticker: '$GME',
          basePct: 69.4,
          isPositive: true,
          iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
        };
      case 'doge_kart':
        return {
          ticker: '$DOGE',
          basePct: 42.0,
          isPositive: true,
          iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>`,
        };
    }
  }

  public showDeltaGain(delta: number): void {
    this.bagDeltaEl.innerText = `${delta >= 0 ? '+' : ''}$${Math.abs(delta)}`;
    this.bagDeltaEl.className = `hud-bag-delta ${delta >= 0 ? 'positive' : 'negative'}`;
    this.bagDeltaEl.classList.remove('faded');

    // MotionFX elastic ticks
    MotionFX.elasticTick(this.bagAmountEl, { scalePeak: 1.30, duration: 0.24 });
    MotionFX.popPunch(this.bagDeltaEl, { scaleFrom: 0.4, scalePeak: 1.25, duration: 0.28 });

    if (this.deltaFadeTimeout) window.clearTimeout(this.deltaFadeTimeout);
    this.deltaFadeTimeout = window.setTimeout(() => {
      this.bagDeltaEl.classList.add('faded');
    }, 2200);
  }

  public triggerDamageFlash(): void {
    this.statusBarEl.classList.add('damage-flash');
    this.damageVignetteEl.classList.add('active');

    if (this.damageFlashTimeout) window.clearTimeout(this.damageFlashTimeout);
    this.damageFlashTimeout = window.setTimeout(() => {
      this.statusBarEl.classList.remove('damage-flash');
      this.damageVignetteEl.classList.remove('active');
    }, 250);
  }

  public triggerBumpPopup(
    amount: number,
    isGain: boolean,
    customTitle?: string,
    skillType?: string,
    comboCount?: number,
    comboMultiplier?: number
  ): void {
    let title = customTitle || (isGain ? 'BUMP!' : 'HIT!');

    if (!customTitle && isGain && comboCount && comboCount >= 2) {
      title = comboCount === 2 ? '🔥 DOUBLE BUMP!' : comboCount === 3 ? '⚡ TRIPLE BUMP!' : '💥 MEGA COMBO!';
      this.bumpCashEl.innerText = `+$${amount} (STEAL ×${comboMultiplier ?? 2})`;
      this.bumpCashEl.className = 'hud-bump-cash positive combo-punch';
    } else {
      if (amount > 0) {
        this.bumpCashEl.innerText = `${isGain ? '+' : '-'}$${amount}`;
        this.bumpCashEl.className = `hud-bump-cash ${isGain ? 'positive' : 'negative'}`;
      } else {
        this.bumpCashEl.innerText = '';
        this.bumpCashEl.className = 'hud-bump-cash neutral';
      }
    }

    this.bumpTextEl.innerText = title;

    const skillClass = skillType ? `skill-${skillType.toLowerCase().replace(/_/g, '-')}` : '';
    this.bumpPopupEl.className = `hud-bump-popup show ${skillClass}`;

    // Framer Motion Arcade Spring Pop-Punch via MotionFX
    const isCombo = comboCount && comboCount >= 2;
    const peak = isCombo ? 1.48 : (skillType ? 1.38 : 1.32);
    const rot = isGain ? -3 : 3;
    MotionFX.popPunch(this.bumpPopupEl, {
      scaleFrom: 0.22,
      scalePeak: peak,
      rotateDeg: rot,
      duration: 0.38,
    });

    if (this.bumpPopupTimeout) window.clearTimeout(this.bumpPopupTimeout);
    this.bumpPopupTimeout = window.setTimeout(() => {
      MotionFX.exitShrink(this.bumpPopupEl, { scaleTo: 0.75, duration: 0.16 });
      window.setTimeout(() => {
        this.bumpPopupEl.classList.remove('show');
      }, 160);
    }, 950);
  }

  private formatSkillTitle(type: string): string {
    switch (type) {
      case 'COUNTER_CRASH': return 'COUNTER CRASH!';
      case 'PERFECT_BUMP': return 'PERFECT BUMP!';
      case 'BANK_SHOT': return 'BANK SHOT!';
      case 'WALL_SLAM': return 'WALL SLAM!';
      case 'DRIFT_BUMP': return 'DRIFT BUMP!';
      case 'BOOST_CRASH': return 'BOOST CRASH!';
      case 'DOUBLE_IMPACT': return 'DOUBLE IMPACT!';
      case 'REVENGE': return 'REVENGE!';
      case 'CHAIN_BUMP': return 'CHAIN BUMP!';
      case 'PINNED': return 'CORNER TRAP!';
      case 'CLOSE_CALL': return 'CLOSE CALL!';
      default: return 'BUMP!';
    }
  }

  public showComboBanner(state: ComboState): void {
    if (state.comboCount < 2) {
      this.comboBannerEl.classList.add('hidden');
      return;
    }

    this.comboTitleEl.innerText = state.title;
    this.comboSubEl.innerText = state.subtitle;
    this.comboBannerEl.className = `hud-combo-banner visible combo-x${state.multiplier}`;
    this.comboFillEl.style.width = '100%';

    // Spring punch on combo update via MotionFX
    MotionFX.popPunch(this.comboBannerEl, { scaleFrom: 0.75, scalePeak: 1.25, duration: 0.32 });
  }

  public showComboLost(_lastCombo: number): void {
    this.comboTitleEl.innerText = 'COMBO LOST';
    this.comboSubEl.innerText = 'MULTIPLIER RESET';
    this.comboBannerEl.className = 'hud-combo-banner visible combo-lost';
    this.comboFillEl.style.width = '0%';

    // Spring shake via MotionFX
    MotionFX.shake(this.comboBannerEl, { distance: 10, duration: 0.34 });

    if (this.comboBannerTimeout) window.clearTimeout(this.comboBannerTimeout);
    this.comboBannerTimeout = window.setTimeout(() => {
      MotionFX.exitShrink(this.comboBannerEl, { scaleTo: 0.85, duration: 0.18 });
      window.setTimeout(() => {
        this.comboBannerEl.classList.remove('visible');
        this.comboBannerEl.classList.add('hidden');
      }, 180);
    }, 700);
  }

  public showMarketTelegraph(data: { secondsLeft: number; eventName: string; subtitle: string; isFinal: boolean }): void {
    if (data.isFinal) {
      this.telegraphCountdownEl.innerText = '⚡';
      this.telegraphTitleEl.innerText = `💵 MARKET EVENT: ${data.eventName.toUpperCase()}!`;
      this.telegraphSubEl.innerText = data.subtitle;
      this.telegraphBannerEl.className = 'hud-market-telegraph visible active-event';

      MotionFX.popPunch(this.telegraphBannerEl, { scaleFrom: 0.6, scalePeak: 1.35, duration: 0.4 });

      if (this.telegraphTimeout) window.clearTimeout(this.telegraphTimeout);
      this.telegraphTimeout = window.setTimeout(() => {
        MotionFX.exitShrink(this.telegraphBannerEl, { scaleTo: 0.85, duration: 0.2 });
        window.setTimeout(() => {
          this.telegraphBannerEl.classList.remove('visible');
          this.telegraphBannerEl.classList.add('hidden');
        }, 200);
      }, 2500);
      return;
    }

    this.telegraphCountdownEl.innerText = data.secondsLeft.toString();
    this.telegraphTitleEl.innerText = `💵 MARKET EVENT: ${data.eventName.toUpperCase()}!`;
    this.telegraphSubEl.innerText = `STARTING IN ${data.secondsLeft} SECONDS...`;
    this.telegraphBannerEl.className = 'hud-market-telegraph visible countdown';

    MotionFX.bounceSlideDown(this.telegraphBannerEl, { yFrom: -30, yPeak: 8, duration: 0.36 });
    MotionFX.elasticTick(this.telegraphCountdownEl, { scalePeak: 1.45, duration: 0.25 });
  }

  public enqueueNotification(icon: string, title: string, subtitle: string, type: 'bump' | 'pickup' | 'liquidation' | 'info'): void {
    this.notifQueue.push({ icon, title, subtitle, type });
    if (!this.isNotifActive) {
      this.processNextNotification();
    }
  }

  private processNextNotification(): void {
    if (this.notifQueue.length === 0) {
      this.isNotifActive = false;
      return;
    }

    this.isNotifActive = true;
    const item = this.notifQueue.shift()!;

    this.notifMainEl.innerText = `${item.icon} ${item.title}`;
    this.notifSubEl.innerText = item.subtitle;
    this.notifCardEl.className = `hud-notification-card type-${item.type} visible`;

    // Spring slide-down with overshoot bounce
    MotionFX.bounceSlideDown(this.notifCardEl, { yFrom: -36, yPeak: 6, duration: 0.36 });

    window.setTimeout(() => {
      MotionFX.slideOutUp(this.notifCardEl, { yTo: -30, duration: 0.18 });
      window.setTimeout(() => {
        this.notifCardEl.classList.remove('visible');
        this.processNextNotification();
      }, 190);
    }, 1200);
  }

  public update(dt: number, camera: THREE.Camera, playerCar: HeroCar, opponents: HeroCar[]): void {
    if (!this.isVisible) return;

    // Cache cars in map so event listeners can reliably check elimination status
    this.currentCarsMap.set(playerCar.id, playerCar);
    for (const opp of opponents) {
      this.currentCarsMap.set(opp.id, opp);
    }

    // 0. Update Combo Manager & Countdown Progress Bar
    ComboManager.get().update(dt);
    const comboState = ComboManager.get().getState();
    if (comboState.comboCount >= 2 && comboState.timeLeft > 0) {
      const pct = (comboState.timeLeft / comboState.maxWindow) * 100;
      this.comboFillEl.style.width = `${pct}%`;
    }

    // 0b. Update Bounty System Tiers
    const allCars = [playerCar, ...opponents];
    BountySystem.get().update(allCars);

    // 1. Update Match Timer
    this.updateTimer(dt);

    // 2. Update Bag Cash Readout (Smooth Lerping)
    this.updateCashReadout(dt, playerCar);

    // 3. Update Player Dual Status Bar (HP & Boost)
    this.updatePlayerStatus(playerCar);

    // 4. Update Power-Up Badges Bar
    this.updatePowerUpsBar(playerCar);

    // 5. Update Stock Jitter Simulation
    this.updateStockTicker(dt);

    // 6. Update Ranking Table with Bounty Indicators
    this.updateRanking(playerCar, opponents);

    // 7. Update In-World Floating Nameplates & Bounty Badges
    this.updateWorldLabels(camera, playerCar, opponents);

    // 8. Update Floating Combat Numbers
    this.updateFloatingTexts(dt, camera);
  }

  private updateTimer(dt: number): void {
    if (this.onlineMode) {
      this.roundTimer = this.onlineRoundSeconds;
    } else {
      this.roundTimer = Math.max(0, this.roundTimer - dt);
    }

    const minutes = Math.floor(this.roundTimer / 60);
    const seconds = Math.floor(this.roundTimer % 60);
    this.timerDigitsEl.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (this.roundTimer <= 10.0 && this.roundTimer > 0) {
      this.timerContainerEl.classList.add('hud-timer-urgent');
    } else {
      this.timerContainerEl.classList.remove('hud-timer-urgent');
    }
  }

  private updateCashReadout(dt: number, playerCar: HeroCar): void {
    const actualCash = playerCar.controller.getBalance();
    const isEliminated = playerCar.controller.isEliminated();
    const isCritical = playerCar.controller.isCritical();

    if (isCritical && !isEliminated) {
      this.criticalBagTagEl.classList.remove('hidden');
      this.bagCardEl.classList.add('critical-bag');
    } else {
      this.criticalBagTagEl.classList.add('hidden');
      this.bagCardEl.classList.remove('critical-bag');
    }

    if (actualCash !== this.targetCash) {
      const delta = actualCash - this.targetCash;
      this.targetCash = actualCash;
      this.showDeltaGain(delta);
    }

    // Smooth interpolation
    if (Math.abs(this.targetCash - this.currentDisplayedCash) > 0.4) {
      this.currentDisplayedCash += (this.targetCash - this.currentDisplayedCash) * Math.min(1.0, dt * 10);
    } else {
      this.currentDisplayedCash = this.targetCash;
    }

    this.bagAmountEl.innerText = isEliminated ? '$0' : `$${Math.round(this.currentDisplayedCash)}`;
  }

  private updatePlayerStatus(playerCar: HeroCar): void {
    const isEliminated = playerCar.controller.isEliminated();
    const cash = playerCar.controller.getBalance();
    const maxBalance = playerCar.controller.getMaxHealth() || 250;
    const bagPct = isEliminated ? 0 : Math.max(0, Math.min(100, Math.round((cash / maxBalance) * 100)));
    const boost = Math.max(0, Math.min(100, Math.round(playerCar.controller.boost.getFuel() * 100)));

    // HP Bar strictly reflects BAG ($ Cash)
    this.hpFillEl.style.width = `${bagPct}%`;

    if (isEliminated) {
      this.hpFillEl.className = 'hud-bar-fill hud-hp-fill liquidated';
      this.hpPctEl.style.color = '#8b9bb4';
      this.hpPctEl.innerText = 'LIQUIDATED';
    } else if (cash < 25) {
      this.hpFillEl.className = 'hud-bar-fill hud-hp-fill critical';
      this.hpPctEl.style.color = '#f80757';
      this.hpPctEl.innerText = `$${cash} (${bagPct}%)`;
    } else if (bagPct < 40) {
      this.hpFillEl.className = 'hud-bar-fill hud-hp-fill warning';
      this.hpPctEl.style.color = '#f08204';
      this.hpPctEl.innerText = `$${cash} (${bagPct}%)`;
    } else {
      this.hpFillEl.className = 'hud-bar-fill hud-hp-fill';
      this.hpPctEl.style.color = '#ffffff';
      this.hpPctEl.innerText = `$${cash} (${bagPct}%)`;
    }

    // Boost Bar
    this.boostFillEl.style.width = `${boost}%`;
    this.boostPctEl.innerText = `${boost}%`;
    if (boost >= 98) {
      this.boostSegmentEl.classList.add('boost-full');
    } else {
      this.boostSegmentEl.classList.remove('boost-full');
    }
  }

  private updateStockTicker(dt: number): void {
    this.stockJitterTimer += dt;
    if (this.stockJitterTimer >= 5.0) {
      this.stockJitterTimer = 0;
      // Slight stock fluctuation (+-0.3%)
      const jitter = (Math.random() - 0.45) * 0.4;
      this.stockDeltaPct = Math.round((this.stockDeltaPct + jitter) * 10) / 10;
      this.stockChangeEl.innerText = `${this.stockDeltaPct > 0 ? '+' : ''}${this.stockDeltaPct.toFixed(1)}% ${this.isStockPositive ? '▲' : '▼'}`;
    }
  }

  private updateRanking(playerCar: HeroCar, opponents: HeroCar[]): void {
    const useServerRanking = this.onlineMode && this.onlineRanking !== null;
    const list: RankingRowData[] = useServerRanking ? [...(this.onlineRanking ?? [])] : [
      {
        id: 'player_car',
        name: 'You',
        cash: playerCar.controller.getBalance(),
        isPlayer: true,
        rank: 0,
        isEliminated: playerCar.controller.isEliminated(),
        bountyTier: BountySystem.get().getTier(playerCar.controller.getBalance()),
      },
      ...opponents.map((car) => ({
        id: car.id,
        name: this.formatVehicleHandle(car.id, car.vehicleType),
        cash: car.controller.getBalance(),
        isPlayer: false,
        rank: 0,
        isEliminated: car.controller.isEliminated(),
        bountyTier: BountySystem.get().getTier(car.controller.getBalance()),
      })),
    ];

    if (!useServerRanking) {
      list.sort((a, b) => {
        if (a.isEliminated && !b.isEliminated) return 1;
        if (!a.isEliminated && b.isEliminated) return -1;
        return b.cash - a.cash;
      });
      list.forEach((entry, idx) => {
        entry.rank = idx + 1;
      });
    }

    this.lastRankings = list;

    const aliveCount = list.filter((e) => !e.isEliminated).length;
    const playerIndex = list.findIndex((e) => e.isPlayer);
    const playerRank = playerIndex !== -1 ? playerIndex + 1 : 1;
    const playerEliminated = list[playerIndex]?.isEliminated;

    if (playerEliminated) {
      this.rankPosEl.innerText = `💀 #${playerRank} / ${list.length}`;
    } else {
      this.rankPosEl.innerText = `#${playerRank} / ${list.length} (${aliveCount} ALIVE)`;
    }

    // Select rows to display:
    // If compact, max 4 players with 'You' always included.
    let displayList = list;
    if (!this.isRankingExpanded && list.length > 4) {
      if (playerRank <= 4) {
        displayList = list.slice(0, 4);
      } else {
        // Show Top 3 + Player
        displayList = [...list.slice(0, 3), list[playerIndex]];
      }
    }

    this.rankingListEl.innerHTML = displayList
      .map((entry) => {
        const isFirst = entry.rank === 1 && !entry.isEliminated;
        let badgeIcon = '';
        if (entry.isEliminated) badgeIcon = ' 💀';
        else if (entry.bountyTier === 'BOUNTY' || isFirst) badgeIcon = ' 👑';
        else if (entry.bountyTier === 'BIG_BAG') badgeIcon = ' 💰';

        const badgeClass = entry.rank <= 3 && !entry.isEliminated ? `rank-${entry.rank}` : '';
        const rowClass = entry.isEliminated ? 'eliminated-row' : '';
        const cashClass = entry.isEliminated ? 'hud-rank-cash eliminated' : 'hud-rank-cash';
        const displayCash = entry.isEliminated ? 'OUT' : `$${entry.cash}`;

        return `
          <div class="hud-ranking-row ${entry.isPlayer ? 'player-row' : ''} ${rowClass}">
            <span class="hud-rank-pos-badge ${badgeClass}">${entry.isEliminated ? '💀' : entry.rank}</span>
            <span class="hud-rank-name">${entry.name}${badgeIcon}</span>
            <span class="${cashClass}">${displayCash}</span>
          </div>
        `;
      })
      .join('');
  }

  private updateWorldLabels(camera: THREE.Camera, playerCar: HeroCar, opponents: HeroCar[]): void {
    const allCars = [playerCar, ...opponents];
    const activeIds = new Set<string>();

    for (const car of allCars) {
      activeIds.add(car.id);
      let labelEl = this.worldLabels.get(car.id);
      if (!labelEl) {
        labelEl = document.createElement('div');
        labelEl.className = `hud-world-label ${car.id === 'player_car' ? 'player' : this.getThemeClass(car.vehicleType)}`;
        labelEl.innerHTML = `
          <div class="hud-world-label-bubble">
            <span class="hud-world-label-name"></span>
            <span class="hud-world-label-cash"></span>
            <span class="hud-world-bounty-badge" style="display: none;"></span>
          </div>
          <div class="hud-world-label-arrow">▼</div>
        `;
        this.worldLabelsContainer.appendChild(labelEl);
        this.worldLabels.set(car.id, labelEl);
      }

      // World position above vehicle roof/antenna
      const pState = car.controller.getPhysicsState();
      this.tempProjectVec.copy(pState.position);
      this.tempProjectVec.y += 1.65;

      // Project into screen NDC coordinates
      this.tempProjectVec.project(camera);

      // Frustum check: z between -1 and 1
      if (this.tempProjectVec.z > 1.0 || this.tempProjectVec.z < -1.0) {
        labelEl.style.display = 'none';
        continue;
      }

      const screenX = (this.tempProjectVec.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-this.tempProjectVec.y * 0.5 + 0.5) * window.innerHeight;

      // Check viewport visibility
      if (
        screenX < -60 ||
        screenX > window.innerWidth + 60 ||
        screenY < -60 ||
        screenY > window.innerHeight + 60
      ) {
        labelEl.style.display = 'none';
        continue;
      }

      labelEl.style.display = 'flex';
      labelEl.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -100%)`;

      // Update text
      const nameEl = labelEl.querySelector('.hud-world-label-name') as HTMLElement;
      const cashEl = labelEl.querySelector('.hud-world-label-cash') as HTMLElement;
      const bountyBadgeEl = labelEl.querySelector('.hud-world-bounty-badge') as HTMLElement;

      const name = car.id === 'player_car' ? 'You' : this.formatVehicleHandle(car.id, car.vehicleType);
      const isEliminated = car.controller.isEliminated();
      const isCritical = car.controller.isCritical();
      const balance = car.controller.getBalance();

      nameEl.innerText = name;
      cashEl.innerText = isEliminated ? '$0' : `$${balance}`;

      if (isEliminated) {
        bountyBadgeEl.innerText = '💀 LIQUIDATED';
        bountyBadgeEl.className = 'hud-world-bounty-badge tier-liquidated';
        bountyBadgeEl.style.display = 'inline-block';
        labelEl.classList.remove('has-bounty');
        labelEl.classList.remove('is-critical');
        labelEl.classList.add('is-wreck');
      } else if (isCritical) {
        bountyBadgeEl.innerText = '⚠️ CRITICAL BAG (<$25)';
        bountyBadgeEl.className = 'hud-world-bounty-badge tier-critical';
        bountyBadgeEl.style.display = 'inline-block';
        labelEl.classList.remove('has-bounty');
        labelEl.classList.remove('is-wreck');
        labelEl.classList.add('is-critical');
      } else {
        labelEl.classList.remove('is-wreck');
        labelEl.classList.remove('is-critical');
        const bountyTier = BountySystem.get().getTier(balance);
        if (bountyTier === 'BOUNTY') {
          bountyBadgeEl.innerText = '👑 BOUNTY TARGET 🎯';
          bountyBadgeEl.className = 'hud-world-bounty-badge tier-bounty';
          bountyBadgeEl.style.display = 'inline-block';
          labelEl.classList.add('has-bounty');
        } else if (bountyTier === 'BIG_BAG') {
          bountyBadgeEl.innerText = '💰 BIG BAG';
          bountyBadgeEl.className = 'hud-world-bounty-badge tier-bigbag';
          bountyBadgeEl.style.display = 'inline-block';
          labelEl.classList.remove('has-bounty');
        } else if (bountyTier === 'HOT') {
          bountyBadgeEl.innerText = '🔥 HOT';
          bountyBadgeEl.className = 'hud-world-bounty-badge tier-hot';
          bountyBadgeEl.style.display = 'inline-block';
          labelEl.classList.remove('has-bounty');
        } else {
          bountyBadgeEl.style.display = 'none';
          labelEl.classList.remove('has-bounty');
        }
      }
    }

    // Cleanup dead or removed car labels
    for (const [id, el] of Array.from(this.worldLabels.entries())) {
      if (!activeIds.has(id)) {
        el.remove();
        this.worldLabels.delete(id);
      }
    }
  }

  private formatVehicleHandle(id: string, type?: VehicleType): string {
    if (id === 'player_car') return 'You';
    const onlineName = this.onlineNames.get(id);
    if (onlineName) return onlineName;
    if (id === 'opponent_whale' || type === 'gold_whale') return 'Diamond_Hands';
    if (id === 'opponent_tsla' || type === 'tsla_racer') return 'Tesla_DeGen';
    if (id === 'opponent_nvda' || type === 'nvda_ai') return 'Nvda_Max';
    if (id === 'opponent_bear' || type === 'hood_bear') return 'Hood_Bear';
    return id.replace('opponent_', '');
  }

  private getThemeClass(type: VehicleType): string {
    switch (type) {
      case 'hood_bear':
        return 'theme-bear';
      case 'tsla_racer':
        return 'theme-tsla';
      case 'nvda_ai':
        return 'theme-nvda';
      case 'gold_whale':
        return 'theme-whale';
      default:
        return 'theme-tsla';
    }
  }

  public destroy(): void {
    this.container.remove();
  }
}
