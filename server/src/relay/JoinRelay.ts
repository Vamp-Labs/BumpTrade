import {
  buildDomain,
  CHAIN_ID,
  JOIN_INTENT_TYPES,
  type JoinErrorCode,
  type JoinIntentMessage,
  toTypedJoinIntent,
  VEHICLE_COUNT,
} from "@bump/shared";
import {
  type Address,
  getAddress,
  type Hex,
  isAddress,
  recoverTypedDataAddress,
} from "viem";
import { type ChainGateway, MatchStatus } from "../chain/ChainGateway";
import type { LimitConfig } from "../config";
import { RateLimiter } from "./RateLimiter";
import type { RelayerGuard } from "./RelayerGuard";

const HOUR_MS = 3_600_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type JoinOutcome =
  | { ok: true; wallet: Address; seat: number; txHash: Hex }
  | {
      ok: false;
      code: JoinErrorCode | "ROOM_FULL" | "CHAIN_UNAVAILABLE";
      message: string;
      retryAfterS?: number;
    };

export interface JoinRelayOptions {
  chain: ChainGateway;
  guard: RelayerGuard;
  limits: LimitConfig;
  arenaAddress: Address;
  chainId?: number;
  now: () => number;
  log: (line: Record<string, unknown>) => void;
}

const isHex = (value: unknown, length?: number): value is Hex =>
  typeof value === "string" &&
  /^0x[0-9a-fA-F]*$/.test(value) &&
  (length === undefined || value.length === length);

export const parseJoinMessage = (raw: unknown): JoinIntentMessage | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as Record<string, unknown>;
  const i = m.intent;
  if (typeof i !== "object" || i === null || !isHex(m.signature)) return null;
  const intent = i as Record<string, unknown>;
  if (
    !isHex(intent.matchId, 66) ||
    !isAddress(intent.player as string) ||
    !isAddress(intent.sessionKey as string) ||
    typeof intent.vehicleId !== "number" ||
    !Number.isInteger(intent.vehicleId) ||
    typeof intent.deadline !== "string" ||
    !/^[0-9]{1,20}$/.test(intent.deadline)
  ) {
    return null;
  }
  return {
    intent: {
      matchId: intent.matchId,
      player: intent.player as Address,
      sessionKey: intent.sessionKey as Address,
      vehicleId: intent.vehicleId,
      deadline: intent.deadline,
    },
    signature: m.signature,
  };
};

const reject = (
  code: Extract<JoinOutcome, { ok: false }>["code"],
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

  async submit(raw: unknown, matchId: Hex, ip: string): Promise<JoinOutcome> {
    const { chain, guard, now, log } = this.options;
    const message = parseJoinMessage(raw);
    if (!message) return reject("JOIN_MALFORMED", "malformed join intent");
    const { intent, signature } = message;

    if (intent.matchId.toLowerCase() !== matchId.toLowerCase()) {
      return reject("WRONG_MATCH", "intent is for another match");
    }
    if (intent.vehicleId < 0 || intent.vehicleId >= VEHICLE_COUNT) {
      return reject("JOIN_MALFORMED", "unknown vehicle");
    }
    if (intent.sessionKey.toLowerCase() === ZERO_ADDRESS) {
      return reject("JOIN_MALFORMED", "session key is empty");
    }
    const typed = toTypedJoinIntent(intent);
    const nowS = Math.floor(now() / 1000);
    if (typed.deadline < BigInt(nowS)) {
      return reject("INTENT_EXPIRED", "join intent has expired");
    }

    let signer: Address;
    try {
      signer = await recoverTypedDataAddress({
        domain: buildDomain(
          this.options.arenaAddress,
          this.options.chainId ?? CHAIN_ID,
        ),
        types: JOIN_INTENT_TYPES,
        primaryType: "JoinIntent",
        message: typed,
        signature,
      });
    } catch {
      return reject("BAD_SIGNATURE", "signature is invalid");
    }
    if (signer.toLowerCase() !== intent.player.toLowerCase()) {
      return reject("BAD_SIGNATURE", "signature is not from the player");
    }

    const player = getAddress(intent.player);
    const key = player.toLowerCase();
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
        const existing = await chain.sessionKeyOf(matchId, player);
        if (existing.toLowerCase() !== ZERO_ADDRESS) {
          return reject("ALREADY_JOINED", "wallet already joined this match");
        }
        const balance = await chain.tokenBalanceOf(player);
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

      let txHash: Hex;
      try {
        txHash = await chain.joinWithSig(typed, signature);
        guard.invalidate();
      } catch (error) {
        const text = String(error);
        log({
          evt: "join_failed",
          matchId,
          wallet: key,
          error: text.split("\n")[0],
        });
        if (text.includes("IntentExpired")) {
          return reject("INTENT_EXPIRED", "join intent has expired");
        }
        if (text.includes("AlreadyJoined")) {
          return reject("ALREADY_JOINED", "wallet already joined this match");
        }
        if (text.includes("MatchFull"))
          return reject("ROOM_FULL", "match is full");
        if (text.includes("JoinClosed")) {
          return reject("MATCH_CLOSED", "join window has closed");
        }
        if (text.includes("ERC20InsufficientBalance")) {
          return reject(
            "INSUFFICIENT_BALANCE",
            "not enough BUMP for the stake",
          );
        }
        return reject("JOIN_FAILED", "join transaction failed", 5);
      }

      let seat = -1;
      try {
        const players = await chain.getPlayers(matchId);
        seat = players.findIndex((p) => p.toLowerCase() === key);
      } catch {
        seat = -1;
      }
      log({ evt: "join_relayed", matchId, wallet: key, txHash, seat });
      return { ok: true, wallet: key as Address, seat, txHash };
    } finally {
      this.pending.delete(key);
    }
  }

  sweep(): void {
    this.perIp.sweep();
  }
}
