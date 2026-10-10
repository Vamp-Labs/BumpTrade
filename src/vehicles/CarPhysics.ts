import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CAR_CONFIG } from '../core/Config';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { VehicleInput } from '../input/InputManager';
import { CarPhysicsState } from './CarTypes';
import { VehicleArchetypeConfig } from './VehicleTypes';

export class CarPhysics {
  public body: RAPIER.RigidBody;
  public chassisCollider: RAPIER.Collider;
  public bumperCollider: RAPIER.Collider;
  public readonly id: string;
  public readonly config: VehicleArchetypeConfig | typeof CAR_CONFIG;

  private state: CarPhysicsState;
  private currentSteerAngle: number = 0;
  private isBoostActive: boolean = false;
  private boostMultiplier: number = 1.0;
  private powerUpSpeedMultiplier: number = 1.0;

  // Cached Three.js helper vectors to avoid GC pressure in physics loop
  private tempForward = new THREE.Vector3();
  private tempRight = new THREE.Vector3();

  constructor(
    id: string,
    physicsWorld: PhysicsWorld,
    spawnPos: THREE.Vector3 = new THREE.Vector3(0, 0.4, 0),
    spawnRotY: number = 0,
    config: VehicleArchetypeConfig | typeof CAR_CONFIG = CAR_CONFIG
  ) {
    this.id = id;
    this.config = config;

    // 1. Create Dynamic RigidBody
    const bodyDesc = physicsWorld.rapier.RigidBodyDesc.dynamic()
      .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
      .setRotation({
        x: 0,
        y: Math.sin(spawnRotY / 2),
        z: 0,
        w: Math.cos(spawnRotY / 2),
      })
      .setLinearDamping(this.config.linearDamping)
      .setAngularDamping(this.config.angularDamping)
      .setAdditionalMass(this.config.mass)
      // Lock X and Z rotation so the bumper car remains upright during extreme ramming,
      // while allowing free Y-axis steering and yaw spin!
      .enabledRotations(false, true, false);

    this.body = physicsWorld.world.createRigidBody(bodyDesc);
    this.body.enableCcd(true); // Continuous collision detection prevents tunneling through walls

    // 2. Create Bumper Collider (Primary outer perimeter collision zone)
    // Rounded cuboid around bottom base with restitution for satisfying bumper bounce
    const bumperHalfX = (this.config.dimensions.width * 0.5);
    const bumperHalfY = 0.22;
    const bumperHalfZ = (this.config.dimensions.length * 0.5);

    const bumperDesc = physicsWorld.rapier.ColliderDesc.roundCuboid(
      bumperHalfX,
      bumperHalfY,
      bumperHalfZ,
      0.15 // corner radius
    )
      .setTranslation(0, 0.22, 0)
      .setRestitution(this.config.bounce)
      .setFriction(0.12) // Low kinetic friction allows smooth wall glances & unhindered reversing
      .setActiveEvents(physicsWorld.rapier.ActiveEvents.COLLISION_EVENTS)
      .setActiveCollisionTypes(
        physicsWorld.rapier.ActiveCollisionTypes.DEFAULT |
        physicsWorld.rapier.ActiveCollisionTypes.DYNAMIC_DYNAMIC
      );

    this.bumperCollider = physicsWorld.world.createCollider(bumperDesc, this.body);

    // 3. Create Upper Cabin Collider
    const cabinDesc = physicsWorld.rapier.ColliderDesc.cuboid(
      bumperHalfX * 0.75,
      0.35,
      bumperHalfZ * 0.7
    )
      .setTranslation(0, 0.7, 0)
      .setRestitution(0.2)
      .setFriction(0.5);

    this.chassisCollider = physicsWorld.world.createCollider(cabinDesc, this.body);

    // Register with PhysicsWorld
    physicsWorld.registerCollider(this.bumperCollider, { id: this.id, type: 'vehicle', entity: this });
    physicsWorld.registerCollider(this.chassisCollider, { id: this.id, type: 'vehicle', entity: this });

    // Initial state
    this.state = {
      position: new THREE.Vector3().copy(spawnPos),
      quaternion: new THREE.Quaternion(),
      forward: new THREE.Vector3(0, 0, 1),
      right: new THREE.Vector3(1, 0, 0),
      up: new THREE.Vector3(0, 1, 0),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      speed: 0,
      forwardSpeed: 0,
      lateralSpeed: 0,
      isDrifting: false,
      driftRatio: 0,
      steerAngle: 0,
      isGrounded: true,
    };

    this.updateStateFromPhysics();
  }

