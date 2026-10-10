import {
  CarFlag,
  CarState,
  MarketEventKind,
  Phase,
  ROOM_NAME,
  TICK_HZ,
  VEHICLE_IDS,
  seatMessage,
  type BumpTier,
  type PhaseValue,
  type RankingRow,
  type ServerEvent,
} from '@bump/shared';
import type { Hex } from 'viem';
import { walletKey } from '../chain/format';
import type { VehicleType } from '../vehicles/VehicleTypes';

export { CarFlag, CarState, MarketEventKind, Phase, ROOM_NAME, seatMessage };
export type { BumpTier, RankingRow, ServerEvent };

export type PhaseId = PhaseValue;

export const TICK_RATE = TICK_HZ;

export function vehicleIdOf(type: VehicleType): number {
  const index = (VEHICLE_IDS as readonly string[]).indexOf(type);
  return index === -1 ? 0 : index;
}

export function vehicleTypeOf(id: number): VehicleType {
  return (VEHICLE_IDS[id] ?? 'hood_bull') as VehicleType;
}

export interface ServerCar {
  wallet: string;
  seat: number;
  vehicle: number;
  connected: boolean;
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
  powerUp: number;
  powerUpMs: number;
  balance: number;
  state: number;
}

export interface MatchView {
  matchId: Hex | '';
  phase: PhaseId;
  stakeAmount: string;
  startBalance: number;
  joinDeadline: number;
  fillEndsAt: number;
  tick: number;
  liveStartTick: number;
  endsAtTick: number;
  marketEvent: number;
  eventEndsAtTick: number;
  lobby: number;
  cars: ServerCar[];
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function readCar(raw: unknown, key: string): ServerCar {
  const c = asRecord(raw);
  return {
    wallet: walletKey(str(c.wallet, key)),
    seat: num(c.seat),
    vehicle: num(c.vehicle),
    connected: c.connected !== false,
    px: num(c.px),
    py: num(c.py),
    pz: num(c.pz),
    qx: num(c.qx),
    qy: num(c.qy),
    qz: num(c.qz),
    qw: num(c.qw, 1),
    vx: num(c.vx),
    vy: num(c.vy),
    vz: num(c.vz),
    wx: num(c.wx),
    wy: num(c.wy),
    wz: num(c.wz),
    boost: num(c.boost),
    flags: num(c.flags),
    powerUp: num(c.powerUp),
    powerUpMs: num(c.powerUpMs),
    balance: num(c.balance),
    state: num(c.state),
  };
}

function forEachEntry(collection: unknown, visit: (value: unknown, key: string) => void): void {
  const c = collection as { forEach?: (cb: (value: unknown, key: string) => void) => void } | null;
  if (c && typeof c.forEach === 'function') {
    c.forEach((value, key) => {
      visit(value, String(key));
    });
  }
}

export function readMatchView(rawState: unknown): MatchView {
  const s = asRecord(rawState);
  const cars: ServerCar[] = [];
  forEachEntry(s.cars, (value, key) => cars.push(readCar(value, key)));
  cars.sort((a, b) => a.seat - b.seat);
  const phase = num(s.phase) as PhaseId;
  return {
    matchId: str(s.matchId) as Hex | '',
    phase,
    stakeAmount: str(s.stakeAmount, str(s.stakeWei, '0')),
    startBalance: num(s.startBalance),
    joinDeadline: num(s.joinDeadline),
    fillEndsAt: num(s.fillEndsAt),
    tick: num(s.tick),
    liveStartTick: num(s.liveStartTick),
    endsAtTick: num(s.endsAtTick),
    marketEvent: num(s.marketEvent),
    eventEndsAtTick: num(s.eventEndsAtTick),
    lobby: num(s.lobby),
    cars,
  };
}

export function rankingPayout(row: RankingRow): bigint {
  const raw = row as unknown as Record<string, unknown>;
  const value = raw.payoutAmount ?? raw.payoutWei;
  try {
    return typeof value === 'string' || typeof value === 'number' ? BigInt(value) : 0n;
  } catch {
    return 0n;
  }
}

export function normalizeEvent(type: string | number, payload: unknown): ServerEvent | null {
  const body = asRecord(payload);
  const kind = typeof body.t === 'string' ? body.t : String(type);
  const event = { ...body, t: kind };
  switch (kind) {
    case 'joinResult':
    case 'solJoinTx':
    case 'seat':
    case 'bump':
    case 'eliminate':
    case 'marketEvent':
    case 'phase':
    case 'matchStart':
    case 'matchEnd':
    case 'settlement':
    case 'error':
    case 'crateSpawn':
    case 'crateTaken':
      return event as unknown as ServerEvent;
    default:
      return null;
  }
}
