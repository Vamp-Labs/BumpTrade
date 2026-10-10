import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "viem/chains";
import { createApp } from "./app";
import { RefundKeeper } from "./chain/RefundKeeper";
import { Settler } from "./chain/Settler";
import { ViemChainGateway } from "./chain/ViemChainGateway";
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

  const chain = new ViemChainGateway({
    rpcUrl: config.rpcUrl,
    wssUrl: config.wssUrl,
    arenaAddress: config.arenaAddress,
    tokenAddress: config.tokenAddress,
    relayerPrivateKey: config.relayerPrivateKey,
  });
  const settler = new Settler({
    chain,
    account: privateKeyToAccount(config.signerPrivateKey),
    arenaAddress: config.arenaAddress,
    chainId: robinhoodTestnet.id,
    pendingDir: join(config.replayDir, "pending"),
    log,
  });

  const sample = {
    matchId: `0x${"11".repeat(32)}` as const,
    players: [privateKeyToAccount(config.signerPrivateKey).address],
    finalBalances: [config.startBalance],
    ranks: [1],
    inputLogHash: `0x${"00".repeat(32)}` as const,
    replayHash: `0x${"00".repeat(32)}` as const,
    endedAt: 1n,
  };
  try {
    await settler.selfCheck(sample);
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
  const guard = new RelayerGuard(chain, config.relayerMinBalanceWei, Date.now);
  const joinRelay = new JoinRelay({
    chain,
    guard,
    limits: config.limits,
    arenaAddress: config.arenaAddress,
    chainId: robinhoodTestnet.id,
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
    arena: config.arenaAddress,
    relayer: chain.relayerAddress,
    signer: settler.signerAddress,
    resumedSettlements: resumed,
  });
};

main().catch((error: unknown) => {
  process.stderr.write(
    `fatal: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
