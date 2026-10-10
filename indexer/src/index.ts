import { ponder } from "ponder:registry";
import { match, matchPlayer, playerStats } from "ponder:schema";
import { eq } from "ponder";
import type { Address } from "viem";

const lower = (address: Address): Address => address.toLowerCase() as Address;

ponder.on("BumpArena:MatchOpened", async ({ event, context }) => {
  await context.db
    .insert(match)
    .values({
      id: event.args.matchId,
      stakeAmount: event.args.stake,
      startBalance: event.args.startBalance,
      maxPlayers: event.args.maxPlayers,
      status: "open",
      openedAt: event.block.timestamp,
      potAmount: 0n,
    })
    .onConflictDoNothing();
});

ponder.on("BumpArena:PlayerJoined", async ({ event, context }) => {
  const wallet = lower(event.args.player);
  const row = await context.db.find(match, { id: event.args.matchId });
  if (!row) return;
  await context.db
    .insert(matchPlayer)
    .values({
      matchId: event.args.matchId,
      wallet,
      seat: event.args.seat,
      vehicleId: event.args.vehicleId,
      refunded: false,
    })
    .onConflictDoNothing();
  await context.db
    .update(match, { id: event.args.matchId })
    .set({ potAmount: row.potAmount + row.stakeAmount });
});

ponder.on("BumpArena:MatchStarted", async ({ event, context }) => {
  const row = await context.db.find(match, { id: event.args.matchId });
  if (!row) return;
  await context.db
    .update(match, { id: event.args.matchId })
    .set({ status: "started", startedAt: event.block.timestamp });
});

ponder.on("BumpArena:PlayerResult", async ({ event, context }) => {
  const wallet = lower(event.args.player);
  const row = await context.db.find(match, { id: event.args.matchId });
  const seat = await context.db.find(matchPlayer, {
    matchId: event.args.matchId,
    wallet,
  });
  if (!row || !seat) return;
  await context.db
    .update(matchPlayer, { matchId: event.args.matchId, wallet })
    .set({
      finalBalance: event.args.finalBalance,
      rank: event.args.rank,
      payoutAmount: event.args.payout,
    });
  const won = event.args.rank === 1 ? 1 : 0;
  await context.db
    .insert(playerStats)
    .values({
      wallet,
      matches: 1,
      wins: won,
      totalPayoutAmount: event.args.payout,
      totalStakeAmount: row.stakeAmount,
      netPnlAmount: event.args.payout - row.stakeAmount,
      bestBalance: event.args.finalBalance,
      lastMatchAt: event.block.timestamp,
    })
    .onConflictDoUpdate((stats) => ({
      matches: stats.matches + 1,
      wins: stats.wins + won,
      totalPayoutAmount: stats.totalPayoutAmount + event.args.payout,
      totalStakeAmount: stats.totalStakeAmount + row.stakeAmount,
      netPnlAmount: stats.netPnlAmount + event.args.payout - row.stakeAmount,
      bestBalance: Math.max(stats.bestBalance, event.args.finalBalance),
      lastMatchAt: event.block.timestamp,
    }));
});

ponder.on("BumpArena:MatchSettled", async ({ event, context }) => {
  const row = await context.db.find(match, { id: event.args.matchId });
  if (!row) return;
  await context.db.update(match, { id: event.args.matchId }).set({
    status: "settled",
    settledAt: event.block.timestamp,
    settleTx: event.transaction.hash,
    resultHash: event.args.resultHash,
    inputLogHash: event.args.inputLogHash,
    replayHash: event.args.replayHash,
    winner: lower(event.args.winner),
    potAmount: event.args.pot,
  });
});

ponder.on("BumpArena:MatchCancelled", async ({ event, context }) => {
  const row = await context.db.find(match, { id: event.args.matchId });
  if (!row) return;
  await context.db
    .update(match, { id: event.args.matchId })
    .set({ status: "cancelled" });
  const seats = await context.db.sql
    .select()
    .from(matchPlayer)
    .where(eq(matchPlayer.matchId, event.args.matchId));
  for (const seat of seats) {
    await context.db
      .update(matchPlayer, { matchId: seat.matchId, wallet: seat.wallet })
      .set({ refunded: true });
  }
});

ponder.on("BumpArena:Refunded", async ({ event, context }) => {
  const wallet = lower(event.args.player);
  const row = await context.db.find(match, { id: event.args.matchId });
  const seat = await context.db.find(matchPlayer, {
    matchId: event.args.matchId,
    wallet,
  });
  if (!row || !seat) return;
  if (row.status !== "cancelled") {
    await context.db
      .update(match, { id: event.args.matchId })
      .set({ status: "refunding" });
  }
  await context.db
    .update(matchPlayer, { matchId: event.args.matchId, wallet })
    .set({ refunded: true });
});
