import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  buildDomain,
  JOIN_INTENT_TYPES,
  type JoinIntentWire,
  toTypedJoinIntent,
} from "@bump/shared";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import {
  type ChainGateway,
  MatchStatus,
  type OnChainMatch,
  type SettleResult,
} from "../src/chain/ChainGateway";
import { RefundKeeper } from "../src/chain/RefundKeeper";
import type { LimitConfig } from "../src/config";
import { Faucet } from "../src/relay/Faucet";
import { JoinRelay } from "../src/relay/JoinRelay";
import { RateLimiter } from "../src/relay/RateLimiter";
import { RelayerGuard } from "../src/relay/RelayerGuard";

interface Vector {
  domain: { verifyingContract: Address; chainId: number };
  message: JoinIntentWire;
  signature: Hex;
  signerAddress: Address;
}

const vector = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../contracts/test/fixtures/join-vector.json"),
    "utf8",
  ),
) as Vector;

const ANVIL_KEY_ONE: Hex =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const ARENA = vector.domain.verifyingContract;
const MATCH_ID = vector.message.matchId;
const PLAYER = vector.message.player;
const TX: Hex = `0x${"cc".repeat(32)}`;
const NOW_MS = 1_790_000_000_000;
const ETH = 10n ** 18n;

const view = (over: Partial<OnChainMatch> = {}): OnChainMatch => ({
  stake: 100n * ETH,
  startBalance: 100,
  maxPlayers: 8,
  playerCount: 0,
  status: MatchStatus.Open,
  joinDeadline: BigInt(NOW_MS / 1000 + 100),
  settleDeadline: BigInt(NOW_MS / 1000 + 3700),
  pot: 0n,
  ...over,
});

class FakeChain implements ChainGateway {
  match = view();
  balance = 1000n * ETH;
  relayer = ETH;
  next = 0n;
  joined: Address[] = [];
  sessionKey: Address = "0x0000000000000000000000000000000000000000";
  joinCalls = 0;
  claimCalls = 0;
  joinGate: Promise<void> | null = null;
  refundCalls: Address[] = [];
  refundFail = new Set<string>();
  cancelCalls = 0;

  async openMatch(): Promise<Hex> {
    return TX;
  }
  async startMatch(): Promise<Hex> {
    return TX;
  }
  async cancel(): Promise<Hex> {
    this.cancelCalls += 1;
    return TX;
  }
  async settle(_r: SettleResult): Promise<Hex> {
    return TX;
  }
  async getMatch(): Promise<OnChainMatch> {
    return this.match;
  }
  async getPlayers(): Promise<Address[]> {
    return this.joined;
  }
  async sessionKeyOf(): Promise<Address> {
    return this.sessionKey;
  }
  async vehicleOf(): Promise<number> {
    return 0;
  }
  async hashResult(): Promise<Hex> {
    return TX;
  }
  async joinWithSig(): Promise<Hex> {
    this.joinCalls += 1;
    if (this.joinGate) await this.joinGate;
    this.joined.push(PLAYER);
    return TX;
  }
  async claimRefund(_m: Hex, player: Address): Promise<Hex> {
    if (this.refundFail.has(player)) throw new Error("AlreadyRefunded()");
    this.refundCalls.push(player);
    return TX;
  }
  async faucetClaim(): Promise<Hex> {
    this.claimCalls += 1;
    this.next = BigInt(NOW_MS / 1000 + 86400);
    return TX;
  }
  async tokenBalanceOf(): Promise<bigint> {
    return this.balance;
  }
  async nextClaimAt(): Promise<bigint> {
    return this.next;
  }
  async relayerBalance(): Promise<bigint> {
    return this.relayer;
  }
  async tokenAddress(): Promise<Address> {
    return ARENA;
  }
}

const limits = (over: Partial<LimitConfig> = {}): LimitConfig => ({
  faucetPerIpPerHour: 5,
  faucetGlobalPerHour: 300,
  joinPerIpPerHour: 20,
  ...over,
});

