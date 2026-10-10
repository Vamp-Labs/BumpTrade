import { CarFlag, PowerUpKind } from "../protocol/enums";
import { FIXED_DT } from "./constants";
import { SimCar } from "./SimCar";
import { SimWorld } from "./SimWorld";
import { boostMultiplierOf, stepCar, updateBoost } from "./stepCar";
import type { VehicleInput } from "./types";

export interface AdoptableCar {
  px: number;
  py: number;
  pz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  vx: number;
  vy: number;
  vz: number;
  wx: number;
  wy: number;
  wz: number;
  boost: number;
  flags: number;
}

export interface CarPose {
  px: number;
  py: number;
  pz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  vx: number;
  vy: number;
  vz: number;
  wx: number;
  wy: number;
  wz: number;
}

export interface PredictionWorld {
  readonly sim: SimWorld;
  readonly car: SimCar;
}

export const createPredictionWorld = async (
  vehicleId: number,
  seat: number,
): Promise<PredictionWorld> => {
  const sim = await SimWorld.create();
  const car = new SimCar(sim, seat, vehicleId);
  sim.prime();
  return { sim, car };
};

export const adoptCar = (world: PredictionWorld, state: AdoptableCar): void => {
  const { car } = world;
  car.body.setTranslation({ x: state.px, y: state.py, z: state.pz }, true);
  car.body.setRotation(
    { x: state.qx, y: state.qy, z: state.qz, w: state.qw },
    true,
  );
  car.body.setLinvel({ x: state.vx, y: state.vy, z: state.vz }, true);
  car.body.setAngvel({ x: state.wx, y: state.wy, z: state.wz }, true);
  car.boost.fuel = Math.max(0, Math.min(1, state.boost / 100));
  car.boost.active = (state.flags & CarFlag.BOOSTING) !== 0;
  if ((state.flags & CarFlag.TURBO) !== 0) {
    car.powerUps.set(PowerUpKind.TURBO, 1);
  } else {
    car.powerUps.delete(PowerUpKind.TURBO);
  }
  car.kin();
};

export const stepPredictedCar = (
  world: PredictionWorld,
  input: VehicleInput,
  dt: number = FIXED_DT,
): void => {
  const { car, sim } = world;
  updateBoost(car.boost, dt, input.boost);
  car.drive.boostActive = car.boost.active;
  car.drive.boostMultiplier = boostMultiplierOf(car.boost);
  car.drive.speedMultiplier = car.hasPowerUp(PowerUpKind.TURBO) ? 1.5 : 1.0;
  stepCar(car.drive, car.body, car.handling, input, dt);
  sim.world.timestep = dt;
  sim.step();
  sim.eventQueue.clear();
};

export const poseCar = (world: PredictionWorld): CarPose => {
  const t = world.car.body.translation();
  const r = world.car.body.rotation();
  const v = world.car.body.linvel();
  const w = world.car.body.angvel();
  return {
    px: t.x,
    py: t.y,
    pz: t.z,
    qx: r.x,
    qy: r.y,
    qz: r.z,
    qw: r.w,
    vx: v.x,
    vy: v.y,
    vz: v.z,
    wx: w.x,
    wy: w.y,
    wz: w.z,
  };
};
