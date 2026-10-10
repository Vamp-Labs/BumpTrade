import * as THREE from 'three';
import { CAR_CONFIG } from '../core/Config';
import { VehicleInput } from '../input/InputManager';
import { CollisionEvent, CollisionTier } from '../collision/CollisionTypes';
import { CarPhysics } from './CarPhysics';
import { CarVisual } from './CarVisual';
import { CarAnimation } from './CarAnimation';
import { CarVFX } from './CarVFX';
import { CarAudio } from './CarAudio';
import { BoostController } from './BoostController';
import { VehicleState, CarPhysicsState, CarAnimationState } from './CarTypes';
import { PowerUpType, POWER_UP_CONFIGS } from '../pickups/PowerUpTypes';
import { BountySystem } from '../combat/BountySystem';
import { EventBus } from '../core/EventBus';
import { SoundManager } from '../audio/SoundManager';
import { ComboManager } from '../combat/ComboManager';

export class CarController {
  public readonly physics: CarPhysics;
  public readonly visual: CarVisual;
  public readonly animation: CarAnimation;
  public readonly vfx: CarVFX;
  public readonly audio: CarAudio;
  public readonly boost: BoostController;

  private state: VehicleState = 'IDLE';
  private hitTimer: number = 0;
  private currentHitTier?: CollisionTier;
  private wasBoostingPrev: boolean = false;
  private lastDriftTime: number = 0;

  // Balance = Life: Strictly Synchronized Economy & Health
  private maxBalance: number = 85;
  private balance: number = 85;
  private damageRatio: number = 0.0;
  private isFalling: boolean = false;
  private respawnTargetPos: THREE.Vector3 = new THREE.Vector3(0, 0.4, 0);

  // Active Collectible Power-Ups
  private activePowerUps: Map<PowerUpType, { remaining: number; duration: number }> = new Map();

  // 3D Power-Up Visual Meshes attached to vehicle root
  private shieldMesh?: THREE.Mesh;
  private titanScale: number = 1.0;
  private hasPlayedTitanIntro: boolean = false;

  constructor(
    physics: CarPhysics,
    visual: CarVisual,
    animation: CarAnimation,
    vfx: CarVFX,
    audio: CarAudio,
    initialBalance: number = 85
  ) {
    this.physics = physics;
    this.visual = visual;
    this.animation = animation;
    this.vfx = vfx;
    this.audio = audio;
    this.boost = new BoostController();
    this.balance = initialBalance;
    this.maxBalance = Math.max(100, initialBalance);
    this.damageRatio = 0.0;
    this.visual.updateMoneyDisplay(this.balance);
    this.visual.setBountyTier(BountySystem.get().getTier(this.balance));
    this.setupPowerUpVisuals();
  }

  private setupPowerUpVisuals(): void {
    const root = this.visual.bindings.root;
    if (!root) return;

    // KINETIC REFLECTOR: Razor-thin transparent hexagonal wireframe lattice clinging close to car body
    // (100% vehicle visibility, 0 floor obstruction!)
    const shieldWireGeo = new THREE.IcosahedronGeometry(1.58, 2);
    const shieldWireMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      wireframe: true,
      transparent: true,
      opacity: 0.08, // Subtle energy lattice, vehicle is 100% visible
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.shieldMesh = new THREE.Mesh(shieldWireGeo, shieldWireMat);
    this.shieldMesh.position.set(0, 0.45, 0);
    this.shieldMesh.visible = false;
    root.add(this.shieldMesh);
  }

  public getHealth(): number {
    return this.balance;
  }

  public getMaxHealth(): number {
    return this.maxBalance;
  }

  public getMaxBalance(): number {
    return this.maxBalance;
  }

  public getDamageRatio(): number {
    return this.damageRatio;
  }

  public isEliminated(): boolean {
    return this.state === 'ELIMINATED' || this.state === 'LIQUIDATED';
  }

  public isAlive(): boolean {
    return !this.isEliminated();
  }

  public isCriticalBag(): boolean {
    return this.isAlive() && this.balance < 25;
  }

  public isCritical(): boolean {
    return this.isCriticalBag();
  }

  /**
   * Deducts cash balance directly as damage (Balance = Life).
   * Strict Zero-Sum Economy: never drops below $0.
   */
  public subtractBalance(amount: number, localImpactDir?: THREE.Vector3, intensity: number = 0.5): number {
    if (this.isEliminated()) return 0;

    const stealAmount = Math.max(0, Math.min(amount, this.balance));
    this.balance -= stealAmount;
    this.damageRatio = Math.max(0, Math.min(1.0, (this.maxBalance - this.balance) / this.maxBalance));

    this.visual.updateMoneyDisplay(this.balance);
    this.visual.applyDamage(this.damageRatio, localImpactDir, intensity);
    this.visual.setBountyTier(BountySystem.get().getTier(this.balance));

    if (this.balance <= 0) {
      this.eliminate();
    } else if (this.balance < 25) {
      this.state = 'CRITICAL';
      this.visual.setCriticalBag(true);
    } else {
      this.visual.setCriticalBag(false);
    }

    return stealAmount;
  }

