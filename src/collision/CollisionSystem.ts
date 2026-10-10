import * as THREE from 'three';
import { CAR_CONFIG, COLLISION_CONFIG } from '../core/Config';
import { EventBus } from '../core/EventBus';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { HeroCar } from '../vehicles/HeroCar';
import { CollisionEvent, CollisionTier, ImpactJuiceHooks, SkillMomentType, SkillMomentEvent } from './CollisionTypes';
import { SoundManager } from '../audio/SoundManager';
import { ComboManager } from '../combat/ComboManager';

export class CollisionSystem {
  private physicsWorld: PhysicsWorld;
  private vehicles: Map<string, HeroCar> = new Map();
  private juiceHooks: ImpactJuiceHooks = {};
  private lastCollisionTime: number = 0;
  private surgeEndTime: number = 0;

  // Skill Crash Tracking State
  // 1. Bank Shot: car bounced off wall within last 1.2s
  private lastWallBounces: Map<string, { timestamp: number; speed: number; normal: THREE.Vector3 }> = new Map();

  // 2. Wall Slam: victim was hit by attacker within last 1.5s
  private recentVictimHits: Map<string, { attackerId: string; timestamp: number; impactForce: number; normal: THREE.Vector3 }> = new Map();

  // 3. Chain Reaction: car B was pushed by car A within 1.2s
  private chainReactionTracker: Map<string, { pushedById: string; timestamp: number }> = new Map();

  // 4. Revenge: car B remembers who hit them for up to 5.0s
  private revengeTracker: Map<string, { lastAttackerId: string; timestamp: number }> = new Map();

  // 5. Near Miss: cooldown per car pair
  private nearMissCooldowns: Map<string, number> = new Map();

  // 6. Corner Pin: car pinned against wall
  private pinTimers: Map<string, { pinnedById: string; timer: number; triggered: boolean }> = new Map();

  constructor(physicsWorld: PhysicsWorld) {
    this.physicsWorld = physicsWorld;

    EventBus.get().on('arena_event', (event: any) => {
      if (event && event.type === 'DOUBLE_STEAL_SURGE') {
        this.surgeEndTime = performance.now() + ((event.duration ?? 10.0) * 1000);
      }
    });
  }

  public registerVehicle(car: HeroCar): void {
    this.vehicles.set(car.id, car);
  }

  public unregisterVehicle(id: string): void {
    this.vehicles.delete(id);
    this.lastWallBounces.delete(id);
    this.recentVictimHits.delete(id);
    this.chainReactionTracker.delete(id);
    this.revengeTracker.delete(id);
    this.pinTimers.delete(id);
  }

  public setJuiceHooks(hooks: ImpactJuiceHooks): void {
    this.juiceHooks = { ...this.juiceHooks, ...hooks };
  }

