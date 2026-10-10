import type { Hex } from "viem";
import type { JoinIntentWire } from "../chain/join";
import type { Hex32, SeatScheme, TxRef, WalletId } from "../chain/types";
import type { BumpTier, EliminationCause } from "./enums";

export type Address = `0x${string}`;

export interface ClaimSeatMessage {
  wallet: WalletId;
  sessionKey: string;
  issuedAt: number;
  signature: string;
  scheme?: SeatScheme;
}

export interface JoinIntentMessage {
  intent: JoinIntentWire;
  signature: Hex;
}

export interface SolJoinPrepareMessage {
  matchId: Hex32;
  player: WalletId;
  sessionKey: string;
  vehicleId: number;
}

export interface SolJoinSubmitMessage {
  matchId: Hex32;
  signedTx: string;
}

export type SolJoinTxEvent = {
  t: "solJoinTx";
  matchId: Hex32;
  tx: string;
  expiresAt: number;
};

export type JoinResultEvent = {
  t: "joinResult";
  matchId: Hex32;
  wallet: WalletId;
  seat: number;
  txHash: TxRef;
};

export type SeatEvent = {
  t: "seat";
  wallet: WalletId;
  seat: number;
  vehicle: number;
};

export type BumpEvent = {
  t: "bump";
  tick: number;
  kind: "car" | "wall";
  attacker: string;
  victim: string;
  amount: number;
  tier: BumpTier;
  skills: number;
  x: number;
  z: number;
  nx: number;
  nz: number;
};

export type EliminateEvent = {
  t: "eliminate";
  tick: number;
  car: string;
  by: string | null;
  cause: EliminationCause;
  redistributed: Array<[string, number]>;
};

export type MarketEvent = {
  t: "marketEvent";
  tick: number;
  kind: number;
  title: string;
  durationTicks: number;
};

export type PhaseEvent = { t: "phase"; phase: number; tick: number };

export type MatchStartEvent = {
  t: "matchStart";
  matchId: Hex32;
  liveStartTick: number;
  durationTicks: number;
  seed: Hex;
  rapier: "0.21.0";
  serverBuild: string;
};

export interface RankingRow {
  wallet: string;
  finalBalance: number;
  rank: number;
  payoutWei: string;
}

export type MatchEndEvent = {
  t: "matchEnd";
  matchId: Hex32;
  endTick: number;
  ranking: RankingRow[];
  inputLogHash: Hex32;
  replayHash: Hex32;
  resultSignature: string;
};

export type SettlementStatus =
  | "opened"
  | "started"
  | "submitted"
  | "confirmed"
  | "failed"
  | "cancelled";

export type SettlementEvent = {
  t: "settlement";
  matchId: Hex32;
  status: SettlementStatus;
  txHash?: TxRef;
  error?: string;
};

export type ErrorCode =
  | "SEAT_REJECTED"
  | "NOT_JOINED"
  | "STALE_AUTH"
  | "ROOM_FULL"
  | "CHAIN_UNAVAILABLE"
  | JoinErrorCode;

export type JoinErrorCode =
  | "JOIN_MALFORMED"
  | "BAD_SIGNATURE"
  | "INTENT_EXPIRED"
  | "WRONG_MATCH"
  | "MATCH_CLOSED"
  | "ALREADY_JOINED"
  | "INSUFFICIENT_BALANCE"
  | "JOIN_PENDING"
  | "RATE_LIMITED"
  | "RELAYER_LOW"
  | "JOIN_FAILED"
  | "TX_EXPIRED"
  | "TX_TAMPERED";

export type ErrorEvent = {
  t: "error";
  code: ErrorCode;
  message: string;
  retryAfterS?: number;
};

export type FaucetErrorCode =
  | "INVALID_ADDRESS"
  | "COOLDOWN"
  | "RATE_LIMITED"
  | "GLOBAL_LIMIT"
  | "RELAYER_LOW"
  | "CHAIN_UNAVAILABLE"
  | "CLAIM_FAILED";

export interface FaucetSuccess {
  txHash: TxRef;
  nextClaimAt: number;
}

export interface FaucetError {
  code: FaucetErrorCode;
  message: string;
  retryAfterS: number;
  nextClaimAt?: number;
}

export interface FaucetStatus {
  wallet: WalletId;
  balance: string;
  nextClaimAt: number;
  canClaimNow: boolean;
}

export type CrateSpawnEvent = {
  t: "crateSpawn";
  tick: number;
  id: number;
  kind: number;
  x: number;
  z: number;
};
export type CrateTakenEvent = {
  t: "crateTaken";
  tick: number;
  id: number;
  car: string;
  kind: number;
};

export type ServerEvent =
  | JoinResultEvent
  | SolJoinTxEvent
  | SeatEvent
  | BumpEvent
  | EliminateEvent
  | MarketEvent
  | PhaseEvent
  | MatchStartEvent
  | MatchEndEvent
  | SettlementEvent
  | ErrorEvent
  | CrateSpawnEvent
  | CrateTakenEvent;

export const EVENT_CHANNEL = "ev";
export const CLAIM_SEAT_MESSAGE = "claimSeat";
export const JOIN_INTENT_MESSAGE = "joinIntent";
export const SOL_JOIN_PREPARE_MESSAGE = "solJoinPrepare";
export const SOL_JOIN_SUBMIT_MESSAGE = "solJoinSubmit";

export const encodeButtons = (flags: {
  brake?: boolean;
  boost?: boolean;
  handbrake?: boolean;
  usePowerUp?: boolean;
}): number =>
  (flags.brake ? 1 : 0) |
  (flags.boost ? 2 : 0) |
  (flags.handbrake ? 4 : 0) |
  (flags.usePowerUp ? 8 : 0);

export const quantizeAxis = (value: number): number =>
  Math.max(-100, Math.min(100, Math.round(value * 100)));