  public setBoost(active: boolean, multiplier: number = CAR_CONFIG.boostMultiplier): void {
    this.isBoostActive = active;
    this.boostMultiplier = active ? multiplier : 1.0;
  }

  public setPowerUpSpeedMultiplier(multiplier: number = 1.0): void {
    this.powerUpSpeedMultiplier = multiplier;
  }

  /**
   * Fixed physics step update: applies drive, steering, lateral grip, and drift mechanics.
   */
  public step(dt: number, input: VehicleInput): void {
    this.updateStateFromPhysics();

    const forward = this.state.forward;
    const right = this.state.right;
    const fwdSpeed = this.state.forwardSpeed;
    const latSpeed = this.state.lateralSpeed;

    // --- STEERING ---
    // Smooth steer angle input
    const targetSteerAngle = input.steer * this.config.maxSteerAngle;
    this.currentSteerAngle = THREE.MathUtils.lerp(
      this.currentSteerAngle,
      targetSteerAngle,
      this.config.steeringRate * dt * 3.5
    );
    this.state.steerAngle = this.currentSteerAngle;

    // Calculate turning yaw response
    // Agile low-speed and reverse steering: bumper cars can pivot crisply even when stopped or backing up!
    const isReversing = fwdSpeed < -0.15 || (input.throttle < 0 && fwdSpeed <= 1.0);
    const speedFactor = Math.abs(fwdSpeed) < 1.2
      ? 0.88
      : THREE.MathUtils.clamp(Math.abs(fwdSpeed) / 3.0, 0.88, 1.0);
    const driftSteerBonus = this.state.isDrifting ? this.config.driftSteerBoost : 1.0;
    const reverseFactor = isReversing ? -1.0 : 1.0; // Invert steering direction in reverse
    const yawSpeed = -input.steer * this.config.steeringRate * speedFactor * driftSteerBonus * reverseFactor;

    // Apply angular velocity to rigid body directly
    const currentAngvel = this.body.angvel();
    this.body.setAngvel(
      {
        x: 0,
        y: THREE.MathUtils.lerp(currentAngvel.y, yawSpeed, 0.55),
        z: 0,
      },
      true
    );

    // --- ACCELERATION & BRAKING & REVERSE ("Back Down") ---
    let effectiveMaxSpeed = (this.isBoostActive ? this.config.boostMaxSpeed : this.config.maxSpeed) * this.powerUpSpeedMultiplier;
    let effectiveAccel = this.config.acceleration * this.boostMultiplier * this.powerUpSpeedMultiplier;

    let thrustForce = 0;
    if (input.throttle > 0) {
      // Accelerating forward
      if (fwdSpeed < effectiveMaxSpeed) {
        thrustForce = effectiveAccel * this.config.mass * input.throttle;
      }
    } else if (input.throttle < 0) {
      // Active braking when moving forward fast, or instant snappy reverse when slow/stopped
      if (fwdSpeed > 2.0) {
        // Active hard braking
        thrustForce = -this.config.brakingDeceleration * this.config.mass;
      } else if (fwdSpeed > -this.config.reverseSpeed) {
        // Immediate snappy reverse thrust ("back down for car")
        thrustForce = -this.config.reverseAcceleration * this.config.mass;
      }
    }

    if (thrustForce !== 0) {
      this.body.applyImpulse(
        {
          x: forward.x * thrustForce * dt,
          y: 0,
          z: forward.z * thrustForce * dt,
        },
        true
      );
    }

    // --- LATERAL GRIP & ARCADE DRIFT ---
    // Arcade tire physics: resist lateral slip based on grip coefficient
    const currentGrip = this.state.isDrifting
      ? this.config.lateralGrip * this.config.driftGripMultiplier
      : this.config.lateralGrip;

    // Counteract lateral velocity to maintain grip / drift
    const lateralCorrection = -latSpeed * this.config.mass * currentGrip * 3.5 * dt;
    this.body.applyImpulse(
      {
        x: right.x * lateralCorrection,
        y: 0,
        z: right.z * lateralCorrection,
      },
      true
    );

    // Keep car grounded firmly on Y plane (prevent jumping on small bumps)
    const pos = this.body.translation();
    if (pos.y > 0.5) {
      this.body.applyImpulse({ x: 0, y: -this.config.mass * 9.8 * dt * 2.0, z: 0 }, true);
    }

    // Velocity Clamping (Safety ceiling against extreme physics impulses)
    const linvel = this.body.linvel();
    const horizSpeedSq = linvel.x * linvel.x + linvel.z * linvel.z;
    const maxAllowedSpeed = this.config.boostMaxSpeed * 1.35;
    if (horizSpeedSq > maxAllowedSpeed * maxAllowedSpeed) {
      const scale = maxAllowedSpeed / Math.sqrt(horizSpeedSq);
      this.body.setLinvel({ x: linvel.x * scale, y: linvel.y, z: linvel.z * scale }, true);
    }

    // Arena Boundary Containment (Safety guarantee: car can NEVER breach or exit outer walls)
    const arenaLimit = 22.0; // Comfortably inside the 23.5m outer walls
    const curPos = this.body.translation();
    let clampedX = curPos.x;
    let clampedZ = curPos.z;
    let breached = false;

    if (curPos.x > arenaLimit) {
      clampedX = arenaLimit;
      breached = true;
    } else if (curPos.x < -arenaLimit) {
      clampedX = -arenaLimit;
      breached = true;
    }

    if (curPos.z > arenaLimit) {
      clampedZ = arenaLimit;
      breached = true;
    } else if (curPos.z < -arenaLimit) {
      clampedZ = -arenaLimit;
      breached = true;
    }

    if (breached) {
      this.body.setTranslation({ x: clampedX, y: Math.max(0.2, curPos.y), z: clampedZ }, true);
      const lv = this.body.linvel();
      const newVx = clampedX !== curPos.x ? -Math.abs(lv.x) * Math.sign(curPos.x) * 0.75 : lv.x;
      const newVz = clampedZ !== curPos.z ? -Math.abs(lv.z) * Math.sign(curPos.z) * 0.75 : lv.z;
      this.body.setLinvel({ x: newVx, y: lv.y, z: newVz }, true);
    }

    // Update state again after forces
    this.updateStateFromPhysics();
  }

