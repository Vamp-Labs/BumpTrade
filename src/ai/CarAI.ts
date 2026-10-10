import * as THREE from 'three';
import { VehicleInput } from '../input/InputManager';
import { HeroCar } from '../vehicles/HeroCar';
import { VOID_CONFIG } from '../core/Config';

export type AIMode = 'ACTIVE' | 'DUMMY';

export class CarAI {
  private selfCar: HeroCar;
  private targetCar: HeroCar;
  public mode: AIMode = 'ACTIVE';

  private stuckTimer: number = 0;
  private reverseTimer: number = 0;
  private boostCooldown: number = 0;

  constructor(selfCar: HeroCar, targetCar: HeroCar, mode: AIMode = 'ACTIVE') {
    this.selfCar = selfCar;
    this.targetCar = targetCar;
    this.mode = mode;
  }

  public setTarget(targetCar: HeroCar): void {
    this.targetCar = targetCar;
  }

  public update(dt: number): VehicleInput {
    if (this.selfCar.controller.isEliminated() || this.mode === 'DUMMY') {
      return {
        throttle: 0,
        steer: 0,
        brake: false,
        boost: false,
        handbrake: false,
      };
    }

    const selfPhys = this.selfCar.controller.getPhysicsState();
    const targetPhys = this.targetCar.controller.getPhysicsState();

    this.boostCooldown = Math.max(0, this.boostCooldown - dt);

    // 1. Stuck Detection (e.g. pinned against a wall)
    if (selfPhys.speed < 0.6) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 1.2) {
        this.reverseTimer = 1.0;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = Math.max(0, this.stuckTimer - dt);
    }

    if (this.reverseTimer > 0) {
      this.reverseTimer -= dt;
      return {
        throttle: -1.0,
        steer: 0.8,
        brake: false,
        boost: false,
        handbrake: false,
      };
    }

    // 2. Vector toward player target
    const toTarget = new THREE.Vector3().subVectors(targetPhys.position, selfPhys.position);
    const distance = toTarget.length();
    toTarget.normalize();

    // 3. Avoid Margin Void Pits
    let avoidance = new THREE.Vector3();
    for (const loc of VOID_CONFIG.locations) {
      const pitPos = new THREE.Vector3(loc.x, 0, loc.z);
      const toPit = new THREE.Vector3().subVectors(selfPhys.position, pitPos);
      const pitDist = toPit.length();
      if (pitDist < VOID_CONFIG.radius + 3.5) {
        avoidance.add(toPit.normalize().multiplyScalar((VOID_CONFIG.radius + 3.5 - pitDist) * 2.5));
      }
    }

    const steerTargetDir = toTarget.clone().add(avoidance).normalize();

    // 4. Calculate Steering Angle Error
    // Forward is +Z in local space
    const forward = selfPhys.forward;
    const right = selfPhys.right;

    const dotForward = forward.dot(steerTargetDir);
    const dotRight = right.dot(steerTargetDir);

    let steer = 0;
    if (dotRight > 0.08) steer = 1.0;
    else if (dotRight < -0.08) steer = -1.0;
    else steer = dotRight * 8.0;

    // 5. Throttle & Boost Ram Decision
    let throttle = 1.0;
    let boost = false;

    // If aligned with target and within ramming strike range, ENGAGE BOOST!
    if (dotForward > 0.88 && distance > 3.0 && distance < 18.0 && this.boostCooldown <= 0) {
      boost = true;
      if (distance < 4.0) {
        this.boostCooldown = 4.0; // Cooldown after ram attempt
      }
    }

    return {
      throttle,
      steer: THREE.MathUtils.clamp(steer, -1.0, 1.0),
      brake: false,
      boost,
      handbrake: false,
    };
  }
}
