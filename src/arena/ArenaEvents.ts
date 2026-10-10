import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { SoundManager } from '../audio/SoundManager';

export interface FlamePillar {
  group: THREE.Group;
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  baseY: number;
}

export class ArenaEvents {
  private scene: THREE.Scene;
  private ambientLight?: THREE.AmbientLight;
  private keyLight?: THREE.DirectionalLight;

  // 8 Perimeter Flame Pillars
  private flamePillars: FlamePillar[] = [];
  private isFireBurstActive: boolean = false;
  private fireBurstTimer: number = 0;
  private fireBurstDuration: number = 2.5;

  // Blackout event state
  private isBlackoutActive: boolean = false;
  private blackoutTimer: number = 0;

  // Market Crash event state
  private isCrashActive: boolean = false;
  private crashTimer: number = 0;
  // Double Steal Surge state (Strict Zero-Sum: all money comes from ramming opponents)
  private isSurgeActiveState: boolean = false;
  private surgeTimer: number = 0;
  private surgeDuration: number = 10.0;

  // Animated flame texture
  private flameMat!: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, ambientLight?: THREE.AmbientLight, keyLight?: THREE.DirectionalLight) {
    this.scene = scene;
    this.ambientLight = ambientLight;
    this.keyLight = keyLight;

    this.initFlameMaterials();
    this.buildFlamePillars();
  }

  private initFlameMaterials(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Vertical fire gradient: bright white-yellow core to orange-red tip
    const grad = ctx.createLinearGradient(0, 256, 0, 0);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, '#ffe600');
    grad.addColorStop(0.65, '#ff4800');
    grad.addColorStop(1.0, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 256);

    const flameTex = new THREE.CanvasTexture(canvas);
    this.flameMat = new THREE.MeshBasicMaterial({
      map: flameTex,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  private buildFlamePillars(): void {
    // 8 perimeter flame vent locations around outer walls
    const pillarPositions = [
      { x: -16, z: -21 },
      { x: 0, z: -21 },
      { x: 16, z: -21 },
      { x: -21, z: 0 },
      { x: 21, z: 0 },
      { x: -16, z: 21 },
      { x: 0, z: 21 },
      { x: 16, z: 21 },
    ];

    const flameGeo = new THREE.CylinderGeometry(0.5, 0.9, 5.0, 12, 1, true);
    flameGeo.translate(0, 2.5, 0); // Origin at base

    const nozzleGeo = new THREE.CylinderGeometry(0.7, 0.8, 0.45, 12);
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x222a36,
      metalness: 0.9,
      roughness: 0.3,
    });

    pillarPositions.forEach((pos) => {
      const group = new THREE.Group();
      group.position.set(pos.x, 0.1, pos.z);

      // Industrial vent nozzle ring
      const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
      nozzle.position.y = 0.22;
      group.add(nozzle);

      // Flame cylinder
      const flame = new THREE.Mesh(flameGeo, this.flameMat.clone());
      flame.scale.set(1, 0.01, 1);
      group.add(flame);

      // Warm dynamic flickering PointLight
      const light = new THREE.PointLight(0xff6600, 0.0, 12.0);
      light.position.set(0, 2.0, 0);
      group.add(light);

      this.scene.add(group);
      this.flamePillars.push({
        group,
        mesh: flame,
        light,
        baseY: 0.1,
      });
    });
  }

  /**
   * Triggers the 20s Fire Burst Arena Pulse:
   * Phase 1: lights dim slightly, warning beacons flash.
   * Phase 2: flame bursts roar upward for 2.5s (0 damage, pure atmospheric spectacle).
   * Phase 3: lights restore to neon normal.
   */
  public triggerFireBurst(): void {
    this.isFireBurstActive = true;
    this.fireBurstTimer = 0;

    // Dim stadium lighting slightly for dramatic contrast
    if (this.ambientLight) this.ambientLight.intensity = 0.8;

    // Audio roar
    SoundManager.get().playFireBurst();

    EventBus.get().emit('arena_event', {
      type: 'FIRE_BURST',
      title: 'ARENA HAZARD: FIRE BURST',
      subtitle: 'PYROTECHNICS ACTIVE',
      duration: this.fireBurstDuration,
    });
  }

  /**
   * Triggers Market Flash: Peripheral billboards rapidly strobe crypto/stock fluctuations.
   */
  public triggerMarketFlash(): void {
    EventBus.get().emit('arena_event', {
      type: 'MARKET_FLASH',
      title: 'MARKET FLASH',
      subtitle: '$HOOD ▲ +14.2%  |  $NVDA ▲ +18.7%',
      duration: 3.0,
    });
    SoundManager.get().playMarketEvent('market_flash');
  }

  /**
   * Triggers Blackout: Brief 1s lighting dip followed by explosive neon reboot.
   */
  public triggerBlackout(): void {
    this.isBlackoutActive = true;
    this.blackoutTimer = 0;

    if (this.ambientLight) this.ambientLight.intensity = 0.05;
    if (this.keyLight) this.keyLight.intensity = 0.1;

    EventBus.get().emit('arena_event', {
      type: 'BLACKOUT',
      title: 'POWER DIP',
      subtitle: 'GRID REBOOTING...',
      duration: 1.2,
    });
  }

  /**
   * Triggers Market Crash: red emergency lighting & siren alert.
   */
  public triggerMarketCrash(): void {
    this.isCrashActive = true;
    this.crashTimer = 0;

    if (this.ambientLight) this.ambientLight.color.setHex(0x33050d);

    SoundManager.get().playMarketEvent('market_crash');

    EventBus.get().emit('arena_event', {
      type: 'MARKET_CRASH',
      title: 'MARKET CRASH',
      subtitle: '$HOOD -6.4% ▼ // MASS LIQUIDATION',
      duration: 4.0,
    });
  }

  /**
   * Triggers Double Steal Surge: 10s PvP frenzy where all ram impacts extract 2× cash!
   * Upholds strict Zero-Sum PvP rule: all money strictly comes from other players.
   */
  public triggerDoubleStealSurge(): void {
    this.isSurgeActiveState = true;
    this.surgeTimer = 0;

    SoundManager.get().playMarketEvent('market_crash');

    EventBus.get().emit('arena_event', {
      type: 'DOUBLE_STEAL_SURGE',
      title: '⚡ DOUBLE STEAL SURGE',
      subtitle: 'ALL RAM IMPACTS EXTRACT 2× CASH!',
      duration: this.surgeDuration,
    });
  }

  public isSurgeActive(): boolean {
    return this.isSurgeActiveState;
  }


  public update(dt: number): void {
    // 1. Update Fire Burst Animation
    if (this.isFireBurstActive) {
      this.fireBurstTimer += dt;
      const progress = this.fireBurstTimer / this.fireBurstDuration;

      if (this.fireBurstTimer < this.fireBurstDuration) {
        // Flame height envelope: quick rise, flickering plateau, smooth fade
        let envelope = 1.0;
        if (progress < 0.15) {
          envelope = progress / 0.15;
        } else if (progress > 0.8) {
          envelope = (1.0 - progress) / 0.2;
        }

        const flicker = 0.85 + Math.random() * 0.3;
        const scaleY = envelope * flicker;

        for (const pillar of this.flamePillars) {
          pillar.mesh.scale.set(1.0 + Math.random() * 0.15, scaleY, 1.0 + Math.random() * 0.15);
          pillar.mesh.rotation.y += dt * 4.0;
          (pillar.mesh.material as THREE.MeshBasicMaterial).opacity = envelope * 0.88;
          pillar.light.intensity = 4.5 * envelope * flicker;
        }
      } else {
        // Complete Fire Burst
        this.isFireBurstActive = false;
        for (const pillar of this.flamePillars) {
          pillar.mesh.scale.set(1, 0.01, 1);
          (pillar.mesh.material as THREE.MeshBasicMaterial).opacity = 0.0;
          pillar.light.intensity = 0.0;
        }
        if (this.ambientLight && !this.isBlackoutActive && !this.isCrashActive) {
          this.ambientLight.intensity = 1.6;
        }
      }
    }

    // 2. Update Blackout
    if (this.isBlackoutActive) {
      this.blackoutTimer += dt;
      if (this.blackoutTimer >= 1.0) {
        this.isBlackoutActive = false;
        if (this.ambientLight) this.ambientLight.intensity = 1.6;
        if (this.keyLight) this.keyLight.intensity = 1.8;
        SoundManager.get().playImpact(0.8, 'HEAVY'); // Explosive neon reboot snap!
      }
    }

    // 3. Update Market Crash
    if (this.isCrashActive) {
      this.crashTimer += dt;
      if (this.crashTimer >= 4.0) {
        this.isCrashActive = false;
        if (this.ambientLight) {
          this.ambientLight.color.setHex(0x091220);
          this.ambientLight.intensity = 1.6;
        }
      }
    }

    // 4. Update Double Steal Surge
    if (this.isSurgeActiveState) {
      this.surgeTimer += dt;
      if (this.surgeTimer >= this.surgeDuration) {
        this.isSurgeActiveState = false;
      }
    }
  }

  public isFireActive(): boolean {
    return this.isFireBurstActive;
  }
}
