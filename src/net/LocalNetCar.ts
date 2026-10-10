import * as THREE from 'three';
import type { HeroCar } from '../vehicles/HeroCar';
import { CarStateSync, sampleFromServer, syntheticInput, writePose, type PoseSample } from './RemoteCar';
import type { ServerCar } from './protocol';

const SNAP_DISTANCE_M = 3;
const SMOOTH_RATE = 28;
const LEAD_LIMIT_S = 0.08;

export class LocalNetCar {
  private car: HeroCar;
  private sync: CarStateSync;
  private latest: PoseSample | null = null;
  private lastFlags = 0;
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly velocity = new THREE.Vector3();
  private readonly angular = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private placed = false;

  constructor(car: HeroCar, startBalance: number) {
    this.car = car;
    this.sync = new CarStateSync(car, startBalance);
  }

  public getCar(): HeroCar {
    return this.car;
  }

  public push(server: ServerCar, now: number): void {
    this.latest = sampleFromServer(server, now);
    this.lastFlags = server.flags;
    this.sync.applyState(server);
  }

  public update(now: number, dt: number): void {
    const latest = this.latest;
    if (latest) {
      const lead = Math.min(Math.max(0, (now - latest.t) / 1000), LEAD_LIMIT_S);
      this.target.copy(latest.position).addScaledVector(latest.velocity, lead);
      if (!this.placed || this.position.distanceTo(this.target) > SNAP_DISTANCE_M) {
        this.position.copy(this.target);
        this.quaternion.copy(latest.quaternion);
        this.placed = true;
      } else {
        const alpha = 1 - Math.exp(-SMOOTH_RATE * dt);
        this.position.lerp(this.target, alpha);
        this.quaternion.slerp(latest.quaternion, alpha);
      }
      this.velocity.copy(latest.velocity);
      this.angular.copy(latest.angularVelocity);
      if (this.car.controller.isEliminated()) {
        this.velocity.set(0, 0, 0);
        this.angular.set(0, 0, 0);
      }
      writePose(this.car, this.position, this.quaternion, this.velocity, this.angular);
    }
    this.sync.tickBoost(dt, this.lastFlags);
    this.car.controller.update(dt, syntheticInput(this.car, this.lastFlags));
  }
}
