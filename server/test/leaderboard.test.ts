import { describe, expect, it } from "vitest";
import {
  createLeaderboard,
  type Leaderboard,
  type SettlementRecord,
} from "../src/leaderboard";
import { migrate, openDb } from "../src/leaderboard/db";

const A = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const B = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const C = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T";
interface Entry {
  wallet: string;
  matches: number;
  netPnlAmount: string;
  rank: number;
}

interface Body {
  // biome-ignore lint/suspicious/noExplicitAny: loose JSON in tests
  [key: string]: any;
}

const ORIGIN = "http://localhost:5173";

const matchId = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as const;

const record = (n: number, settledAt: number): SettlementRecord => ({
  matchId: matchId(n),
  chain: "solana",
  stake: 100n,
  startBalance: 1000,
  potAmount: 300n,
  settleTx: `sig${n}`,
  settledAt,
  players: [
    { wallet: A, finalBalance: 1500, rank: 1, payout: 285n },
    { wallet: B, finalBalance: 900, rank: 2, payout: 0n },
    { wallet: C, finalBalance: 600, rank: 3, payout: 0n },
  ],
});

const make = (): Promise<Leaderboard> =>
  createLeaderboard({
    schema: "bump_sol",
    chain: "solana",
    decimals: 6,
    corsOrigins: [ORIGIN],
  });

const get = async (lb: Leaderboard, path: string, origin?: string) => {
  const res = await lb.handleRequest(
    new Request(`http://x${path}`, {
      headers: origin ? { origin } : {},
    }),
  );
  if (res === null) throw new Error("not handled");
  return { res, body: (await res.json()) as Body };
};

const now = () => Math.floor(Date.now() / 1000);