  /**
   * Evaluates collision contacts from the physics engine event queue.
   */
  public update(): void {
    const dt = 1 / 60;

    // 1. Check Near Misses (Close Call) between high-speed vehicles without contact
    this.checkNearMisses();

    // 2. Check Corner Pins (pinned against wall >= 1.0s)
    this.checkCornerPins(dt);

    // 3. Drain and process physics contacts
    this.physicsWorld.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (!started) return;

      const data1 = this.physicsWorld.getColliderData(handle1);
      const data2 = this.physicsWorld.getColliderData(handle2);

      if (!data1 || !data2) return;

      // Rate limit multiple micro-contacts within same 50ms window
      const now = performance.now();
      if (now - this.lastCollisionTime < 50) return;

      // Vehicle vs Vehicle
      if (data1.type === 'vehicle' && data2.type === 'vehicle') {
        const car1 = this.vehicles.get(data1.id);
        const car2 = this.vehicles.get(data2.id);
        if (car1 && car2 && car1.id !== car2.id) {
          this.handleVehicleVehicleCollision(car1, car2);
          this.lastCollisionTime = now;
        }
      }
      // Vehicle vs Wall
      else if (
        (data1.type === 'vehicle' && data2.type === 'wall') ||
        (data1.type === 'wall' && data2.type === 'vehicle')
      ) {
        const vehicleData = data1.type === 'vehicle' ? data1 : data2;
        const car = this.vehicles.get(vehicleData.id);
        if (car) {
          this.handleVehicleWallCollision(car);
          this.lastCollisionTime = now;
        }
      }
    });
  }

  private handleVehicleVehicleCollision(carA: HeroCar, carB: HeroCar): void {
    const now = performance.now();
    const stateA = carA.controller.getPhysicsState();
    const stateB = carB.controller.getPhysicsState();

    // 1. Calculate Relative Velocity & Impact Speed
    const relVel = new THREE.Vector3().subVectors(stateA.velocity, stateB.velocity);
    const impactSpeed = relVel.length();

    // Disregard stationary resting contacts
    if (impactSpeed < 1.2) return;

    // Determine Attacker vs Victim based on dot product of velocity with direction vector
    const toB = new THREE.Vector3().subVectors(stateB.position, stateA.position).normalize();
    const dotA = stateA.velocity.clone().normalize().dot(toB);
    const dotB = stateB.velocity.clone().normalize().dot(toB.clone().negate());

    let attacker = carA;
    let victim = carB;
    let normal = toB;
    let stateAttacker = stateA;
    let stateVictim = stateB;

    if (dotB > dotA) {
      attacker = carB;
      victim = carA;
      normal = toB.clone().negate();
      stateAttacker = stateB;
      stateVictim = stateA;
    }

    // 2. Calculate Impact Force & Normalized Intensity (PRD Section 3 & 14)
    const impactForce = impactSpeed * CAR_CONFIG.mass * COLLISION_CONFIG.collisionMultiplier;
    const intensity = THREE.MathUtils.clamp(impactForce / COLLISION_CONFIG.maxImpactForce, 0.05, 1.0);

    // 3. ANGLE ANALYSIS & PERFECT ANGLE (PRD Section 4)
    // toVictim = vector from attacker toward victim
    const toVictim = normal.clone();
    const attackerFwd = stateAttacker.forward;
    const attackerFrontAlignment = attackerFwd.dot(toVictim); // 1.0 = attacker hit straight forward with nose

    const victimFwd = stateVictim.forward;
    const victimRight = stateVictim.right;
    const victimFlankExposure = Math.abs(victimRight.dot(toVictim)); // 1.0 = direct perpendicular flank/doors hit
    const victimRearExposure = Math.max(0, -victimFwd.dot(toVictim)); // 1.0 = direct rear hit

    let angleQuality: 'BAD' | 'GOOD' | 'PERFECT' = 'BAD';
    if (attackerFrontAlignment >= 0.65) {
      if (victimFlankExposure >= 0.65 || (victimRearExposure >= 0.70 && impactSpeed >= 9.0)) {
        angleQuality = 'PERFECT'; // Optimal T-bone or solid rear shunt
      } else if (victimFlankExposure >= 0.35 || attackerFrontAlignment >= 0.82) {
        angleQuality = 'GOOD';
      } else {
        angleQuality = 'BAD';
      }
    } else {
      angleQuality = 'BAD';
    }

    // 4. HIGH SPEED MULTIPLIER (PRD Section 5)
    let speedMultiplier = 1.0;
    if (impactSpeed >= 18.0) {
      speedMultiplier = 1.5; // MAX VELOCITY (×1.5)
    } else if (impactSpeed >= 10.0) {
      speedMultiplier = 1.25; // HIGH SPEED (×1.25)
    } else {
      speedMultiplier = 1.0; // LOW SPEED (×1.0)
    }

    const isVictimDead = victim.controller.isEliminated();
    const isAttackerDead = attacker.controller.isEliminated();
    const isEitherDead = isVictimDead || isAttackerDead;

    // 5. SKILL CRASH SIGNATURE MOMENTS DETECTION (PRD Sections 6-15)
    // Only active between living combatants (dead wrecks produce 0 skill moments or text effects)
    const skillMoments: SkillMomentType[] = [];
    let isHeadOn = false;
    let isBankShot = false;
    let isDriftBump = false;
    let isBoostCrash = false;
    let isRevenge = false;
    let isChainBump = false;
    let isDoubleImpact = false;

    if (!isEitherDead) {
      // 5a. COUNTER CRASH: Frontal head-on collision at high velocity (YOU -> <- ENEMY)
      const headOnDot = stateAttacker.forward.dot(stateVictim.forward);
      const speedTowardVictim = stateAttacker.velocity.dot(toVictim);
      const speedTowardAttacker = stateVictim.velocity.dot(toVictim.clone().negate());
      isHeadOn = headOnDot < -0.55 && speedTowardVictim > 2.5 && speedTowardAttacker > 2.5 && impactSpeed >= 12.0;

      if (isHeadOn) {
        skillMoments.push('COUNTER_CRASH');
      }

      // 5b. BANK SHOT: Player bounced off arena wall, then hits opponent within < 1.2s (PRD Section 10)
      const wallBounce = this.lastWallBounces.get(attacker.id);
      isBankShot = !!(wallBounce && (now - wallBounce.timestamp < 1200) && wallBounce.speed >= 3.0);
      if (isBankShot) {
        skillMoments.push('BANK_SHOT');
        this.lastWallBounces.delete(attacker.id); // Consumed
      }

      // 5c. DRIFT BUMP: Attacker drifting or recently drifting (PRD Section 12)
      isDriftBump = attacker.controller.isDriftingRecently();
      if (isDriftBump) {
        skillMoments.push('DRIFT_BUMP');
      }

      // 5d. BOOST CRASH: High speed impact while boosting (PRD Section 13)
      isBoostCrash = attacker.controller.isBoosting() || attacker.controller.hasPowerUp('TURBO');
      if (isBoostCrash) {
        skillMoments.push('BOOST_CRASH');
      }

      // 5e. REVENGE CRASH: Attacking the player who hit you within 5s (PRD Section 15)
      const rev = this.revengeTracker.get(attacker.id);
      isRevenge = !!(rev && rev.lastAttackerId === victim.id && (now - rev.timestamp < 5000));
      if (isRevenge) {
        skillMoments.push('REVENGE');
        this.revengeTracker.delete(attacker.id);
      }

      // 5f. CHAIN BUMP: Attacker was pushed by someone else within 1.2s into this victim (PRD Section 9)
      const chain = this.chainReactionTracker.get(attacker.id);
      isChainBump = !!(chain && (now - chain.timestamp < 1200) && chain.pushedById !== victim.id);
      if (isChainBump) {
        skillMoments.push('CHAIN_BUMP');
      }

      // 5g. DOUBLE IMPACT: Extreme T-bone momentum or head-on critical (PRD Section 6)
      isDoubleImpact = (impactSpeed >= 16.0 && angleQuality === 'PERFECT') || (impactSpeed >= 20.0 && isHeadOn);
      if (isDoubleImpact) {
        skillMoments.push('DOUBLE_IMPACT');
      }

      // Record victim hit for potential WALL SLAM and CHAIN REACTION downstream
      this.recentVictimHits.set(victim.id, {
        attackerId: attacker.id,
        timestamp: now,
        impactForce,
        normal: normal.clone(),
      });
      this.chainReactionTracker.set(victim.id, {
        pushedById: attacker.id,
        timestamp: now,
      });
      this.revengeTracker.set(victim.id, {
        lastAttackerId: attacker.id,
        timestamp: now,
      });
    }

    // 6. CLASSIFY IMPACT TIER (PRD Section 3)
    let tier: CollisionTier = 'LIGHT';
    if (isHeadOn || impactSpeed >= COLLISION_CONFIG.criticalThreshold || intensity >= 0.75) {
      tier = 'CRITICAL';
    } else if (angleQuality === 'PERFECT' && impactSpeed >= COLLISION_CONFIG.perfectThreshold) {
      tier = 'PERFECT';
      if (!isEitherDead) {
        skillMoments.push('PERFECT_BUMP');
      }
    } else if (impactSpeed >= COLLISION_CONFIG.heavyThreshold || intensity >= 0.4) {
      tier = 'HEAVY';
    }

    // Contact point between vehicles at bumper height
    const contactPos = new THREE.Vector3()
      .addVectors(stateA.position, stateB.position)
      .multiplyScalar(0.5);
    contactPos.y = 0.35;

    // Evaluate Combo if player was attacker (PRD Section 8)
    // Only against living opponents (dead cars give 0 combo progression)
    let comboMultiplier = 1.0;
    let comboCount = 1;
    if (attacker.id === 'player_car' && !isEitherDead) {
      const comboState = ComboManager.get().registerBump(attacker.id, victim.id);
      comboMultiplier = comboState.multiplier;
      comboCount = comboState.comboCount;
    }

    // 7. Physical Knockback Impulses with Archetype & Power-Up Multipliers (PRD Section 3 & 9)
    const isAttackerTitan = attacker.controller.hasPowerUp('TITAN') || attacker.controller.hasPowerUp('HEAVY_HIT');
    const attackerMassMult = isAttackerTitan ? 2.5 : 1.0;
    const attackerMass = attacker.controller.physics.config.mass * attackerMassMult;
    const powerUpKnockback = attacker.controller.getImpactMultiplier();
    let knockbackMult = ((attacker.controller.physics.config as any).impactKnockback ?? 1.0) * powerUpKnockback;
    const recoilResist = ((attacker.controller.physics.config as any).recoilResistance ?? 1.0) * (isAttackerTitan ? 2.5 : 1.0);

    if (isHeadOn) knockbackMult *= 1.45;
    if (isBankShot) knockbackMult *= 1.30;
    if (isBoostCrash) knockbackMult *= 1.40;
    if (tier === 'PERFECT') knockbackMult *= 1.25;

    const maxVictimImpulse = attackerMass * 11.5 * knockbackMult;
    const victimImpulseMag = Math.min(
      impactSpeed * attackerMass * 0.44 * knockbackMult,
      maxVictimImpulse
    );
    const victimImpulse = normal.clone().multiplyScalar(victimImpulseMag);
    victimImpulse.y = COLLISION_CONFIG.verticalHopImpulse * intensity * 260.0;
    victim.controller.physics.applyImpulse(victimImpulse);

    // Attacker receives realistic recoil impulse modulated by recoil resistance
    const recoilScale = isHeadOn ? 0.75 : 0.22; // In head-on counter crashes, both vehicles experience violent recoil
    const recoilMag = Math.min((victimImpulseMag * recoilScale) / Math.max(0.1, recoilResist), attackerMass * 2.8);
    const attackerImpulse = normal.clone().multiplyScalar(-recoilMag);
    attacker.controller.physics.applyImpulse(attackerImpulse);

    if (isAttackerTitan) {
      SoundManager.get().playTitanImpact();
      this.juiceHooks.cameraShake?.(intensity * 1.5, normal);
    }

    // Check Shield Protection
    const isVictimShielded = victim.controller.isShieldActive();
    if (isVictimShielded) {
      SoundManager.get().playShieldDeflect();
      const reflectImpulse = normal.clone().multiplyScalar(-victimImpulseMag * 0.85);
      attacker.controller.physics.applyImpulse(reflectImpulse);
    }

    // 8. STRICT ZERO-SUM CASH TRANSFER (PRD Section 1, 4, 6, 29)
    // "Crash another player -> steal their money. Total money in match must remain constant."
    let stolenCash = 0;
    if (!victim.controller.isEliminated() && !attacker.controller.isEliminated()) {
      // Base damage scaled by tier and angle quality
      let baseDamage = 15;
      if (tier === 'CRITICAL') baseDamage = 35;
      else if (tier === 'PERFECT') baseDamage = 35;
      else if (tier === 'HEAVY') baseDamage = 20;
      else baseDamage = 8;

      if (angleQuality === 'PERFECT') baseDamage = Math.max(baseDamage, 35);
      else if (angleQuality === 'BAD') baseDamage = Math.min(baseDamage, 8);

      let calculatedDamage = baseDamage;
      calculatedDamage = Math.round(calculatedDamage * speedMultiplier);
      calculatedDamage = Math.round(calculatedDamage * comboMultiplier);

      // Skill multipliers
      if (isHeadOn) calculatedDamage = Math.round(calculatedDamage * 1.40);
      if (isBankShot) calculatedDamage = Math.round(calculatedDamage * 1.35);
      if (isDriftBump) calculatedDamage = Math.round(calculatedDamage * 1.25);
      if (isBoostCrash) calculatedDamage = Math.round(calculatedDamage * 2.00);
      if (isDoubleImpact) calculatedDamage = Math.round(calculatedDamage * 2.00);
      if (isRevenge) calculatedDamage = Math.round(calculatedDamage * 1.35);
      if (isAttackerTitan) calculatedDamage = Math.round(calculatedDamage * 2.00);
      if (now < this.surgeEndTime) calculatedDamage = Math.round(calculatedDamage * 2.00);
      if (isVictimShielded) calculatedDamage = 0;

      // Exact steal calculation: never exceeds target balance, never negative
      stolenCash = Math.max(0, Math.min(calculatedDamage, victim.controller.getBalance()));

      // STRICT ZERO-SUM EXECUTION:
      // Target loses exactly what attacker gains
      if (stolenCash > 0) {
        victim.controller.subtractBalance(stolenCash, normal, intensity);
        attacker.controller.addMoney(stolenCash);

        // Visual cash particles burst out from the impact point
        EventBus.get().emit('money_scatter', {
          position: contactPos,
          amount: stolenCash,
          normal,
        });
      }
    }

    // 9. Construct Normalized CollisionEvent
    const event: CollisionEvent = {
      attackerId: attacker.id,
      victimId: victim.id,
      position: contactPos,
      normal,
      relativeVelocity: relVel,
      impactSpeed,
      impactForce,
      intensity,
      tier,
      timestamp: now,
      comboCount,
      comboMultiplier,
      skillMoments,
      stolenCash,
      angleQuality,
      speedMultiplier,
      isHeadOn,
      isWall: false,
      isVictimDead,
      isAttackerDead,
    };

    // 10. Notify Subsystems
    attacker.controller.handleCollision(event, true);
    victim.controller.handleCollision(event, false);

    // 11. Publish to EventBus
    EventBus.get().emit('collision', event);

    if (skillMoments.length > 0 && !isEitherDead) {
      const primarySkill = skillMoments[0];
      const title = this.formatSkillTitle(primarySkill);
      const subtitle = this.formatSkillSubtitle(primarySkill, stolenCash);

      const skillEvent: SkillMomentEvent = {
        type: primarySkill,
        attackerId: attacker.id,
        victimId: victim.id,
        stolenCash,
        position: contactPos.clone(),
        title,
        subtitle,
        comboCount,
        comboMultiplier,
      };
      EventBus.get().emit('skill_moment', skillEvent);
    }

    // 12. Trigger Juice Feedback Stack (Audio, Camera Shake, Hit-Stop) (PRD Section 27)
    SoundManager.get().playImpact(event.intensity, isHeadOn ? 'COUNTER' : event.tier);
    if (skillMoments.length > 0) {
      SoundManager.get().playSkillCrash(skillMoments[0]);
    }
    this.triggerJuice(event, isHeadOn);
  }

  private handleVehicleWallCollision(car: HeroCar): void {
    const now = performance.now();
    const state = car.controller.getPhysicsState();
    const speed = state.speed;
    if (speed < 2.0) return;

    // Wall hit direction opposite to car position
    const normal = new THREE.Vector3(-Math.sign(state.position.x), 0, -Math.sign(state.position.z)).normalize();
    const impactForce = speed * CAR_CONFIG.mass * 1.2;
    const intensity = THREE.MathUtils.clamp(impactForce / COLLISION_CONFIG.maxImpactForce, 0.05, 0.85);

    let tier: CollisionTier = 'LIGHT';
    if (speed >= COLLISION_CONFIG.heavyThreshold) tier = 'HEAVY';

    // Record wall bounce for potential BANK SHOT
    this.lastWallBounces.set(car.id, {
      timestamp: now,
      speed,
      normal: normal.clone(),
    });

    // Check WALL SLAM: Did an opponent recently hit this car, projecting it into the wall? (PRD Section 11)
    const recentHit = this.recentVictimHits.get(car.id);
    let isWallSlam = false;
    let wallSlamAttacker: HeroCar | undefined;

    if (recentHit && (now - recentHit.timestamp < 1500) && speed >= 3.5) {
      isWallSlam = true;
      wallSlamAttacker = this.vehicles.get(recentHit.attackerId);
      this.recentVictimHits.delete(car.id); // Consumed
    }

    let stolenCash = 0;
    if (isWallSlam && wallSlamAttacker && !car.controller.isEliminated() && !wallSlamAttacker.controller.isEliminated()) {
      const slamBase = Math.round(15 + Math.min(speed, 10));
      stolenCash = Math.max(0, Math.min(slamBase, car.controller.getBalance()));

      if (stolenCash > 0) {
        car.controller.subtractBalance(stolenCash, normal, intensity);
        wallSlamAttacker.controller.addMoney(stolenCash);

        EventBus.get().emit('money_scatter', {
          position: state.position.clone(),
          amount: stolenCash,
          normal,
        });
      }

      SoundManager.get().playSkillCrash('WALL_SLAM');
      this.juiceHooks.cameraShake?.(0.9, normal);
      this.juiceHooks.hitStop?.(0.08);

      // Note: Do not emit 'skill_moment' text event on wall hit per user directive:
      // "fix when hit wall or player that already dead dont add any text effect"
    }

    const event: CollisionEvent = {
      attackerId: car.id,
      victimId: 'wall',
      position: state.position.clone().add(normal.clone().multiplyScalar(-1.2)),
      normal,
      relativeVelocity: state.velocity,
      impactSpeed: speed,
      impactForce,
      intensity,
      tier,
      timestamp: now,
      skillMoments: [],
      stolenCash,
      isWall: true,
      isVictimDead: false,
      isAttackerDead: car.controller.isEliminated(),
    };

    car.controller.handleCollision(event, true);
    EventBus.get().emit('collision', event);
    this.triggerJuice(event, false);
  }

  /**
   * Evaluates Near Misses / Close Calls between high-speed vehicles without contact (PRD Section 22).
   */
  private checkNearMisses(): void {
    const now = performance.now();
    const cars = Array.from(this.vehicles.values());

    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const carA = cars[i];
        const carB = cars[j];

        if (carA.controller.isEliminated() || carB.controller.isEliminated()) continue;

        const pairKey = carA.id < carB.id ? `${carA.id}:${carB.id}` : `${carB.id}:${carA.id}`;
        const lastNearMiss = this.nearMissCooldowns.get(pairKey) || 0;
        if (now - lastNearMiss < 3000) continue;

        const stateA = carA.controller.getPhysicsState();
        const stateB = carB.controller.getPhysicsState();

        const dist = stateA.position.distanceTo(stateB.position);
        // Vehicle dimensions ~2.6m x 1.9m: center-to-center distance between 2.1m and 2.85m means <0.5m clearance
        if (dist >= 2.1 && dist <= 2.85) {
          const relVel = new THREE.Vector3().subVectors(stateA.velocity, stateB.velocity);
          const relSpeed = relVel.length();

          if (relSpeed >= 11.5) {
            this.nearMissCooldowns.set(pairKey, now);

            SoundManager.get().playNearMiss();

            const isPlayerInvolved = carA.id === 'player_car' || carB.id === 'player_car';
            if (isPlayerInvolved) {
              const punchDir = new THREE.Vector3()
                .subVectors(stateA.position, stateB.position)
                .normalize();
              this.juiceHooks.cameraPunch?.(punchDir, 0.24);

              EventBus.get().emit('skill_moment', {
                type: 'CLOSE_CALL',
                attackerId: 'player_car',
                position: stateA.position.clone().add(stateB.position).multiplyScalar(0.5),
                title: 'CLOSE CALL!',
                subtitle: 'HIGH-SPEED NEAR MISS',
              });
            }
          }
        }
      }
    }
  }

  /**
   * Evaluates if any vehicle is pinned against an arena wall by another car (PRD Section 23).
   */
  private checkCornerPins(dt: number): void {
    const wallBound = 21.0;

    for (const [victimId, victimCar] of this.vehicles.entries()) {
      if (victimCar.controller.isEliminated()) {
        this.pinTimers.delete(victimId);
        continue;
      }

      const victimPos = victimCar.controller.getPhysicsState().position;
      const isNearWall = Math.abs(victimPos.x) >= wallBound || Math.abs(victimPos.z) >= wallBound;

      if (!isNearWall) {
        this.pinTimers.delete(victimId);
        continue;
      }

      let pinningCar: HeroCar | null = null;
      for (const [attackerId, attackerCar] of this.vehicles.entries()) {
        if (attackerId === victimId || attackerCar.controller.isEliminated()) continue;

        const attackerPos = attackerCar.controller.getPhysicsState().position;
        const dist = victimPos.distanceTo(attackerPos);

        if (dist < 2.5) {
          const relSpeed = victimCar.controller.getPhysicsState().velocity.length();
          if (relSpeed < 2.5) {
            pinningCar = attackerCar;
            break;
          }
        }
      }

      if (pinningCar) {
        let entry = this.pinTimers.get(victimId);
        if (!entry || entry.pinnedById !== pinningCar.id) {
          entry = { pinnedById: pinningCar.id, timer: 0, triggered: false };
          this.pinTimers.set(victimId, entry);
        }

        entry.timer += dt;

        if (entry.timer >= 1.0 && !entry.triggered) {
          entry.triggered = true;
          SoundManager.get().playPinAlarm();
          this.juiceHooks.cameraShake?.(0.4);

          EventBus.get().emit('skill_moment', {
            type: 'PINNED',
            attackerId: pinningCar.id,
            victimId: victimCar.id,
            position: victimPos.clone(),
            title: 'CORNER TRAP!',
            subtitle: 'OPPONENT PINNED AGAINST WALL',
          });
        } else if (entry.timer > 2.0) {
          // Reset pin timer to avoid infinite stun-lock
          this.pinTimers.delete(victimId);
        }
      } else {
        this.pinTimers.delete(victimId);
      }
    }
  }

  private triggerJuice(event: CollisionEvent, isHeadOn: boolean = false): void {
    // Camera shake intensity & tactile hit-stop based on tier and signature moment (PRD Section 27)
    let shake = COLLISION_CONFIG.shakeIntensityLight;
    let hitStopDuration = COLLISION_CONFIG.hitStopDurationLight;

    if (isHeadOn) {
      shake = COLLISION_CONFIG.shakeIntensityCounter;
      hitStopDuration = COLLISION_CONFIG.hitStopDurationCounter; // 120ms
    } else if (event.tier === 'CRITICAL') {
      shake = COLLISION_CONFIG.shakeIntensityCritical;
      hitStopDuration = COLLISION_CONFIG.hitStopDurationCritical; // 110ms
    } else if (event.tier === 'PERFECT') {
      shake = COLLISION_CONFIG.shakeIntensityPerfect;
      hitStopDuration = COLLISION_CONFIG.hitStopDurationPerfect; // 90ms
    } else if (event.tier === 'HEAVY') {
      shake = COLLISION_CONFIG.shakeIntensityHeavy;
      hitStopDuration = COLLISION_CONFIG.hitStopDurationHeavy; // 50ms
    }

    if (this.juiceHooks.cameraShake) {
      this.juiceHooks.cameraShake(shake * (0.6 + event.intensity * 0.4), event.normal);
    }

    if (hitStopDuration > 0 && this.juiceHooks.hitStop) {
      this.juiceHooks.hitStop(hitStopDuration);
    }
  }

  private formatSkillTitle(type: SkillMomentType): string {
    switch (type) {
      case 'COUNTER_CRASH':
        return 'COUNTER CRASH!';
      case 'PERFECT_BUMP':
        return 'PERFECT BUMP!';
      case 'BANK_SHOT':
        return 'BANK SHOT!';
      case 'WALL_SLAM':
        return 'WALL SLAM!';
      case 'DRIFT_BUMP':
        return 'DRIFT BUMP!';
      case 'BOOST_CRASH':
        return 'BOOST CRASH!';
      case 'DOUBLE_IMPACT':
        return 'DOUBLE IMPACT!';
      case 'REVENGE':
        return 'REVENGE!';
      case 'CHAIN_BUMP':
        return 'CHAIN BUMP!';
      case 'PINNED':
        return 'CORNER TRAP!';
      case 'CLOSE_CALL':
        return 'CLOSE CALL!';
      default:
        return 'BUMP!';
    }
  }

  private formatSkillSubtitle(type: SkillMomentType, cash: number): string {
    const cashStr = cash > 0 ? ` +$${cash}` : '';
    switch (type) {
      case 'COUNTER_CRASH':
        return `HEAD-ON FRONTAL COLLISION${cashStr}`;
      case 'PERFECT_BUMP':
        return `OPTIMAL ANGLE IMPACT${cashStr}`;
      case 'BANK_SHOT':
        return `WALL BOUNCE SKILL SHOT${cashStr}`;
      case 'WALL_SLAM':
        return `PROJECTED INTO ARENA WALL${cashStr}`;
      case 'DRIFT_BUMP':
        return `POWER DRIFT RAM${cashStr}`;
      case 'BOOST_CRASH':
        return `HIGH SPEED BOOST IMPACT${cashStr}`;
      case 'DOUBLE_IMPACT':
        return `MASSIVE 2× IMPACT DAMAGE${cashStr}`;
      case 'REVENGE':
        return `RETALIATION CRASH${cashStr}`;
      case 'CHAIN_BUMP':
        return `CHAIN REACTION MULTI-BUMP${cashStr}`;
      case 'PINNED':
        return 'PINNED AGAINST ARENA BOUNDARY';
      case 'CLOSE_CALL':
        return 'HIGH-SPEED NEAR MISS';
      default:
        return `${cashStr} EXTRACTED`;
    }
  }
}
