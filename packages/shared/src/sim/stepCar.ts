import { ARENA_LIMIT, BASE_CAR } from "./constants";
import type { HandlingConfig } from "./handling";
import type { Vec3, VehicleInput } from "./types";

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface DriveBody {
  translation(): Vec3;
  rotation(): Quat;
  linvel(): Vec3;
  angvel(): Vec3;
  setAngvel(v: Vec3, wake: boolean): void;
  setLinvel(v: Vec3, wake: boolean): void;
  setTranslation(v: Vec3, wake: boolean): void;
  applyImpulse(v: Vec3, wake: boolean): void;
}

export interface Kinematics {
  position: Vec3;
  velocity: Vec3;
  forward: Vec3;
  right: Vec3;
  speed: number;
  forwardSpeed: number;
  lateralSpeed: number;
  isDrifting: boolean;
}

export interface DriveState {
  steerAngle: number;
  boostActive: boolean;
  boostMultiplier: number;
  speedMultiplier: number;
  kin: Kinematics;
}

export interface BoostState {
  fuel: number;
  active: boolean;
}

export const createKinematics = (): Kinematics => ({
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  forward: { x: 0, y: 0, z: 1 },
  right: { x: 1, y: 0, z: 0 },
  speed: 0,
  forwardSpeed: 0,
  lateralSpeed: 0,
  isDrifting: false,
});

export const createDriveState = (): DriveState => ({
  steerAngle: 0,
  boostActive: false,
  boostMultiplier: 1.0,
  speedMultiplier: 1.0,
  kin: createKinematics(),
});

export const createBoostState = (): BoostState => ({
  fuel: 1.0,
  active: false,
});

export const updateBoost = (
  boost: BoostState,
  dt: number,
  wantBoost: boolean,
): void => {
  if (wantBoost && boost.fuel > 0.02) {
    boost.active = true;
    boost.fuel = Math.max(0, boost.fuel - dt / BASE_CAR.boostDuration);
    if (boost.fuel <= 0) {
      boost.active = false;
    }
  } else {
    boost.active = false;
    boost.fuel = Math.min(1.0, boost.fuel + dt * BASE_CAR.boostRechargeRate);
  }
};

export const boostMultiplierOf = (boost: BoostState): number =>
  boost.active ? BASE_CAR.boostMultiplier : 1.0;

export const readKinematics = (
  body: DriveBody,
  handling: HandlingConfig,
  out: Kinematics,
): Kinematics => {
  const t = body.translation();
  const r = body.rotation();
  const lv = body.linvel();

  out.position.x = t.x;
  out.position.y = t.y;
  out.position.z = t.z;
  out.velocity.x = lv.x;
  out.velocity.y = lv.y;
  out.velocity.z = lv.z;

  const { x, y, z, w } = r;
  out.forward.x = 2 * (x * z + w * y);
  out.forward.y = 2 * (y * z - w * x);
  out.forward.z = 1 - 2 * (x * x + y * y);
  out.right.x = 1 - 2 * (y * y + z * z);
  out.right.y = 2 * (x * y + w * z);
  out.right.z = 2 * (x * z - w * y);

  out.speed = Math.sqrt(lv.x * lv.x + lv.z * lv.z);
  out.forwardSpeed =
    lv.x * out.forward.x + lv.y * out.forward.y + lv.z * out.forward.z;
  out.lateralSpeed =
    lv.x * out.right.x + lv.y * out.right.y + lv.z * out.right.z;

  out.isDrifting =
    Math.abs(out.lateralSpeed) > handling.driftThreshold && out.speed > 4.0;
  return out;
};

const lerp = (from: number, to: number, t: number): number =>
  (1 - t) * from + t * to;

