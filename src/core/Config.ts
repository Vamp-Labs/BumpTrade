/**
 * BUMP.TRADE - Central Gameplay & Vehicle Configuration
 * All gameplay tuning parameters are centralized here.
 * No scattered magic numbers.
 */

export const CAR_CONFIG = {
  // Physical Dimensions (meters)
  dimensions: {
    length: 2.6,
    width: 1.9,
    height: 1.35,
    wheelRadius: 0.28,
    antennaHeight: 1.5,
  },

  // Dynamics & Mass
  mass: 850.0, // kg - gives a heavy, satisfying arcade weight
  linearDamping: 0.95, // Reduced drag for faster, free-flowing arcade glide
  angularDamping: 3.8,

  // Driving & Engine (High-energy fast arcade pace!)
  acceleration: 36.0, // m/s^2 forward thrust (+64% faster pickup!)
  maxSpeed: 25.0, // m/s (~90 km/h base top speed)
  reverseSpeed: 15.0, // m/s (~54 km/h fast back down/reverse)
  reverseAcceleration: 26.0, // m/s^2 instant snappy reverse thrust
  brakingDeceleration: 50.0, // m/s^2 hard brake
  steeringRate: 5.2, // rad/s quick agile turning
  maxSteerAngle: 0.58, // rad visual wheel angle

  // Grip & Drift Model
  friction: 1.9,
  lateralGrip: 0.84,
  driftThreshold: 2.8,
  driftGripMultiplier: 0.45,
  driftSteerBoost: 1.45,

  // Boost Model
  boostMultiplier: 1.85,
  boostMaxSpeed: 38.0, // m/s (~137 km/h blazing rocket boost!)
  boostDuration: 3.2,
  boostRechargeRate: 0.4,
  boostImpactBonus: 2.0,

  // Bumper & Spring Compression
  bounce: 0.65, // Bumper restitution / bounciness
  bumperSpringStiffness: 300.0,
  bumperDamping: 24.0,
  maxBumperCompression: 0.22,

  // Visual Procedural Animations
  bodyTiltPitchAccel: 0.1, // Pitch back under acceleration
  bodyTiltPitchBrake: 0.14, // Pitch forward under hard braking
  bodyTiltRollSteer: 0.11, // Roll lean into turns
  suspensionIdleFreq: 2.2,
  suspensionIdleAmp: 0.015,
  antennaSwayLag: 0.14,
  antennaVibrationAmp: 0.06,
};

export const COLLISION_CONFIG = {
  // Impact Speed Thresholds (m/s)
  lightThreshold: 3.5,
  heavyThreshold: 8.5,
  perfectThreshold: 11.0,
  criticalThreshold: 18.0,

  // Force Calculation
  collisionMultiplier: 1.6,
  maxImpactForce: 35000.0,

  // Knockback Physics
  victimImpulseMultiplier: 0.45,
  attackerRecoilMultiplier: 0.22,
  verticalHopImpulse: 2.5,

  // Camera Shake & Hit Stop (PRD Section 27: 80-120ms tactile hit-stop)
  shakeIntensityLight: 0.2,
  shakeIntensityHeavy: 0.55,
  shakeIntensityPerfect: 0.85,
  shakeIntensityCritical: 1.05,
  shakeIntensityCounter: 1.15,
  hitStopDurationLight: 0.0,
  hitStopDurationHeavy: 0.05,
  hitStopDurationPerfect: 0.09, // 90ms
  hitStopDurationCritical: 0.11, // 110ms
  hitStopDurationCounter: 0.12, // 120ms
};

export const CAMERA_CONFIG = {
  // Far-away "Toy In A Box" / Stadium Overview POV
  // High vantage point framing the entire battle box, all enemies, and hazards
  overviewPos: { x: 0, y: 28.0, z: -27.0 },
  targetInfluence: 0.38, // Smooth parallax tracking with car position (keeps entire box visible)
  lookTargetInfluence: 0.55, // Look center between car and arena center
  smoothPositionSpeed: 4.8,
  baseFov: 50, // Wide angle framing the whole arena box
  boostFov: 56, // Subtle expansion under boost
  fovTransitionSpeed: 3.5,
  shakeDecay: 6.0,
};

export const ARENA_CONFIG = {
  width: 48.0, // Arena X bounds (meters)
  length: 48.0, // Arena Z bounds (meters)
  wallHeight: 1.8,
  wallBounciness: 0.75, // Rapier restitution for perimeter bumper walls
  gridSpacing: 2.0,
};

export const BEAR_CONFIG = {
  // Heavy Bumper Car Archetype ("The Bear crashes hard")
  dimensions: {
    length: 2.7,
    width: 2.05,
    height: 1.4,
    wheelRadius: 0.3,
    antennaHeight: 1.5,
  },
  mass: 1150.0, // kg - Heavy tank bumper car
  linearDamping: 1.05,
  angularDamping: 4.2,
  acceleration: 30.0, // Faster pickup
  maxSpeed: 22.0, // ~80 km/h
  reverseSpeed: 13.0,
  reverseAcceleration: 22.0,
  brakingDeceleration: 55.0,
  steeringRate: 4.2, // Responsive turning
  maxSteerAngle: 0.52,
  friction: 2.1,
  lateralGrip: 0.88,
  driftThreshold: 3.0,
  driftGripMultiplier: 0.52,
  driftSteerBoost: 1.3,
  bounce: 0.55,
  bumperSpringStiffness: 350.0,
  bumperDamping: 28.0,
  maxBumperCompression: 0.25,
  boostMultiplier: 1.75,
  boostMaxSpeed: 33.0, // ~120 km/h
  boostDuration: 3.0,
  boostRechargeRate: 0.3,
  boostImpactBonus: 2.2, // Massive ramming multiplier
  bodyTiltPitchAccel: 0.08,
  bodyTiltPitchBrake: 0.12,
  bodyTiltRollSteer: 0.08,
  suspensionIdleFreq: 1.8,
  suspensionIdleAmp: 0.012,
  antennaSwayLag: 0.1,
  antennaVibrationAmp: 0.06,
};

export const PICKUP_CONFIG = {
  coinRadius: 0.4,
  coinHoverHeight: 0.45,
  coinRotateSpeed: 3.2, // rad/s
  pickupRadius: 1.8, // Distance at which car vacuums/collects
  magnetDistance: 4.5, // Distance at which coins fly toward car
  scatterMinSpeed: 4.0,
  scatterMaxSpeed: 11.0,
  lifetime: 120.0, // seconds before uncollected coins despawn (preserves match economy)
};

export const VOID_CONFIG = {
  // 4 Margin Void corner/quadrant pits as seen in the arena board
  radius: 3.8,
  depth: 6.0,
  triggerY: -0.6, // Falling below this Y triggers LIQUIDATION
  locations: [
    { x: -14.0, z: -14.0 },
    { x: 14.0, z: -14.0 },
    { x: -14.0, z: 14.0 },
    { x: 14.0, z: 14.0 },
  ],
};
