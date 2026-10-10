import * as THREE from 'three';
import { CAMERA_CONFIG } from '../core/Config';
import { CarPhysicsState } from '../vehicles/CarTypes';

export class GameCamera {
  public readonly camera: THREE.PerspectiveCamera;
  private currentLookTarget: THREE.Vector3 = new THREE.Vector3();
  private trauma: number = 0; // 0.0 to 1.0 (screen shake energy)
  private isBoosting: boolean = false;
  private currentFov: number = CAMERA_CONFIG.baseFov;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.baseFov,
      aspect,
      0.1,
      200.0
    );
    this.camera.position.set(0, 15, -20);
  }

  private punchOffset: THREE.Vector3 = new THREE.Vector3();

  public setBoostFOV(active: boolean): void {
    this.isBoosting = active;
  }

  public cameraShake(intensity: number, normal?: THREE.Vector3): void {
    // Trauma accumulation with ceiling
    this.trauma = Math.min(this.trauma + intensity, 1.2);

    // Instant tight punch displacement proportional to collision impulse (150ms recovery)
    const punchMag = Math.min(intensity * 0.42, 0.55);
    if (normal) {
      // Directional recoil punch opposite to collision normal
      this.punchOffset.set(
        -normal.x * punchMag * 0.5 + (Math.random() - 0.5) * 0.1,
        -punchMag * 0.35,
        -normal.z * punchMag * 0.5
      );
    } else {
      this.punchOffset.set(
        (Math.random() - 0.5) * 0.2,
        -punchMag * 0.35,
        -punchMag * 0.7
      );
    }
  }

  public cameraPunch(direction: THREE.Vector3, magnitude: number): void {
    const mag = Math.min(magnitude, 0.75);
    this.punchOffset.set(
      direction.x * mag,
      (direction.y || -0.25) * mag,
      direction.z * mag
    );
  }

  public cameraMode: 'OVERVIEW' | 'CHASE' | 'INSPECT' | 'SPECTATOR' = 'OVERVIEW';
  public isSpectating: boolean = false;

  public setSpectatorMode(spectating: boolean): void {
    this.isSpectating = spectating;
    if (spectating) {
      this.cameraMode = 'SPECTATOR';
    } else if (this.cameraMode === 'SPECTATOR') {
      this.cameraMode = 'OVERVIEW';
    }
  }

  public toggleMode(): 'OVERVIEW' | 'CHASE' | 'INSPECT' | 'SPECTATOR' {
    if (this.isSpectating) return 'SPECTATOR';
    if (this.cameraMode === 'OVERVIEW') this.cameraMode = 'CHASE';
    else if (this.cameraMode === 'CHASE') this.cameraMode = 'INSPECT';
    else this.cameraMode = 'OVERVIEW';
    return this.cameraMode;
  }

  public update(dt: number, targetState: CarPhysicsState, targetScale: number = 1.0): void {
    // 1. Smooth FOV Transition under Boost
    const targetFov = this.isBoosting ? CAMERA_CONFIG.boostFov : CAMERA_CONFIG.baseFov;
    this.currentFov = THREE.MathUtils.lerp(
      this.currentFov,
      targetFov,
      CAMERA_CONFIG.fovTransitionSpeed * dt
    );
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    const targetPos = targetState.position;
    const fwd = targetState.forward;
    const right = targetState.right;

    // Smooth camera framing compensation for Titan Ram scale
    const scalePullBack = THREE.MathUtils.lerp(1.0, 1.35, Math.max(0, (targetScale - 1.0) / 0.75));

    let desiredCamPos: THREE.Vector3;
    let desiredLookTarget: THREE.Vector3;

    if (this.cameraMode === 'SPECTATOR') {
      // Dynamic elevated cinematic spectator follow camera behind surviving car
      desiredCamPos = targetPos.clone().sub(fwd.clone().multiplyScalar(6.5 * scalePullBack)).add(new THREE.Vector3(0, 3.8 * scalePullBack, 0));
      desiredLookTarget = targetPos.clone().add(fwd.clone().multiplyScalar(2.0)).add(new THREE.Vector3(0, 0.5 * scalePullBack, 0));
    } else if (this.cameraMode === 'CHASE') {
      // Dynamic 3rd person chase camera behind vehicle
      desiredCamPos = targetPos.clone().sub(fwd.clone().multiplyScalar(4.6 * scalePullBack)).add(new THREE.Vector3(0, 2.2 * scalePullBack, 0));
      desiredLookTarget = targetPos.clone().add(fwd.clone().multiplyScalar(3.0)).add(new THREE.Vector3(0, 0.4 * scalePullBack, 0));
    } else if (this.cameraMode === 'INSPECT') {
      // Close-up angled front-quarter beauty camera to view hood emblem, stripes, headlights, wheels, and textures
      desiredCamPos = targetPos.clone().add(fwd.clone().multiplyScalar(2.4 * scalePullBack)).add(right.clone().multiplyScalar(1.6 * scalePullBack)).add(new THREE.Vector3(0, 2.2 * scalePullBack, 0));
      desiredLookTarget = targetPos.clone().add(new THREE.Vector3(0, 0.4 * scalePullBack, 0));
    } else {
      // Far-away "Toy In A Box" Stadium Overview
      desiredCamPos = new THREE.Vector3(
        CAMERA_CONFIG.overviewPos.x + targetPos.x * CAMERA_CONFIG.targetInfluence,
        CAMERA_CONFIG.overviewPos.y * (1.0 + (scalePullBack - 1.0) * 0.35),
        CAMERA_CONFIG.overviewPos.z * (1.0 + (scalePullBack - 1.0) * 0.25) + targetPos.z * CAMERA_CONFIG.targetInfluence
      );
      desiredLookTarget = new THREE.Vector3(
        targetPos.x * CAMERA_CONFIG.lookTargetInfluence,
        0.5 * scalePullBack,
        targetPos.z * CAMERA_CONFIG.lookTargetInfluence + 1.2
      );
    }

    // Smooth position interpolation
    this.camera.position.lerp(desiredCamPos, CAMERA_CONFIG.smoothPositionSpeed * dt);
    this.currentLookTarget.lerp(desiredLookTarget, CAMERA_CONFIG.smoothPositionSpeed * dt);
    this.camera.lookAt(this.currentLookTarget);

    // 4. Apply Trauma-based Screen Shake & Snappy Punch Offset
    if (this.punchOffset.lengthSq() > 0.0001) {
      this.camera.position.add(this.punchOffset);
      // Fast snappy recovery within ~150ms
      this.punchOffset.lerp(new THREE.Vector3(0, 0, 0), Math.min(1.0, 18.0 * dt));
    }

    if (this.trauma > 0) {
      const shakeFactor = this.trauma * this.trauma; // Non-linear falloff
      const maxShakeOffset = 0.35;
      const maxShakeRot = 0.025;

      const shakeX = (Math.random() - 0.5) * 2.0 * maxShakeOffset * shakeFactor;
      const shakeY = (Math.random() - 0.5) * 2.0 * maxShakeOffset * shakeFactor;
      const shakeZ = (Math.random() - 0.5) * 2.0 * maxShakeOffset * shakeFactor;

      this.camera.position.x += shakeX;
      this.camera.position.y += shakeY;
      this.camera.position.z += shakeZ;

      this.camera.rotation.z += (Math.random() - 0.5) * 2.0 * maxShakeRot * shakeFactor;

      // Decay trauma
      this.trauma = Math.max(0, this.trauma - CAMERA_CONFIG.shakeDecay * dt);
    }
  }

  public onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
