export type VehicleType = 'hood_bull' | 'hood_bear' | 'tsla_racer' | 'nvda_ai' | 'gold_whale' | 'gme_ape' | 'doge_kart';

export interface VehicleArchetypeConfig {
  type: VehicleType;
  displayName: string;
  archetype: string;
  tagline: string;
  role: string;
  difficulty: 'Easy' | 'Medium' | 'Medium-Hard' | 'Hard' | 'Expert';

  // Physical Dimensions (meters)
  dimensions: {
    length: number;
    width: number;
    height: number;
    wheelRadius: number;
    antennaHeight: number;
  };

  // Mass & Dynamics
  mass: number; // kg
  linearDamping: number;
  angularDamping: number;

  // Driving & Engine Performance
  acceleration: number; // m/s^2 forward thrust
  maxSpeed: number; // m/s base top speed
  reverseSpeed: number; // m/s top reverse speed
  reverseAcceleration: number; // m/s^2 reverse thrust
  brakingDeceleration: number; // m/s^2 hard braking
  steeringRate: number; // rad/s turning speed
  maxSteerAngle: number; // rad visual wheel angle

  // Grip & Drift Model
  friction: number;
  lateralGrip: number;
  driftThreshold: number;
  driftGripMultiplier: number;
  driftSteerBoost: number;

  // Boost Model
  boostMultiplier: number;
  boostMaxSpeed: number;
  boostDuration: number;
  boostRechargeRate: number;
  boostImpactBonus: number;

  // Bumper Spring & Restitution
  bounce: number;
  bumperSpringStiffness: number;
  bumperDamping: number;
  maxBumperCompression: number;

  // Combat & Collision Tuning (PRD Section 3)
  impactKnockback: number; // Multiplier on collision impulse delivered to victims
  recoilResistance: number; // Multiplier resisting recoil impulse when delivering a hit
  baseStartingBag: number; // Default wallet cash ($)

  // Visual Procedural Animation Tuning
  bodyTiltPitchAccel: number;
  bodyTiltPitchBrake: number;
  bodyTiltRollSteer: number;
  suspensionIdleFreq: number;
  suspensionIdleAmp: number;
  antennaSwayLag: number;
  antennaVibrationAmp: number;

  // Visual Identity Colors
  primaryColor: number;
  accentColor: number;
  glowColor: number;
  hudBadgeClass: string;
  displayTextColor: string;
}

export const HOOD_BULL_CONFIG: VehicleArchetypeConfig = {
  type: 'hood_bull',
  displayName: 'HOOD BULL',
  archetype: 'Bull Type',
  tagline: 'The Bull Takes The Bag',
  role: 'All-Rounder',
  difficulty: 'Easy',

  dimensions: {
    length: 2.6,
    width: 1.9,
    height: 1.35,
    wheelRadius: 0.28,
    antennaHeight: 1.45,
  },

  mass: 850.0,
  linearDamping: 0.95,
  angularDamping: 3.8,

  acceleration: 36.0,
  maxSpeed: 25.0,
  reverseSpeed: 15.0,
  reverseAcceleration: 26.0,
  brakingDeceleration: 50.0,
  steeringRate: 5.2,
  maxSteerAngle: 0.58,

  friction: 1.9,
  lateralGrip: 0.84,
  driftThreshold: 2.8,
  driftGripMultiplier: 0.45,
  driftSteerBoost: 1.45,

  boostMultiplier: 1.85,
  boostMaxSpeed: 38.0,
  boostDuration: 3.2,
  boostRechargeRate: 0.4,
  boostImpactBonus: 2.0,

  bounce: 0.65,
  bumperSpringStiffness: 300.0,
  bumperDamping: 24.0,
  maxBumperCompression: 0.22,

  impactKnockback: 1.0,
  recoilResistance: 1.0,
  baseStartingBag: 85,

  bodyTiltPitchAccel: 0.10,
  bodyTiltPitchBrake: 0.14,
  bodyTiltRollSteer: 0.11,
  suspensionIdleFreq: 2.2,
  suspensionIdleAmp: 0.015,
  antennaSwayLag: 0.14,
  antennaVibrationAmp: 0.06,

  primaryColor: 0x00b84b,
  accentColor: 0xffc820,
  glowColor: 0x00ff6a,
  hudBadgeClass: 'badge-bull',
  displayTextColor: '#00ff6a',
};

