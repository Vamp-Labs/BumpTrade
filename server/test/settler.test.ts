import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import {
  type ChainGateway,
  MatchStatus,
  type OnChainMatch,
  type SettleResult,
} from "../src/chain/ChainGateway";
import { Settler, type SettleUpdate } from "../src/chain/Settler";

const KEY: Hex =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ARENA: Address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PLAYERS: Address[] = [
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
];
const MATCH_ID: Hex = `0x${"aa".repeat(32)}`;
const TX: Hex = `0x${"bb".repeat(32)}`;

const result: SettleResult = {
  matchId: MATCH_ID,
  players: PLAYERS,
  finalBalances: [130, 70],
  ranks: [1, 2],
  inputLogHash: `0x${"00".repeat(32)}`,
  replayHash: `0x${"00".repeat(32)}`,
  endedAt: 1_790_000_000n,
};

const view = (status: number, settleDeadline: bigint): OnChainMatch => ({
  stake: 1n,
  startBalance: 100,
  maxPlayers: 2,
  playerCount: 2,
  status,
  joinDeadline: 0n,
  settleDeadline,
  pot: 2n,
});

class FakeChain implements ChainGateway {
  status: number = MatchStatus.Started;
  deadline = 4_000_000_000n;
  failures = 0;
  settleCalls = 0;

  async openMatch(): Promise<Hex> {
    return TX;
  }
  async startMatch(): Promise<Hex> {
    return TX;
  }
  async cancel(): Promise<Hex> {
    return TX;
  }
  async settle(
    _r: SettleResult,
    _s: Hex,
    onSubmitted?: (hash: Hex) => void,
  ): Promise<Hex> {
    this.settleCalls += 1;
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error("receipt timeout");
    }
    onSubmitted?.(TX);
    this.status = MatchStatus.Settled;
    return TX;
  }
  async getMatch(): Promise<OnChainMatch> {
    return view(this.status, this.deadline);
  }
  async getPlayers(): Promise<Address[]> {
    return PLAYERS;
  }
  async sessionKeyOf(): Promise<Address> {
    return PLAYERS[0] as Address;
  }
  async vehicleOf(): Promise<number> {
    return 0;
  }
  async hashResult(): Promise<Hex> {
    return TX;
  }
  async joinWithSig(): Promise<Hex> {
    return TX;
  }
  async claimRefund(): Promise<Hex> {
    return TX;
  }
  async faucetClaim(): Promise<Hex> {
    return TX;
  }
  async tokenBalanceOf(): Promise<bigint> {
    return 0n;
  }
  async nextClaimAt(): Promise<bigint> {
    return 0n;
  }
  async relayerBalance(): Promise<bigint> {
    return 0n;
  }
  async tokenAddress(): Promise<Address> {
    return ARENA;
  }
}

const makeSettler = (chain: ChainGateway, dir: string, now?: () => number) => {
  const sleeps: number[] = [];
  const settler = new Settler({
    chain,
    account: privateKeyToAccount(KEY),
    arenaAddress: ARENA,
    chainId: 46630,
    pendingDir: dir,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    backoffMs: 100,
    maxBackoffMs: 400,
    now,
  });
  return { settler, sleeps };
};

describe("Settler", () => {
  it("retries with exponential backoff until the settlement confirms and clears the pending file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bump-settle-"));
    const chain = new FakeChain();
    chain.failures = 3;
    const { settler, sleeps } = makeSettler(chain, dir);
    const signature = await settler.signResult(result);
    const updates: SettleUpdate[] = [];

    const status = await settler.submit({ result, signature }, (u) =>
      updates.push(u),
    );

    expect(status).toBe("confirmed");
    expect(chain.settleCalls).toBe(4);
    expect(sleeps).toEqual([100, 200, 400]);
    expect(updates.at(-1)?.status).toBe("confirmed");
    expect(
      updates.some((u) => u.status === "submitted" && u.txHash === TX),
    ).toBe(true);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("treats an already settled match as confirmed without sending", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bump-settle-"));
    const chain = new FakeChain();
    chain.status = MatchStatus.Settled;
    const { settler } = makeSettler(chain, dir);
    const signature = await settler.signResult(result);
    expect(await settler.submit({ result, signature }, () => undefined)).toBe(
      "confirmed",
    );
    expect(chain.settleCalls).toBe(0);
  });

  it("fails and archives when the match is refunding or the deadline has passed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bump-settle-"));
    const chain = new FakeChain();
    chain.status = MatchStatus.Refunding;
    const { settler } = makeSettler(chain, dir);
    const signature = await settler.signResult(result);
    expect(await settler.submit({ result, signature }, () => undefined)).toBe(
      "failed",
    );
    expect(existsSync(join(dir, `${MATCH_ID}.failed`))).toBe(true);

    const late = new FakeChain();
    late.deadline = 10n;
    const second = makeSettler(
      late,
      mkdtempSync(join(tmpdir(), "bump-settle-")),
      () => 20_000,
    );
    expect(
      await second.settler.submit({ result, signature }, () => undefined),
    ).toBe("failed");
    expect(late.settleCalls).toBe(0);
  });

  it("re-submits a pending settlement after a restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bump-settle-"));
    const before = makeSettler(new FakeChain(), dir);
    const signature = await before.settler.signResult(result);
    await before.settler.persist({ result, signature });
    expect(readdirSync(dir)).toEqual([`${MATCH_ID}.json`]);

    const chain = new FakeChain();
    const after = makeSettler(chain, dir);
    const seen: SettleUpdate[] = [];
    const resumed = await after.settler.resumePending((_id, update) =>
      seen.push(update),
    );
    expect(resumed).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(chain.status).toBe(MatchStatus.Settled);
    expect(seen.at(-1)?.status).toBe("confirmed");
    expect(readdirSync(dir)).toEqual([]);
  });
});
