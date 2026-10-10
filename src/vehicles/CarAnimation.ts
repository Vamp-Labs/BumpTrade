import * as THREE from 'three';
import { CAR_CONFIG } from '../core/Config';
import { CarNodeBindings, CarPhysicsState, CarAnimationState, VehicleState } from './CarTypes';

export class CarAnimation {
  private bindings: CarNodeBindings;
  private state: CarAnimationState;
  private idleTimer: number = 0;
  private antennaRecoilTimer: number = 0;
  private antennaRecoilIntensity: number = 0;

  // Smoothing states
  private currentPitch: number = 0;
  private currentRoll: number = 0;
  private baseAntennaRot: THREE.Euler = new THREE.Euler();
  private baseBodyPos: THREE.Vector3 = new THREE.Vector3();

  constructor(bindings: CarNodeBindings) {
    this.bindings = bindings;

    if (this.bindings.antenna) {
      this.baseAntennaRot.copy(this.bindings.antenna.rotation);
    }
    if (this.bindings.body) {
      this.baseBodyPos.copy(this.bindings.body.position);
    }

    this.state = {
      wheelRotation: 0,
      wheelSteer: 0,
      bodyPitch: 0,
      bodyRoll: 0,
      suspensionBob: 0,
      antennaPitch: 0,
      antennaRoll: 0,
      antennaEnergy: 0,
      bumperOffset: new THREE.Vector3(),
    };
  }

  public triggerImpact(intensity: number): void {
    this.antennaRecoilTimer = 0.45;
    this.antennaRecoilIntensity = intensity;
  }

  public update(
    dt: number,
    physicsState: CarPhysicsState,
    vehicleState: VehicleState,
    throttle: number,
    isBoosting: boolean
  ): CarAnimationState {
    this.idleTimer += dt;

    // 1. WHEEL ROTATION & STEERING (Step 10)
    // Angular distance delta = linear_distance / radius
    const wheelRotDelta = (physicsState.forwardSpeed / CAR_CONFIG.dimensions.wheelRadius) * dt;
    this.state.wheelRotation += wheelRotDelta;
    this.state.wheelSteer = physicsState.steerAngle;

    // Apply to Wheel_FL, Wheel_FR (spin + steer)
    if (this.bindings.wheelFL) {
      this.bindings.wheelFL.rotation.y = this.state.wheelSteer;
      for (const child of this.bindings.wheelFL.children) {
        child.rotateX(wheelRotDelta);
      }
    }
    if (this.bindings.wheelFR) {
      this.bindings.wheelFR.rotation.y = this.state.wheelSteer;
      for (const child of this.bindings.wheelFR.children) {
        child.rotateX(wheelRotDelta);
      }
    }
    // Rear wheels (Wheel_RL, Wheel_RR) only spin
    if (this.bindings.wheelRL) {
      for (const child of this.bindings.wheelRL.children) {
        child.rotateX(wheelRotDelta);
      }
    }
    if (this.bindings.wheelRR) {
      for (const child of this.bindings.wheelRR.children) {
        child.rotateX(wheelRotDelta);
      }
    }

    // 2. IDLE BREATHING & SUSPENSION (Step 9)
    let targetBob = 0;
    if (vehicleState === 'IDLE') {
      targetBob = Math.sin(this.idleTimer * CAR_CONFIG.suspensionIdleFreq) * CAR_CONFIG.suspensionIdleAmp;
    }
    this.state.suspensionBob = THREE.MathUtils.lerp(this.state.suspensionBob, targetBob, dt * 8.0);

    // 3. BODY PITCH & ROLL (Step 10)
    // Pitch back on acceleration, forward on braking
    let targetPitch = 0;
    if (throttle > 0) {
      targetPitch = CAR_CONFIG.bodyTiltPitchAccel * (isBoosting ? 1.6 : 1.0);
    } else if (throttle < 0 && physicsState.forwardSpeed > 0.5) {
      targetPitch = -CAR_CONFIG.bodyTiltPitchBrake;
    }

    // Roll into turns / centrifugal sway
    const targetRoll = -physicsState.steerAngle * CAR_CONFIG.bodyTiltRollSteer * (Math.abs(physicsState.forwardSpeed) / 8.0);

    this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, targetPitch, dt * 6.0);
    this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, targetRoll, dt * 8.0);

    this.state.bodyPitch = this.currentPitch;
    this.state.bodyRoll = this.currentRoll;

    // Apply to Body node
    if (this.bindings.body) {
      this.bindings.body.position.y = this.baseBodyPos.y + this.state.suspensionBob;
      this.bindings.body.rotation.x = this.currentPitch;
      this.bindings.body.rotation.z = this.currentRoll;
    }

    // 4. ANTENNA PROCEDURAL ANIMATION (Step 14)
    // Idle: subtle sway
    // Moving: sway back opposite to acceleration
    // Boosting: high-frequency vibration
    // Impact: whip recoil
    let antPitch = 0;
    let antRoll = 0;
    let targetEnergy = 0.1;

    if (vehicleState === 'IDLE') {
      antPitch = Math.sin(this.idleTimer * 1.8) * 0.04;
      antRoll = Math.cos(this.idleTimer * 1.4) * 0.03;
      targetEnergy = 0.15 + Math.sin(this.idleTimer * 3.0) * 0.08;
    } else {
      // Speed lag
      const speedNorm = Math.min(physicsState.speed / 20.0, 1.0);
      antPitch = -speedNorm * CAR_CONFIG.antennaSwayLag;
      antRoll = this.currentRoll * 1.2;
      targetEnergy = 0.3 + speedNorm * 0.4;
    }

    if (isBoosting) {
      // Strong high-frequency vibration
      const vib = (Math.random() - 0.5) * CAR_CONFIG.antennaVibrationAmp;
      antPitch += -0.15 + vib;
      antRoll += vib;
      targetEnergy = 1.0;
    }

    // Impact recoil spring
    if (this.antennaRecoilTimer > 0) {
      this.antennaRecoilTimer -= dt;
      const decay = Math.max(this.antennaRecoilTimer / 0.45, 0);
      const recoilWhip = Math.sin(this.antennaRecoilTimer * 35.0) * 0.28 * this.antennaRecoilIntensity * decay;
      antPitch += recoilWhip;
      antRoll += recoilWhip * 0.5;
    }

    this.state.antennaPitch = antPitch;
    this.state.antennaRoll = antRoll;
    this.state.antennaEnergy = THREE.MathUtils.lerp(this.state.antennaEnergy, targetEnergy, dt * 10.0);

    if (this.bindings.antenna) {
      this.bindings.antenna.rotation.x = this.baseAntennaRot.x + antPitch;
      this.bindings.antenna.rotation.z = this.baseAntennaRot.z + antRoll;
    }

    // Contact head glow reaction
    if (this.bindings.contactHead) {
      this.bindings.contactHead.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat && mat.emissive) {
            mat.emissiveIntensity = 2.0 + this.state.antennaEnergy * 4.0;
          }
        }
      });
    }

    return this.state;
  }

  public getState(): CarAnimationState {
    return this.state;
  }
}