const setup = (over: Partial<LimitConfig> = {}) => {
  const chain = new FakeChain();
  const now = () => NOW_MS;
  const guard = new RelayerGuard(chain, 2_000_000_000_000_000n, now, 0);
  const log = () => undefined;
  const relay = new JoinRelay({
    chain,
    guard,
    limits: limits(over),
    arenaAddress: ARENA,
    chainId: 46630,
    now,
    log,
  });
  const faucet = new Faucet({ chain, guard, limits: limits(over), now, log });
  return { chain, relay, faucet, guard, now };
};

const goodMessage = () => ({
  intent: vector.message,
  signature: vector.signature,
});

describe("join relay", () => {
  it("relays the contract vector signature to joinWithSig", async () => {
    const { chain, relay } = setup();
    const outcome = await relay.submit(goodMessage(), MATCH_ID, "1.1.1.1");
    expect(outcome).toMatchObject({
      ok: true,
      txHash: TX,
      seat: 0,
      wallet: PLAYER.toLowerCase(),
    });
    expect(chain.joinCalls).toBe(1);
  });

  it("rejects a signature from another key", async () => {
    const { chain, relay } = setup();
    const other = privateKeyToAccount(ANVIL_KEY_ONE);
    const typed = toTypedJoinIntent({
      ...vector.message,
      player: other.address,
    });
    const forged = await privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    ).signTypedData({
      domain: buildDomain(ARENA, 46630),
      types: JOIN_INTENT_TYPES,
      primaryType: "JoinIntent",
      message: typed,
    });
    const outcome = await relay.submit(
      {
        intent: { ...vector.message, player: other.address },
        signature: forged,
      },
      MATCH_ID,
      "1.1.1.1",
    );
    expect(outcome).toMatchObject({ ok: false, code: "BAD_SIGNATURE" });
    const tampered = await relay.submit(
      {
        intent: { ...vector.message, vehicleId: 4 },
        signature: vector.signature,
      },
      MATCH_ID,
      "1.1.1.1",
    );
    expect(tampered).toMatchObject({ ok: false, code: "BAD_SIGNATURE" });
    expect(chain.joinCalls).toBe(0);
  });

  it("rejects wrong match, expired deadline and malformed input", async () => {
    const { relay, chain } = setup();
    expect(
      await relay.submit(goodMessage(), `0x${"22".repeat(32)}`, "1.1.1.1"),
    ).toMatchObject({ ok: false, code: "WRONG_MATCH" });

    const late = new JoinRelay({
      chain,
      guard: new RelayerGuard(chain, 1n, () => NOW_MS, 0),
      limits: limits(),
      arenaAddress: ARENA,
      now: () => (Number(vector.message.deadline) + 1) * 1000,
      log: () => undefined,
    });
    expect(await late.submit(goodMessage(), MATCH_ID, "1.1.1.1")).toMatchObject(
      { ok: false, code: "INTENT_EXPIRED" },
    );

    expect(await relay.submit({ nope: 1 }, MATCH_ID, "x")).toMatchObject({
      ok: false,
      code: "JOIN_MALFORMED",
    });
    expect(chain.joinCalls).toBe(0);
  });

  it("checks the Open state, capacity, existing seat and token balance", async () => {
    const { relay, chain } = setup();
    chain.match = view({ status: MatchStatus.Started });
    expect(await relay.submit(goodMessage(), MATCH_ID, "a")).toMatchObject({
      code: "MATCH_CLOSED",
    });
    chain.match = view({ joinDeadline: BigInt(NOW_MS / 1000 - 1) });
    expect(await relay.submit(goodMessage(), MATCH_ID, "a")).toMatchObject({
      code: "MATCH_CLOSED",
    });
    chain.match = view({ playerCount: 8 });
    expect(await relay.submit(goodMessage(), MATCH_ID, "a")).toMatchObject({
      code: "ROOM_FULL",
    });
    chain.match = view();
    chain.sessionKey = vector.message.sessionKey;
    expect(await relay.submit(goodMessage(), MATCH_ID, "a")).toMatchObject({
      code: "ALREADY_JOINED",
    });
    chain.sessionKey = "0x0000000000000000000000000000000000000000";
    chain.balance = 99n * ETH;
    expect(await relay.submit(goodMessage(), MATCH_ID, "a")).toMatchObject({
      code: "INSUFFICIENT_BALANCE",
    });
    expect(chain.joinCalls).toBe(0);
  });

  it("allows one pending join per wallet", async () => {
    const { relay, chain } = setup();
    let release: () => void = () => undefined;
    chain.joinGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = relay.submit(goodMessage(), MATCH_ID, "a");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await relay.submit(goodMessage(), MATCH_ID, "b");
    expect(second).toMatchObject({ ok: false, code: "JOIN_PENDING" });
    release();
    expect(await first).toMatchObject({ ok: true });
    expect(chain.joinCalls).toBe(1);
  });

  it("limits joins per IP per hour", async () => {
    const { relay, chain } = setup({ joinPerIpPerHour: 2 });
    chain.sessionKey = vector.message.sessionKey;
    expect(await relay.submit(goodMessage(), MATCH_ID, "ip")).toMatchObject({
      code: "ALREADY_JOINED",
    });
    expect(await relay.submit(goodMessage(), MATCH_ID, "ip")).toMatchObject({
      code: "ALREADY_JOINED",
    });
    const third = await relay.submit(goodMessage(), MATCH_ID, "ip");
    expect(third).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(third.ok === false && (third.retryAfterS ?? 0) > 0).toBe(true);
    expect(await relay.submit(goodMessage(), MATCH_ID, "other")).toMatchObject({
      code: "ALREADY_JOINED",
    });
  });

  it("refuses to relay when the relayer balance is below the minimum", async () => {
    const { relay, chain } = setup();
    chain.relayer = 1_999_999_999_999_999n;
    expect(await relay.submit(goodMessage(), MATCH_ID, "a")).toMatchObject({
      ok: false,
      code: "RELAYER_LOW",
    });
    expect(chain.joinCalls).toBe(0);
    chain.relayer = 2_000_000_000_000_000n;
    expect(await relay.submit(goodMessage(), MATCH_ID, "a")).toMatchObject({
      ok: true,
    });
  });
});