export const HOOD_BEAR_CONFIG: VehicleArchetypeConfig = {
  type: 'hood_bear',
  displayName: 'HOOD BEAR',
  archetype: 'Bear Type',
  tagline: 'The Bear Crashes Hard',
  role: 'Heavy Brawler / Juggernaut',
  difficulty: 'Medium',

  dimensions: {
    length: 2.76,
    width: 2.16,
    height: 1.48,
    wheelRadius: 0.32,
    antennaHeight: 1.55,
  },

  mass: 1150.0,
  linearDamping: 1.05,
  angularDamping: 4.2,

  acceleration: 26.0,
  maxSpeed: 19.0,
  reverseSpeed: 11.0,
  reverseAcceleration: 20.0,
  brakingDeceleration: 55.0,
  steeringRate: 3.8,
  maxSteerAngle: 0.52,

  friction: 2.1,
  lateralGrip: 0.92,
  driftThreshold: 3.0,
  driftGripMultiplier: 0.52,
  driftSteerBoost: 1.30,

  boostMultiplier: 1.60,
  boostMaxSpeed: 30.0,
  boostDuration: 3.0,
  boostRechargeRate: 0.3,
  boostImpactBonus: 2.2,

  bounce: 0.55,
  bumperSpringStiffness: 350.0,
  bumperDamping: 28.0,
  maxBumperCompression: 0.25,

  impactKnockback: 1.45,
  recoilResistance: 1.40,
  baseStartingBag: 120,

  bodyTiltPitchAccel: 0.08,
  bodyTiltPitchBrake: 0.12,
  bodyTiltRollSteer: 0.08,
  suspensionIdleFreq: 1.8,
  suspensionIdleAmp: 0.012,
  antennaSwayLag: 0.10,
  antennaVibrationAmp: 0.06,

  primaryColor: 0x820c15,
  accentColor: 0xff3300,
  glowColor: 0xff0044,
  hudBadgeClass: 'badge-bear',
  displayTextColor: '#ff1144',
};

export const TSLA_RACER_CONFIG: VehicleArchetypeConfig = {
  type: 'tsla_racer',
  displayName: 'TSLA RACER',
  archetype: 'Tech Type',
  tagline: 'Speed. Technology. Full Send.',
  role: 'Fast & Agile / Hit-and-Run',
  difficulty: 'Medium-Hard',

  dimensions: {
    length: 2.5,
    width: 1.8,
    height: 1.30,
    wheelRadius: 0.26,
    antennaHeight: 1.40,
  },

  mass: 680.0,
  linearDamping: 0.90,
  angularDamping: 3.5,

  acceleration: 44.0,
  maxSpeed: 30.0,
  reverseSpeed: 18.0,
  reverseAcceleration: 30.0,
  brakingDeceleration: 60.0,
  steeringRate: 6.5,
  maxSteerAngle: 0.62,

  friction: 1.8,
  lateralGrip: 0.78,
  driftThreshold: 2.5,
  driftGripMultiplier: 0.40,
  driftSteerBoost: 1.60,

  boostMultiplier: 2.10,
  boostMaxSpeed: 44.0,
  boostDuration: 3.5,
  boostRechargeRate: 0.45,
  boostImpactBonus: 1.75,

  bounce: 0.70,
  bumperSpringStiffness: 270.0,
  bumperDamping: 20.0,
  maxBumperCompression: 0.20,

  impactKnockback: 0.75,
  recoilResistance: 0.70,
  baseStartingBag: 200,

  bodyTiltPitchAccel: 0.13,
  bodyTiltPitchBrake: 0.16,
  bodyTiltRollSteer: 0.14,
  suspensionIdleFreq: 2.5,
  suspensionIdleAmp: 0.016,
  antennaSwayLag: 0.16,
  antennaVibrationAmp: 0.08,

  primaryColor: 0xf5f7fa,
  accentColor: 0xe60026,
  glowColor: 0x00e5ff,
  hudBadgeClass: 'badge-tsla',
  displayTextColor: '#00e5ff',
};

