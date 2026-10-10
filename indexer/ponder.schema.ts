import { onchainTable, primaryKey } from "ponder";

export const match = onchainTable("match", (t) => ({
  id: t.hex().primaryKey(),
  stakeAmount: t.bigint().notNull(),
  startBalance: t.integer().notNull(),
  maxPlayers: t.integer().notNull(),
  status: t.text().notNull(),
  openedAt: t.bigint().notNull(),
  startedAt: t.bigint(),
  settledAt: t.bigint(),
  settleTx: t.hex(),
  resultHash: t.hex(),
  inputLogHash: t.hex(),
  replayHash: t.hex(),
  winner: t.hex(),
  potAmount: t.bigint().notNull(),
}));

export const matchPlayer = onchainTable(
  "match_player",
  (t) => ({
    matchId: t.hex().notNull(),
    wallet: t.hex().notNull(),
    seat: t.integer().notNull(),
    vehicleId: t.integer().notNull(),
    finalBalance: t.integer(),
    rank: t.integer(),
    payoutAmount: t.bigint(),
    refunded: t.boolean().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.matchId, table.wallet] }),
  }),
);

export const playerStats = onchainTable("player_stats", (t) => ({
  wallet: t.hex().primaryKey(),
  matches: t.integer().notNull(),
  wins: t.integer().notNull(),
  totalPayoutAmount: t.bigint().notNull(),
  totalStakeAmount: t.bigint().notNull(),
  netPnlAmount: t.bigint().notNull(),
  bestBalance: t.integer().notNull(),
  lastMatchAt: t.bigint().notNull(),
}));