describe("faucet", () => {
  const wallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  it("claims for a fresh wallet and returns the new nextClaimAt", async () => {
    const { faucet, chain } = setup();
    const res = await faucet.claim(wallet, "1.1.1.1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      txHash: TX,
      nextClaimAt: NOW_MS / 1000 + 86400,
    });
    expect(chain.claimCalls).toBe(1);
  });

  it("validates the address and checks the cooldown before spending gas", async () => {
    const { faucet, chain } = setup();
    expect((await faucet.claim("nope", "a")).body).toMatchObject({
      code: "INVALID_ADDRESS",
    });
    chain.next = BigInt(NOW_MS / 1000 + 600);
    const res = await faucet.claim(wallet, "a");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({
      code: "COOLDOWN",
      retryAfterS: 600,
      nextClaimAt: NOW_MS / 1000 + 600,
    });
    expect(chain.claimCalls).toBe(0);
  });

  it("limits calls per IP per hour", async () => {
    const { faucet, chain } = setup({ faucetPerIpPerHour: 5 });
    chain.next = BigInt(NOW_MS / 1000 + 600);
    for (let i = 0; i < 5; i++) {
      expect((await faucet.claim(wallet, "ip")).body).toMatchObject({
        code: "COOLDOWN",
      });
    }
    const sixth = await faucet.claim(wallet, "ip");
    expect(sixth.status).toBe(429);
    expect(sixth.body).toMatchObject({ code: "RATE_LIMITED" });
    expect((await faucet.claim(wallet, "elsewhere")).body).toMatchObject({
      code: "COOLDOWN",
    });
  });

  it("enforces the global hourly ceiling", async () => {
    const { faucet, chain } = setup({ faucetGlobalPerHour: 2 });
    for (let i = 0; i < 2; i++) {
      chain.next = 0n;
      expect((await faucet.claim(wallet, `ip${i}`)).status).toBe(200);
    }
    chain.next = 0n;
    const res = await faucet.claim(wallet, "ip9");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: "GLOBAL_LIMIT" });
    expect(chain.claimCalls).toBe(2);
  });

  it("refuses below the relayer minimum balance", async () => {
    const { faucet, chain } = setup();
    chain.relayer = 1n;
    const res = await faucet.claim(wallet, "a");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ code: "RELAYER_LOW" });
    expect(chain.claimCalls).toBe(0);
  });

  it("reports balance and nextClaimAt", async () => {
    const { faucet, chain } = setup();
    chain.next = BigInt(NOW_MS / 1000 + 60);
    const res = await faucet.status(wallet);
    expect(res).toMatchObject({
      status: 200,
      body: {
        wallet: wallet.toLowerCase(),
        balance: (1000n * ETH).toString(),
        nextClaimAt: NOW_MS / 1000 + 60,
        canClaimNow: false,
      },
    });
    expect((await faucet.status("x")).status).toBe(400);
  });
});

