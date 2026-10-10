import { join } from "node:path";
import { createApp } from "./app";
import { createChain } from "./chain/createChain";
import { RefundKeeper } from "./chain/RefundKeeper";
import { Settler } from "./chain/Settler";
import { loadConfig } from "./config";
import { Metrics } from "./metrics";
import { Faucet } from "./relay/Faucet";
import { JoinRelay } from "./relay/JoinRelay";
import { RelayerGuard } from "./relay/RelayerGuard";

const log = (line: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify({ ts: Date.now(), ...line })}\n`);
};

const main = async (): Promise<void> => {
  const config = loadConfig(process.env);

  const { chain, joinProtocol } = createChain(config);
  const settler = new Settler({
    chain,
    pendingDir: join(config.replayDir, "pending"),
    log,
  });

  const sample = {
    matchId: `0x${"11".repeat(32)}` as const,
    players: [chain.signerId],
    finalBalances: [config.startBalance],
    ranks: [1],
    inputLogHash: `0x${"00".repeat(32)}` as const,
    replayHash: `0x${"00".repeat(32)}` as const,
    endedAt: 1n,
  };
  try {
    await chain.selfCheck?.(sample);
  } catch (error) {
    if (error instanceof Error && error.message.includes("digest mismatch"))
      throw error;
    log({
      evt: "selfcheck_skipped",
      error:
        error instanceof Error ? error.message.split("\n")[0] : String(error),
    });
  }

  const resumed = await settler.resumePending((matchId, update) => {
    log({ evt: "settle_resume", matchId, ...update });
  });

  const stats = { rooms: 0 };
  const guard = new RelayerGuard(chain, config.relayerMinBalance, Date.now);
  const joinRelay = new JoinRelay({
    chain,
    guard,
    limits: config.limits,
    protocol: joinProtocol,
    now: Date.now,
    log,
  });
  const faucet = new Faucet({
    chain,
    guard,
    limits: config.limits,
    now: Date.now,
    log,
  });
  const keeper = new RefundKeeper({
    chain,
    dir: join(config.replayDir, "tracked"),
    now: Date.now,
    log,
    minPlayers: config.minPlayers,
  });
  await keeper.load();
  keeper.start();
  setInterval(() => {
    joinRelay.sweep();
    faucet.sweep();
  }, 600_000).unref();
  const server = createApp({
    config,
    chain,
    settler,
    log,
    now: Date.now,
    stats,
    metrics: new Metrics(),
    guard,
    joinRelay,
    faucet,
    keeper,
    receiptRetryDelayMs: 500,
  });
  await server.listen(config.port);
  log({
    evt: "listening",
    port: config.port,
    chain: chain.id,
    arena: config.evm?.arenaAddress,
    relayer: chain.relayerId,
    signer: chain.signerId,
    resumedSettlements: resumed,
  });
};

main().catch((error: unknown) => {
  process.stderr.write(
    `fatal: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
