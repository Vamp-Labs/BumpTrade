import type { ChainId, Hex32 } from "@bump/shared";
import { assertSchema, type Db, migrate, openDb, type Row } from "./db";

export interface SettlementRecord {
  matchId: Hex32;
  chain: ChainId;
  stake: bigint;
  startBalance: number;
  potAmount: bigint;
  settleTx: string;
  settledAt: number;
  players: {
    wallet: string;
    finalBalance: number;
    rank: number;
    payout: bigint;
  }[];
}

export interface Leaderboard {
  recordSettled(rec: SettlementRecord): Promise<void>;
  recordCancelled(matchId: Hex32): Promise<void>;
  faucetNextClaimAt(wallet: string): Promise<number>;
  faucetMarkClaimed(wallet: string, at: number): Promise<void>;
  handleRequest(req: Request): Promise<Response | null>;
  ready(): Promise<boolean>;
}

const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MATCH_ID = /^0x[0-9a-fA-F]{64}$/;
const WEEK_SECONDS = 7 * 24 * 60 * 60;
const FAUCET_COOLDOWN_S = 24 * 60 * 60;

const clampLimit = (raw: string | null, fallback: number): number => {
  const parsed = Number(raw);
  if (raw === null || !Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 200);
};

const text = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

const num = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

const summarize = (row: Row) => ({
  matchId: row.id,
  status: row.status,
  stakeAmount: String(row.stake_amount),
  startBalance: Number(row.start_balance),
  maxPlayers: Number(row.max_players),
  openedAt: Number(row.opened_at),
  startedAt: num(row.started_at),
  settledAt: num(row.settled_at),
  settleTx: text(row.settle_tx),
  resultHash: text(row.result_hash),
  inputLogHash: text(row.input_log_hash),
  replayHash: text(row.replay_hash),
  winner: text(row.winner),
  potAmount: String(row.pot_amount),
});

const seatView = (row: Row) => ({
  wallet: row.wallet,
  seat: Number(row.seat),
  vehicleId: Number(row.vehicle_id),
  finalBalance: num(row.final_balance),
  rank: num(row.rank),
  payoutAmount: text(row.payout_amount),
  refunded: Boolean(row.refunded),
});

const statsRow = (row: Row) => ({
  wallet: row.wallet,
  matches: Number(row.matches),
  wins: Number(row.wins),
  totalPayoutAmount: String(row.total_payout_amount),
  totalStakeAmount: String(row.total_stake_amount),
  netPnlAmount: String(row.net_pnl_amount),
  bestBalance: Number(row.best_balance),
});

