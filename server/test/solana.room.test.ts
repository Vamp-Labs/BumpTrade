import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CLAIM_SEAT_MESSAGE,
  EVENT_CHANNEL,
  type InputFrame,
  MatchState,
  type ServerEvent,
  SOL_JOIN_PREPARE_MESSAGE,
  SOL_JOIN_SUBMIT_MESSAGE,
  seatMessage,
} from "@bump/shared";
import { Client, type Room } from "@colyseus/sdk";
import {
  generateKeyPairSigner,
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getTransactionDecoder,
  type KeyPairSigner,
  signBytes,
} from "@solana/kit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { MatchStatus } from "../src/chain/ArenaChain";
import { RefundKeeper } from "../src/chain/RefundKeeper";
import { Settler } from "../src/chain/Settler";
import { SolanaArenaChain } from "../src/chain/solana";
import type { ServerConfig } from "../src/config";
import { createLeaderboard, type Leaderboard } from "../src/leaderboard";
import { Metrics } from "../src/metrics";
import { Faucet } from "../src/relay/Faucet";
import { RelayerGuard } from "../src/relay/RelayerGuard";
import { SolanaJoinRelay } from "../src/relay/SolanaJoinRelay";
import {
  airdrop,
  canRunValidator,
  deployLocal,
  startValidator,
  type Validator,
} from "./solana/validator";

const SERVER_PORT = 30000 + (process.pid % 20000);
const BASE = `http://127.0.0.1:${SERVER_PORT}`;
const STAKE = 100n * 10n ** 9n;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const noKeepAlive = { connection: "close" };

const waitFor = async <T>(
  read: () => T | undefined | null | false,
  ms: number,
  label: string,
): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > end) throw new Error(`timeout waiting for ${label}`);
    await sleep(50);
  }
};

let validator: Validator;
let chain: SolanaArenaChain;
let board: Leaderboard;
let app: ReturnType<typeof createApp> | null = null;

interface Player {
  room: Room;
  events: ServerEvent[];
  wallet: KeyPairSigner;
}

beforeAll(async () => {
  if (!canRunValidator) return;
  validator = await startValidator();
  const relayer = await generateKeyPairSigner();
  const resultSigner = await generateKeyPairSigner();
  const mintAuthority = await generateKeyPairSigner();
  await airdrop(validator, relayer.address, 50n);
  const deployed = await deployLocal(validator, {
    payer: relayer,
    mintAuthority: mintAuthority.address,
    operator: relayer.address,
    resultSigner: resultSigner.address,
    stake: STAKE,
    startBalance: 100,
  });
  board = await createLeaderboard({
    schema: "bump_sol_test",
    chain: "solana",
    decimals: 9,
    corsOrigins: ["http://localhost:5173"],
  });
  chain = new SolanaArenaChain({
    cluster: "local",
    rpcUrl: validator.rpcUrl,
    programId: "3LDXSuMuzP33VZ31sar4ZN1YB13pta7NRuR6aDJmwVgz",
    mint: deployed.mint,
    treasury: deployed.treasury,
    relayer,
    resultSigner,
    mintAuthority,
    cooldown: {
      nextClaimAt: (w) => board.faucetNextClaimAt(w),
      markClaimed: (w, at) => board.faucetMarkClaimed(w, at),
    },
    expectedStake: STAKE,
    pollMs: 100,
  });
}, 150_000);

afterAll(async () => {
  if (app) await app.gracefullyShutdown(false);
  if (validator) await validator.stop();
});

const config = (): ServerConfig => ({
  chain: "solana",
  port: SERVER_PORT,
  evm: null,
  solana: null,
  databaseUrl: null,
  databaseSchema: "bump_sol_test",
  stakeAmount: STAKE,
  relayerMinBalance: 50_000_000n,
  corsOrigins: ["http://localhost:5173"],
  limits: {
    faucetPerIpPerHour: 50,
    faucetGlobalPerHour: 500,
    joinPerIpPerHour: 50,
  },
  startBalance: 100,
  minPlayers: 2,
  maxPlayers: 2,
  matchDurationS: 5,
  joinWindowS: 60,
  fillTimerS: 1,
  replayDir: mkdtempSync(join(tmpdir(), "bump-sol-replay-")),
  serverBuild: "test",
});

const connect = async (): Promise<Player> => {
  const client = new Client(`ws://127.0.0.1:${SERVER_PORT}`);
  const room = await client.joinOrCreate("arena", {}, MatchState);
  const events: ServerEvent[] = [];
  room.onMessage(EVENT_CHANNEL, (event: ServerEvent) => events.push(event));
  await waitFor(() => room.state.matchId, 10_000, "state");
  return { room, events, wallet: await generateKeyPairSigner() };
};

const fund = async (wallet: string) => {
  const res = await fetch(`${BASE}/faucet`, {
    method: "POST",
    headers: { "content-type": "application/json", ...noKeepAlive },
    body: JSON.stringify({ wallet }),
  });
  expect(res.status).toBe(200);
};