  /**
   * Applies an external impulse (e.g. from ramming/collision knockback).
   */
  public applyImpulse(impulse: THREE.Vector3, point?: THREE.Vector3): void {
    if (point) {
      this.body.applyImpulseAtPoint(
        { x: impulse.x, y: impulse.y, z: impulse.z },
        { x: point.x, y: point.y, z: point.z },
        true
      );
    } else {
      this.body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    }
  }

  public reset(position: THREE.Vector3, rotationY: number = 0): void {
    this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    this.body.setRotation(
      {
        x: 0,
        y: Math.sin(rotationY / 2),
        z: 0,
        w: Math.cos(rotationY / 2),
      },
      true
    );
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.currentSteerAngle = 0;
    this.updateStateFromPhysics();
  }

  private updateStateFromPhysics(): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    const lv = this.body.linvel();
    const av = this.body.angvel();

    this.state.position.set(t.x, t.y, t.z);
    this.state.quaternion.set(r.x, r.y, r.z, r.w);
    this.state.velocity.set(lv.x, lv.y, lv.z);
    this.state.angularVelocity.set(av.x, av.y, av.z);

    // Compute forward (+Z) and right (+X) vectors in world space
    this.tempForward.set(0, 0, 1).applyQuaternion(this.state.quaternion);
    this.state.forward.copy(this.tempForward);

    this.tempRight.set(1, 0, 0).applyQuaternion(this.state.quaternion);
    this.state.right.copy(this.tempRight);

    // Decompose velocity into forward and lateral speeds
    this.state.speed = Math.sqrt(lv.x * lv.x + lv.z * lv.z);
    this.state.forwardSpeed = this.state.velocity.dot(this.state.forward);
    this.state.lateralSpeed = this.state.velocity.dot(this.state.right);

    // Drift detection: based on actual physical lateral motion vs threshold
    const absLat = Math.abs(this.state.lateralSpeed);
    this.state.isDrifting = absLat > this.config.driftThreshold && this.state.speed > 4.0;
    this.state.driftRatio = THREE.MathUtils.clamp(
      (absLat - this.config.driftThreshold) / 5.0,
      0,
      1
    );
  }

  public getState(): CarPhysicsState {
    this.updateStateFromPhysics();
    return this.state;
  }
}
