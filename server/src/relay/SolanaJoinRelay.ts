import {
  type Hex32,
  type SolJoinPrepareMessage,
  type SolJoinSubmitMessage,
  type SolJoinTxEvent,
  VEHICLE_COUNT,
} from "@bump/shared";
import { isAddress } from "@solana/kit";
import { type ArenaChain, MatchStatus } from "../chain/ArenaChain";
import {
  JoinTxError,
  type JoinParams,
  type PreparedJoin,
} from "../chain/solana/SolanaArenaChain";
import { programErrorName } from "../chain/solana/programErrors";
import type { LimitConfig } from "../config";
import type { JoinOutcome, JoinRejection } from "./JoinRelay";
import { RateLimiter } from "./RateLimiter";
import type { RelayerGuard } from "./RelayerGuard";

const HOUR_MS = 3_600_000;
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const JOIN_TX_TTL_MS = 60_000;

export interface SolanaJoinChain extends ArenaChain {
  prepareJoin(params: JoinParams): Promise<PreparedJoin>;
  messageIdOf(signedTx: string): string | null;
  submitJoin(prepared: PreparedJoin, signedTx: string): Promise<string>;
}

export interface SolanaJoinRelayOptions {
  chain: SolanaJoinChain;
  guard: RelayerGuard;
  limits: LimitConfig;
  now: () => number;
  log: (line: Record<string, unknown>) => void;
  ttlMs?: number;
}

export type PrepareOutcome =
  | { ok: true; event: SolJoinTxEvent }
  | ({ ok: false } & JoinRejection);

interface Pending {
  prepared: PreparedJoin;
  matchId: Hex32;
  expiresAt: number;
  inFlight: boolean;
}

const isHex32 = (value: unknown): value is Hex32 =>
  typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);

export const parseSolJoinPrepare = (
  raw: unknown,
): SolJoinPrepareMessage | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as Record<string, unknown>;
  if (
    !isHex32(m.matchId) ||
    typeof m.player !== "string" ||
    !isAddress(m.player) ||
    typeof m.sessionKey !== "string" ||
    !isAddress(m.sessionKey) ||
    m.sessionKey === SYSTEM_PROGRAM ||
    typeof m.vehicleId !== "number" ||
    !Number.isInteger(m.vehicleId)
  ) {
    return null;
  }
  return {
    matchId: m.matchId,
    player: m.player,
    sessionKey: m.sessionKey,
    vehicleId: m.vehicleId,
  };
};

export const parseSolJoinSubmit = (
  raw: unknown,
): SolJoinSubmitMessage | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as Record<string, unknown>;
  if (
    !isHex32(m.matchId) ||
    typeof m.signedTx !== "string" ||
    m.signedTx.length === 0 ||
    m.signedTx.length > 4096
  ) {
    return null;
  }
  return { matchId: m.matchId, signedTx: m.signedTx };
};

const reject = (
  code: JoinRejection["code"],
  message: string,
  retryAfterS?: number,
): { ok: false } & JoinRejection => ({ ok: false, code, message, retryAfterS });

const mapSendError = (text: string): JoinRejection => {
  if (text.includes("MatchFull")) {
    return { code: "ROOM_FULL", message: "match is full" };
  }
  if (text.includes("AlreadyJoined")) {
    return {
      code: "ALREADY_JOINED",
      message: "wallet already joined this match",
    };
  }
  if (
    text.includes("JoinClosed") ||
    text.includes("MatchNotOpen") ||
    text.includes("Paused")
  ) {
    return { code: "MATCH_CLOSED", message: "join window has closed" };
  }
  if (text.includes("InsufficientFunds")) {
    return {
      code: "INSUFFICIENT_BALANCE",
      message: "not enough BUMP for the stake",
    };
  }
  if (text.includes("expired") || text.includes("Blockhash not found")) {
    return { code: "TX_EXPIRED", message: "transaction expired" };
  }
  return {
    code: "JOIN_FAILED",
    message: "join transaction failed",
    retryAfterS: 5,
  };
};

export class SolanaJoinRelay {
  private readonly perIp: RateLimiter;
  private readonly byId = new Map<string, Pending>();
  private readonly byWallet = new Map<string, string>();
  private readonly ttlMs: number;

  constructor(private readonly options: SolanaJoinRelayOptions) {
    this.perIp = new RateLimiter(
      options.limits.joinPerIpPerHour,
      HOUR_MS,
      options.now,
    );
    this.ttlMs = options.ttlMs ?? JOIN_TX_TTL_MS;
  }

