import { db } from "ponder:api";
import { match, matchPlayer, playerStats } from "ponder:schema";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { and, desc, eq, gte, inArray } from "ponder";

const WALLET = /^0x[0-9a-fA-F]{40}$/;
const MATCH_ID = /^0x[0-9a-fA-F]{64}$/;
const WEEK_SECONDS = 7n * 24n * 60n * 60n;

const origins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const clampLimit = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 200);
};

const nullableString = (value: bigint | null): string | null =>
  value === null ? null : value.toString();

type MatchRow = typeof match.$inferSelect;
type SeatRow = typeof matchPlayer.$inferSelect;

const summarize = (row: MatchRow) => ({
  matchId: row.id,
  status: row.status,
  stakeAmount: row.stakeAmount.toString(),
  startBalance: row.startBalance,
  maxPlayers: row.maxPlayers,
  openedAt: Number(row.openedAt),
  startedAt: row.startedAt === null ? null : Number(row.startedAt),
  settledAt: row.settledAt === null ? null : Number(row.settledAt),
  settleTx: row.settleTx,
  resultHash: row.resultHash,
  inputLogHash: row.inputLogHash,
  replayHash: row.replayHash,
  winner: row.winner,
  potAmount: row.potAmount.toString(),
});

const seatView = (seat: SeatRow) => ({
  wallet: seat.wallet,
  seat: seat.seat,
  vehicleId: seat.vehicleId,
  finalBalance: seat.finalBalance,
  rank: seat.rank,
  payoutAmount: nullableString(seat.payoutAmount),
  refunded: seat.refunded,
});

const app = new Hono();

app.use("*", cors({ origin: origins }));

app.get("/leaderboard", async (c) => {
  const window = c.req.query("window") === "7d" ? "7d" : "all";
  const limit = clampLimit(c.req.query("limit"), 50);
  const updatedAt = Math.floor(Date.now() / 1000);

  if (window === "all") {
    const rows = await db
      .select()
      .from(playerStats)
      .orderBy(desc(playerStats.netPnlAmount))
      .limit(limit);
    return c.json({
      window,
      updatedAt,
      rows: rows.map((row) => ({
        wallet: row.wallet,
        matches: row.matches,
        wins: row.wins,
        totalPayoutAmount: row.totalPayoutAmount.toString(),
        totalStakeAmount: row.totalStakeAmount.toString(),
        netPnlAmount: row.netPnlAmount.toString(),
        bestBalance: row.bestBalance,
      })),
    });
  }

  const since = BigInt(updatedAt) - WEEK_SECONDS;
  const joined = await db
    .select({ seat: matchPlayer, game: match })
    .from(matchPlayer)
    .innerJoin(match, eq(matchPlayer.matchId, match.id))
    .where(and(eq(match.status, "settled"), gte(match.settledAt, since)));

  const totals = new Map<
    string,
    {
      matches: number;
      wins: number;
      payout: bigint;
      stake: bigint;
      best: number;
    }
  >();
  for (const { seat, game } of joined) {
    const entry = totals.get(seat.wallet) ?? {
      matches: 0,
      wins: 0,
      payout: 0n,
      stake: 0n,
      best: 0,
    };
    entry.matches += 1;
    entry.wins += seat.rank === 1 ? 1 : 0;
    entry.payout += seat.payoutAmount ?? 0n;
    entry.stake += game.stakeAmount;
    entry.best = Math.max(entry.best, seat.finalBalance ?? 0);
    totals.set(seat.wallet, entry);
  }
  const ranked = [...totals.entries()]
    .map(([wallet, entry]) => ({
      wallet,
      matches: entry.matches,
      wins: entry.wins,
      totalPayoutAmount: entry.payout,
      totalStakeAmount: entry.stake,
      netPnl: entry.payout - entry.stake,
      bestBalance: entry.best,
    }))
    .sort((a, b) => (a.netPnl === b.netPnl ? 0 : a.netPnl < b.netPnl ? 1 : -1))
    .slice(0, limit);
  return c.json({
    window,
    updatedAt,
    rows: ranked.map((row) => ({
      wallet: row.wallet,
      matches: row.matches,
      wins: row.wins,
      totalPayoutAmount: row.totalPayoutAmount.toString(),
      totalStakeAmount: row.totalStakeAmount.toString(),
      netPnlAmount: row.netPnl.toString(),
      bestBalance: row.bestBalance,
    })),
  });
});

app.get("/matches", async (c) => {
  const limit = clampLimit(c.req.query("limit"), 20);
  const wallet = c.req.query("wallet");

  if (wallet === undefined) {
    const rows = await db
      .select()
      .from(match)
      .orderBy(desc(match.openedAt))
      .limit(limit);
    return c.json({ rows: rows.map(summarize) });
  }

  if (!WALLET.test(wallet)) return c.json({ error: "invalid wallet" }, 400);
  const lowered = wallet.toLowerCase() as `0x${string}`;
  const rows = await db
    .select({ seat: matchPlayer, game: match })
    .from(matchPlayer)
    .innerJoin(match, eq(matchPlayer.matchId, match.id))
    .where(eq(matchPlayer.wallet, lowered))
    .orderBy(desc(match.openedAt))
    .limit(limit);
  return c.json({
    rows: rows.map(({ seat, game }) => ({
      ...summarize(game),
      rank: seat.rank,
      payoutAmount: nullableString(seat.payoutAmount),
    })),
  });
});

app.get("/matches/:matchId", async (c) => {
  const matchId = c.req.param("matchId");
  if (!MATCH_ID.test(matchId)) return c.json({ error: "invalid matchId" }, 400);
  const id = matchId.toLowerCase() as `0x${string}`;
  const row = await db.select().from(match).where(eq(match.id, id)).limit(1);
  const found = row[0];
  if (!found) return c.json({ error: "not found" }, 404);
  const seats = await db
    .select()
    .from(matchPlayer)
    .where(inArray(matchPlayer.matchId, [id]));
  seats.sort((a, b) => a.seat - b.seat);
  return c.json({ ...summarize(found), players: seats.map(seatView) });
});

app.get("/players/:wallet", async (c) => {
  const wallet = c.req.param("wallet");
  if (!WALLET.test(wallet)) return c.json({ error: "invalid wallet" }, 400);
  const lowered = wallet.toLowerCase() as `0x${string}`;
  const rows = await db
    .select()
    .from(playerStats)
    .where(eq(playerStats.wallet, lowered))
    .limit(1);
  const row = rows[0];
  return c.json({
    wallet: lowered,
    matches: row?.matches ?? 0,
    wins: row?.wins ?? 0,
    totalPayoutAmount: (row?.totalPayoutAmount ?? 0n).toString(),
    totalStakeAmount: (row?.totalStakeAmount ?? 0n).toString(),
    netPnlAmount: (row?.netPnlAmount ?? 0n).toString(),
    bestBalance: row?.bestBalance ?? 0,
    claimableHint: null,
  });
});

export default app;
