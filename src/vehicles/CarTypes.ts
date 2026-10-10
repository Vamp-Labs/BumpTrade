import * as THREE from 'three';

export type VehicleState =
  | 'IDLE'
  | 'MOVING'
  | 'BRAKING'
  | 'TURNING'
  | 'DRIFTING'
  | 'BOOSTING'
  | 'HIT_LIGHT'
  | 'HIT_HEAVY'
  | 'HIT_CRITICAL'
  | 'FALLING'
  | 'CRITICAL'
  | 'ELIMINATED'
  | 'SPECTATING'
  | 'LIQUIDATED'
  | 'WIN'
  | 'LOSS';

/**
 * Expected conceptual node hierarchy per BUMP.TRADE specification.
 * All optional nodes degrade gracefully if null/undefined.
 */
export interface CarNodeBindings {
  root: THREE.Object3D;
  chassis?: THREE.Object3D;
  body?: THREE.Object3D;
  bumper?: THREE.Object3D;
  wheelFL?: THREE.Object3D;
  wheelFR?: THREE.Object3D;
  wheelRL?: THREE.Object3D;
  wheelRR?: THREE.Object3D;
  antenna?: THREE.Object3D;
  contactHead?: THREE.Object3D;
  moneyDisplay?: THREE.Object3D;
  headlightL?: THREE.Object3D;
  headlightR?: THREE.Object3D;
  tailLightL?: THREE.Object3D;
  tailLightR?: THREE.Object3D;
  vfxImpact?: THREE.Object3D;
  vfxBoost?: THREE.Object3D;
  vfxAntenna?: THREE.Object3D;
  vfxCoin?: THREE.Object3D;
  vfxSkid?: THREE.Object3D;
  driver?: THREE.Object3D;
}

export interface CarPhysicsState {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  forward: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  speed: number;
  forwardSpeed: number;
  lateralSpeed: number;
  isDrifting: boolean;
  driftRatio: number;
  steerAngle: number;
  isGrounded: boolean;
}

export interface CarAnimationState {
  wheelRotation: number;
  wheelSteer: number;
  bodyPitch: number;
  bodyRoll: number;
  suspensionBob: number;
  antennaPitch: number;
  antennaRoll: number;
  antennaEnergy: number; // 0.0 to 1.0 (electricity drive)
  bumperOffset: THREE.Vector3;
}
