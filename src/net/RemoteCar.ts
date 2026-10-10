import * as THREE from 'three';
import type { VehicleInput } from '../input/InputManager';
import type { PowerUpType } from '../pickups/PowerUpTypes';
import type { HeroCar } from '../vehicles/HeroCar';
import { CarFlag, CarState, type ServerCar } from './protocol';

export const INTERPOLATION_DELAY_MS = 100;
const MAX_EXTRAPOLATION_S = 0.15;
const BUFFER_LIMIT = 40;

export interface PoseSample {
  t: number;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
}

const FLAG_POWER_UPS: ReadonlyArray<readonly [number, PowerUpType]> = [
  [CarFlag.SHIELD, 'SHIELD'],
  [CarFlag.HEAVY_HIT, 'HEAVY_HIT'],
  [CarFlag.MAGNET, 'CASH_MAGNET'],
  [CarFlag.TURBO, 'TURBO'],
];

export function sampleFromServer(car: ServerCar, t: number): PoseSample {
  const quaternion = new THREE.Quaternion(car.qx, car.qy, car.qz, car.qw);
  if (quaternion.lengthSq() < 1e-6) quaternion.identity();
  else quaternion.normalize();
  return {
    t,
    position: new THREE.Vector3(car.px, car.py, car.pz),
    quaternion,
    velocity: new THREE.Vector3(car.vx, car.vy, car.vz),
    angularVelocity: new THREE.Vector3(car.wx, car.wy, car.wz),
  };
}

export class CarStateSync {
  private previousFlags = 0;
  private wasBoosting = false;
  private initialised = false;

  constructor(private readonly car: HeroCar, private readonly startBalance: number) {}

  public applyState(server: ServerCar): void {
    const controller = this.car.controller;
    const eliminated =
      server.state === CarState.ELIMINATED || (server.flags & CarFlag.ELIMINATED) !== 0 || server.balance <= 0;
    if (!this.initialised) {
      this.initialised = true;
      controller.setOnlineBalance(server.balance, Math.max(this.startBalance, server.balance));
    } else if (server.balance !== controller.getBalance()) {
      controller.setOnlineBalance(server.balance, Math.max(controller.getMaxBalance(), this.startBalance));
    }
    if (eliminated) {
      controller.eliminate();
      return;
    }
    const rising = server.flags & ~this.previousFlags;
    for (const [bit, type] of FLAG_POWER_UPS) {
      if (rising & bit) {
        controller.applyPowerUp(type, server.powerUpMs > 0 ? server.powerUpMs / 1000 : undefined);
      }
    }
    this.previousFlags = server.flags;
  }

  public tickBoost(dt: number, flags: number): void {
    const controller = this.car.controller;
    const boosting = (flags & CarFlag.BOOSTING) !== 0;
    controller.boost.update(dt, boosting);
    if (boosting && !this.wasBoosting) {
      controller.vfx.playBoost();
      controller.audio.playBoostSound();
    } else if (!boosting && this.wasBoosting) {
      controller.vfx.stopBoost();
    }
    this.wasBoosting = boosting;
  }
}

export function writePose(
  car: HeroCar,
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  velocity: THREE.Vector3,
  angularVelocity: THREE.Vector3
): void {
  const body = car.controller.physics.body;
  body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
  body.setRotation({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }, true);
  body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
  body.setAngvel({ x: angularVelocity.x, y: angularVelocity.y, z: angularVelocity.z }, true);
}

export function syntheticInput(car: HeroCar, flags: number): VehicleInput {
  const state = car.controller.getPhysicsState();
  const direction = state.forwardSpeed >= 0 ? 1 : -1;
  const throttle = THREE.MathUtils.clamp(state.forwardSpeed / Math.max(1, car.config.maxSpeed * 0.6), -1, 1);
  const steer = THREE.MathUtils.clamp((state.angularVelocity.y / 2.5) * direction, -1, 1);
  return {
    throttle,
    steer,
    brake: false,
    boost: (flags & CarFlag.BOOSTING) !== 0,
    handbrake: false,
  };
}

export class RemoteCar {
  public readonly car: HeroCar;
  public readonly wallet: string;
  public readonly seat: number;
  private readonly sync: CarStateSync;
  private readonly buffer: PoseSample[] = [];
  private lastFlags = 0;
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly velocity = new THREE.Vector3();
  private readonly angular = new THREE.Vector3();

  constructor(car: HeroCar, wallet: string, seat: number, startBalance: number) {
    this.car = car;
    this.wallet = wallet;
    this.seat = seat;
    this.sync = new CarStateSync(car, startBalance);
  }

  public push(server: ServerCar, now: number): void {
    this.buffer.push(sampleFromServer(server, now));
    if (this.buffer.length > BUFFER_LIMIT) this.buffer.shift();
    this.lastFlags = server.flags;
    this.sync.applyState(server);
  }

  public update(now: number, dt: number): void {
    const renderTime = now - INTERPOLATION_DELAY_MS;
    const count = this.buffer.length;
    if (count > 0) {
      if (this.car.controller.isEliminated()) {
        const last = this.buffer[count - 1];
        this.position.copy(last.position);
        this.quaternion.copy(last.quaternion);
        this.velocity.set(0, 0, 0);
        this.angular.set(0, 0, 0);
      } else {
        this.interpolate(renderTime);
      }
      writePose(this.car, this.position, this.quaternion, this.velocity, this.angular);
    }
    this.sync.tickBoost(dt, this.lastFlags);
    this.car.controller.update(dt, syntheticInput(this.car, this.lastFlags));
  }

  private interpolate(renderTime: number): void {
    const buffer = this.buffer;
    const last = buffer[buffer.length - 1];
    if (buffer.length === 1 || renderTime >= last.t) {
      const ahead = Math.min(Math.max(0, (renderTime - last.t) / 1000), MAX_EXTRAPOLATION_S);
      this.position.copy(last.position).addScaledVector(last.velocity, ahead);
      this.quaternion.copy(last.quaternion);
      this.velocity.copy(last.velocity);
      this.angular.copy(last.angularVelocity);
      return;
    }
    let upper = 1;
    while (upper < buffer.length - 1 && buffer[upper].t < renderTime) upper += 1;
    const a = buffer[upper - 1];
    const b = buffer[upper];
    const span = b.t - a.t;
    const k = span > 1e-3 ? THREE.MathUtils.clamp((renderTime - a.t) / span, 0, 1) : 1;
    this.position.lerpVectors(a.position, b.position, k);
    this.quaternion.slerpQuaternions(a.quaternion, b.quaternion, k);
    this.velocity.lerpVectors(a.velocity, b.velocity, k);
    this.angular.lerpVectors(a.angularVelocity, b.angularVelocity, k);
  }
}
