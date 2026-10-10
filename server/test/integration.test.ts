import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { bumpArenaAbi, mockBumpAbi } from "@bump/contracts";
import {
  buildDomain,
  CLAIM_SEAT_MESSAGE,
  EVENT_CHANNEL,
  type InputFrame,
  JOIN_INTENT_MESSAGE,
  JOIN_INTENT_TYPES,
  MatchState,
  type ServerEvent,
  seatMessage,
} from "@bump/shared";
import { Client, type Room } from "@colyseus/sdk";
import {
  type Address,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "viem/chains";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { type ArenaChain, MatchStatus } from "../src/chain/ArenaChain";
import { EvmArenaChain, EvmJoinProtocol } from "../src/chain/evm";
import { RefundKeeper } from "../src/chain/RefundKeeper";
import { Settler } from "../src/chain/Settler";
import type { ServerConfig } from "../src/config";
import { Metrics } from "../src/metrics";
import { Faucet } from "../src/relay/Faucet";
import { JoinRelay } from "../src/relay/JoinRelay";
import { RelayerGuard } from "../src/relay/RelayerGuard";
import type { RoomContext } from "../src/rooms/context";

const ANVIL_PORT = 20000 + (process.pid % 20000);
const SERVER_PORT = ANVIL_PORT + 1;
const RPC = `http://127.0.0.1:${ANVIL_PORT}`;
const KEYS = {
  deployer:
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  relayer: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  signer: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  playerA: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  playerB: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  treasury:
    "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
} as const satisfies Record<string, Hex>;

const artifactPath = resolve(
  __dirname,
  "../../contracts/out/BumpArena.sol/BumpArena.json",
);
const tokenArtifactPath = resolve(
  __dirname,
  "../../contracts/out/MockBUMP.sol/MockBUMP.json",
);
const canRun =
  existsSync(artifactPath) &&
  existsSync(tokenArtifactPath) &&
  existsSync(`${process.env.HOME}/.foundry/bin/anvil`);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

const publicClient = createPublicClient({
  chain: robinhoodTestnet,
  transport: http(RPC),
});
const walletFor = (key: Hex) =>
  createWalletClient({
    account: privateKeyToAccount(key),
    chain: robinhoodTestnet,
    transport: http(RPC),
  });

let anvil: ChildProcess | null = null;
let arena: Address;
let token: Address;
let app: ReturnType<typeof createApp> | null = null;

const config = (): ServerConfig => ({
  chain: "evm",
  port: SERVER_PORT,
  evm: {
    rpcUrl: RPC,
    wssUrl: null,
    arenaAddress: arena,
    signerPrivateKey: KEYS.signer,
    relayerPrivateKey: KEYS.relayer,
    tokenAddress: token,
  },
  stakeAmount: 100n * 10n ** 18n,
  relayerMinBalance: 2_000_000_000_000_000n,
  corsOrigins: ["http://localhost:5173"],
  limits: {
    faucetPerIpPerHour: 5,
    faucetGlobalPerHour: 300,
    joinPerIpPerHour: 20,
  },
  startBalance: 100,
  minPlayers: 2,
  maxPlayers: 2,
  matchDurationS: 5,
  joinWindowS: 60,
  fillTimerS: 1,
  replayDir: mkdtempSync(join(tmpdir(), "bump-replay-")),
  serverBuild: "test",
});

const outageOf = (inner: EvmArenaChain): ArenaChain => ({
  id: inner.id,
  decimals: inner.decimals,
  relayerId: inner.relayerId,
  signerId: inner.signerId,
  openMatch: (p) => inner.openMatch(p),
  startMatch: (m) => inner.startMatch(m),
  cancel: (m) => inner.cancel(m),
  settle: async () => {
    throw new Error("rpc outage");
  },
  signResult: (r) => inner.signResult(r),
  getMatch: (m) => inner.getMatch(m),
  getPlayers: (m) => inner.getPlayers(m),
  sessionKeyOf: (m, w) => inner.sessionKeyOf(m, w),
  vehicleOf: (m, w) => inner.vehicleOf(m, w),
  claimRefund: (m, p) => inner.claimRefund(m, p),
  faucetClaim: (w) => inner.faucetClaim(w),
  tokenBalanceOf: (w) => inner.tokenBalanceOf(w),
  nextClaimAt: (w) => inner.nextClaimAt(w),
  relayerBalance: () => inner.relayerBalance(),
  explorerTx: (t) => inner.explorerTx(t),
  parseWallet: (r) => inner.parseWallet(r),
  walletKey: (w) => inner.walletKey(w),
});

const startApp = async (pendingDir: string, outage: boolean) => {
  const cfg = config();
  const real = new EvmArenaChain({
    rpcUrl: RPC,
    wssUrl: null,
    arenaAddress: arena,
    tokenAddress: token,
    relayerPrivateKey: KEYS.relayer,
    signerPrivateKey: KEYS.signer,
    chainId: 46630,
    receiptTimeoutMs: 10_000,
  });
  const chain: ArenaChain = outage ? outageOf(real) : real;
  const settler = new Settler({
    chain,
    pendingDir,
    sleep: outage ? () => new Promise<void>(() => undefined) : undefined,
    backoffMs: 200,
  });
  const log = () => undefined;
  const guard = new RelayerGuard(chain, cfg.relayerMinBalance, Date.now, 0);
  const context: RoomContext = {
    config: cfg,
    chain,
    settler,
    log,
    now: Date.now,
    stats: { rooms: 0 },
    metrics: new Metrics(),
    receiptRetryDelayMs: 200,
    guard,
    joinRelay: new JoinRelay({
      chain,
      guard,
      limits: cfg.limits,
      protocol: new EvmJoinProtocol(real),
      now: Date.now,
      log,
    }),
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
  };
  const server = createApp(context);
  await server.listen(SERVER_PORT);
  return { server, settler, real };
};

interface Player {
  room: Room;
  events: ServerEvent[];
  wallet: Address;
}

const connect = async (): Promise<Player> => {
  const client = new Client(`ws://127.0.0.1:${SERVER_PORT}`);
  const room = await client.joinOrCreate("arena", {}, MatchState);
  const events: ServerEvent[] = [];
  room.onMessage(EVENT_CHANNEL, (event: ServerEvent) => events.push(event));
  await waitFor(() => room.state.matchId, 10_000, "state");
  return { room, events, wallet: "0x" };
};

const noKeepAlive = { connection: "close" };
const BASE = `http://127.0.0.1:${SERVER_PORT}`;
const STAKE = 100n * 10n ** 18n;

const fundFromFaucet = async (wallet: Address) => {
  const balance = await publicClient.readContract({
    address: token,
    abi: mockBumpAbi,
    functionName: "balanceOf",
    args: [wallet],
  });
  if (balance >= STAKE) return;
  const res = await fetch(`${BASE}/faucet`, {
    method: "POST",
    headers: { "content-type": "application/json", ...noKeepAlive },
    body: JSON.stringify({ wallet }),
  });
  expect(res.status).toBe(200);
};

const gaslessJoin = async (player: Player, walletKey: Hex, vehicle: number) => {
  const account = privateKeyToAccount(walletKey);
  const sessionAccount = privateKeyToAccount(generatePrivateKey());
  const matchId = player.room.state.matchId as Hex;
  await fundFromFaucet(account.address);
  const ethBefore = await publicClient.getBalance({ address: account.address });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  const signature = await account.signTypedData({
    domain: buildDomain(arena, 46630),
    types: JOIN_INTENT_TYPES,
    primaryType: "JoinIntent",
    message: {
      matchId,
      player: account.address,
      sessionKey: sessionAccount.address,
      vehicleId: vehicle,
      deadline,
    },
  });
  player.room.send(JOIN_INTENT_MESSAGE, {
    intent: {
      matchId,
      player: account.address,
      sessionKey: sessionAccount.address,
      vehicleId: vehicle,
      deadline: deadline.toString(),
    },
    signature,
  });
  const joined = await waitFor(
    () => player.events.find((e) => e.t === "joinResult"),
    20_000,
    "joinResult",
  );
  expect(joined).toMatchObject({ wallet: account.address.toLowerCase() });
  expect(await publicClient.getBalance({ address: account.address })).toBe(
    ethBefore,
  );
  const issuedAt = Date.now();
  const seatSignature = await sessionAccount.signMessage({
    message: seatMessage({
      matchId,
      wallet: account.address,
      roomId: player.room.roomId,
      issuedAt,
    }),
  });
  player.room.send(CLAIM_SEAT_MESSAGE, {
    wallet: account.address,
    sessionKey: sessionAccount.address,
    issuedAt,
    signature: seatSignature,
  });
  player.wallet = account.address;
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

beforeAll(async () => {
  if (!canRun) return;
  anvil = spawn(
    `${process.env.HOME}/.foundry/bin/anvil`,
    ["--chain-id", "46630", "--port", String(ANVIL_PORT), "--silent"],
    {
      stdio: "ignore",
    },
  );
  const end = Date.now() + 15_000;
  for (;;) {
    try {
      await publicClient.getChainId();
      break;
    } catch {
      if (Date.now() > end) throw new Error("anvil did not start");
      await sleep(100);
    }
  }
  const load = (path: string) =>
    (JSON.parse(readFileSync(path, "utf8")) as { bytecode: { object: Hex } })
      .bytecode.object;
  const deployer = walletFor(KEYS.deployer);
  const deploy = async (
    abi: typeof bumpArenaAbi | typeof mockBumpAbi,
    bytecode: Hex,
    args: readonly unknown[],
  ): Promise<Address> => {
    const hash = await deployer.deployContract({
      abi,
      bytecode,
      args,
    } as Parameters<typeof deployer.deployContract>[0]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) throw new Error("deploy failed");
    return receipt.contractAddress;
  };
  token = await deploy(mockBumpAbi, load(tokenArtifactPath), [
    deployer.account.address,
  ]);
  arena = await deploy(bumpArenaAbi, load(artifactPath), [
    deployer.account.address,
    privateKeyToAccount(KEYS.signer).address,
    privateKeyToAccount(KEYS.relayer).address,
    privateKeyToAccount(KEYS.treasury).address,
    3600n,
    token,
  ]);
  const setArena = await deployer.writeContract({
    address: token,
    abi: mockBumpAbi,
    functionName: "setArena",
    args: [arena],
  });
  await publicClient.waitForTransactionReceipt({ hash: setArena });
}, 60_000);

afterAll(async () => {
  if (app) await app.gracefullyShutdown(false);
  if (anvil) {
    const exited = new Promise<void>((resolve) =>
      anvil?.once("exit", () => resolve()),
    );
    anvil.kill();
    await exited;
  }
});

const runMatch = async (pendingDir: string, outage: boolean) => {
  const started = await startApp(pendingDir, outage);
  app = started.server;
  const a = await connect();
  const b = await connect();
  const intruder = await connect();

  await gaslessJoin(a, KEYS.playerA, 0);
  const impostorKey = privateKeyToAccount(generatePrivateKey());
  const issuedAt = Date.now();
  intruder.room.send(CLAIM_SEAT_MESSAGE, {
    wallet: privateKeyToAccount(KEYS.playerA).address,
    sessionKey: impostorKey.address,
    issuedAt,
    signature: await impostorKey.signMessage({
      message: seatMessage({
        matchId: a.room.state.matchId as Hex,
        wallet: privateKeyToAccount(KEYS.playerA).address,
        roomId: intruder.room.roomId,
        issuedAt,
      }),
    }),
  });
  await waitFor(
    () => intruder.events.find((e) => e.t === "error"),
    10_000,
    "impostor rejection",
  );
  expect(intruder.events.find((e) => e.t === "error")).toMatchObject({
    code: "SEAT_REJECTED",
  });

  await gaslessJoin(b, KEYS.playerB, 3);

  await waitFor(
    () => a.events.find((e) => e.t === "matchStart"),
    20_000,
    "matchStart",
  );
  const timers = [drive(a), drive(b)];
  const end = await waitFor(
    () => a.events.find((e) => e.t === "matchEnd"),
    30_000,
    "matchEnd",
  );
  timers.forEach(clearInterval);
  return { started, a, b, intruder, end, matchId: a.room.state.matchId as Hex };
};

describe.skipIf(!canRun)("arena room against anvil and BumpArena", () => {
  it("runs a full match and settles on chain", async () => {
    const pendingDir = mkdtempSync(join(tmpdir(), "bump-pending-"));
    const { a, end, matchId } = await runMatch(pendingDir, false);

    expect(end.t).toBe("matchEnd");
    if (end.t !== "matchEnd") return;
    expect(end.ranking).toHaveLength(2);
    expect(end.ranking.reduce((sum, row) => sum + row.finalBalance, 0)).toBe(
      200,
    );
    expect(end.ranking[0]?.rank).toBe(1);
    expect(end.replayHash).not.toBe(`0x${"0".repeat(64)}`);
    expect(a.events.some((e) => e.t === "bump" && e.amount > 0)).toBe(true);

    await waitFor(
      () =>
        a.events.find((e) => e.t === "settlement" && e.status === "confirmed"),
      30_000,
      "settlement confirmed",
    );
    const view = await publicClient.readContract({
      address: arena,
      abi: bumpArenaAbi,
      functionName: "getMatch",
      args: [matchId],
    });
    expect(Number(view.status)).toBe(MatchStatus.Settled);

    const logs = await publicClient.getContractEvents({
      address: arena,
      abi: bumpArenaAbi,
      eventName: "PlayerResult",
      fromBlock: 0n,
    });
    const mine = logs.filter((log) => log.args.matchId === matchId);
    expect(mine).toHaveLength(2);
    expect(
      mine.reduce((sum, log) => sum + Number(log.args.finalBalance ?? 0), 0),
    ).toBe(200);
    expect(readdirSync(pendingDir)).toEqual([]);

    const balances = await Promise.all(
      [KEYS.playerA, KEYS.playerB].map((key) =>
        publicClient.readContract({
          address: token,
          abi: mockBumpAbi,
          functionName: "balanceOf",
          args: [privateKeyToAccount(key).address],
        }),
      ),
    );
    expect(balances[0] + balances[1]).toBe(2000n * 10n ** 18n);
    expect(
      await publicClient.readContract({
        address: token,
        abi: mockBumpAbi,
        functionName: "balanceOf",
        args: [arena],
      }),
    ).toBe(0n);

    const walletA = privateKeyToAccount(KEYS.playerA).address;
    const again = await fetch(`${BASE}/faucet`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
        ...noKeepAlive,
      },
      body: JSON.stringify({ wallet: walletA }),
    });
    expect(again.status).toBe(429);
    expect(again.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
    const cooldown = (await again.json()) as {
      code: string;
      retryAfterS: number;
    };
    expect(cooldown.code).toBe("COOLDOWN");
    expect(cooldown.retryAfterS).toBeGreaterThan(80000);

    const status = await fetch(`${BASE}/faucet/status?wallet=${walletA}`, {
      headers: noKeepAlive,
    });
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      wallet: walletA.toLowerCase(),
      canClaimNow: false,
    });
    const bad = await fetch(`${BASE}/faucet`, {
      method: "POST",
      headers: { "content-type": "application/json", ...noKeepAlive },
      body: JSON.stringify({ wallet: "nope" }),
    });
    expect(bad.status).toBe(400);

    const preflight = await fetch(`${BASE}/faucet`, {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        ...noKeepAlive,
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );

    const metrics = (await (
      await fetch(`${BASE}/metrics.json`, { headers: noKeepAlive })
    ).json()) as {
      relayerBalanceWei: string;
    };
    expect(BigInt(metrics.relayerBalanceWei)).toBeGreaterThan(0n);

    const health = await fetch(`http://127.0.0.1:${SERVER_PORT}/health`, {
      headers: noKeepAlive,
    });
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true });

    await app?.gracefullyShutdown(false);
    app = null;
  }, 90_000);

  it("re-submits a pending settlement after the server restarts", async () => {
    const pendingDir = mkdtempSync(join(tmpdir(), "bump-pending-"));
    const { matchId } = await runMatch(pendingDir, true);

    await waitFor(
      () => readdirSync(pendingDir).includes(`${matchId}.json`),
      10_000,
      "pending file",
    );
    const before = await publicClient.readContract({
      address: arena,
      abi: bumpArenaAbi,
      functionName: "getMatch",
      args: [matchId],
    });
    expect(Number(before.status)).toBe(MatchStatus.Started);

    await app?.gracefullyShutdown(false);
    app = null;

    const restarted = await startApp(pendingDir, false);
    app = restarted.server;
    const resumed = await restarted.settler.resumePending(() => undefined);
    expect(resumed).toBe(1);

    const end = Date.now() + 30_000;
    let status = 0;
    while (Date.now() < end) {
      const view = await publicClient.readContract({
        address: arena,
        abi: bumpArenaAbi,
        functionName: "getMatch",
        args: [matchId],
      });
      status = Number(view.status);
      if (status === MatchStatus.Settled) break;
      await sleep(200);
    }
    expect(status).toBe(MatchStatus.Settled);
    await waitFor(
      () => readdirSync(pendingDir).length === 0,
      10_000,
      "pending cleared",
    );
  }, 120_000);
});