export const stepCar = (
  drive: DriveState,
  body: DriveBody,
  handling: HandlingConfig,
  input: VehicleInput,
  dt: number,
): void => {
  const kin = readKinematics(body, handling, drive.kin);
  const forward = kin.forward;
  const right = kin.right;
  const fwdSpeed = kin.forwardSpeed;
  const latSpeed = kin.lateralSpeed;

  const targetSteerAngle = input.steer * handling.maxSteerAngle;
  drive.steerAngle = lerp(
    drive.steerAngle,
    targetSteerAngle,
    handling.steeringRate * dt * 3.5,
  );

  const isReversing =
    fwdSpeed < -0.15 || (input.throttle < 0 && fwdSpeed <= 1.0);
  const absFwd = Math.abs(fwdSpeed);
  const speedFactor =
    absFwd < 1.2 ? 0.88 : Math.min(1.0, Math.max(0.88, absFwd / 3.0));
  const driftSteerBonus = kin.isDrifting ? handling.driftSteerBoost : 1.0;
  const reverseFactor = isReversing ? -1.0 : 1.0;
  const yawSpeed =
    -input.steer *
    handling.steeringRate *
    speedFactor *
    driftSteerBonus *
    reverseFactor;

  const currentAngvel = body.angvel();
  body.setAngvel(
    { x: 0, y: lerp(currentAngvel.y, yawSpeed, 0.55), z: 0 },
    true,
  );

  const effectiveMaxSpeed =
    (drive.boostActive ? handling.boostMaxSpeed : handling.maxSpeed) *
    drive.speedMultiplier;
  const effectiveAccel =
    handling.acceleration * drive.boostMultiplier * drive.speedMultiplier;

  let thrustForce = 0;
  if (input.throttle > 0) {
    if (fwdSpeed < effectiveMaxSpeed) {
      thrustForce = effectiveAccel * handling.mass * input.throttle;
    }
  } else if (input.throttle < 0) {
    if (fwdSpeed > 2.0) {
      thrustForce = -handling.brakingDeceleration * handling.mass;
    } else if (fwdSpeed > -handling.reverseSpeed) {
      thrustForce = -handling.reverseAcceleration * handling.mass;
    }
  }

  if (thrustForce !== 0) {
    body.applyImpulse(
      {
        x: forward.x * thrustForce * dt,
        y: 0,
        z: forward.z * thrustForce * dt,
      },
      true,
    );
  }

  const currentGrip = kin.isDrifting
    ? handling.lateralGrip * handling.driftGripMultiplier
    : handling.lateralGrip;
  const lateralCorrection = -latSpeed * handling.mass * currentGrip * 3.5 * dt;
  body.applyImpulse(
    { x: right.x * lateralCorrection, y: 0, z: right.z * lateralCorrection },
    true,
  );

  const pos = body.translation();
  if (pos.y > 0.5) {
    body.applyImpulse({ x: 0, y: -handling.mass * 9.8 * dt * 2.0, z: 0 }, true);
  }

  const linvel = body.linvel();
  const horizSpeedSq = linvel.x * linvel.x + linvel.z * linvel.z;
  const maxAllowedSpeed = handling.boostMaxSpeed * 1.35;
  if (horizSpeedSq > maxAllowedSpeed * maxAllowedSpeed) {
    const scale = maxAllowedSpeed / Math.sqrt(horizSpeedSq);
    body.setLinvel(
      { x: linvel.x * scale, y: linvel.y, z: linvel.z * scale },
      true,
    );
  }

  const curPos = body.translation();
  let clampedX = curPos.x;
  let clampedZ = curPos.z;
  let breached = false;

  if (curPos.x > ARENA_LIMIT) {
    clampedX = ARENA_LIMIT;
    breached = true;
  } else if (curPos.x < -ARENA_LIMIT) {
    clampedX = -ARENA_LIMIT;
    breached = true;
  }

  if (curPos.z > ARENA_LIMIT) {
    clampedZ = ARENA_LIMIT;
    breached = true;
  } else if (curPos.z < -ARENA_LIMIT) {
    clampedZ = -ARENA_LIMIT;
    breached = true;
  }

  if (breached) {
    body.setTranslation(
      { x: clampedX, y: Math.max(0.2, curPos.y), z: clampedZ },
      true,
    );
    const lv = body.linvel();
    const newVx =
      clampedX !== curPos.x
        ? -Math.abs(lv.x) * Math.sign(curPos.x) * 0.75
        : lv.x;
    const newVz =
      clampedZ !== curPos.z
        ? -Math.abs(lv.z) * Math.sign(curPos.z) * 0.75
        : lv.z;
    body.setLinvel({ x: newVx, y: lv.y, z: newVz }, true);
  }

  readKinematics(body, handling, drive.kin);
};
