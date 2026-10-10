import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

export type Row = Record<string, unknown>;

export type Query = (text: string, params?: unknown[]) => Promise<Row[]>;

export interface Db {
  query: Query;
  transaction<T>(fn: (query: Query) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const SCHEMA_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export const assertSchema = (schema: string): string => {
  if (!SCHEMA_NAME.test(schema)) throw new Error("invalid DATABASE_SCHEMA");
  return schema;
};

const memoryDb = async (): Promise<Db> => {
  const db = new PGlite();
  await db.waitReady;
  const query: Query = async (text, params) =>
    (await db.query<Row>(text, params)).rows;
  return {
    query,
    transaction: async <T>(fn: (query: Query) => Promise<T>): Promise<T> =>
      (await db.transaction((tx) =>
        fn(async (text, params) => (await tx.query<Row>(text, params)).rows),
      )) as T,
    close: () => db.close(),
  };
};

const postgresDb = (url: string): Db => {
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  pool.on("error", () => {});
  return {
    query: async (text, params) => (await pool.query(text, params)).rows,
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(
          async (text, params) => (await client.query(text, params)).rows,
        );
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
};

export const openDb = (databaseUrl: string | undefined): Promise<Db> =>
  databaseUrl === undefined || databaseUrl === ""
    ? memoryDb()
    : Promise.resolve(postgresDb(databaseUrl));

export const migrate = async (db: Db, schema: string): Promise<void> => {
  await db.transaction(async (q) => {
    await q(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await q(`CREATE TABLE IF NOT EXISTS "${schema}".matches (
      id text PRIMARY KEY,
      stake_amount numeric(78,0) NOT NULL,
      start_balance integer NOT NULL,
      max_players integer NOT NULL,
      status text NOT NULL,
      opened_at bigint NOT NULL,
      started_at bigint,
      settled_at bigint,
      settle_tx text,
      result_hash text,
      input_log_hash text,
      replay_hash text,
      winner text,
      pot_amount numeric(78,0) NOT NULL
    )`);
    await q(`CREATE TABLE IF NOT EXISTS "${schema}".match_players (
      match_id text NOT NULL,
      wallet text NOT NULL,
      seat integer NOT NULL,
      vehicle_id integer NOT NULL,
      final_balance integer,
      rank integer,
      payout_amount numeric(78,0),
      refunded boolean NOT NULL DEFAULT false,
      PRIMARY KEY (match_id, wallet)
    )`);
    await q(`CREATE INDEX IF NOT EXISTS match_players_wallet_idx
      ON "${schema}".match_players (wallet)`);
    await q(`CREATE TABLE IF NOT EXISTS "${schema}".player_stats (
      wallet text PRIMARY KEY,
      matches integer NOT NULL,
      wins integer NOT NULL,
      total_payout_amount numeric(78,0) NOT NULL,
      total_stake_amount numeric(78,0) NOT NULL,
      net_pnl_amount numeric(78,0) NOT NULL,
      best_balance integer NOT NULL,
      last_match_at bigint NOT NULL
    )`);
    await q(`CREATE INDEX IF NOT EXISTS player_stats_net_idx
      ON "${schema}".player_stats (net_pnl_amount DESC)`);
    await q(`CREATE TABLE IF NOT EXISTS "${schema}".faucet_claims (
      wallet text PRIMARY KEY,
      claimed_at bigint NOT NULL
    )`);
  });
};