  public takeDamage(amount: number, localImpactDir?: THREE.Vector3, intensity: number = 0.5): void {
    this.subtractBalance(amount, localImpactDir, intensity);
  }

  public repair(amount: number = 25): void {
    if (this.isEliminated()) return;
    this.addMoney(amount);
  }

  public addMoney(amount: number): void {
    if (this.isEliminated()) return;
    this.balance += amount;
    if (this.balance > this.maxBalance) {
      this.maxBalance = this.balance;
    }
    this.damageRatio = Math.max(0, (this.maxBalance - this.balance) / this.maxBalance);
    this.visual.updateMoneyDisplay(this.balance);
    this.visual.setBountyTier(BountySystem.get().getTier(this.balance));

    if (this.balance >= 25) {
      this.visual.setCriticalBag(false);
      if (this.state === 'CRITICAL') {
        this.state = 'IDLE';
      }
    }
  }

  public dropMoney(amount: number): number {
    return this.subtractBalance(amount);
  }

  public getBalance(): number {
    return this.balance;
  }

  public setBalance(amount: number): void {
    this.balance = Math.max(0, amount);
    if (this.balance > this.maxBalance) {
      this.maxBalance = this.balance;
    }
    this.damageRatio = Math.max(0, (this.maxBalance - this.balance) / this.maxBalance);
    this.visual.updateMoneyDisplay(this.balance);
    this.visual.setBountyTier(BountySystem.get().getTier(this.balance));

    if (this.balance <= 0) {
      this.eliminate();
    } else if (this.balance < 25) {
      this.state = 'CRITICAL';
      this.visual.setCriticalBag(true);
    } else {
      this.visual.setCriticalBag(false);
    }
  }

  public setOnlineBalance(amount: number, maxBalance: number): void {
    if (this.isEliminated()) return;
    const previous = this.balance;
    this.maxBalance = Math.max(1, maxBalance);
    this.setBalance(amount);
    if (amount < previous && amount > 0) {
      this.visual.applyDamage(this.damageRatio);
    }
  }

  /**
   * Strict Single-Life Elimination (balance <= 0 or fell into void pit).
   * NO respawns, NO second lives, NO re-entry.
   * One-way state transition: ALIVE -> CRITICAL -> ELIMINATED.
   */
  public eliminate(): void {
    if (this.isEliminated()) return;
    this.balance = 0;
    this.state = 'ELIMINATED';
    this.damageRatio = 1.0;

    // 1. Lock physics body to become stationary wreck
    this.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.physics.body.setLinearDamping(35.0);
    this.physics.body.setAngularDamping(35.0);

    // 2. Visual & VFX permanent destruction
    this.visual.triggerEliminationShutdown();
    this.vfx.triggerExplosionWreck(this.physics.getState().position);
    this.audio.updateEngine(0, false);

    // 3. Audio alarm
    SoundManager.get().playImpact(1.0, 'CRITICAL');

    EventBus.get().emit('vehicle_eliminated', {
      carId: this.physics.id,
      position: this.physics.getState().position.clone(),
    });
  }

  public triggerFall(respawnPos: THREE.Vector3): void {
    if (this.isEliminated()) return;
    this.isFalling = true;
    this.respawnTargetPos.copy(respawnPos);

    // Give tumble impulse downward and spinning
    this.physics.body.applyImpulse({ x: 0, y: -4500, z: 0 }, true);
    this.physics.body.applyTorqueImpulse({ x: 400, y: 800, z: 400 }, true);

    // Falling into margin void causes instant liquidation without respawn
    this.eliminate();
  }

  public applyPowerUp(type: PowerUpType, duration?: number): void {
    const config = POWER_UP_CONFIGS[type];
    const dur = duration ?? config.duration;
    this.activePowerUps.set(type, { remaining: dur, duration: dur });

    // Inform Visual and VFX of body-contour aura and exhaust effects
    this.visual.setPowerUpAura(type, true);
    this.vfx.setPowerUpType(type);

    if (type === 'SHIELD') {
      if (this.shieldMesh) this.shieldMesh.visible = true;
    } else if (type === 'TITAN' || type === 'HEAVY_HIT') {
      this.hasPlayedTitanIntro = false;
      SoundManager.get().playTitanGrow();
    } else if (type === 'TURBO') {
      this.boost.refill();
      this.vfx.playBoost();
    }
  }

  public hasPowerUp(type: PowerUpType): boolean {
    const entry = this.activePowerUps.get(type);
    return entry !== undefined && entry.remaining > 0;
  }

