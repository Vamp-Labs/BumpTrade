export const Phase = {
  LOBBY: 0,
  COUNTDOWN: 1,
  LIVE: 2,
  ENDED: 3,
  SETTLED: 4,
  CANCELLED: 5,
  SETTLE_FAILED: 6,
} as const;
export type PhaseValue = (typeof Phase)[keyof typeof Phase];

export const CarState = {
  ALIVE: 0,
  CRITICAL: 1,
  ELIMINATED: 2,
  DISCONNECTED: 3,
} as const;
export type CarStateValue = (typeof CarState)[keyof typeof CarState];

export const PowerUpKind = {
  NONE: 0,
  TURBO: 1,
  HEAVY_HIT: 2,
  CASH_MAGNET: 3,
  SHIELD: 4,
} as const;
export type PowerUpKind = (typeof PowerUpKind)[keyof typeof PowerUpKind];

export const MarketEventKind = {
  NONE: 0,
  FIRE_BURST: 1,
  MARKET_FLASH: 2,
  BLACKOUT: 3,
  MARKET_CRASH: 4,
  DOUBLE_STEAL_SURGE: 5,
  MARKET_DROP: 6,
  FINAL_20: 7,
} as const;
export type MarketEventKind =
  (typeof MarketEventKind)[keyof typeof MarketEventKind];

export type BumpTier = "LIGHT" | "HEAVY" | "PERFECT" | "CRITICAL";
export type EliminationCause = "bankrupt" | "voidPit" | "disconnectTimeout";

export const Skill = {
  HEAD_ON: 1 << 0,
  BANK: 1 << 1,
  DRIFT: 1 << 2,
  BOOST: 1 << 3,
  DOUBLE: 1 << 4,
  REVENGE: 1 << 5,
  TITAN: 1 << 6,
  SURGE: 1 << 7,
} as const;

export const CarFlag = {
  BOOSTING: 1 << 0,
  DRIFTING: 1 << 1,
  SHIELD: 1 << 2,
  HEAVY_HIT: 1 << 3,
  MAGNET: 1 << 4,
  TURBO: 1 << 5,
  CRITICAL: 1 << 6,
  ELIMINATED: 1 << 7,
} as const;

export const InputButton = {
  BRAKE: 1 << 0,
  BOOST: 1 << 1,
  HANDBRAKE: 1 << 2,
  USE_POWER_UP: 1 << 3,
} as const;
export const INPUT_BUTTON_MASK = 0x0f;

export const VEHICLE_IDS = [
  "hood_bull",
  "hood_bear",
  "tsla_racer",
  "nvda_ai",
  "gold_whale",
  "gme_ape",
  "doge_kart",
] as const;
export type VehicleName = (typeof VEHICLE_IDS)[number];
export const VEHICLE_COUNT = VEHICLE_IDS.length;

export const ROOM_NAME = "arena";
export const PATCH_RATE_MS = 33;