export const createLeaderboard = async (o: {
  databaseUrl?: string;
  schema: string;
  chain: ChainId;
  decimals: number;
  corsOrigins: string[];
}): Promise<Leaderboard> => {
  const schema = assertSchema(o.schema);
  const db: Db = await openDb(o.databaseUrl);
  try {
    await migrate(db, schema);
  } catch (error) {
    await db.close().catch(() => {});
    throw error;
  }
  const t = (name: string): string => `"${schema}".${name}`;
  const meta = { chain: o.chain, decimals: o.decimals };

  const corsHeaders = (req: Request): Record<string, string> => {
    const origin = req.headers.get("origin") ?? "";
    return {
      "access-control-allow-origin": o.corsOrigins.includes(origin)
        ? origin
        : (o.corsOrigins[0] ?? ""),
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
      vary: "Origin",
    };
  };

  const reply = (req: Request, status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...corsHeaders(req) },
    });

  const leaderboard = async (url: URL) => {
    const window = url.searchParams.get("window") === "7d" ? "7d" : "all";
    const limit = clampLimit(url.searchParams.get("limit"), 50);
    const updatedAt = Math.floor(Date.now() / 1000);
    if (window === "all") {
      const rows = await db.query(
        `SELECT * FROM ${t("player_stats")}
         ORDER BY net_pnl_amount DESC, wallet ASC LIMIT $1`,
        [limit],
      );
      return { window, updatedAt, rows: rows.map(statsRow) };
    }
    const rows = await db.query(
      `SELECT p.wallet,
         count(*)::int AS matches,
         count(*) FILTER (WHERE p.rank = 1)::int AS wins,
         COALESCE(sum(p.payout_amount), 0) AS total_payout_amount,
         sum(m.stake_amount) AS total_stake_amount,
         COALESCE(sum(p.payout_amount), 0) - sum(m.stake_amount) AS net_pnl_amount,
         COALESCE(max(p.final_balance), 0)::int AS best_balance
       FROM ${t("match_players")} p
       JOIN ${t("matches")} m ON m.id = p.match_id
       WHERE m.status = 'settled' AND m.settled_at >= $1
       GROUP BY p.wallet
       ORDER BY net_pnl_amount DESC, p.wallet ASC LIMIT $2`,
      [updatedAt - WEEK_SECONDS, limit],
    );
    return { window, updatedAt, rows: rows.map(statsRow) };
  };

  const matches = async (url: URL): Promise<Response | unknown> => {
    const limit = clampLimit(url.searchParams.get("limit"), 20);
    const wallet = url.searchParams.get("wallet");
    if (wallet === null) {
      const rows = await db.query(
        `SELECT * FROM ${t("matches")} ORDER BY opened_at DESC, id ASC LIMIT $1`,
        [limit],
      );
      return { rows: rows.map(summarize) };
    }
    if (!WALLET.test(wallet)) return null;
    const rows = await db.query(
      `SELECT m.*, p.rank AS seat_rank, p.payout_amount AS seat_payout
       FROM ${t("match_players")} p
       JOIN ${t("matches")} m ON m.id = p.match_id
       WHERE p.wallet = $1
       ORDER BY m.opened_at DESC, m.id ASC LIMIT $2`,
      [wallet, limit],
    );
    return {
      rows: rows.map((row) => ({
        ...summarize(row),
        rank: num(row.seat_rank),
        payoutAmount: text(row.seat_payout),
      })),
    };
  };

  const route = async (req: Request, url: URL): Promise<Response | null> => {
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path === "/ready") {
      const ok = await ready();
      return reply(req, ok ? 200 : 503, { ready: ok, ...meta });
    }
    if (path === "/leaderboard")
      return reply(req, 200, { ...meta, ...(await leaderboard(url)) });
    if (path === "/matches") {
      const body = await matches(url);
      if (body === null) return reply(req, 400, { error: "invalid wallet" });
      return reply(req, 200, { ...meta, ...(body as object) });
    }
    const matchRoute = /^\/matches\/([^/]+)$/.exec(path);
    if (matchRoute) {
      const raw = matchRoute[1] ?? "";
      if (!MATCH_ID.test(raw))
        return reply(req, 400, { error: "invalid matchId" });
      const id = raw.toLowerCase();
      const found = (
        await db.query(`SELECT * FROM ${t("matches")} WHERE id = $1`, [id])
      )[0];
      if (!found) return reply(req, 404, { error: "not found" });
      const seats = await db.query(
        `SELECT * FROM ${t("match_players")} WHERE match_id = $1 ORDER BY seat ASC`,
        [id],
      );
      return reply(req, 200, {
        ...meta,
        ...summarize(found),
        players: seats.map(seatView),
      });
    }
    const playerRoute = /^\/players\/([^/]+)$/.exec(path);
    if (playerRoute) {
      const wallet = decodeURIComponent(playerRoute[1] ?? "");
      if (!WALLET.test(wallet))
        return reply(req, 400, { error: "invalid wallet" });
      const row = (
        await db.query(`SELECT * FROM ${t("player_stats")} WHERE wallet = $1`, [
          wallet,
        ])
      )[0];
      return reply(req, 200, {
        ...meta,
        ...statsRow(
          row ?? {
            wallet,
            matches: 0,
            wins: 0,
            total_payout_amount: 0,
            total_stake_amount: 0,
            net_pnl_amount: 0,
            best_balance: 0,
          },
        ),
        claimableHint: null,
      });
    }
    return null;
  };

  const ready = async (): Promise<boolean> => {
    try {
      await db.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  };

  return {
    ready,

    async recordSettled(rec) {
      const id = rec.matchId.toLowerCase();
      const winner = rec.players.find((p) => p.rank === 1)?.wallet ?? null;
      await db.transaction(async (q) => {
        const claimed = await q(
          `INSERT INTO ${t("matches")}
             (id, stake_amount, start_balance, max_players, status, opened_at,
              settled_at, settle_tx, winner, pot_amount)
           VALUES ($1, $2, $3, $4, 'settled', $5, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             stake_amount = EXCLUDED.stake_amount,
             start_balance = EXCLUDED.start_balance,
             max_players = EXCLUDED.max_players,
             status = 'settled',
             opened_at = EXCLUDED.opened_at,
             settled_at = EXCLUDED.settled_at,
             settle_tx = EXCLUDED.settle_tx,
             winner = EXCLUDED.winner,
             pot_amount = EXCLUDED.pot_amount
           WHERE ${t("matches")}.status <> 'settled'
           RETURNING id`,
          [
            id,
            rec.stake.toString(),
            rec.startBalance,
            rec.players.length,
            rec.settledAt,
            rec.settleTx,
            winner,
            rec.potAmount.toString(),
          ],
        );
        if (claimed.length === 0) return;
        for (const [seat, p] of rec.players.entries()) {
          await q(
            `INSERT INTO ${t("match_players")}
               (match_id, wallet, seat, vehicle_id, final_balance, rank,
                payout_amount, refunded)
             VALUES ($1, $2, $3, 0, $4, $5, $6, false)
             ON CONFLICT (match_id, wallet) DO UPDATE SET
               seat = EXCLUDED.seat,
               final_balance = EXCLUDED.final_balance,
               rank = EXCLUDED.rank,
               payout_amount = EXCLUDED.payout_amount,
               refunded = false`,
            [id, p.wallet, seat, p.finalBalance, p.rank, p.payout.toString()],
          );
          await q(
            `INSERT INTO ${t("player_stats")}
               (wallet, matches, wins, total_payout_amount, total_stake_amount,
                net_pnl_amount, best_balance, last_match_at)
             VALUES ($1, 1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (wallet) DO UPDATE SET
               matches = ${t("player_stats")}.matches + 1,
               wins = ${t("player_stats")}.wins + EXCLUDED.wins,
               total_payout_amount = ${t("player_stats")}.total_payout_amount + EXCLUDED.total_payout_amount,
               total_stake_amount = ${t("player_stats")}.total_stake_amount + EXCLUDED.total_stake_amount,
               net_pnl_amount = ${t("player_stats")}.net_pnl_amount + EXCLUDED.net_pnl_amount,
               best_balance = GREATEST(${t("player_stats")}.best_balance, EXCLUDED.best_balance),
               last_match_at = GREATEST(${t("player_stats")}.last_match_at, EXCLUDED.last_match_at)`,
            [
              p.wallet,
              p.rank === 1 ? 1 : 0,
              p.payout.toString(),
              rec.stake.toString(),
              (p.payout - rec.stake).toString(),
              p.finalBalance,
              rec.settledAt,
            ],
          );
        }
      });
    },

    async recordCancelled(matchId) {
      await db.query(
        `INSERT INTO ${t("matches")}
           (id, stake_amount, start_balance, max_players, status, opened_at, pot_amount)
         VALUES ($1, 0, 0, 0, 'cancelled', $2, 0)
         ON CONFLICT (id) DO UPDATE SET status = 'cancelled'
         WHERE ${t("matches")}.status <> 'settled'`,
        [matchId.toLowerCase(), Math.floor(Date.now() / 1000)],
      );
    },

    async faucetNextClaimAt(wallet) {
      const row = (
        await db.query(
          `SELECT claimed_at FROM ${t("faucet_claims")} WHERE wallet = $1`,
          [wallet],
        )
      )[0];
      if (!row) return 0;
      return Number(row.claimed_at) + FAUCET_COOLDOWN_S;
    },

    async faucetMarkClaimed(wallet, at) {
      await db.query(
        `INSERT INTO ${t("faucet_claims")} (wallet, claimed_at) VALUES ($1, $2)
         ON CONFLICT (wallet) DO UPDATE SET claimed_at = EXCLUDED.claimed_at`,
        [wallet, at],
      );
    },

    async handleRequest(req) {
      const url = new URL(req.url);
      const known =
        /^\/(leaderboard|matches|ready|players\/[^/]+|matches\/[^/]+)\/?$/.test(
          url.pathname,
        );
      if (!known) return null;
      if (req.method === "OPTIONS")
        return new Response(null, { status: 204, headers: corsHeaders(req) });
      if (req.method !== "GET" && req.method !== "HEAD")
        return reply(req, 405, { error: "method not allowed" });
      try {
        return await route(req, url);
      } catch {
        return reply(req, 500, { error: "internal error" });
      }
    },
  };
};