describe("leaderboard", () => {
  it("records a settled match and serves stats", async () => {
    const lb = await make();
    await lb.recordSettled(record(1, now()));
    const { body } = await get(lb, "/leaderboard");
    expect(body.chain).toBe("solana");
    expect(body.decimals).toBe(6);
    expect(body.window).toBe("all");
    expect(body.rows.map((r: Entry) => r.wallet)).toEqual([A, C, B]);
    expect(body.rows[0]).toMatchObject({
      matches: 1,
      wins: 1,
      totalPayoutAmount: "285",
      totalStakeAmount: "100",
      netPnlAmount: "185",
      bestBalance: 1500,
    });
    expect(body.rows[2].netPnlAmount).toBe("-100");

    const player = await get(lb, `/players/${B}`);
    expect(player.body).toMatchObject({
      wallet: B,
      matches: 1,
      wins: 0,
      netPnlAmount: "-100",
      claimableHint: null,
    });
    const empty = await get(lb, "/players/11111111111111111111111111111111");
    expect(empty.body).toMatchObject({ matches: 0, netPnlAmount: "0" });

    const detail = await get(lb, `/matches/${matchId(1)}`);
    expect(detail.body).toMatchObject({
      matchId: matchId(1),
      status: "settled",
      stakeAmount: "100",
      potAmount: "300",
      settleTx: "sig1",
      winner: A,
      maxPlayers: 3,
    });
    expect(detail.body.players.map((p: Entry) => p.rank)).toEqual([1, 2, 3]);

    const list = await get(lb, `/matches?wallet=${A}`);
    expect(list.body.rows[0]).toMatchObject({ rank: 1, payoutAmount: "285" });
    expect((await get(lb, "/matches")).body.rows).toHaveLength(1);
  });

  it("is idempotent when a settlement is written twice", async () => {
    const lb = await make();
    await lb.recordSettled(record(2, now()));
    await lb.recordSettled(record(2, now()));
    const { body } = await get(lb, "/leaderboard");
    expect(body.rows.find((r: Entry) => r.wallet === A).matches).toBe(1);
    expect(body.rows.find((r: Entry) => r.wallet === A).netPnlAmount).toBe(
      "185",
    );
  });

  it("never touches stats for cancelled matches", async () => {
    const lb = await make();
    await lb.recordCancelled(matchId(3));
    expect((await get(lb, "/leaderboard")).body.rows).toEqual([]);
    const detail = await get(lb, `/matches/${matchId(3)}`);
    expect(detail.body.status).toBe("cancelled");
    expect(detail.body.players).toEqual([]);

    await lb.recordSettled(record(4, now()));
    await lb.recordCancelled(matchId(4));
    const settled = await get(lb, `/matches/${matchId(4)}`);
    expect(settled.body.status).toBe("settled");
    expect(
      (await get(lb, "/leaderboard")).body.rows.find(
        (r: Entry) => r.wallet === A,
      ).matches,
    ).toBe(1);
  });

  it("applies the 7d window and limit", async () => {
    const lb = await make();
    await lb.recordSettled(record(5, now() - 8 * 86400));
    await lb.recordSettled({
      ...record(6, now() - 3600),
      players: [
        { wallet: B, finalBalance: 1200, rank: 1, payout: 285n },
        { wallet: A, finalBalance: 700, rank: 2, payout: 0n },
      ],
    });
    const week = await get(lb, "/leaderboard?window=7d");
    expect(week.body.window).toBe("7d");
    expect(week.body.rows.map((r: Entry) => r.wallet)).toEqual([B, A]);
    expect(week.body.rows[0]).toMatchObject({
      matches: 1,
      wins: 1,
      netPnlAmount: "185",
      bestBalance: 1200,
    });
    expect(week.body.rows[1].netPnlAmount).toBe("-100");
    const all = await get(lb, "/leaderboard?limit=1");
    expect(all.body.rows).toHaveLength(1);
    expect(all.body.rows[0].matches).toBe(2);
  });

  it("tracks faucet cooldown", async () => {
    const lb = await make();
    expect(await lb.faucetNextClaimAt(A)).toBe(0);
    await lb.faucetMarkClaimed(A, 1000);
    expect(await lb.faucetNextClaimAt(A)).toBe(1000 + 86400);
    await lb.faucetMarkClaimed(A, 5000);
    expect(await lb.faucetNextClaimAt(A)).toBe(5000 + 86400);
    expect(await lb.faucetNextClaimAt(B)).toBe(0);
  });

  it("handles routing, validation and CORS", async () => {
    const lb = await make();
    expect(await lb.ready()).toBe(true);
    expect(await lb.handleRequest(new Request("http://x/metrics.json"))).toBe(
      null,
    );
    expect(await lb.handleRequest(new Request("http://x/faucet"))).toBe(null);
    const ready = await get(lb, "/ready");
    expect(ready.res.status).toBe(200);
    expect(ready.body).toMatchObject({ ready: true, chain: "solana" });
    expect((await get(lb, "/players/nope")).res.status).toBe(400);
    expect((await get(lb, "/matches/0x12")).res.status).toBe(400);
    expect((await get(lb, "/matches?wallet=bad")).res.status).toBe(400);
    expect((await get(lb, `/matches/${matchId(9)}`)).res.status).toBe(404);
    const ok = await get(lb, "/leaderboard", ORIGIN);
    expect(ok.res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const other = await get(lb, "/leaderboard", "http://evil.example");
    expect(other.res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const preflight = await lb.handleRequest(
      new Request("http://x/leaderboard", {
        method: "OPTIONS",
        headers: { origin: ORIGIN },
      }),
    );
    expect(preflight?.status).toBe(204);
    const post = await lb.handleRequest(
      new Request("http://x/leaderboard", { method: "POST" }),
    );
    expect(post?.status).toBe(405);
  });

  it("migrates idempotently and keeps data across a restart", async () => {
    const db = await openDb(undefined);
    await migrate(db, "bump_sol");
    await db.query(
      "INSERT INTO bump_sol.faucet_claims (wallet, claimed_at) VALUES ('w', 1)",
    );
    await migrate(db, "bump_sol");
    const rows = await db.query("SELECT * FROM bump_sol.faucet_claims");
    expect(rows).toHaveLength(1);
    await db.close();
  });

  it("rejects an unsafe schema name", async () => {
    await expect(
      createLeaderboard({
        schema: 'x"; drop',
        chain: "solana",
        decimals: 6,
        corsOrigins: [],
      }),
    ).rejects.toThrow("DATABASE_SCHEMA");
  });
});
