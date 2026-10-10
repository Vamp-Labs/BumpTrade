import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CollisionSystem } from '../collision/CollisionSystem';
import { InputManager } from '../input/InputManager';
import { GameCamera } from '../camera/GameCamera';
import { NeonMarketArena } from '../arena/NeonMarketArena';
import { HeroCar } from '../vehicles/HeroCar';
import { VehicleFactory } from '../vehicles/VehicleFactory';
import { VehicleType } from '../vehicles/VehicleTypes';
import { GameLoop } from './GameLoop';
import { DebugRenderer } from '../debug/DebugRenderer';
import { EventBus } from './EventBus';
import { CollisionEvent } from '../collision/CollisionTypes';
import { PickupManager } from '../pickups/PickupManager';
import { PowerUpManager } from '../pickups/PowerUpManager';
import { MatchManager } from './MatchManager';
import { OpponentManager } from '../ai/OpponentManager';
import { PostProcessingManager } from '../rendering/PostProcessing';
import { SkidMarkManager } from '../vfx/SkidMarkManager';
import { ShockwaveManager } from '../vfx/ShockwaveManager';
import { ShowroomStage } from '../showroom/ShowroomStage';
import { OnboardingUI, ScreenState } from '../ui/OnboardingUI';
import { GameplayHUD } from '../ui/GameplayHUD';

import { BountySystem } from '../combat/BountySystem';
import { SoundManager } from '../audio/SoundManager';
import { AssetManager } from './AssetManager';
import { OnlineController } from '../net/OnlineController';

export type AppState = 'MAIN_MENU' | 'VEHICLE_SELECT' | 'LEADERBOARD' | 'GAMEPLAY' | 'PAUSED';

export class GameApp {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public gameCamera: GameCamera;
  public physicsWorld: PhysicsWorld;
  public collisionSystem: CollisionSystem;
  public arena: NeonMarketArena;
  public playerCar: HeroCar;
  public opponentManager: OpponentManager;
  public pickupManager: PickupManager;
  public powerUpManager!: PowerUpManager;
  public matchManager!: MatchManager;
  public postProcessing: PostProcessingManager;
  public skidMarkManager: SkidMarkManager;
  public shockwaveManager: ShockwaveManager;
  public debugRenderer: DebugRenderer;
  public inputManager: InputManager;
  public gameLoop: GameLoop;
  public gameplayHUD: GameplayHUD;

  // 3D Showroom & Onboarding UI
  public showroomStage: ShowroomStage;
  public onboardingUI: OnboardingUI;
  public state: AppState = 'MAIN_MENU';

  private spawnPosPlayer = new THREE.Vector3(0, 0.4, -7.0);
  private isSwitchingVehicle: boolean = false;
  private isPlayerSpectating: boolean = false;
  private spectatedOpponentIndex: number = 0;
  private isFinalDuelActive: boolean = false;
  private onlineScene: boolean = false;
  public readonly online: OnlineController;

  private constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    gameCamera: GameCamera,
    physicsWorld: PhysicsWorld,
    collisionSystem: CollisionSystem,
    arena: NeonMarketArena,
    playerCar: HeroCar,
    opponentManager: OpponentManager,
    pickupManager: PickupManager,
    powerUpManager: PowerUpManager,
    matchManager: MatchManager,
    postProcessing: PostProcessingManager,
    skidMarkManager: SkidMarkManager,
    shockwaveManager: ShockwaveManager,
    debugRenderer: DebugRenderer,
    inputManager: InputManager,
    showroomStage: ShowroomStage,
    onboardingUI: OnboardingUI,
    gameplayHUD: GameplayHUD
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.gameCamera = gameCamera;
    this.physicsWorld = physicsWorld;
    this.collisionSystem = collisionSystem;
    this.arena = arena;
    this.playerCar = playerCar;
    this.opponentManager = opponentManager;
    this.pickupManager = pickupManager;
    this.powerUpManager = powerUpManager;
    this.matchManager = matchManager;
    this.postProcessing = postProcessing;
    this.skidMarkManager = skidMarkManager;
    this.shockwaveManager = shockwaveManager;
    this.debugRenderer = debugRenderer;
    this.inputManager = inputManager;
    this.showroomStage = showroomStage;
    this.onboardingUI = onboardingUI;
    this.gameplayHUD = gameplayHUD;

    // Hook MatchManager freeze hit-stop
    this.matchManager.setHitStopHook((duration) => this.gameLoop.triggerHitStop(duration));

    // Initialize HUD with player vehicle config
    this.gameplayHUD.setVehicle(playerCar.config);

