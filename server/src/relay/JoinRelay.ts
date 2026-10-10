import type {
  Hex32,
  JoinErrorCode,
  TxRef,
  WalletId,
} from "@bump/shared";
import { type ArenaChain, MatchStatus } from "../chain/ArenaChain";
import type { LimitConfig } from "../config";
import { RateLimiter } from "./RateLimiter";
import type { RelayerGuard } from "./RelayerGuard";

const HOUR_MS = 3_600_000;

export interface JoinRejection {
  code: JoinErrorCode | "ROOM_FULL" | "CHAIN_UNAVAILABLE";
  message: string;
  retryAfterS?: number;
}

export type JoinOutcome =
  | { ok: true; wallet: WalletId; seat: number; txHash: TxRef }
  | ({ ok: false } & JoinRejection);

export interface JoinRequest {
  wallet: WalletId;
  key: string;
  send: () => Promise<TxRef>;
}

export type JoinCheck =
  | { ok: true; request: JoinRequest }
  | ({ ok: false } & JoinRejection);

export interface JoinProtocol {
  verify(raw: unknown, matchId: Hex32, nowS: number): Promise<JoinCheck>;
  mapSendError(text: string): JoinRejection;
}

export interface JoinRelayOptions {
  chain: ArenaChain;
  guard: RelayerGuard;
  limits: LimitConfig;
  protocol: JoinProtocol;
  now: () => number;
  log: (line: Record<string, unknown>) => void;
}

const reject = (
  code: JoinRejection["code"],
  message: string,
  retryAfterS?: number,
): JoinOutcome => ({ ok: false, code, message, retryAfterS });

export class JoinRelay {
  private readonly perIp: RateLimiter;
  private readonly pending = new Set<string>();

  constructor(private readonly options: JoinRelayOptions) {
    this.perIp = new RateLimiter(
      options.limits.joinPerIpPerHour,
      HOUR_MS,
      options.now,
    );
  }

  async submit(raw: unknown, matchId: Hex32, ip: string): Promise<JoinOutcome> {
    const { chain, guard, now, log, protocol } = this.options;
    const nowS = Math.floor(now() / 1000);
    const check = await protocol.verify(raw, matchId, nowS);
    if (!check.ok) {
      return reject(check.code, check.message, check.retryAfterS);
    }
    const { wallet, key, send } = check.request;

    if (this.pending.has(key)) {
      return reject("JOIN_PENDING", "a join is already in flight", 3);
    }
    const wait = this.perIp.tryConsume(ip);
    if (wait > 0) {
      return reject("RATE_LIMITED", "too many joins from this address", wait);
    }

    this.pending.add(key);
    try {
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
        const existing = await chain.sessionKeyOf(matchId, wallet);
        if (existing !== null) {
          return reject("ALREADY_JOINED", "wallet already joined this match");
        }
        const balance = await chain.tokenBalanceOf(wallet);
        if (balance < view.stake) {
          return reject(
            "INSUFFICIENT_BALANCE",
            "not enough BUMP for the stake",
          );
        }
      } catch (error) {
        log({ evt: "join_read_failed", error: String(error) });
        return reject("CHAIN_UNAVAILABLE", "chain is unavailable", 10);
      }

      let txHash: TxRef;
      try {
        txHash = await send();
        guard.invalidate();
      } catch (error) {
        const text = String(error);
        log({
          evt: "join_failed",
          matchId,
          wallet: key,
          error: text.split("\n")[0],
        });
        const mapped = protocol.mapSendError(text);
        return reject(mapped.code, mapped.message, mapped.retryAfterS);
      }

      let seat = -1;
      try {
        const players = await chain.getPlayers(matchId);
        seat = players.findIndex((p) => chain.walletKey(p) === key);
      } catch {
        seat = -1;
      }
      log({ evt: "join_relayed", matchId, wallet: key, txHash, seat });
      return { ok: true, wallet: key, seat, txHash };
    } finally {
      this.pending.delete(key);
    }
  }

  sweep(): void {
    this.perIp.sweep();
  }
}
