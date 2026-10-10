import * as THREE from 'three';
import { VehicleType } from '../vehicles/VehicleTypes';
import { MotionFX } from './MotionFX';

export type ScreenState = 'MAIN_MENU' | 'VEHICLE_SELECT' | 'LEADERBOARD' | 'GAMEPLAY';

export interface VehiclePresentationData {
  type: VehicleType;
  name: string;
  role: string;
  stockBadge: string;
  stockDelta: string;
  isPositive: boolean;
  stockTicker: string;
  description: string;
  accentColor: string;
  glowColor: string;
  stats: {
    speed: number;      // 0 - 100
    impact: number;     // 0 - 100
    handling: number;   // 0 - 100
    stability: number;  // 0 - 100
  };
  iconSvg: string;
}

export class OnboardingUI {
  private container: HTMLElement;
  private currentScreen: ScreenState = 'MAIN_MENU';
  private selectedVehicleIndex: number = 0;
  private isSettingsOpen: boolean = false;
  private isPaused: boolean = false;

  // 3D-to-2D projection cache for Leaderboard podium badges
  private tempPodiumVec = new THREE.Vector3();
  private cachedPodiumAnchors = {
    slot1: new THREE.Vector3(0, 2.70, 0),
    slot2: new THREE.Vector3(-3.3, 2.28, 0.25),
    slot3: new THREE.Vector3(3.3, 2.12, 0.25),
  };

  // Callbacks to communicate with GameApp & ShowroomStage
  public onScreenChange?: (screen: ScreenState) => void;
  public onVehicleChange?: (type: VehicleType) => void;
  public onLaunchGame?: (type: VehicleType) => void;
  public onResumeGame?: () => void;
  public onRestartGame?: () => void;
  public onPlayOnline?: () => void;
  public onOnlineLeaderboardShown?: (host: HTMLElement) => void;
  public onOnlineLeaderboardHidden?: () => void;
  private onlineFlow: boolean = false;

  public readonly vehicles: VehiclePresentationData[] = [
    {
      type: 'hood_bull',
      name: 'HOOD BULL',
      role: 'ALL-ROUNDER',
      stockTicker: '$HOOD',
      stockDelta: '+2.8%',
      stockBadge: '$HOOD +2.8% ▲',
      isPositive: true,
      description: 'Balanced, reliable, and ready to hit.',
      accentColor: '#1ef66d',
      glowColor: '#1ef66d',
      stats: { speed: 72, impact: 70, handling: 74, stability: 82 },
      iconSvg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    },
    {
      type: 'hood_bear',
      name: 'HOOD BEAR',
      role: 'TANK / IMPACT',
      stockTicker: '$HOOD',
      stockDelta: '-1.7%',
      stockBadge: '$HOOD -1.7% ▼',
      isPositive: false,
      description: 'Maximum impact mass. Built to crush portfolios.',
      accentColor: '#ff1144',
      glowColor: '#ff0044',
      stats: { speed: 52, impact: 98, handling: 48, stability: 95 },
      iconSvg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    },
    {
      type: 'tsla_racer',
      name: 'TSLA RACER',
      role: 'SPEED / CHASE',
      stockTicker: '$TSLA',
      stockDelta: '+4.2%',
      stockBadge: '$TSLA +4.2% ▲',
      isPositive: true,
      description: 'Instant acceleration and electric top-speed drift.',
      accentColor: '#2dbdf1',
      glowColor: '#2dbdf1',
      stats: { speed: 96, impact: 48, handling: 86, stability: 60 },
      iconSvg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>`,
    },
    {
      type: 'nvda_ai',
      name: 'NVDA AI',
      role: 'PRECISION / CORNERING',
      stockTicker: '$NVDA',
      stockDelta: '+3.4%',
      stockBadge: '$NVDA +3.4% ▲',
      isPositive: true,
      description: 'Calculated apex handling and cornering domination.',
      accentColor: '#c084fc',
      glowColor: '#c084fc',
      stats: { speed: 82, impact: 68, handling: 98, stability: 85 },
      iconSvg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
    },
    {
      type: 'gold_whale',
      name: 'GOLD WHALE',
      role: 'CHAOS GAMBLER',
      stockTicker: '$WHALE',
      stockDelta: '+1.1%',
      stockBadge: '$WHALE +1.1% ▲',
      isPositive: true,
      description: 'Extreme momentum and high-stakes cash scatter.',
      accentColor: '#fcbe20',
      glowColor: '#fcbe20',
      stats: { speed: 90, impact: 88, handling: 54, stability: 50 },
      iconSvg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4-6.2-4.5h7.6z"/></svg>`,
    },
    {
      type: 'gme_ape',
      name: 'GME APE',
      role: 'MUSCLE / BERSERKER',
      stockTicker: '$GME',
      stockDelta: '+69.4%',
      stockBadge: '$GME +69.4% ▲',
      isPositive: true,
      description: 'Supercharged V8, Diamond Hands Gorilla with red headband. To the moon!',
      accentColor: '#ff2a5f',
      glowColor: '#ff2a5f',
      stats: { speed: 88, impact: 94, handling: 62, stability: 70 },
      iconSvg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
    },
    {
      type: 'doge_kart',
      name: 'DOGE BARK',
      role: 'DRIFT & AGILITY / SPEEDSTER',
      stockTicker: '$DOGE',
      stockDelta: '+42.0%',
      stockBadge: '$DOGE +42.0% ▲',
      isPositive: true,
      description: 'Cyber Dune Buggy, tubular roll cage, Shiba driver with Deal-With-It shades. Much wow, very bump!',
      accentColor: '#ffaa00',
      glowColor: '#ffaa00',
      stats: { speed: 92, impact: 65, handling: 96, stability: 68 },
      iconSvg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>`,
    },
  ];

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'onboarding-root';
    document.body.appendChild(this.container);

    this.injectStyles();
    this.render();
    this.setupKeyboardEvents();
    this.startTickerSimulation();
  }

  public setOnlineFlow(active: boolean): void {
    this.onlineFlow = active;
    const ctaBtn = document.getElementById('vs-play-btn');
    if (ctaBtn) ctaBtn.innerText = this.launchLabel(this.getSelectedVehicle().name);
  }

  public isOnlineFlow(): boolean {
    return this.onlineFlow;
  }

  private launchLabel(name: string): string {
    return this.onlineFlow ? `▶ ENTER LOBBY WITH ${name}` : `▶ PLAY WITH ${name}`;
  }

  public getScreen(): ScreenState {
    return this.currentScreen;
  }

  public getSelectedVehicle(): VehiclePresentationData {
    return this.vehicles[this.selectedVehicleIndex];
  }

  public setScreen(screen: ScreenState): void {
    if (this.currentScreen === screen) return;
    this.currentScreen = screen;
    this.isSettingsOpen = false;
    this.isPaused = false;
    this.render();

    // MotionFX transitions per screen
    if (screen === 'MAIN_MENU') {
      const heroContent = document.querySelector('.hero-content') as HTMLElement;
      if (heroContent) MotionFX.bounceSlideDown(heroContent, { yFrom: -25, yPeak: 4, duration: 0.35 });
    } else if (screen === 'VEHICLE_SELECT') {
      const centerInfo = document.querySelector('.vs-center-info') as HTMLElement;
      if (centerInfo) MotionFX.popPunch(centerInfo, { scaleFrom: 0.85, scalePeak: 1.08, duration: 0.32 });
    } else if (screen === 'LEADERBOARD') {
      const rows = Array.from(document.querySelectorAll('.lb-table tbody tr')) as HTMLElement[];
      if (rows.length > 0) MotionFX.staggerDrop(rows, { staggerDelay: 0.05, duration: 0.32 });
    }

    if (this.onScreenChange) {
      this.onScreenChange(screen);
    }
  }

  /**
   * Dynamically projects 3D world podium anchors to 2D screen coordinates
   * and pins floating podium cards directly above each car.
   */
  public updateLeaderboardPodium(
    camera: THREE.Camera,
    anchors?: { slot1: THREE.Vector3; slot2: THREE.Vector3; slot3: THREE.Vector3 }
  ): void {
    if (this.currentScreen !== 'LEADERBOARD') return;

    const useAnchors = anchors || this.cachedPodiumAnchors;
    const b1 = document.getElementById('podium-badge-1');
    const b2 = document.getElementById('podium-badge-2');
    const b3 = document.getElementById('podium-badge-3');

    const updateBadge = (el: HTMLElement | null, anchor: THREE.Vector3) => {
      if (!el) return;
      this.tempPodiumVec.copy(anchor);
      this.tempPodiumVec.project(camera);

      // Frustum check: NDC z must be between -1.0 and 1.0
      if (this.tempPodiumVec.z > 1.0 || this.tempPodiumVec.z < -1.0) {
        el.style.display = 'none';
        return;
      }

      const screenX = (this.tempPodiumVec.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-this.tempPodiumVec.y * 0.5 + 0.5) * window.innerHeight;

      // Viewport margin check
      if (
        screenX < -120 ||
        screenX > window.innerWidth + 120 ||
        screenY < -120 ||
        screenY > window.innerHeight + 120
      ) {
        el.style.display = 'none';
        return;
      }

      el.style.display = 'flex';
      el.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -100%)`;
    };

    updateBadge(b1, useAnchors.slot1);
    updateBadge(b2, useAnchors.slot2);
    updateBadge(b3, useAnchors.slot3);
  }