  public getActivePowerUps(): Array<{ type: PowerUpType; remaining: number; duration: number }> {
    const list: Array<{ type: PowerUpType; remaining: number; duration: number }> = [];
    for (const [type, data] of this.activePowerUps.entries()) {
      if (data.remaining > 0) {
        list.push({ type, remaining: data.remaining, duration: data.duration });
      }
    }
    return list;
  }

  public getSpeedMultiplier(): number {
    return this.hasPowerUp('TURBO') ? 1.5 : 1.0;
  }

  public getImpactMultiplier(): number {
    return (this.hasPowerUp('TITAN') || this.hasPowerUp('HEAVY_HIT')) ? 2.5 : 1.0;
  }

  public getMagnetRadiusMultiplier(): number {
    return this.hasPowerUp('CASH_MAGNET') ? 3.5 : 1.0;
  }

  public isShieldActive(): boolean {
    return this.hasPowerUp('SHIELD');
  }

  public getTitanScale(): number {
    return this.titanScale;
  }

  public isBoosting(): boolean {
    return typeof this.boost?.isActive === 'function' ? this.boost.isActive() : !!(this.boost as any)?.isActive;
  }

  public isDriftingRecently(): boolean {
    return this.physics.getState().isDrifting || (performance.now() - this.lastDriftTime < 800);
  }

  /**
   * Fixed physics tick: passes inputs to physics simulation.
   */
  public stepPhysics(dt: number, input: VehicleInput): void {
    if (this.isEliminated()) {
      // Stationary wreck: lock body motion
      this.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    if (this.isFalling) {
      // Free fall without engine drive
      return;
    }

    // 1. Update Boost State
    this.boost.update(dt, input.boost);
    const isBoosting = this.boost.isActive();

    // Sound and VFX trigger when boost starts
    if (isBoosting && !this.wasBoostingPrev) {
      this.vfx.playBoost();
      this.audio.playBoostSound();
    } else if (!isBoosting && this.wasBoostingPrev) {
      this.vfx.stopBoost();
    }
    this.wasBoostingPrev = isBoosting;

    // 2. Drive Physics Body
    this.physics.setPowerUpSpeedMultiplier(this.getSpeedMultiplier());
    this.physics.setBoost(isBoosting, this.boost.getMultiplier());
    this.physics.step(dt, input);
  }

  /**
   * Visual / render frame update: synchronizes visuals, animations, VFX, and audio.
   */
  public update(dt: number, input: VehicleInput): void {
    const physState = this.physics.getState();

    if (this.isEliminated()) {
      // Smoking wreck: keep visuals, VFX and sagged frame updated
      this.visual.update(dt, physState, this.animation.getState(), false, false);
      this.vfx.update(dt, physState, 1.0);
      this.audio.updateEngine(0, false);
      return;
    }

    // 0. Update Active Power-Ups
    for (const [type, data] of this.activePowerUps.entries()) {
      data.remaining -= dt;
      if (data.remaining <= 0) {
        this.activePowerUps.delete(type);
        this.visual.setPowerUpAura(type, false);
        if (this.activePowerUps.size === 0) {
          this.vfx.setPowerUpType(null);
        } else {
          const nextType = this.activePowerUps.keys().next().value as PowerUpType | undefined;
          this.visual.setPowerUpAura(nextType ?? null, true);
          this.vfx.setPowerUpType(nextType ?? null);
        }
        if (type === 'SHIELD' && this.shieldMesh) {
          this.shieldMesh.visible = false;
        }
      }
    }

    // Dynamic TITAN RAM Vehicle Scaling (Smoothly expands to 1.75× size)
    const isTitan = this.hasPowerUp('TITAN') || this.hasPowerUp('HEAVY_HIT');
    const targetScale = isTitan ? 1.75 : 1.0;
    this.titanScale = THREE.MathUtils.lerp(this.titanScale, targetScale, 5.0 * dt);
    this.visual.bindings.root.scale.set(this.titanScale, this.titanScale, this.titanScale);

    if (isTitan && this.titanScale > 1.20 && !this.hasPlayedTitanIntro) {
      this.hasPlayedTitanIntro = true;
      SoundManager.get().playTitanGrow();
    }

    // Animate active Kinetic Reflector wireframe lattice
    if (this.shieldMesh && this.shieldMesh.visible) {
      this.shieldMesh.rotation.y += 1.2 * dt;
      this.shieldMesh.rotation.x += 0.8 * dt;
      const pulse = 1.0 + Math.sin(performance.now() * 0.005) * 0.04;
      this.shieldMesh.scale.set(pulse, pulse, pulse);
    }

    // 1. Update Vehicle State Machine
    this.updateStateMachine(dt, physState, input);

    const isBraking = this.state === 'BRAKING';
    const isBoosting = this.boost.isActive() || this.hasPowerUp('TURBO');

    // 2. Procedural Animation
    const animState = this.animation.update(
      dt,
      physState,
      this.state,
      input.throttle,
      isBoosting
    );

    // 3. Visual Synchronization & Bumper Spring Update
    this.visual.update(dt, physState, animState, isBraking, isBoosting);

    // 4. VFX Update (includes engine damage smoke and spark emissions)
    this.vfx.update(dt, physState, this.damageRatio);

    // 5. Audio Update
    const speedRatio = Math.min(physState.speed / CAR_CONFIG.maxSpeed, 1.0);
    this.audio.updateEngine(speedRatio, isBoosting);
  }

  /**
   * Handles collision response from CollisionSystem.
   * Procedural bumper compression, recoil, sparks, and impact audio.
   */
  public handleCollision(event: CollisionEvent, isAttacker: boolean): void {
    if (this.isEliminated()) return;

    this.hitTimer = 0.35;
    this.currentHitTier = event.tier;

    if (event.tier === 'CRITICAL' || event.tier === 'PERFECT') this.state = 'HIT_CRITICAL';
    else if (event.tier === 'HEAVY') this.state = 'HIT_HEAVY';
    else this.state = 'HIT_LIGHT';

    // If player car was victim of major impact, break combo (PRD Section 8)
    if (!isAttacker && this.physics.id === 'player_car') {
      ComboManager.get().onPlayerHitAsVictim(event.tier);
    }

    // Procedural Bumper Compression & Antenna recoil
    const localNormal = event.normal.clone().applyQuaternion(this.physics.getState().quaternion.clone().invert());
    if (isAttacker) localNormal.negate();

    this.visual.triggerBumperCompression(localNormal, event.intensity);
    this.animation.triggerImpact(event.intensity);

    // VFX Sparks & Flash
    this.vfx.playImpactSpark(event.position, event.intensity, event.normal);
    if (event.tier !== 'LIGHT') {
      this.vfx.playImpactFlash(event.position, event.intensity, event.normal);
    }

    // Audio
    this.audio.playImpactSound(event.intensity);
  }

  private updateStateMachine(dt: number, physState: CarPhysicsState, input: VehicleInput): void {
    if (physState.isDrifting) {
      this.lastDriftTime = performance.now();
    }
    if (this.isEliminated()) {
      this.state = 'ELIMINATED';
      return;
    }

    if (this.isFalling) {
      this.state = 'LIQUIDATED';
      return;
    }

    // If recently hit, preserve HIT state for brief duration
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) {
        this.currentHitTier = undefined;
      } else {
        return;
      }
    }