export const NVDA_AI_CONFIG: VehicleArchetypeConfig = {
  type: 'nvda_ai',
  displayName: 'NVDA AI',
  archetype: 'AI Type',
  tagline: 'Calculate. Predict. Dominate.',
  role: 'Precise & Controlled / Cornering Specialist',
  difficulty: 'Hard',

  dimensions: {
    length: 2.6,
    width: 1.9,
    height: 1.35,
    wheelRadius: 0.27,
    antennaHeight: 1.45,
  },

  mass: 820.0,
  linearDamping: 0.94,
  angularDamping: 4.0,

  acceleration: 38.0,
  maxSpeed: 27.0,
  reverseSpeed: 16.0,
  reverseAcceleration: 28.0,
  brakingDeceleration: 54.0,
  steeringRate: 7.2,
  maxSteerAngle: 0.64,

  friction: 2.0,
  lateralGrip: 0.96,
  driftThreshold: 3.2,
  driftGripMultiplier: 0.50,
  driftSteerBoost: 1.50,

  boostMultiplier: 1.90,
  boostMaxSpeed: 40.0,
  boostDuration: 3.2,
  boostRechargeRate: 0.42,
  boostImpactBonus: 1.95,

  bounce: 0.62,
  bumperSpringStiffness: 320.0,
  bumperDamping: 25.0,
  maxBumperCompression: 0.22,

  impactKnockback: 1.0,
  recoilResistance: 1.10,
  baseStartingBag: 150,

  bodyTiltPitchAccel: 0.11,
  bodyTiltPitchBrake: 0.14,
  bodyTiltRollSteer: 0.10,
  suspensionIdleFreq: 2.3,
  suspensionIdleAmp: 0.014,
  antennaSwayLag: 0.13,
  antennaVibrationAmp: 0.07,

  primaryColor: 0x0c0d11,
  accentColor: 0x00ff44,
  glowColor: 0x9d00ff,
  hudBadgeClass: 'badge-nvda',
  displayTextColor: '#76b900',
};

export const GOLD_WHALE_CONFIG: VehicleArchetypeConfig = {
  type: 'gold_whale',
  displayName: 'GOLD WHALE',
  archetype: 'Gold Type',
  tagline: 'High Risk. High Reward.',
  role: 'Premium & Unstable / Chaos Gambler',
  difficulty: 'Expert',

  dimensions: {
    length: 2.7,
    width: 2.0,
    height: 1.40,
    wheelRadius: 0.29,
    antennaHeight: 1.50,
  },

  mass: 920.0,
  linearDamping: 0.92,
  angularDamping: 3.6,

  acceleration: 48.0,
  maxSpeed: 33.0,
  reverseSpeed: 20.0,
  reverseAcceleration: 32.0,
  brakingDeceleration: 48.0,
  steeringRate: 4.0,
  maxSteerAngle: 0.50,

  friction: 1.7,
  lateralGrip: 0.65,
  driftThreshold: 2.2,
  driftGripMultiplier: 0.35,
  driftSteerBoost: 1.70,

  boostMultiplier: 2.25,
  boostMaxSpeed: 46.0,
  boostDuration: 3.6,
  boostRechargeRate: 0.38,
  boostImpactBonus: 2.35,

  bounce: 0.68,
  bumperSpringStiffness: 290.0,
  bumperDamping: 22.0,
  maxBumperCompression: 0.24,

  impactKnockback: 1.35,
  recoilResistance: 0.80,
  baseStartingBag: 500,

  bodyTiltPitchAccel: 0.14,
  bodyTiltPitchBrake: 0.15,
  bodyTiltRollSteer: 0.15,
  suspensionIdleFreq: 2.0,
  suspensionIdleAmp: 0.015,
  antennaSwayLag: 0.15,
  antennaVibrationAmp: 0.07,

  primaryColor: 0xffd700,
  accentColor: 0x141416,
  glowColor: 0xffaa00,
  hudBadgeClass: 'badge-whale',
  displayTextColor: '#ffd700',
};