describe("rate limiter", () => {
  it("slides the window", () => {
    let t = 0;
    const limiter = new RateLimiter(2, 1000, () => t);
    expect(limiter.tryConsume("k")).toBe(0);
    expect(limiter.tryConsume("k")).toBe(0);
    expect(limiter.tryConsume("k")).toBe(1);
    t = 1001;
    expect(limiter.tryConsume("k")).toBe(0);
  });
});

describe("refund keeper", () => {
  const makeKeeper = (chain: FakeChain, nowMs: number) => {
    const dir = mkdtempSync(join(tmpdir(), "bump-keeper-"));
    const keeper = new RefundKeeper({
      chain,
      dir,
      now: () => nowMs,
      log: () => undefined,
      minPlayers: 2,
    });
    return { keeper, dir };
  };
  const players: Address[] = [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  ];

  it("refunds every player of an unsettled match after settleDeadline", async () => {
    const chain = new FakeChain();
    chain.joined = players;
    chain.match = view({
      status: MatchStatus.Started,
      playerCount: 2,
      settleDeadline: BigInt(NOW_MS / 1000 - 1),
    });
    chain.refundFail.add(players[1] as Address);
    const { keeper, dir } = makeKeeper(chain, NOW_MS);
    await keeper.track(MATCH_ID, chain.match.settleDeadline);
    await keeper.sweep();
    expect(chain.refundCalls).toEqual([players[0]]);
    expect(keeper.size).toBe(0);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("keeps tracking until the settle deadline and drops settled matches", async () => {
    const chain = new FakeChain();
    chain.joined = players;
    chain.match = view({ status: MatchStatus.Started, playerCount: 2 });
    const { keeper } = makeKeeper(chain, NOW_MS);
    await keeper.track(MATCH_ID, chain.match.settleDeadline);
    await keeper.sweep();
    expect(chain.refundCalls).toEqual([]);
    expect(keeper.size).toBe(1);
    chain.match = view({ status: MatchStatus.Settled });
    await keeper.sweep();
    expect(keeper.size).toBe(0);
  });

  it("cancels an Open match that stayed under the minimum past its join deadline", async () => {
    const chain = new FakeChain();
    chain.match = view({
      playerCount: 1,
      joinDeadline: BigInt(NOW_MS / 1000 - 5),
    });
    const { keeper } = makeKeeper(chain, NOW_MS);
    await keeper.track(MATCH_ID, chain.match.settleDeadline);
    await keeper.sweep();
    expect(chain.cancelCalls).toBe(1);
    expect(keeper.size).toBe(0);
  });
});