  async prepare(
    raw: unknown,
    matchId: Hex32,
    ip: string,
  ): Promise<PrepareOutcome> {
    const { chain, guard, now, log } = this.options;
    const message = parseSolJoinPrepare(raw);
    if (!message) return reject("JOIN_MALFORMED", "malformed join request");
    if (message.matchId.toLowerCase() !== matchId.toLowerCase()) {
      return reject("WRONG_MATCH", "request is for another match");
    }
    if (message.vehicleId < 0 || message.vehicleId >= VEHICLE_COUNT) {
      return reject("JOIN_MALFORMED", "unknown vehicle");
    }
    const wallet = message.player;
    this.expire();
    const existing = this.byWallet.get(wallet);
    if (existing && this.byId.get(existing)?.inFlight) {
      return reject("JOIN_PENDING", "a join is already in flight", 3);
    }
    const wait = this.perIp.tryConsume(ip);
    if (wait > 0) {
      return reject("RATE_LIMITED", "too many joins from this address", wait);
    }

    const nowS = Math.floor(now() / 1000);
    try {
      if (await guard.isLow()) {
        return reject("RELAYER_LOW", "relayer is out of gas, try later", 300);
      }
      const view = await chain.getMatch(matchId);
      if (view.status !== MatchStatus.Open) {
        return reject("MATCH_CLOSED", "match is not open");
      }
      if (BigInt(nowS) > view.joinDeadline) {
        return reject("MATCH_CLOSED", "join window has closed");
      }
      if (view.playerCount >= view.maxPlayers) {
        return reject("ROOM_FULL", "match is full");
      }
      if ((await chain.sessionKeyOf(matchId, wallet)) !== null) {
        return reject("ALREADY_JOINED", "wallet already joined this match");
      }
      if ((await chain.tokenBalanceOf(wallet)) < view.stake) {
        return reject("INSUFFICIENT_BALANCE", "not enough BUMP for the stake");
      }
    } catch (error) {
      log({ evt: "join_read_failed", error: String(error) });
      return reject("CHAIN_UNAVAILABLE", "chain is unavailable", 10);
    }

    let prepared: PreparedJoin;
    try {
      prepared = await chain.prepareJoin({
        matchId,
        player: wallet,
        sessionKey: message.sessionKey,
        vehicleId: message.vehicleId,
      });
    } catch (error) {
      log({ evt: "join_prepare_failed", error: String(error) });
      return reject("CHAIN_UNAVAILABLE", "chain is unavailable", 10);
    }
    if (existing) this.byId.delete(existing);
    const expiresAt = now() + this.ttlMs;
    this.byId.set(prepared.id, {
      prepared,
      matchId,
      expiresAt,
      inFlight: false,
    });
    this.byWallet.set(wallet, prepared.id);
    return {
      ok: true,
      event: { t: "solJoinTx", matchId, tx: prepared.tx, expiresAt },
    };
  }

  async submit(raw: unknown, matchId: Hex32): Promise<JoinOutcome> {
    const { chain, guard, now, log } = this.options;
    const message = parseSolJoinSubmit(raw);
    if (!message) return reject("JOIN_MALFORMED", "malformed join submission");
    if (message.matchId.toLowerCase() !== matchId.toLowerCase()) {
      return reject("WRONG_MATCH", "submission is for another match");
    }
    const id = chain.messageIdOf(message.signedTx);
    const pending = id ? this.byId.get(id) : undefined;
    if (!id || !pending || pending.matchId !== matchId) {
      return reject("TX_TAMPERED", "transaction does not match the prepared join");
    }
    if (pending.inFlight) {
      return reject("JOIN_PENDING", "a join is already in flight", 3);
    }
    const wallet = pending.prepared.player;
    if (now() >= pending.expiresAt) {
      this.drop(id, wallet);
      return reject("TX_EXPIRED", "prepared transaction has expired");
    }

    pending.inFlight = true;
    let keep = false;
    try {
      let txHash: string;
      try {
        txHash = await chain.submitJoin(pending.prepared, message.signedTx);
        guard.invalidate();
      } catch (error) {
        if (error instanceof JoinTxError) {
          keep = true;
          return reject(error.code, error.message);
        }
        const text = programErrorName(error) ?? String(error);
        log({
          evt: "join_failed",
          matchId,
          wallet,
          error: String(error).split("\n")[0],
        });
        const mapped = mapSendError(`${text} ${String(error)}`);
        return reject(mapped.code, mapped.message, mapped.retryAfterS);
      }
      let seat = -1;
      try {
        seat = (await chain.getPlayers(matchId)).indexOf(wallet);
      } catch {
        seat = -1;
      }
      log({ evt: "join_relayed", matchId, wallet, txHash, seat });
      return { ok: true, wallet, seat, txHash };
    } finally {
      pending.inFlight = false;
      if (!keep) this.drop(id, wallet);
    }
  }

  sweep(): void {
    this.perIp.sweep();
    this.expire();
  }

  private drop(id: string, wallet: string): void {
    this.byId.delete(id);
    if (this.byWallet.get(wallet) === id) this.byWallet.delete(wallet);
  }

  private expire(): void {
    const cutoff = this.options.now() - 5 * this.ttlMs;
    for (const [id, pending] of this.byId) {
      if (!pending.inFlight && pending.expiresAt < cutoff) {
        this.drop(id, pending.prepared.player);
      }
    }
  }
}
