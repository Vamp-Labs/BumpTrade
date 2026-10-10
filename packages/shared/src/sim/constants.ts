export const TICK_HZ = 60;
export const FIXED_DT = 1 / TICK_HZ;

export const secondsToTicks = (seconds: number): number =>
  Math.round(seconds * TICK_HZ);

export const MAX_SEATS = 8;
export const GRAVITY_Y = -9.81;
export const ARENA_LIMIT = 22.0;
export const ARENA_WALL_POS = 23.5;
export const ARENA_WALL_LENGTH = 47.0;
export const ARENA_HALF_EXTENT = 24.0;

export const BASE_CAR = {
  mass: 850.0,
  boostMultiplier: 1.85,
  boostDuration: 3.2,
  boostRechargeRate: 0.4,
} as const;

export const COLLISION = {
  heavyThreshold: 8.5,
  perfectThreshold: 11.0,
  criticalThreshold: 18.0,
  collisionMultiplier: 1.6,
  maxImpactForce: 35000.0,
  verticalHopImpulse: 2.5,
  minImpactSpeed: 1.2,
  pairCooldownTicks: 3,
  bankShotTicks: secondsToTicks(1.2),
  revengeTicks: secondsToTicks(5),
  wallSlamTicks: secondsToTicks(1.5),
  driftRecentTicks: secondsToTicks(0.8),
  comboWindowTicks: secondsToTicks(4.5),
  lastHitterTicks: secondsToTicks(5),
} as const;

export const VOID = {
  radius: 3.8,
  triggerY: -0.6,
  locations: [
    { x: -14.0, z: -14.0 },
    { x: 14.0, z: -14.0 },
    { x: -14.0, z: 14.0 },
    { x: 14.0, z: 14.0 },
  ],
} as const;

export const CRITICAL_BALANCE = 25;
export const POWER_UP_PICKUP_RADIUS = 2.2;
export const SURGE_TICKS = secondsToTicks(10);
export const COUNTDOWN_TICKS = secondsToTicks(3);

export const ELIMINATED_DAMPING = 35.0;