    // Initially hide gameplay HUD until player clicks PLAY
    this.setHUDVisible(false);

    // Wire Game Loop
    this.gameLoop = new GameLoop(
      (dt: number) => this.physicsTick(dt),
      (dt: number) => this.renderTick(dt)
    );

    this.online = new OnlineController({
      scene: this.scene,
      physicsWorld: this.physicsWorld,
      hud: this.gameplayHUD,
      visuals: {
        fire: () => this.arena.events.triggerFireBurst(),
        surge: () => this.arena.events.triggerDoubleStealSurge(),
        crash: () => this.arena.events.triggerMarketCrash(),
        flash: () => this.arena.events.triggerMarketFlash(),
      },
      prepareMatch: (type) => this.prepareOnlineMatch(type),
      beginGameplay: () => this.beginOnlineGameplay(),
      endOnline: () => this.restoreOffline(),
      exitToMenu: () => this.onboardingUI.setScreen('MAIN_MENU'),
      exitToVehicleSelect: () => this.onboardingUI.setScreen('VEHICLE_SELECT'),
    });
    this.online.onFlowChange = (active) => this.onboardingUI.setOnlineFlow(active);
  }

  public static async create(canvas: HTMLCanvasElement): Promise<GameApp> {
    // 1. Three.js Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Gameplay Scene with cyber atmospheric fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    scene.fog = new THREE.FogExp2(0x06080e, 0.012);

    (window as any).__gameAppStep = 'camera_and_physics';
    // 3. Gameplay Camera
    const gameCamera = new GameCamera(window.innerWidth / window.innerHeight);

    // 4. Rapier 3D Physics World
    const physicsWorld = await PhysicsWorld.create();

    // 5. Collision System
    const collisionSystem = new CollisionSystem(physicsWorld);

    // 6. Neon Market Arena
    const arena = new NeonMarketArena(scene, physicsWorld);

    (window as any).__gameAppStep = 'playerCar_hood_bull';
    // 7. Initial Player Car: HOOD BULL (Hero Car)
    const spawnPosPlayer = new THREE.Vector3(0, 0.4, -7.0);
    const playerCar = await VehicleFactory.createVehicle(
      'hood_bull',
      'player_car',
      scene,
      physicsWorld,
      spawnPosPlayer,
      0
    );
    collisionSystem.registerVehicle(playerCar);

    (window as any).__gameAppStep = 'opponentManager_spawn';
    // 8. Opponent Fleet Manager (Bear, Tsla, Nvda, Whale)
    const opponentManager = new OpponentManager(scene, physicsWorld, collisionSystem, playerCar);
    await opponentManager.spawnFullRoster();

    // 9. Pickup Manager (Coins & Cash bundles - Zero-Sum: purely dropped from trader bags)
    const pickupManager = new PickupManager(scene);

    // 9b. Collectible Power-Up Manager (Turbo, Heavy Hit, Cash Magnet, Shield)
    const powerUpManager = new PowerUpManager(scene);

    // 10. Visual FX Pipelines
    const postProcessing = new PostProcessingManager(renderer, scene, gameCamera.camera);
    const skidMarkManager = new SkidMarkManager(scene);
    const shockwaveManager = new ShockwaveManager(scene);

    // 11. Debug Renderer
    const debugRenderer = new DebugRenderer(scene, physicsWorld);

    // 12. Input Manager
    const inputManager = new InputManager();

    (window as any).__gameAppStep = 'showroomStage_preload';
    // 13. 3D Showroom Stage for Main Menu, Vehicle Selection & Leaderboard
    const showroomStage = new ShowroomStage(window.innerWidth / window.innerHeight);
    await showroomStage.preloadAllVehicles();
    showroomStage.setMode('MAIN_MENU');

    (window as any).__gameAppStep = 'ui_init';

    // 14. 3-Screen Onboarding & Menu UI
    const onboardingUI = new OnboardingUI();

    // 15. Modern Gameplay HUD
    const gameplayHUD = new GameplayHUD();

    // 16. Dynamic Match Manager (90s Tension Curve & Event Orchestrator)
    const matchManager = new MatchManager(
      arena.events,
      powerUpManager,
      pickupManager,
      gameplayHUD
    );

    const app = new GameApp(
      renderer,
      scene,
      gameCamera,
      physicsWorld,
      collisionSystem,
      arena,
      playerCar,
      opponentManager,
      pickupManager,
      powerUpManager,
      matchManager,
      postProcessing,
      skidMarkManager,
      shockwaveManager,
      debugRenderer,
      inputManager,
      showroomStage,
      onboardingUI,
      gameplayHUD
    );

    app.setupEventHandlers();
    app.setupInputHandlers();
    app.setupOnboardingHandlers();

    return app;
  }

  private setupOnboardingHandlers(): void {
    // Screen transitions
    this.onboardingUI.onScreenChange = (screen: ScreenState) => {
      if (this.online.isActive() && (screen === 'MAIN_MENU' || (screen === 'VEHICLE_SELECT' && this.onlineScene))) {
        this.online.shutdown();
      }
      if (screen === 'MAIN_MENU') {
        this.state = 'MAIN_MENU';
        this.setHUDVisible(false);
        this.showroomStage.setMode('MAIN_MENU');
        const v = this.onboardingUI.getSelectedVehicle();
        this.showroomStage.setTurntableVehicle(v.type, false);
      } else if (screen === 'VEHICLE_SELECT') {
        this.state = 'VEHICLE_SELECT';
        this.setHUDVisible(false);
        this.showroomStage.setMode('VEHICLE_SELECT');
        const v = this.onboardingUI.getSelectedVehicle();
        this.showroomStage.setTurntableVehicle(v.type, false);
      } else if (screen === 'LEADERBOARD') {
        this.state = 'LEADERBOARD';
        this.setHUDVisible(false);
        this.showroomStage.setMode('LEADERBOARD');
        this.onboardingUI.updateLeaderboardPodium(
          this.showroomStage.camera,
          this.showroomStage.getPodiumAnchors()
        );
      } else if (screen === 'GAMEPLAY') {
        this.state = 'GAMEPLAY';
        this.setHUDVisible(true);
      }
    };

    // Vehicle carousel cycling
    this.onboardingUI.onVehicleChange = (type: VehicleType) => {
      this.showroomStage.setTurntableVehicle(type, true);
    };

    // Primary CTA: Play with chosen car
    this.onboardingUI.onLaunchGame = async (type: VehicleType) => {
      if (this.onboardingUI.isOnlineFlow()) {
        await this.online.launch(type);
        return;
      }
      await this.launchGameWithVehicle(type);
    };

    this.onboardingUI.onPlayOnline = () => {
      this.online.openWallet();
    };

    this.onboardingUI.onOnlineLeaderboardShown = (host) => this.online.leaderboard.attach(host);
    this.onboardingUI.onOnlineLeaderboardHidden = () => this.online.leaderboard.detach();

    // In-game pause controls
    this.onboardingUI.onResumeGame = () => {
      this.resumeGame();
    };

    this.onboardingUI.onRestartGame = () => {
      this.restartMatch();
    };

    // Match Result Modal callbacks (Play Again / Return to Garage)
    this.gameplayHUD.onPlayAgain = () => {
      this.restartMatch();
    };

    this.gameplayHUD.onReturnToGarage = () => {
      this.state = 'VEHICLE_SELECT';
      this.setHUDVisible(false);
      this.onboardingUI.setScreen('VEHICLE_SELECT');
      this.showroomStage.setMode('VEHICLE_SELECT');
      const v = this.onboardingUI.getSelectedVehicle();
      this.showroomStage.setTurntableVehicle(v.type, false);
    };
  }

  private setupEventHandlers(): void {
    this.collisionSystem.setJuiceHooks({
      cameraShake: (intensity, normal) => this.gameCamera.cameraShake(intensity, normal),
      cameraPunch: (direction, magnitude) => this.gameCamera.cameraPunch(direction, magnitude),
      hitStop: (duration) => this.gameLoop.triggerHitStop(duration),
    });

    EventBus.get().on<CollisionEvent>('collision', (event) => {
      if (this.state !== 'GAMEPLAY') return;
      this.debugRenderer.showImpact(event);
      const shockColor =
        event.tier === 'CRITICAL' ? 0xff0055
        : event.tier === 'PERFECT' ? 0x00f5a0
        : event.tier === 'HEAVY' ? 0xffb800 : 0x00e5ff;
      const maxRadius =
        event.tier === 'CRITICAL' ? 3.8
        : event.tier === 'PERFECT' ? 3.2
        : event.tier === 'HEAVY' ? 2.4 : 1.5;
      this.shockwaveManager.spawnShockwave(event.position, shockColor, maxRadius, 0.32);
      if (this.onlineScene && (event.attackerId === 'player_car' || event.victimId === 'player_car')) {
        this.gameCamera.cameraShake(event.intensity * 0.6, event.normal);
      }
    });

    EventBus.get().on('money_scatter', (data: { position: THREE.Vector3; amount: number; normal?: THREE.Vector3 }) => {
      if (this.state !== 'GAMEPLAY') return;
      this.pickupManager.spawnScatter(data.position, data.amount, data.normal);
    });

    EventBus.get().on('money_collected', (data: { position: THREE.Vector3; amount: number }) => {
      if (this.state !== 'GAMEPLAY') return;
      this.shockwaveManager.spawnShockwave(data.position, 0xffcc00, 1.4, 0.24);
    });

    EventBus.get().on('vehicle_liquidated', (data: { carId: string; pitLocation: { x: number; z: number } }) => {
      if (this.state !== 'GAMEPLAY') return;
      const pitCenter = new THREE.Vector3(data.pitLocation.x, 0.4, data.pitLocation.z);
      this.shockwaveManager.spawnShockwave(pitCenter, 0xff0033, 5.2, 0.55);
    });

    EventBus.get().on('vehicle_eliminated', (data: { carId: string }) => {
      if (this.state !== 'GAMEPLAY') return;

      if (this.onlineScene) {
        if (data.carId === 'player_car' && !this.isPlayerSpectating) {
          this.isPlayerSpectating = true;
          this.gameCamera.setSpectatorMode(true);
          const remotes = this.online.getRemoteCars();
          const alive = remotes.filter((c) => !c.controller.isEliminated()).length;
          this.gameplayHUD.setSpectatorMode(true, alive + 1, remotes.length + 1);
          this.updateSpectatorTargetInfo();
        }
        return;
      }

      const allCars = [this.playerCar, ...this.opponentManager.getAllCars()];
      const aliveCars = allCars.filter((c) => !c.controller.isEliminated());

      if (data.carId === 'player_car') {
        this.isPlayerSpectating = true;
        this.gameCamera.setSpectatorMode(true);
        const finishedRank = aliveCars.length + 1;
        const totalCount = allCars.length;
        this.gameplayHUD.setSpectatorMode(true, finishedRank, totalCount);
        this.updateSpectatorTargetInfo();
      }

      // FINAL DUEL: Triggered when exactly 2 cars remain alive in the match (PRD Section 24)
      if (aliveCars.length === 2 && !this.isFinalDuelActive) {
        this.isFinalDuelActive = true;
        SoundManager.get().playFinalDuel();

        // Atmospheric tense duel lighting tint
        if (this.arena.ambientLight) this.arena.ambientLight.color.setHex(0x280612);
        if (this.arena.dirLight) this.arena.dirLight.intensity = 2.4;

        const otherCar = aliveCars.find((c) => c.id !== 'player_car') || aliveCars[0];
        const opponentName = this.formatVehicleHandle(otherCar.id, otherCar.vehicleType);

        EventBus.get().emit('final_duel', {
          opponentName,
          opponentCash: otherCar.controller.getBalance(),
          playerCash: this.playerCar.controller.getBalance(),
        });
      }

      // If only 1 survivor remains, wrap up the match immediately
      if (aliveCars.length <= 1) {
        console.log('[GameApp] Match finished: only 1 survivor remains!');
        this.matchManager.endMatchEarly();
      }
    });
  }

  private setupInputHandlers(): void {
    // Reset cars on 'R' (only during active gameplay)
    this.inputManager.onReset(() => {
      if (this.state !== 'GAMEPLAY' || this.onlineScene) return;
      this.playerCar.reset(this.spawnPosPlayer, 0);
      this.opponentManager.resetAll();
    });

    // Toggle opponent AI mode on 'T'
    this.inputManager.onToggleAI(() => {
      if (this.state !== 'GAMEPLAY' || this.onlineScene) return;
      const mode = this.opponentManager.toggleAIMode();
      console.log(`[AI] Opponent AI set to ${mode}`);
    });

    // Toggle debug overlay on 'F1' or '~'
    this.inputManager.onToggleDebug(() => {
      if (this.state !== 'GAMEPLAY' || this.onlineScene) return;
      this.debugRenderer.toggle();
    });

    // Cycle camera on 'C'
    this.inputManager.onToggleCamera(() => {
      if (this.state !== 'GAMEPLAY') return;
      const mode = this.gameCamera.toggleMode();
      console.log(`[Camera] Switched to ${mode} mode`);
    });

    // Cycle player vehicle archetype on 'V'
    this.inputManager.onCycleVehicle(() => {
      if (this.state !== 'GAMEPLAY' || this.onlineScene) return;
      this.cyclePlayerVehicle();
    });

    // Cycle opponent vehicle archetype on 'B'
    this.inputManager.onCycleOpponent(() => {
      if (this.state !== 'GAMEPLAY' || this.onlineScene) return;
      this.cycleOpponentVehicle();
    });

    // Spectator mode cycling controls (Arrow Left/Right or A/D)
    this.gameplayHUD.onSpectatorCyclePrev = () => this.cycleSpectator(-1);
    this.gameplayHUD.onSpectatorCycleNext = () => this.cycleSpectator(1);

    window.addEventListener('keydown', (e) => {
      if (this.state !== 'GAMEPLAY' || !this.isPlayerSpectating) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.cycleSpectator(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.cycleSpectator(1);
      }
    });

    // Window resize
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.gameCamera.onResize(w, h);
      this.postProcessing.resize(w, h);
      this.showroomStage.onResize(w, h);
      if (this.state === 'LEADERBOARD') {
        this.onboardingUI.updateLeaderboardPodium(
          this.showroomStage.camera,
          this.showroomStage.getPodiumAnchors()
        );
      }
    });
  }

  /**
   * Toggles visibility of in-game HUD.
   */
  public setHUDVisible(visible: boolean): void {
    this.gameplayHUD.setVisible(visible);
    const dbg = document.getElementById('debug-overlay');
    if (!visible && dbg) dbg.style.display = 'none';
  }

  /**
   * Spawns arena gameplay with the chosen vehicle archetype and starts the battle!
   */
  public async launchGameWithVehicle(type: VehicleType): Promise<void> {
    if (this.isSwitchingVehicle) return;
    this.isSwitchingVehicle = true;

    try {
      if (this.playerCar.vehicleType !== type) {
        // Unregister and destroy existing player car
        this.collisionSystem.unregisterVehicle(this.playerCar.id);
        this.playerCar.destroy(this.scene, this.physicsWorld);

        // Instantiate selected archetype
        const newPlayer = await VehicleFactory.createVehicle(
          type,
          'player_car',
          this.scene,
          this.physicsWorld,
          this.spawnPosPlayer,
          0
        );

        this.collisionSystem.registerVehicle(newPlayer);
        this.playerCar = newPlayer;
        (window as any).__playerCar = newPlayer;
        await this.opponentManager.setPlayerTarget(newPlayer);
      } else {
        this.playerCar.reset(this.spawnPosPlayer, 0);
      }

      this.opponentManager.resetAll();

      // Reset spectator & duel state
      this.isPlayerSpectating = false;
      this.spectatedOpponentIndex = 0;
      this.isFinalDuelActive = false;
      if (this.arena.ambientLight) this.arena.ambientLight.color.setHex(0x091220);
      if (this.arena.dirLight) this.arena.dirLight.intensity = 1.8;
      this.gameCamera.setSpectatorMode(false);
      this.gameplayHUD.setSpectatorMode(false);

      // Update Gameplay HUD with active vehicle config
      this.gameplayHUD.setVehicle(this.playerCar.config);
      this.matchManager.startMatch();

      this.state = 'GAMEPLAY';
      this.onboardingUI.setScreen('GAMEPLAY');
      this.setHUDVisible(true);
      console.log(`[GameApp] Launched arena gameplay with ${this.playerCar.config.displayName}!`);
    } catch (err) {
      console.error('[GameApp] Error launching game with vehicle:', err);
    } finally {
      this.isSwitchingVehicle = false;
    }
  }

  public resumeGame(): void {
    this.state = 'GAMEPLAY';
  }

  public restartMatch(): void {
    if (this.onlineScene) return;
    this.playerCar.reset(this.spawnPosPlayer, 0);
    this.opponentManager.resetAll();
    this.isPlayerSpectating = false;
    this.spectatedOpponentIndex = 0;
    this.isFinalDuelActive = false;
    if (this.arena.ambientLight) this.arena.ambientLight.color.setHex(0x091220);
    if (this.arena.dirLight) this.arena.dirLight.intensity = 1.8;
    this.gameCamera.setSpectatorMode(false);
    this.gameplayHUD.setSpectatorMode(false);
    this.matchManager.resetMatch();
    this.state = 'GAMEPLAY';
    this.onboardingUI.setScreen('GAMEPLAY');
    this.setHUDVisible(true);
  }

  /**
   * Cycles player vehicle across all 5 archetypes in real-time.
   */
  public async cyclePlayerVehicle(): Promise<void> {
    if (this.isSwitchingVehicle) return;
    this.isSwitchingVehicle = true;

    try {
      const currentType = this.playerCar.vehicleType;
      const nextType = VehicleFactory.getNextVehicleType(currentType);

      // Preserve current position & heading
      const pState = this.playerCar.controller.getPhysicsState();
      const currentPos = pState.position.clone();
      const currentY = Math.max(0.4, currentPos.y);
      const euler = new THREE.Euler().setFromQuaternion(pState.quaternion, 'YXZ');
      const currentRotY = euler.y;

      // Unregister and destroy existing player car
      this.collisionSystem.unregisterVehicle(this.playerCar.id);
      this.playerCar.destroy(this.scene, this.physicsWorld);

      // Instantiate new archetype
      const newPlayer = await VehicleFactory.createVehicle(
        nextType,
        'player_car',
        this.scene,
        this.physicsWorld,
        new THREE.Vector3(currentPos.x, currentY, currentPos.z),
        currentRotY
      );

      this.collisionSystem.registerVehicle(newPlayer);
      this.playerCar = newPlayer;
      await this.opponentManager.setPlayerTarget(newPlayer);

      // Notify HUD
      this.gameplayHUD.setVehicle(newPlayer.config);
      this.gameplayHUD.enqueueNotification(
        '🚗',
        `VEHICLE: ${newPlayer.config.displayName}`,
        newPlayer.config.role,
        'info'
      );
      console.log(`[GameApp] Swapped player vehicle to: ${newPlayer.config.displayName} [${nextType}]`);
    } catch (err) {
      console.error('[GameApp] Error cycling player vehicle:', err);
    } finally {
      this.isSwitchingVehicle = false;
    }
  }

  /**
   * Cycles primary opponent archetype across all 5 archetypes in real-time.
   */
  public async cycleOpponentVehicle(): Promise<void> {
    const primary = this.opponentManager.getPrimaryOpponent();
    const id = primary ? primary.id : 'opponent_bear';
    const opp = await this.opponentManager.cycleOpponentType(id);
    if (opp) {
      this.gameplayHUD.enqueueNotification(
        '🚗',
        `OPPONENT: ${opp.config.displayName}`,
        opp.config.role,
        'info'
      );
    }
  }

  /**
   * Cycle spectated surviving car (Arrow Left/Right or A/D).
   */
  public cycleSpectator(direction: number): void {
    if (!this.isPlayerSpectating) return;
    const aliveOpponents = this.getAliveOpponentCars();
    if (aliveOpponents.length === 0) return;
    this.spectatedOpponentIndex =
      (this.spectatedOpponentIndex + direction + aliveOpponents.length) % aliveOpponents.length;
    this.updateSpectatorTargetInfo();
  }

  private getAliveOpponentCars(): HeroCar[] {
    if (this.onlineScene) {
      return this.online.getRemoteCars().filter((car) => !car.controller.isEliminated());
    }
    return this.opponentManager.getAliveOpponents();
  }

  private updateSpectatorTargetInfo(): void {
    const aliveOpponents = this.getAliveOpponentCars();
    if (aliveOpponents.length === 0) return;
    if (this.spectatedOpponentIndex >= aliveOpponents.length) {
      this.spectatedOpponentIndex = 0;
    }
    const target = aliveOpponents[this.spectatedOpponentIndex];
    const name = this.formatVehicleHandle(target.id, target.vehicleType);
    const cash = target.controller.getBalance();
    const isBounty = BountySystem.get().getTier(cash) === 'BOUNTY';
    this.gameplayHUD.updateSpectatorTarget(name, cash, isBounty);
  }

  private formatVehicleHandle(id: string, type?: VehicleType): string {
    if (id === 'opponent_whale' || type === 'gold_whale') return 'Diamond_Hands';
    if (id === 'opponent_tsla' || type === 'tsla_racer') return 'Tesla_DeGen';
    if (id === 'opponent_nvda' || type === 'nvda_ai') return 'Nvda_Max';
    if (id === 'opponent_bear' || type === 'hood_bear') return 'Hood_Bear';
    return id.replace('opponent_', '').toUpperCase();
  }

  public setDebugGlobals(enabled: boolean): void {
    const globals = window as unknown as Record<string, unknown>;
    if (enabled) {
      globals.__gameApp = this;
      globals.__assetManager = AssetManager.get();
      globals.__playerCar = this.playerCar;
      globals.__opponentManager = this.opponentManager;
      globals.__gameCamera = this.gameCamera;
    } else {
      for (const key of ['__gameApp', '__assetManager', '__playerCar', '__opponentManager', '__gameCamera', 'THREE']) {
        delete globals[key];
      }
    }
  }

  private async prepareOnlineMatch(type: VehicleType): Promise<HeroCar> {
    this.isSwitchingVehicle = true;
    try {
      this.onlineScene = true;
      document.body.classList.add('online-mode');
      this.setDebugGlobals(false);
      this.gameLoop.setHitStopEnabled(false);
      this.powerUpManager.clearAll();
      this.pickupManager.update(10000, []);

      if (this.playerCar.vehicleType !== type) {
        this.collisionSystem.unregisterVehicle(this.playerCar.id);
        this.playerCar.destroy(this.scene, this.physicsWorld);
        const newPlayer = await VehicleFactory.createVehicle(
          type,
          'player_car',
          this.scene,
          this.physicsWorld,
          this.spawnPosPlayer,
          0
        );
        this.collisionSystem.registerVehicle(newPlayer);
        this.playerCar = newPlayer;
        await this.opponentManager.setPlayerTarget(newPlayer);
      } else {
        this.playerCar.reset(this.spawnPosPlayer, 0);
      }

      for (const car of this.opponentManager.getAllCars()) car.root.visible = false;

      this.isPlayerSpectating = false;
      this.spectatedOpponentIndex = 0;
      this.isFinalDuelActive = false;
      if (this.arena.ambientLight) this.arena.ambientLight.color.setHex(0x091220);
      if (this.arena.dirLight) this.arena.dirLight.intensity = 1.8;
      this.gameCamera.setSpectatorMode(false);
      this.gameplayHUD.setSpectatorMode(false);
      this.gameplayHUD.hideResultModal();
      this.gameplayHUD.setVehicle(this.playerCar.config);
      return this.playerCar;
    } finally {
      this.isSwitchingVehicle = false;
    }
  }

  private beginOnlineGameplay(): void {
    this.state = 'GAMEPLAY';
    this.onboardingUI.setScreen('GAMEPLAY');
    this.setHUDVisible(true);
  }

  private restoreOffline(): void {
    if (!this.onlineScene) return;
    this.onlineScene = false;
    document.body.classList.remove('online-mode');
    this.gameLoop.setHitStopEnabled(true);
    for (const car of this.opponentManager.getAllCars()) car.root.visible = true;
    this.isPlayerSpectating = false;
    this.gameCamera.setSpectatorMode(false);
    this.gameplayHUD.setSpectatorMode(false);
    this.gameplayHUD.hideResultModal();
    this.opponentManager.resetAll();
    this.playerCar.reset(this.spawnPosPlayer, 0);
    this.setDebugGlobals(true);
    (window as unknown as Record<string, unknown>).THREE = THREE;
  }

  private renderOnline(dt: number): void {
    this.online.update(dt);
    const remotes = this.online.getRemoteCars();

    const pPhys = this.playerCar.controller.getPhysicsState();
    if (pPhys.isDrifting && !this.playerCar.controller.isEliminated()) {
      const rearL = new THREE.Vector3(-0.75, 0.05, -0.9).applyQuaternion(pPhys.quaternion).add(pPhys.position);
      const rearR = new THREE.Vector3(0.75, 0.05, -0.9).applyQuaternion(pPhys.quaternion).add(pPhys.position);
      this.skidMarkManager.addSkid(rearL, rearR, pPhys.driftRatio);
    } else {
      this.skidMarkManager.endSkid();
    }

    this.skidMarkManager.update(dt);
    this.shockwaveManager.update(dt);
    this.pickupManager.update(dt, []);
    this.arena.update(dt);

    if (this.isPlayerSpectating) {
      const alive = this.getAliveOpponentCars();
      if (alive.length > 0) {
        if (this.spectatedOpponentIndex >= alive.length) this.spectatedOpponentIndex = 0;
        const target = alive[this.spectatedOpponentIndex];
        this.gameCamera.update(dt, target.controller.getPhysicsState(), target.controller.getTitanScale());
        this.updateSpectatorTargetInfo();
      } else {
        this.gameCamera.update(dt, pPhys, this.playerCar.controller.getTitanScale());
      }
    } else {
      this.gameCamera.setBoostFOV(this.playerCar.controller.isBoosting());
      this.gameCamera.update(dt, pPhys, this.playerCar.controller.getTitanScale());
    }

    this.gameplayHUD.update(dt, this.gameCamera.camera, this.playerCar, remotes);
    this.postProcessing.render();
  }

  public start(): void {
    this.gameLoop.start();
    console.log('🚀 BUMP.TRADE Menu & Onboarding System initialized successfully!');
  }

  private physicsTick(dt: number): void {
    // Only simulate gameplay physics when in active gameplay
    if (this.state !== 'GAMEPLAY') return;
    if (this.isSwitchingVehicle) return;

    if (this.onlineScene) {
      this.online.tickInput(this.inputManager.sampleInput());
      return;
    }

    const playerInput = this.inputManager.sampleInput();

    // 1. Step Player Car
    this.playerCar.controller.stepPhysics(dt, playerInput);

    // 2. Step Opponent Fleet
    this.opponentManager.stepPhysics(dt);

    // 3. Step Rapier Physics World
    this.physicsWorld.step(dt);

    // 4. Update Collisions & Impulses
    this.collisionSystem.update();

    // 5. Check Margin Void Hazards
    const allCars = [this.playerCar, ...this.opponentManager.getAllCars()];
    this.arena.checkVoidHazards(allCars);
  }

  private renderTick(dt: number): void {
    // In Menu states (Main Menu, Vehicle Select, Leaderboard), render 3D Showroom
    if (
      this.state === 'MAIN_MENU' ||
      this.state === 'VEHICLE_SELECT' ||
      this.state === 'LEADERBOARD'
    ) {
      this.showroomStage.update(dt);
      if (this.state === 'LEADERBOARD') {
        this.onboardingUI.updateLeaderboardPodium(
          this.showroomStage.camera,
          this.showroomStage.getPodiumAnchors()
        );
      }
      this.showroomStage.render(this.renderer);
      return;
    }

    // In Paused mode, render paused gameplay scene behind overlay
    if (this.state === 'PAUSED') {
      this.postProcessing.render();
      return;
    }

    if (this.isSwitchingVehicle) return;

    if (this.onlineScene) {
      this.renderOnline(dt);
      return;
    }

    const playerInput = this.inputManager.sampleInput();

    // 1. Visual Updates
    this.playerCar.controller.update(dt, playerInput);
    this.opponentManager.update(dt);

    // 2. Drift Skidmarks
    const pPhys = this.playerCar.controller.getPhysicsState();
    if (pPhys.isDrifting || (pPhys.speed > 5.0 && playerInput.brake)) {
      const rearL = new THREE.Vector3(-0.75, 0.05, -0.9).applyQuaternion(pPhys.quaternion).add(pPhys.position);
      const rearR = new THREE.Vector3(0.75, 0.05, -0.9).applyQuaternion(pPhys.quaternion).add(pPhys.position);
      this.skidMarkManager.addSkid(rearL, rearR, pPhys.driftRatio);
    } else {
      this.skidMarkManager.endSkid();
    }

    // 3. VFX, Pickups, Power-Ups, Arena & Match Timeline
    this.skidMarkManager.update(dt);
    this.shockwaveManager.update(dt);
    const allCars = [this.playerCar, ...this.opponentManager.getAllCars()];
    this.pickupManager.update(dt, allCars);
    this.powerUpManager.update(dt, allCars);
    this.arena.update(dt);
    this.matchManager.update(dt);

    // 4. Camera Follow
    if (this.isPlayerSpectating) {
      const aliveOpponents = this.opponentManager.getAliveOpponents();
      if (aliveOpponents.length > 0) {
        if (this.spectatedOpponentIndex >= aliveOpponents.length) {
          this.spectatedOpponentIndex = 0;
        }
        const target = aliveOpponents[this.spectatedOpponentIndex];
        this.gameCamera.update(dt, target.controller.getPhysicsState(), target.controller.getTitanScale());
      } else {
        this.gameCamera.update(dt, this.playerCar.controller.getPhysicsState(), this.playerCar.controller.getTitanScale());
      }
      this.updateSpectatorTargetInfo();
    } else {
      this.gameCamera.setBoostFOV(this.playerCar.controller.boost.isActive());
      this.gameCamera.update(dt, this.playerCar.controller.getPhysicsState(), this.playerCar.controller.getTitanScale());
    }

    // 5. Debug Metrics Overlay
    const primaryOpponent = this.opponentManager.getPrimaryOpponent();
    const aiLabel = this.opponentManager.getAIMode() === 'ACTIVE' ? 'COMBAT' : 'PRACTICE';
    this.debugRenderer.update(this.playerCar, primaryOpponent, aiLabel);

    // 6. Modern Gameplay HUD Update
    this.gameplayHUD.update(
      dt,
      this.gameCamera.camera,
      this.playerCar,
      this.opponentManager.getAllCars()
    );

    // 7. Post-Processing Render
    this.postProcessing.render();
  }
}
