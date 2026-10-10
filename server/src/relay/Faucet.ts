import type {
  FaucetError,
  FaucetErrorCode,
  FaucetStatus,
  FaucetSuccess,
} from "@bump/shared";
import { type Address, getAddress, type Hex, isAddress } from "viem";
import type { ChainGateway } from "../chain/ChainGateway";
import type { LimitConfig } from "../config";
import { RateLimiter } from "./RateLimiter";
import type { RelayerGuard } from "./RelayerGuard";

const HOUR_MS = 3_600_000;

export type FaucetResponse =
  | { status: 200; body: FaucetSuccess }
  | { status: number; body: FaucetError };

export type FaucetStatusResponse =
  | { status: 200; body: FaucetStatus }
  | { status: number; body: FaucetError };

export interface FaucetOptions {
  chain: ChainGateway;
  guard: RelayerGuard;
  limits: LimitConfig;
  now: () => number;
  log: (line: Record<string, unknown>) => void;
}

const fail = (
  status: number,
  code: FaucetErrorCode,
  message: string,
  retryAfterS = 0,
  nextClaimAt?: number,
): { status: number; body: FaucetError } => ({
  status,
  body: { code, message, retryAfterS, nextClaimAt },
});

export class Faucet {
  private readonly perIp: RateLimiter;
  private readonly global: RateLimiter;
  private readonly inFlight = new Set<string>();

  constructor(private readonly options: FaucetOptions) {
    this.perIp = new RateLimiter(
      options.limits.faucetPerIpPerHour,
      HOUR_MS,
      options.now,
    );
    this.global = new RateLimiter(
      options.limits.faucetGlobalPerHour,
      HOUR_MS,
      options.now,
    );
  }

  async claim(rawWallet: unknown, ip: string): Promise<FaucetResponse> {
    const { chain, guard, now, log } = this.options;
    if (typeof rawWallet !== "string" || !isAddress(rawWallet)) {
      return fail(400, "INVALID_ADDRESS", "wallet is not a valid address");
    }
    const wallet = getAddress(rawWallet);
    const key = wallet.toLowerCase();

    const ipWait = this.perIp.tryConsume(ip);
    if (ipWait > 0) {
      return fail(429, "RATE_LIMITED", "too many faucet calls", ipWait);
    }
    if (this.inFlight.has(key)) {
      return fail(429, "RATE_LIMITED", "a claim is already in flight", 3);
    }
    this.inFlight.add(key);
    try {
      let next: bigint;
      try {
        next = await chain.nextClaimAt(wallet);
        if (await guard.isLow()) {
          return fail(
            503,
            "RELAYER_LOW",
            "faucet is out of gas, try later",
            300,
          );
        }
      } catch (error) {
        log({ evt: "faucet_read_failed", error: String(error) });
        return fail(503, "CHAIN_UNAVAILABLE", "chain is unavailable", 10);
      }

      const nowS = Math.floor(now() / 1000);
      if (next > BigInt(nowS)) {
        return fail(
          429,
          "COOLDOWN",
          "this wallet already claimed today",
          Number(next) - nowS,
          Number(next),
        );
      }

      const globalWait = this.global.tryConsume("all");
      if (globalWait > 0) {
        return fail(
          429,
          "GLOBAL_LIMIT",
          "faucet is busy, try later",
          globalWait,
        );
      }

      let txHash: Hex;
      try {
        txHash = await chain.faucetClaim(wallet);
        guard.invalidate();
      } catch (error) {
        log({ evt: "faucet_claim_failed", error: String(error) });
        const text = String(error);
        if (text.includes("ClaimCooldown")) {
          return fail(429, "COOLDOWN", "this wallet already claimed today", 60);
        }
        return fail(502, "CLAIM_FAILED", "claim transaction failed", 10);
      }
      let nextClaimAt = 0;
      try {
        nextClaimAt = Number(await chain.nextClaimAt(wallet));
      } catch {
        nextClaimAt = nowS + 24 * 3600;
      }
      log({ evt: "faucet_claim", wallet: key, txHash });
      return { status: 200, body: { txHash, nextClaimAt } };
    } finally {
      this.inFlight.delete(key);
    }
  }

  async status(rawWallet: unknown): Promise<FaucetStatusResponse> {
    if (typeof rawWallet !== "string" || !isAddress(rawWallet)) {
      return fail(400, "INVALID_ADDRESS", "wallet is not a valid address");
    }
    const wallet: Address = getAddress(rawWallet);
    try {
      const [balance, next] = await Promise.all([
        this.options.chain.tokenBalanceOf(wallet),
        this.options.chain.nextClaimAt(wallet),
      ]);
      const nowS = Math.floor(this.options.now() / 1000);
      return {
        status: 200,
        body: {
          wallet: wallet.toLowerCase() as Address,
          balance: balance.toString(),
          nextClaimAt: Number(next),
          canClaimNow: next <= BigInt(nowS),
        },
      };
    } catch (error) {
      this.options.log({ evt: "faucet_status_failed", error: String(error) });
      return fail(503, "CHAIN_UNAVAILABLE", "chain is unavailable", 10);
    }
  }

  sweep(): void {
    this.perIp.sweep();
    this.global.sweep();
  }
}