const solanaJoin = async (player: Player, vehicle: number) => {
  const matchId = player.room.state.matchId as `0x${string}`;
  await fund(player.wallet.address);
  const session = await generateKeyPairSigner();
  player.room.send(SOL_JOIN_PREPARE_MESSAGE, {
    matchId,
    player: player.wallet.address,
    sessionKey: session.address,
    vehicleId: vehicle,
  });
  const prepared = await waitFor(
    () => player.events.find((e) => e.t === "solJoinTx"),
    20_000,
    "solJoinTx",
  );
  if (prepared.t !== "solJoinTx") throw new Error("unexpected event");
  const decoded = getTransactionDecoder().decode(
    getBase64Encoder().encode(prepared.tx),
  );
  const [signatures] = await player.wallet.signTransactions([decoded as never]);
  const signedTx = getBase64EncodedWireTransaction({
    ...decoded,
    signatures: { ...decoded.signatures, ...signatures },
  } as never);
  player.room.send(SOL_JOIN_SUBMIT_MESSAGE, { matchId, signedTx });
  const joined = await waitFor(
    () => player.events.find((e) => e.t === "joinResult"),
    20_000,
    "joinResult",
  );
  expect(joined).toMatchObject({ wallet: player.wallet.address });

  const issuedAt = Date.now();
  const text = seatMessage({
    matchId,
    wallet: player.wallet.address,
    roomId: player.room.roomId,
    issuedAt,
  });
  const signature = await signBytes(
    session.keyPair.privateKey,
    new TextEncoder().encode(text),
  );
  player.room.send(CLAIM_SEAT_MESSAGE, {
    wallet: player.wallet.address,
    sessionKey: session.address,
    issuedAt,
    signature: getBase58Decoder().decode(signature),
    scheme: "ed25519",
  });
};

const drive = (player: Player) => {
  const input = player.room.input<InputFrame>();
  return setInterval(() => {
    input.data.tick += 1;
    input.data.throttle = 100;
    input.data.steer = 0;
    input.data.buttons = 2;
    input.send();
  }, 16);
};

describe.skipIf(!canRunValidator)("arena room on a local solana validator", () => {
  it("joins gaslessly, proves seats with ed25519, settles on chain and records the leaderboard", async () => {
    const cfg = config();
    const log = () => undefined;
    const guard = new RelayerGuard(chain, cfg.relayerMinBalance, Date.now, 0);
    const settler = new Settler({
      chain,
      pendingDir: join(cfg.replayDir, "pending"),
      backoffMs: 200,
    });
    app = createApp({
      config: cfg,
      chain,
      settler,
      log,
      now: Date.now,
      stats: { rooms: 0 },
      metrics: new Metrics(),
      receiptRetryDelayMs: 200,
      guard,
      joinRelay: null,
      solJoin: new SolanaJoinRelay({
        chain,
        guard,
        limits: cfg.limits,
        now: Date.now,
        log,
      }),
      leaderboard: board,
      faucet: new Faucet({
        chain,
        guard,
        limits: cfg.limits,
        now: Date.now,
        log,
      }),
      keeper: new RefundKeeper({
        chain,
        dir: join(cfg.replayDir, "tracked"),
        now: Date.now,
        log,
        minPlayers: cfg.minPlayers,
      }),
    });
    await app.listen(SERVER_PORT);

    const a = await connect();
    const b = await connect();
    const intruder = await connect();
    const matchId = a.room.state.matchId as `0x${string}`;

    await solanaJoin(a, 0);
    const impostor = await generateKeyPairSigner();
    const issuedAt = Date.now();
    intruder.room.send(CLAIM_SEAT_MESSAGE, {
      wallet: a.wallet.address,
      sessionKey: impostor.address,
      issuedAt,
      signature: getBase58Decoder().decode(
        await signBytes(
          impostor.keyPair.privateKey,
          new TextEncoder().encode(
            seatMessage({
              matchId,
              wallet: a.wallet.address,
              roomId: intruder.room.roomId,
              issuedAt,
            }),
          ),
        ),
      ),
      scheme: "ed25519",
    });
    await waitFor(
      () => intruder.events.find((e) => e.t === "error"),
      10_000,
      "impostor rejection",
    );
    expect(intruder.events.find((e) => e.t === "error")).toMatchObject({
      code: "SEAT_REJECTED",
    });

    await solanaJoin(b, 3);
    await waitFor(
      () => a.events.find((e) => e.t === "matchStart"),
      30_000,
      "matchStart",
    );
    const timers = [drive(a), drive(b)];
    const end = await waitFor(
      () => a.events.find((e) => e.t === "matchEnd"),
      30_000,
      "matchEnd",
    );
    timers.forEach(clearInterval);
    expect(end.t).toBe("matchEnd");
    if (end.t !== "matchEnd") return;
    expect(end.ranking.reduce((sum, row) => sum + row.finalBalance, 0)).toBe(
      200,
    );
    const settled = await waitFor(
      () =>
        a.events.find((e) => e.t === "settlement" && e.status === "confirmed"),
      30_000,
      "settlement confirmed",
    );
    expect(settled).toMatchObject({ t: "settlement", status: "confirmed" });
    expect((await chain.getMatch(matchId)).status).toBe(MatchStatus.Settled);

    const total =
      (await chain.tokenBalanceOf(a.wallet.address)) +
      (await chain.tokenBalanceOf(b.wallet.address));
    expect(total).toBe(2000n * 10n ** 9n);

    const lb = await fetch(`${BASE}/leaderboard?window=all`, {
      headers: noKeepAlive,
    });
    expect(lb.status).toBe(200);
    const body = (await lb.json()) as { chain?: string; decimals?: number };
    expect(body).toMatchObject({ chain: "solana", decimals: 9 });
    const ready = await fetch(`${BASE}/ready`, { headers: noKeepAlive });
    expect(ready.status).toBe(200);

    const cooldown = await fetch(`${BASE}/faucet`, {
      method: "POST",
      headers: { "content-type": "application/json", ...noKeepAlive },
      body: JSON.stringify({ wallet: a.wallet.address }),
    });
    expect(cooldown.status).toBe(429);
  }, 150_000);
});