  public selectVehicleByIndex(index: number): void {
    const len = this.vehicles.length;
    this.selectedVehicleIndex = ((index % len) + len) % len;
    const v = this.getSelectedVehicle();
    this.updateVehicleSelectDOM();
    if (this.onVehicleChange) {
      this.onVehicleChange(v.type);
    }
  }

  public selectVehicleByType(type: VehicleType): void {
    const idx = this.vehicles.findIndex((v) => v.type === type);
    if (idx !== -1) {
      this.selectVehicleByIndex(idx);
    }
  }

  public nextVehicle(): void {
    this.selectVehicleByIndex(this.selectedVehicleIndex + 1);
  }

  public prevVehicle(): void {
    this.selectVehicleByIndex(this.selectedVehicleIndex - 1);
  }

  public toggleSettings(): void {
    this.isSettingsOpen = !this.isSettingsOpen;
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.className = this.isSettingsOpen ? 'settings-modal active' : 'settings-modal';
      if (this.isSettingsOpen) {
        const card = modal.querySelector('.settings-card') as HTMLElement;
        if (card) MotionFX.modalZoomIn(card, { duration: 0.35 });
      }
    }
  }

  public togglePause(): void {
    if (this.currentScreen !== 'GAMEPLAY') return;
    this.isPaused = !this.isPaused;
    const pauseOverlay = document.getElementById('pause-overlay');
    if (pauseOverlay) {
      pauseOverlay.className = this.isPaused ? 'pause-overlay active' : 'pause-overlay';
      if (this.isPaused) {
        const card = pauseOverlay.querySelector('.pause-card') as HTMLElement;
        if (card) MotionFX.modalZoomIn(card, { duration: 0.35 });
      }
    }
  }

  private setupKeyboardEvents(): void {
    window.addEventListener('keydown', (e) => {
      if (this.isSettingsOpen && e.key === 'Escape') {
        this.toggleSettings();
        return;
      }

      if (this.currentScreen === 'VEHICLE_SELECT') {
        if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
          this.prevVehicle();
        } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
          this.nextVehicle();
        } else if (e.key === 'Escape') {
          this.setScreen('MAIN_MENU');
        }
      } else if (this.currentScreen === 'LEADERBOARD') {
        if (e.key === 'Escape') {
          this.setScreen('MAIN_MENU');
        }
      } else if (this.currentScreen === 'GAMEPLAY') {
        if (e.key === 'Escape') {
          this.togglePause();
        }
      }
    });
  }

  /**
   * Subtle ticker simulation to make stock numbers feel alive.
   */
  private startTickerSimulation(): void {
    setInterval(() => {
      const hoodEl = document.getElementById('ticker-hood');
      const tslaEl = document.getElementById('ticker-tsla');
      const nvdaEl = document.getElementById('ticker-nvda');

      if (hoodEl) {
        const rand = (2.8 + (Math.random() * 0.4 - 0.2)).toFixed(1);
        hoodEl.innerText = `HOOD +${rand}%`;
      }
      if (tslaEl) {
        const rand = (-1.2 + (Math.random() * 0.4 - 0.2)).toFixed(1);
        tslaEl.innerText = `TSLA ${rand}%`;
      }
      if (nvdaEl) {
        const rand = (3.4 + (Math.random() * 0.4 - 0.2)).toFixed(1);
        nvdaEl.innerText = `NVDA +${rand}%`;
      }
    }, 4500);
  }

  /**
   * Updates only dynamic DOM elements on Vehicle Selection screen (avoiding full re-render).
   */
  private updateVehicleSelectDOM(): void {
    const v = this.getSelectedVehicle();

    // Name & Badges
    const nameEl = document.getElementById('vs-car-name');
    if (nameEl) {
      nameEl.innerText = v.name;
      MotionFX.popPunch(nameEl, { scaleFrom: 0.88, scalePeak: 1.10, duration: 0.28 });
    }

    const roleEl = document.getElementById('vs-car-role');
    if (roleEl) roleEl.innerText = v.role;

    const stockEl = document.getElementById('vs-car-stock');
    if (stockEl) {
      stockEl.innerText = v.stockBadge;
      stockEl.className = v.isPositive ? 'stock-chip positive' : 'stock-chip negative';
      MotionFX.popPunch(stockEl, { scaleFrom: 0.85, scalePeak: 1.15, duration: 0.28 });
    }

    // Stats progress bars
    const statSpeed = document.getElementById('vs-stat-speed');
    if (statSpeed) (statSpeed as HTMLElement).style.width = `${v.stats.speed}%`;

    const statImpact = document.getElementById('vs-stat-impact');
    if (statImpact) (statImpact as HTMLElement).style.width = `${v.stats.impact}%`;

    const statHandling = document.getElementById('vs-stat-handling');
    if (statHandling) (statHandling as HTMLElement).style.width = `${v.stats.handling}%`;

    const statStability = document.getElementById('vs-stat-stability');
    if (statStability) (statStability as HTMLElement).style.width = `${v.stats.stability}%`;

    const statCols = Array.from(document.querySelectorAll('.vs-stats-grid .stat-col')) as HTMLElement[];
    if (statCols.length > 0) {
      MotionFX.staggerDrop(statCols, { staggerDelay: 0.04, duration: 0.25 });
    }

    // CTA button text
    const ctaBtn = document.getElementById('vs-play-btn');
    if (ctaBtn) {
      ctaBtn.innerText = this.launchLabel(v.name);
      MotionFX.popPunch(ctaBtn, { scaleFrom: 0.94, scalePeak: 1.05, duration: 0.25 });
    }

    // Carousel 3-card presentation
    this.updateCarouselCards();
  }

  private updateCarouselCards(): void {
    const len = this.vehicles.length;
    const prevIdx = (this.selectedVehicleIndex - 1 + len) % len;
    const currIdx = this.selectedVehicleIndex;
    const nextIdx = (this.selectedVehicleIndex + 1) % len;

    const prevV = this.vehicles[prevIdx];
    const currV = this.vehicles[currIdx];
    const nextV = this.vehicles[nextIdx];

    const cPrev = document.getElementById('carousel-card-prev');
    if (cPrev) {
      cPrev.innerHTML = `
        <div class="card-glow" style="border-color: ${prevV.glowColor};"></div>
        <div class="card-icon" style="color: ${prevV.accentColor};">${prevV.iconSvg}</div>
        <div class="card-name">${prevV.name}</div>
        <div class="card-role">${prevV.role}</div>
      `;
      cPrev.onclick = () => this.prevVehicle();
    }

    const cCurr = document.getElementById('carousel-card-curr');
    if (cCurr) {
      cCurr.innerHTML = `
        <div class="card-glow active" style="border-color: ${currV.glowColor}; box-shadow: 0 0 20px ${currV.glowColor}66;"></div>
        <div class="card-icon active" style="color: ${currV.accentColor};">${currV.iconSvg}</div>
        <div class="card-name active">${currV.name}</div>
        <div class="card-role active">${currV.role}</div>
      `;
      MotionFX.popPunch(cCurr, { scaleFrom: 0.9, scalePeak: 1.08, duration: 0.28 });
    }

    const cNext = document.getElementById('carousel-card-next');
    if (cNext) {
      cNext.innerHTML = `
        <div class="card-glow" style="border-color: ${nextV.glowColor};"></div>
        <div class="card-icon" style="color: ${nextV.accentColor};">${nextV.iconSvg}</div>
        <div class="card-name">${nextV.name}</div>
        <div class="card-role">${nextV.role}</div>
      `;
      cNext.onclick = () => this.nextVehicle();
    }
  }

  public render(): void {
    const v = this.getSelectedVehicle();
    const isGameplay = this.currentScreen === 'GAMEPLAY';

    // In gameplay mode, hide full-screen onboarding overlay but keep pause & in-game menu button
    if (isGameplay) {
      this.container.innerHTML = `
        <!-- In-game Menu Trigger -->
        <button id="ingame-menu-btn" class="ingame-menu-btn" title="Pause Menu (ESC)">
          <span>☰</span> MENU
        </button>

        <!-- In-game Pause Overlay -->
        <div id="pause-overlay" class="pause-overlay ${this.isPaused ? 'active' : ''}">
          <div class="pause-card">
            <h2 class="pause-title">GAME PAUSED</h2>
            <div class="pause-car-info">CURRENT VEHICLE: <span style="color: #1ef66d; font-weight: 800;">${v.name}</span></div>
            <div class="pause-actions">
              <button id="pause-resume-btn" class="pause-btn primary">▶ RESUME</button>
              <button id="pause-restart-btn" class="pause-btn">🔄 RESTART MATCH</button>
              <button id="pause-vehicles-btn" class="pause-btn">🏎 VEHICLE SELECT</button>
              <button id="pause-menu-btn" class="pause-btn danger">🏠 MAIN MENU</button>
            </div>
          </div>
        </div>
      `;

      this.bindGameplayEvents();
      return;
    }

    // Render 3 Desktop Onboarding Screens
    this.container.innerHTML = `
      <!-- GLOBAL HEADER -->
      <header class="bump-header">
        <div class="header-left">
          ${
            this.currentScreen !== 'MAIN_MENU'
              ? `<button id="header-back-btn" class="header-back-btn">
                   <span class="back-arrow">←</span> BACK
                 </button>`
              : `<div class="logo-group">
                   <div class="logo-title">BUMP.TRADE</div>
                   <div class="logo-sub">BUMP · TRADE · SURVIVE</div>
                 </div>`
          }
        </div>

        ${
          this.currentScreen === 'VEHICLE_SELECT'
            ? `<div class="header-center">
                 <div class="logo-group centered">
                   <div class="logo-title">BUMP.TRADE</div>
                   <div class="logo-sub">BUMP · TRADE · SURVIVE</div>
                 </div>
               </div>`
            : ''
        }

        <div class="header-right">
          <div class="market-ticker-pill">
            <span id="ticker-hood" class="ticker-item positive">HOOD +2.8%</span>
            <span id="ticker-tsla" class="ticker-item negative">TSLA -1.2%</span>
            <span id="ticker-nvda" class="ticker-item positive">NVDA +3.4%</span>
          </div>
          <button id="settings-btn" class="settings-icon-btn" title="System Settings">
            ⚙
          </button>
        </div>
      </header>

      <!-- SCREEN 01: MAIN MENU -->
      <div id="screen-main-menu" class="screen-view ${this.currentScreen === 'MAIN_MENU' ? 'active' : ''}">
        <div class="menu-hero-left">
          <div class="hero-tagline">
            <span class="tag-row-white">BUMP OTHER TRADERS.</span>
            <span class="tag-row-glow">STEAL THEIR BAG.</span>
          </div>

          <div class="menu-actions">
            <button id="menu-play-btn" class="btn-play-cta">
              <span class="play-icon">▶</span> PLAY
            </button>
            <button id="menu-online-btn" class="btn-leaderboard-cta">
              <span class="lb-icon">⛓</span> PLAY ONLINE
            </button>
            <button id="menu-leaderboard-btn" class="btn-leaderboard-cta">
              <span class="lb-icon">🏆</span> LEADERBOARD
            </button>
          </div>
        </div>
        <div class="on-footer">BUMP.TRADE is not affiliated with, endorsed by, or officially connected with Robinhood Markets, Inc.</div>
      </div>

      <!-- SCREEN 02: VEHICLE SELECTION -->
      <div id="screen-vehicle-select" class="screen-view ${this.currentScreen === 'VEHICLE_SELECT' ? 'active' : ''}">
        <!-- 3D Pedestal Navigation Arrows -->
        <button id="vs-nav-prev" class="showroom-arrow prev" title="Previous Car (←)">‹</button>
        <button id="vs-nav-next" class="showroom-arrow next" title="Next Car (→)">›</button>

        <!-- Center Vehicle Info Card -->
        <div class="vs-center-info">
          <div class="vs-name-row">
            <h1 id="vs-car-name" class="vs-car-title">${v.name}</h1>
            <div id="vs-car-stock" class="stock-chip ${v.isPositive ? 'positive' : 'negative'}">
              ${v.stockBadge}
            </div>
          </div>
          <div id="vs-car-role" class="vs-car-role">${v.role}</div>

          <!-- 4 Visual Stat Bars -->
          <div class="vs-stats-grid">
            <div class="stat-col">
              <div class="stat-meta">
                <span class="stat-label">SPEED</span>
              </div>
              <div class="stat-track">
                <div id="vs-stat-speed" class="stat-bar-fill speed" style="width: ${v.stats.speed}%;"></div>
              </div>
            </div>

            <div class="stat-col">
              <div class="stat-meta">
                <span class="stat-label">IMPACT</span>
              </div>
              <div class="stat-track">
                <div id="vs-stat-impact" class="stat-bar-fill impact" style="width: ${v.stats.impact}%;"></div>
              </div>
            </div>

            <div class="stat-col">
              <div class="stat-meta">
                <span class="stat-label">HANDLING</span>
              </div>
              <div class="stat-track">
                <div id="vs-stat-handling" class="stat-bar-fill handling" style="width: ${v.stats.handling}%;"></div>
              </div>
            </div>

            <div class="stat-col">
              <div class="stat-meta">
                <span class="stat-label">STABILITY</span>
              </div>
              <div class="stat-track">
                <div id="vs-stat-stability" class="stat-bar-fill stability" style="width: ${v.stats.stability}%;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Vehicle Carousel Cards (3 Visible at once) -->
        <div class="vs-bottom-carousel">
          <button id="carousel-nav-left" class="carousel-arrow">‹</button>
          <div class="carousel-cards-strip">
            <div id="carousel-card-prev" class="carousel-card side"></div>
            <div id="carousel-card-curr" class="carousel-card active"></div>
            <div id="carousel-card-next" class="carousel-card side"></div>
          </div>
          <button id="carousel-nav-right" class="carousel-arrow">›</button>
        </div>

        <!-- Primary Action CTA Button -->
        <div class="vs-cta-container">
          <button id="vs-play-btn" class="vs-launch-cta">
            ${this.launchLabel(v.name)}
          </button>
        </div>
      </div>

      <!-- SCREEN 03: LEADERBOARD -->
      <div id="screen-leaderboard" class="screen-view ${this.currentScreen === 'LEADERBOARD' ? 'active' : ''}">
        <div class="lb-title-block">
          <h1 class="lb-main-title">LEADERBOARD</h1>
          <div class="lb-subtitle">TOP TRADERS ON THE ARENA</div>
        </div>

        <!-- 3D Podium HTML Badges / Dynamically Projected Anchor Cards -->
        <div class="podium-meta-overlay">
          <!-- #1 GOLD WHALE -->
          <div id="podium-badge-1" class="podium-pillar-badge slot-1">
            <div class="podium-badge-inner gold">
              <div class="podium-badge-top">
                <span class="podium-icon crown">👑</span>
                <span class="podium-player gold">Diamond_Hands</span>
              </div>
              <div class="podium-bag gold">$12,450</div>
              <div class="podium-wins gold">132 WINS</div>
            </div>
            <div class="podium-badge-stem gold"></div>
          </div>

          <!-- #2 HOOD BEAR -->
          <div id="podium-badge-2" class="podium-pillar-badge slot-2">
            <div class="podium-badge-inner silver">
              <div class="podium-badge-top">
                <span class="podium-icon">🐻</span>
                <span class="podium-player silver">Hood_Trader</span>
              </div>
              <div class="podium-bag silver">$10,230</div>
              <div class="podium-wins silver">118 WINS</div>
            </div>
            <div class="podium-badge-stem silver"></div>
          </div>

          <!-- #3 TESLA DEGEN -->
          <div id="podium-badge-3" class="podium-pillar-badge slot-3">
            <div class="podium-badge-inner bronze">
              <div class="podium-badge-top">
                <span class="podium-icon">⚡</span>
                <span class="podium-player bronze">Tesla_DeGen</span>
              </div>
              <div class="podium-bag bronze">$8,960</div>
              <div class="podium-wins bronze">104 WINS</div>
            </div>
            <div class="podium-badge-stem bronze"></div>
          </div>
        </div>

        <!-- Ranking Table Card -->
        <div class="lb-table-card">
          <div class="lb-tabs-row">
            <button class="lb-tab active">ALL TIME</button>
            <button class="lb-tab">THIS WEEK</button>
            <button class="lb-tab">FRIENDS</button>
            <button class="lb-tab" id="lb-tab-online">ONLINE</button>
          </div>
          <div id="lb-online-host" class="on-lb-host"></div>

          <table class="lb-table">
            <thead>
              <tr>
                <th style="width: 10%;">#</th>
                <th style="width: 45%;">PLAYER</th>
                <th style="width: 25%;">FINAL BAG</th>
                <th style="width: 20%;">WINS</th>
              </tr>
            </thead>
            <tbody>
              <tr class="top-row">
                <td><span class="rank-badge gold">1</span></td>
                <td><span class="avatar-cell">👑</span> Diamond_Hands</td>
                <td class="bag-val gold">$12,450</td>
                <td class="wins-val">132</td>
              </tr>
              <tr class="top-row">
                <td><span class="rank-badge silver">2</span></td>
                <td><span class="avatar-cell">🐻</span> Hood_Trader</td>
                <td class="bag-val">$10,230</td>
                <td class="wins-val">118</td>
              </tr>
              <tr class="top-row">
                <td><span class="rank-badge bronze">3</span></td>
                <td><span class="avatar-cell">⚡</span> Tesla_DeGen</td>
                <td class="bag-val">$8,960</td>
                <td class="wins-val">104</td>
              </tr>
              <tr>
                <td><span class="rank-badge">4</span></td>
                <td><span class="avatar-cell">🤖</span> Nvda_Max</td>
                <td class="bag-val">$7,420</td>
                <td class="wins-val">98</td>
              </tr>
              <tr>
                <td><span class="rank-badge">5</span></td>
                <td><span class="avatar-cell">🐋</span> Whale_Hunter</td>
                <td class="bag-val">$6,880</td>
                <td class="wins-val">86</td>
              </tr>
              <tr class="dots-row">
                <td colspan="4">···</td>
              </tr>
              <tr class="user-highlight-row">
                <td><span class="rank-badge user">12</span></td>
                <td><span class="avatar-cell">🟢</span> <strong>You</strong></td>
                <td class="bag-val user">$2,350</td>
                <td class="wins-val user">24</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- SETTINGS MODAL -->
      <div id="settings-modal" class="settings-modal ${this.isSettingsOpen ? 'active' : ''}">
        <div class="settings-card">
          <div class="settings-header">
            <h3>SYSTEM SETTINGS</h3>
            <button id="settings-close-btn" class="close-btn">✕</button>
          </div>
          <div class="settings-body">
            <div class="settings-row">
              <span>Master SFX Volume</span>
              <input type="range" min="0" max="100" value="80" class="settings-slider">
            </div>
            <div class="settings-row">
              <span>Engine Sound</span>
              <button class="settings-toggle active">ON</button>
            </div>
            <div class="settings-row">
              <span>Post-Processing & Bloom</span>
              <button class="settings-toggle active">HIGH</button>
            </div>
            <div class="settings-guide">
              <div class="guide-title">QUICK CONTROLS</div>
              <div class="guide-item">W / S : Accelerate / Reverse</div>
              <div class="guide-item">A / D : Steer Left / Right</div>
              <div class="guide-item">SPACE : Boost Burst (High Impact)</div>
              <div class="guide-item">ESC : Menu / Pause</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.updateCarouselCards();
  }

  private bindEvents(): void {
    // Header back button
    const backBtn = document.getElementById('header-back-btn');
    if (backBtn) {
      MotionFX.springPress(backBtn);
      backBtn.onclick = () => this.setScreen('MAIN_MENU');
    }

    // Settings trigger
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      MotionFX.springPress(settingsBtn);
      settingsBtn.onclick = () => this.toggleSettings();
    }
    const settingsClose = document.getElementById('settings-close-btn');
    if (settingsClose) {
      MotionFX.springPress(settingsClose);
      settingsClose.onclick = () => this.toggleSettings();
    }

    // Screen 01: Main menu
    const playBtn = document.getElementById('menu-play-btn');
    if (playBtn) {
      MotionFX.springPress(playBtn);
      playBtn.onclick = () => this.setScreen('VEHICLE_SELECT');
    }

    const onlineBtn = document.getElementById('menu-online-btn');
    if (onlineBtn) {
      MotionFX.springPress(onlineBtn);
      onlineBtn.onclick = () => this.onPlayOnline?.();
    }

    const lbBtn = document.getElementById('menu-leaderboard-btn');
    if (lbBtn) {
      MotionFX.springPress(lbBtn);
      lbBtn.onclick = () => this.setScreen('LEADERBOARD');
    }

    // Screen 02: Vehicle select
    const navPrev = document.getElementById('vs-nav-prev');
    if (navPrev) {
      MotionFX.springPress(navPrev);
      navPrev.onclick = () => this.prevVehicle();
    }

    const navNext = document.getElementById('vs-nav-next');
    if (navNext) {
      MotionFX.springPress(navNext);
      navNext.onclick = () => this.nextVehicle();
    }

    const carLeft = document.getElementById('carousel-nav-left');
    if (carLeft) {
      MotionFX.springPress(carLeft);
      carLeft.onclick = () => this.prevVehicle();
    }

    const carRight = document.getElementById('carousel-nav-right');
    if (carRight) {
      MotionFX.springPress(carRight);
      carRight.onclick = () => this.nextVehicle();
    }

    const launchBtn = document.getElementById('vs-play-btn');
    if (launchBtn) {
      MotionFX.springPress(launchBtn);
      launchBtn.onclick = () => {
        const v = this.getSelectedVehicle();
        if (this.onLaunchGame) {
          this.onLaunchGame(v.type);
        }
      };
    }

    // Leaderboard filter tabs
    const lbTabs = Array.from(document.querySelectorAll('.lb-tab')) as HTMLElement[];
    lbTabs.forEach((tab) => MotionFX.springPress(tab));
    const card = document.querySelector('.lb-table-card') as HTMLElement | null;
    const podium = document.querySelector('.podium-meta-overlay') as HTMLElement | null;
    const onlineHost = document.getElementById('lb-online-host');
    lbTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        lbTabs.forEach((other) => other.classList.toggle('active', other === tab));
        const online = tab.id === 'lb-tab-online';
        card?.classList.toggle('online-active', online);
        podium?.classList.toggle('online-hidden', online);
        if (online && onlineHost) this.onOnlineLeaderboardShown?.(onlineHost);
        else this.onOnlineLeaderboardHidden?.();
      });
    });
  }

  private bindGameplayEvents(): void {
    const menuBtn = document.getElementById('ingame-menu-btn');
    if (menuBtn) {
      MotionFX.springPress(menuBtn);
      menuBtn.onclick = () => this.togglePause();
    }

    const resumeBtn = document.getElementById('pause-resume-btn');
    if (resumeBtn) {
      MotionFX.springPress(resumeBtn);
      resumeBtn.onclick = () => {
        this.togglePause();
        if (this.onResumeGame) this.onResumeGame();
      };
    }

    const restartBtn = document.getElementById('pause-restart-btn');
    if (restartBtn) {
      MotionFX.springPress(restartBtn);
      restartBtn.onclick = () => {
        this.isPaused = false;
        if (this.onRestartGame) this.onRestartGame();
      };
    }

    const vehiclesBtn = document.getElementById('pause-vehicles-btn');
    if (vehiclesBtn) {
      MotionFX.springPress(vehiclesBtn);
      vehiclesBtn.onclick = () => {
        this.isPaused = false;
        this.setScreen('VEHICLE_SELECT');
      };
    }

    const mainMenuBtn = document.getElementById('pause-menu-btn');
    if (mainMenuBtn) {
      MotionFX.springPress(mainMenuBtn);
      mainMenuBtn.onclick = () => {
        this.isPaused = false;
        this.setScreen('MAIN_MENU');
      };
    }
  }

  private injectStyles(): void {
    if (document.getElementById('onboarding-styles')) return;

    const style = document.createElement('style');
    style.id = 'onboarding-styles';
    style.innerHTML = `
      #onboarding-root {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 50;
        font-family: 'Orbitron', 'JetBrains Mono', -apple-system, sans-serif;
        color: #ffffff;
      }

      /* GLOBAL HEADER */
      .bump-header {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 40px;
        pointer-events: auto;
        z-index: 60;
      }

      .logo-group {
        display: flex;
        flex-direction: column;
      }
      .logo-group.centered {
        align-items: center;
      }
      .logo-title {
        font-size: 26px;
        font-weight: 900;
        font-style: italic;
        letter-spacing: 2px;
        color: #1ef66d;
        text-shadow: 0 0 25px rgba(30, 246, 109, 0.4);
      }
      .logo-sub {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 3.5px;
        color: #8b9bb4;
        margin-top: -2px;
      }

      .header-back-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(26, 38, 59, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.10);
        backdrop-filter: blur(20px) saturate(190%);
        -webkit-backdrop-filter: blur(20px) saturate(190%);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12);
        color: #ffffff;
        font-family: 'Orbitron', sans-serif;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 1.5px;
        padding: 10px 22px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .header-back-btn:hover {
        background: rgba(35, 45, 68, 0.85);
        border-color: #1ef66d;
        box-shadow: 0 0 15px rgba(30, 246, 109, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        transform: translateX(-2px);
      }
      .back-arrow {
        font-size: 16px;
        color: #1ef66d;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .market-ticker-pill {
        display: flex;
        align-items: center;
        gap: 18px;
        background: rgba(10, 16, 28, 0.62);
        border: 1px solid rgba(255, 255, 255, 0.09);
        backdrop-filter: blur(20px) saturate(190%);
        -webkit-backdrop-filter: blur(20px) saturate(190%);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12);
        padding: 8px 18px;
        border-radius: 30px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        font-weight: 700;
      }
      .ticker-item.positive {
        color: #1ef66d;
      }
      .ticker-item.negative {
        color: #f80757;
      }
      .settings-icon-btn {
        background: rgba(26, 38, 59, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.10);
        backdrop-filter: blur(20px) saturate(190%);
        -webkit-backdrop-filter: blur(20px) saturate(190%);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12);
        color: #8b9bb4;
        width: 42px;
        height: 42px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .settings-icon-btn:hover {
        color: #ffffff;
        border-color: #1ef66d;
        box-shadow: 0 0 15px rgba(30, 246, 109, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
      }

      /* SCREEN VIEWS */
      .screen-view {
        position: absolute;
        inset: 0;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.35s ease, visibility 0.35s ease;
        pointer-events: none;
      }
      .screen-view.active {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }

      /* SCREEN 01: MAIN MENU */
      .menu-hero-left {
        position: absolute;
        top: 26%;
        left: 6%;
        max-width: 580px;
        display: flex;
        flex-direction: column;
        gap: 40px;
      }
      .hero-tagline {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .tag-row-white {
        font-size: 38px;
        font-weight: 900;
        font-style: italic;
        letter-spacing: 2px;
        color: #ffffff;
      }
      .tag-row-glow {
        font-size: 42px;
        font-weight: 900;
        font-style: italic;
        letter-spacing: 3px;
        color: #1ef66d;
        text-shadow: 0 0 25px rgba(30, 246, 109, 0.5);
      }
      .menu-actions {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .btn-play-cta {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 270px;
        height: 58px;
        background: #1ef66d;
        border: 1px solid #1ef66d;
        border-radius: 12px;
        box-shadow: 0 0 30px rgba(30, 246, 109, 0.45);
        color: #041a0c;
        font-family: 'Orbitron', sans-serif;
        font-size: 20px;
        font-weight: 900;
        font-style: italic;
        letter-spacing: 2px;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .btn-play-cta:hover {
        transform: scale(1.04);
        background: #04f233;
        box-shadow: 0 0 45px rgba(30, 246, 109, 0.8);
        border-color: #ffffff;
      }
      .btn-play-cta:active {
        transform: scale(0.98);
      }
      .btn-leaderboard-cta {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 270px;
        height: 48px;
        background: rgba(26, 38, 59, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.10);
        backdrop-filter: blur(20px) saturate(190%);
        -webkit-backdrop-filter: blur(20px) saturate(190%);
        border-radius: 12px;
        color: #bcd1ef;
        font-family: 'Orbitron', sans-serif;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 1.5px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12);
      }
      .btn-leaderboard-cta:hover {
        border-color: #1ef66d;
        box-shadow: 0 0 20px rgba(30, 246, 109, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        background: rgba(35, 45, 68, 0.85);
        color: #ffffff;
      }

      /* SCREEN 02: VEHICLE SELECTION */
      .showroom-arrow {
        position: absolute;
        top: 48%;
        transform: translateY(-50%);
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: rgba(26, 38, 59, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.10);
        backdrop-filter: blur(20px) saturate(190%);
        -webkit-backdrop-filter: blur(20px) saturate(190%);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12);
        color: #ffffff;
        font-size: 32px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        z-index: 55;
      }
      .showroom-arrow.prev { left: 8%; }
      .showroom-arrow.next { right: 8%; }
      .showroom-arrow:hover {
        border-color: #1ef66d;
        box-shadow: 0 0 20px rgba(30, 246, 109, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        transform: translateY(-50%) scale(1.1);
      }

      .vs-center-info {
        position: absolute;
        bottom: 23%;
        left: 0;
        right: 0;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        width: 620px;
        pointer-events: none;
      }
      .vs-name-row {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .vs-car-title {
        font-size: 32px;
        font-weight: 900;
        font-style: italic;
        letter-spacing: 2px;
        color: #ffffff;
      }
      .stock-chip {
        padding: 4px 12px;
        border-radius: 20px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 1px;
      }
      .stock-chip.positive {
        background: #123326;
        border: 1px solid #1ef66d;
        color: #1ef66d;
      }
      .stock-chip.negative {
        background: rgba(248, 7, 87, 0.15);
        border: 1px solid #f80757;
        color: #f80757;
      }
      .vs-car-role {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 3px;
        color: #8b9bb4;
        text-transform: uppercase;
      }

      .vs-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        width: 100%;
        margin-top: 10px;
      }
      .stat-col {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .stat-meta {
        font-size: 11px;
        font-weight: 700;
        color: #8b9bb4;
        letter-spacing: 1px;
      }
      .stat-track {
        height: 6px;
        background: #0a111c;
        border: 1px solid #243149;
        border-radius: 3px;
        overflow: hidden;
      }
      .stat-bar-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .stat-bar-fill.speed { background: #1ef66d; }
      .stat-bar-fill.impact { background: #f80757; }
      .stat-bar-fill.handling { background: #2dbdf1; }
      .stat-bar-fill.stability { background: #fcbe20; }

      .vs-bottom-carousel {
        position: absolute;
        bottom: 8.5%;
        left: 0;
        right: 0;
        margin: 0 auto;
        width: fit-content;
        display: flex;
        align-items: center;
        gap: 16px;
        pointer-events: auto;
      }
      .carousel-cards-strip {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .carousel-arrow {
        background: rgba(26, 38, 59, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.10);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        color: #8b9bb4;
        font-size: 26px;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .carousel-arrow:hover {
        color: #fff;
        border-color: #1ef66d;
      }
      .carousel-card {
        position: relative;
        width: 170px;
        height: 85px;
        background: rgba(26, 38, 59, 0.62);
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(20px) saturate(190%);
        -webkit-backdrop-filter: blur(20px) saturate(190%);
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 8px;
        cursor: pointer;
        transition: all 0.25s ease;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.10);
      }
      .carousel-card.side {
        opacity: 0.65;
        transform: scale(0.92);
      }
      .carousel-card.side:hover {
        opacity: 0.9;
        transform: scale(0.96);
      }
      .carousel-card.active {
        opacity: 1.0;
        transform: scale(1.05);
        background: rgba(18, 51, 38, 0.75);
        border: 2px solid #1ef66d;
      }
      .card-glow {
        position: absolute;
        inset: 0;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        pointer-events: none;
      }
      .card-glow.active {
        border-width: 2px;
      }
      .card-icon {
        width: 24px;
        height: 24px;
        margin-bottom: 2px;
      }
      .card-name {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 1px;
        color: #e2e8f0;
      }
      .card-role {
        font-size: 9px;
        font-weight: 700;
        color: #8b9bb4;
        letter-spacing: 1.5px;
      }

      .vs-cta-container {
        position: absolute;
        bottom: 2%;
        left: 0;
        right: 0;
        margin: 0 auto;
        width: fit-content;
        pointer-events: auto;
      }
      .vs-launch-cta {
        width: 390px;
        height: 52px;
        background: #fcbe20;
        border: 1px solid #fcbe20;
        border-radius: 12px;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.6);
        color: #041a0c;
        font-family: 'Orbitron', sans-serif;
        font-size: 16px;
        font-weight: 900;
        letter-spacing: 1.5px;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .vs-launch-cta:hover {
        transform: scale(1.03);
        background: #fbd50b;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.8);
      }
      .vs-launch-cta:active {
        transform: scale(0.98);
      }

      /* SCREEN 03: LEADERBOARD */
      .lb-title-block {
        position: absolute;
        top: 24px;
        left: 0;
        right: 0;
        margin: 0 auto;
        width: fit-content;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        pointer-events: none;
        z-index: 55;
      }
      .lb-main-title {
        font-size: 28px;
        font-weight: 900;
        font-style: italic;
        letter-spacing: 3px;
        color: #ffffff;
        margin: 0;
      }
      .lb-subtitle {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 3px;
        color: #1ef66d;
      }

      .podium-meta-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
      }
      .podium-pillar-badge {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        will-change: transform;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .podium-badge-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 8px 18px;
        border-radius: 14px;
        background: #111b2d;
        backdrop-filter: blur(16px);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.65);
        white-space: nowrap;
      }
      .podium-badge-inner.gold {
        border: 1px solid #fcbe20;
      }
      .podium-badge-inner.silver {
        border: 1px solid #bcd1ef;
      }
      .podium-badge-inner.bronze {
        border: 1px solid #f08204;
      }

      .podium-badge-top {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .podium-icon {
        font-size: 18px;
        line-height: 1;
      }
      .podium-icon.crown {
        font-size: 22px;
      }
      .podium-player {
        font-family: 'Orbitron', sans-serif;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.8px;
        color: #ffffff;
      }
      .podium-player.gold {
        font-size: 14px;
        color: #fcbe20;
      }

      .podium-bag {
        font-family: 'Orbitron', sans-serif;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 0.5px;
      }
      .podium-bag.gold {
        font-size: 20px;
        color: #fcbe20;
      }
      .podium-bag.silver {
        color: #bcd1ef;
      }
      .podium-bag.bronze {
        color: #f08204;
      }

      .podium-wins {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1.2px;
      }
      .podium-wins.gold { color: #fcbe20; }
      .podium-wins.silver { color: #bcd1ef; }
      .podium-wins.bronze { color: #f08204; }

      .podium-badge-stem {
        width: 2px;
        height: 12px;
      }
      .podium-badge-stem.gold {
        background: #fcbe20;
        opacity: 0.6;
      }
      .podium-badge-stem.silver {
        background: #bcd1ef;
        opacity: 0.6;
      }
      .podium-badge-stem.bronze {
        background: #f08204;
        opacity: 0.6;
      }

      .lb-table-card {
        position: absolute;
        bottom: 3%;
        left: 0;
        right: 0;
        margin: 0 auto;
        width: 820px;
        background: #111b2d;
        border: 1px solid #243149;
        backdrop-filter: blur(16px);
        border-radius: 14px;
        padding: 16px 24px;
        pointer-events: auto;
      }
      .lb-tabs-row {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
        border-bottom: 1px solid #243149;
        padding-bottom: 10px;
      }
      .lb-tab {
        background: transparent;
        border: none;
        color: #8b9bb4;
        font-family: 'Orbitron', sans-serif;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 1.5px;
        padding: 6px 14px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .lb-tab.active {
        color: #1ef66d;
        background: #123326;
        border: 1px solid #1ef66d;
      }
      .lb-table {
        width: 100%;
        border-collapse: collapse;
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
      }
      .lb-table th {
        text-align: left;
        color: #8b9bb4;
        font-size: 11px;
        font-weight: 700;
        padding: 6px 10px;
        letter-spacing: 1.5px;
      }
      .lb-table td {
        padding: 7px 10px;
        color: #e2e8f0;
      }
      .rank-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 6px;
        font-weight: 800;
        font-size: 12px;
        background: #1a263b;
      }
      .rank-badge.gold { background: #fcbe20; color: #000; }
      .rank-badge.silver { background: #c0c0c0; color: #000; }
      .rank-badge.bronze { background: #cd7f32; color: #000; }
      .rank-badge.user { background: #1ef66d; color: #041a0c; }
      .avatar-cell { margin-right: 6px; }
      .bag-val { font-weight: 800; color: #fff; }
      .bag-val.gold { color: #fcbe20; }
      .bag-val.user { color: #1ef66d; }
      .wins-val { color: #8b9bb4; }
      .wins-val.user { color: #1ef66d; font-weight: 800; }
      .user-highlight-row {
        background: #123326;
        outline: 1px solid #1ef66d;
        border-radius: 8px;
      }
      .dots-row td {
        text-align: center;
        color: #64748b;
        padding: 2px 0;
      }

      /* SETTINGS MODAL */
      .settings-modal {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: all 0.25s ease;
        z-index: 100;
        pointer-events: none;
      }
      .settings-modal.active {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }
      .settings-card {
        width: 480px;
        background: rgba(10, 16, 28, 0.78);
        border: 1px solid rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(24px) saturate(190%);
        -webkit-backdrop-filter: blur(24px) saturate(190%);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.14);
        border-radius: 16px;
        padding: 24px;
      }
      .settings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        border-bottom: 1px solid #243149;
        padding-bottom: 12px;
      }
      .settings-header h3 {
        font-size: 18px;
        font-weight: 900;
        color: #1ef66d;
        letter-spacing: 1.5px;
      }
      .close-btn {
        background: none;
        border: none;
        color: #8b9bb4;
        font-size: 20px;
        cursor: pointer;
      }
      .close-btn:hover { color: #fff; }
      .settings-body {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .settings-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        color: #e2e8f0;
      }
      .settings-slider {
        accent-color: #1ef66d;
        cursor: pointer;
      }
      .settings-toggle {
        background: #123326;
        border: 1px solid #1ef66d;
        color: #1ef66d;
        padding: 4px 14px;
        border-radius: 6px;
        font-family: 'Orbitron', sans-serif;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
      }
      .settings-guide {
        margin-top: 10px;
        background: #0a111c;
        border: 1px solid #243149;
        border-radius: 8px;
        padding: 12px;
        font-size: 11px;
        color: #8b9bb4;
        line-height: 1.7;
      }
      .guide-title {
        color: #fff;
        font-weight: 800;
        margin-bottom: 4px;
      }

      /* IN-GAME CONTROLS & PAUSE OVERLAY */
      .ingame-menu-btn {
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(26, 38, 59, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.10);
        backdrop-filter: blur(20px) saturate(190%);
        -webkit-backdrop-filter: blur(20px) saturate(190%);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12);
        color: #ffffff;
        font-family: 'Orbitron', sans-serif;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 1.5px;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        pointer-events: auto;
        z-index: 50;
        transition: all 0.2s ease;
      }
      .ingame-menu-btn:hover {
        border-color: #1ef66d;
        box-shadow: 0 0 15px rgba(30, 246, 109, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
      }
      .pause-overlay {
        position: absolute;
        inset: 0;
        background: rgba(3, 13, 25, 0.85);
        backdrop-filter: blur(12px);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: all 0.25s ease;
        z-index: 100;
        pointer-events: none;
      }
      .pause-overlay.active {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }
      .pause-card {
        width: 420px;
        background: rgba(10, 16, 28, 0.78);
        border: 1px solid rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(24px) saturate(190%);
        -webkit-backdrop-filter: blur(24px) saturate(190%);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.14);
        border-radius: 16px;
        padding: 32px 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }
      .pause-title {
        font-size: 26px;
        font-weight: 900;
        font-style: italic;
        letter-spacing: 2px;
        color: #fff;
      }
      .pause-car-info {
        font-size: 12px;
        letter-spacing: 1.5px;
        color: #8b9bb4;
      }
      .pause-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        margin-top: 10px;
      }
      .pause-btn {
        width: 100%;
        height: 48px;
        background: #1a263b;
        border: 1px solid #243149;
        border-radius: 10px;
        color: #ffffff;
        font-family: 'Orbitron', sans-serif;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 1.5px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .pause-btn:hover {
        background: #232d44;
        border-color: #1ef66d;
        box-shadow: 0 0 15px rgba(30, 246, 109, 0.25);
      }
      .pause-btn.primary {
        background: #1ef66d;
        border-color: #1ef66d;
        color: #041a0c;
        box-shadow: 0 0 20px rgba(30, 246, 109, 0.4);
      }
      .pause-btn.primary:hover {
        background: #04f233;
        box-shadow: 0 0 30px rgba(30, 246, 109, 0.6);
      }
      .pause-btn.danger:hover {
        border-color: #f80757;
        box-shadow: 0 0 15px rgba(248, 7, 87, 0.3);
      }
    `;
    document.head.appendChild(style);
  }
}