export const GME_APE_CONFIG: VehicleArchetypeConfig = {
  type: 'gme_ape',
  displayName: 'GME APE',
  archetype: 'Meme / Muscle Type',
  tagline: 'Apes Together Strong. To The Moon.',
  role: 'Muscle / Berserker',
  difficulty: 'Medium',

  dimensions: {
    length: 2.72,
    width: 2.06,
    height: 1.40,
    wheelRadius: 0.29,
    antennaHeight: 1.42,
  },

  mass: 980.0,
  linearDamping: 0.92,
  angularDamping: 3.4,

  acceleration: 42.0,
  maxSpeed: 28.0,
  reverseSpeed: 17.0,
  reverseAcceleration: 30.0,
  brakingDeceleration: 52.0,
  steeringRate: 4.8,
  maxSteerAngle: 0.48,

  friction: 1.6,
  lateralGrip: 0.72,
  driftThreshold: 1.8,
  driftGripMultiplier: 0.42,
  driftSteerBoost: 1.45,

  boostMultiplier: 2.15,
  boostMaxSpeed: 42.0,
  boostDuration: 3.5,
  boostRechargeRate: 0.40,
  boostImpactBonus: 2.20,

  bounce: 0.65,
  bumperSpringStiffness: 310.0,
  bumperDamping: 24.0,
  maxBumperCompression: 0.22,

  impactKnockback: 1.30,
  recoilResistance: 1.25,
  baseStartingBag: 420,

  bodyTiltPitchAccel: 0.16,
  bodyTiltPitchBrake: 0.14,
  bodyTiltRollSteer: 0.13,
  suspensionIdleFreq: 2.4,
  suspensionIdleAmp: 0.016,
  antennaSwayLag: 0.13,
  antennaVibrationAmp: 0.06,

  primaryColor: 0x1c1e26,
  accentColor: 0xff1e42,
  glowColor: 0x00f0ff,
  hudBadgeClass: 'badge-ape',
  displayTextColor: '#ff2a5f',
};

export const DOGE_KART_CONFIG: VehicleArchetypeConfig = {
  type: 'doge_kart',
  displayName: '$DOGE BARK',
  archetype: 'Doge Cyber Dune Buggy / Drift Kart',
  tagline: 'Much Wow. Very Speed. Such Bump.',
  role: 'Drift & Agility / Speedster',
  difficulty: 'Medium-Hard',

  dimensions: {
    length: 2.45,
    width: 1.84,
    height: 1.45,
    wheelRadius: 0.32,
    antennaHeight: 1.45,
  },

  mass: 820.0,
  linearDamping: 0.90,
  angularDamping: 3.2,

  acceleration: 44.0,
  maxSpeed: 27.5,
  reverseSpeed: 17.0,
  reverseAcceleration: 32.0,
  brakingDeceleration: 54.0,
  steeringRate: 5.6,
  maxSteerAngle: 0.62,

  friction: 1.5,
  lateralGrip: 0.74,
  driftThreshold: 1.6,
  driftGripMultiplier: 0.40,
  driftSteerBoost: 1.55,

  boostMultiplier: 2.10,
  boostMaxSpeed: 42.0,
  boostDuration: 3.6,
  boostRechargeRate: 0.45,
  boostImpactBonus: 1.80,

  bounce: 0.70,
  bumperSpringStiffness: 280.0,
  bumperDamping: 22.0,
  maxBumperCompression: 0.24,

  impactKnockback: 1.15,
  recoilResistance: 0.85,
  baseStartingBag: 69,

  bodyTiltPitchAccel: 0.18,
  bodyTiltPitchBrake: 0.16,
  bodyTiltRollSteer: 0.15,
  suspensionIdleFreq: 2.8,
  suspensionIdleAmp: 0.022,
  antennaSwayLag: 0.16,
  antennaVibrationAmp: 0.08,

  primaryColor: 0xf59e0b,
  accentColor: 0xffd000,
  glowColor: 0xffaa00,
  hudBadgeClass: 'badge-doge',
  displayTextColor: '#ffd000',
};

export const VEHICLE_CONFIGS: Record<VehicleType, VehicleArchetypeConfig> = {
  hood_bull: HOOD_BULL_CONFIG,
  hood_bear: HOOD_BEAR_CONFIG,
  tsla_racer: TSLA_RACER_CONFIG,
  nvda_ai: NVDA_AI_CONFIG,
  gold_whale: GOLD_WHALE_CONFIG,
  gme_ape: GME_APE_CONFIG,
  doge_kart: DOGE_KART_CONFIG,
};

export function getVehicleConfig(type: VehicleType): VehicleArchetypeConfig {
  return VEHICLE_CONFIGS[type] ?? HOOD_BULL_CONFIG;
}

