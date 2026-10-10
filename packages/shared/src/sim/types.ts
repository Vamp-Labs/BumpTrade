import type {
  BumpTier,
  EliminationCause,
  MarketEventKind,
  PowerUpKind,
} from "../protocol/enums";

export interface VehicleInput {
  throttle: number;
  steer: number;
  brake: boolean;
  boost: boolean;
  handbrake: boolean;
}

export const IDLE_INPUT: VehicleInput = {
  throttle: 0,
  steer: 0,
  brake: false,
  boost: false,
  handbrake: false,
};

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BumpSimEvent {
  t: "bump";
  tick: number;
  kind: "car" | "wall";
  attackerSeat: number;
  victimSeat: number;
  amount: number;
  tier: BumpTier;
  skills: number;
  x: number;
  z: number;
  nx: number;
  nz: number;
}

export interface EliminateSimEvent {
  t: "eliminate";
  tick: number;
  seat: number;
  bySeat: number | null;
  cause: EliminationCause;
  redistributed: Array<[number, number]>;
}

export interface MarketSimEvent {
  t: "marketEvent";
  tick: number;
  kind: MarketEventKind;
  title: string;
  durationTicks: number;
}

export interface CrateSpawnSimEvent {
  t: "crateSpawn";
  tick: number;
  id: number;
  kind: PowerUpKind;
  x: number;
  z: number;
}

export interface CrateTakenSimEvent {
  t: "crateTaken";
  tick: number;
  id: number;
  seat: number;
  kind: PowerUpKind;
}

export type SimEvent =
  | BumpSimEvent
  | EliminateSimEvent
  | MarketSimEvent
  | CrateSpawnSimEvent
  | CrateTakenSimEvent;

export interface SimCrate {
  id: number;
  kind: PowerUpKind;
  x: number;
  z: number;
}