    // Critical bag state indication
    if (this.isCriticalBag()) {
      if (this.boost.isActive()) {
        this.state = 'BOOSTING';
      } else if (physState.isDrifting) {
        this.state = 'DRIFTING';
      } else {
        this.state = 'CRITICAL';
      }
      return;
    }

    if (this.boost.isActive()) {
      this.state = 'BOOSTING';
    } else if (physState.isDrifting) {
      this.state = 'DRIFTING';
    } else if (input.throttle < 0 && physState.forwardSpeed > 0.5) {
      this.state = 'BRAKING';
    } else if (Math.abs(input.steer) > 0.2 && physState.speed > 1.2) {
      this.state = 'TURNING';
    } else if (physState.speed > 0.3) {
      this.state = 'MOVING';
    } else {
      this.state = 'IDLE';
    }
  }

  public getState(): VehicleState {
    return this.state;
  }

  public setState(state: VehicleState): void {
    this.state = state;
  }

  public getCurrentHitTier(): CollisionTier | undefined {
    return this.currentHitTier;
  }

  public getPhysicsState(): CarPhysicsState {
    return this.physics.getState();
  }

  public getAnimationState(): CarAnimationState {
    return this.animation.getState();
  }

  public reset(pos: THREE.Vector3, rotY: number = 0): void {
    this.state = 'IDLE';
    this.balance = this.maxBalance;
    this.damageRatio = 0.0;
    this.isFalling = false;
    this.visual.resetDamage();
    this.visual.updateMoneyDisplay(this.balance);
    this.visual.setBountyTier(BountySystem.get().getTier(this.balance));
    this.visual.setCriticalBag(false);
    this.physics.reset(pos, rotY);
    this.physics.body.setLinearDamping(this.physics.config.linearDamping);
    this.physics.body.setAngularDamping(this.physics.config.angularDamping);
    this.boost.refill();
    this.activePowerUps.clear();
    this.visual.setPowerUpAura(null, false);
    this.vfx.setPowerUpType(null);
    this.titanScale = 1.0;
    this.visual.bindings.root.scale.set(1.0, 1.0, 1.0);
    if (this.shieldMesh) this.shieldMesh.visible = false;
  }
}
