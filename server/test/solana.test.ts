import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Hex32, SolJoinTxEvent } from "@bump/shared";
import {
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getTransactionDecoder,
  type KeyPairSigner,
} from "@solana/kit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MatchStatus } from "../src/chain/ArenaChain";
import { Settler } from "../src/chain/Settler";
import {
  FAUCET_AMOUNT,
  MemoryFaucetCooldown,
  SolanaArenaChain,
} from "../src/chain/solana";
import { Faucet } from "../src/relay/Faucet";
import { SolanaJoinRelay } from "../src/relay/SolanaJoinRelay";
import { RelayerGuard } from "../src/relay/RelayerGuard";
import {
  airdrop,
  canRunValidator,
  type Deployed,
  deployLocal,
  startValidator,
  type Validator,
} from "./solana/validator";

const STAKE = 100n * 10n ** 9n;
const limits = {
  faucetPerIpPerHour: 50,
  faucetGlobalPerHour: 500,
  joinPerIpPerHour: 50,
};

let validator: Validator;
let deployed: Deployed;
let chain: SolanaArenaChain;
let relayer: KeyPairSigner;
let players: KeyPairSigner[];
let offsetMs = 0;
const clock = () => Date.now() + offsetMs;
const log = () => undefined;

const newMatchId = (): Hex32 => `0x${randomBytes(32).toString("hex")}`;

const playerSign = async (
  player: KeyPairSigner,
  tx: string,
  mutate?: (message: Uint8Array) => void,
): Promise<string> => {
  const decoded = getTransactionDecoder().decode(
    getBase64Encoder().encode(tx),
  );
  const messageBytes = Uint8Array.from(decoded.messageBytes);
  mutate?.(messageBytes);
  const base = { messageBytes, signatures: decoded.signatures };
  const [signatures] = await player.signTransactions([base as never]);
  return getBase64EncodedWireTransaction({
    ...base,
    signatures: { ...base.signatures, ...signatures },
  } as never);
};

const openMatch = async (matchId: Hex32) => {
  await chain.openMatch({
    matchId,
    stake: STAKE,
    maxPlayers: 2,
    startBalance: 100,
    joinDeadline: BigInt(Math.floor(Date.now() / 1000) + 300),
  });
};

const setupRelay = () => {
  const guard = new RelayerGuard(chain, 50_000_000n, clock, 0);
  return {
    guard,
    relay: new SolanaJoinRelay({ chain, guard, limits, now: clock, log }),
  };
};

beforeAll(async () => {
  if (!canRunValidator) return;
  validator = await startValidator();
  relayer = await generateKeyPairSigner();
  const resultSigner = await generateKeyPairSigner();
  const mintAuthority = await generateKeyPairSigner();
  players = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  await airdrop(validator, relayer.address, 50n);
  deployed = await deployLocal(validator, {
    payer: relayer,
    mintAuthority: mintAuthority.address,
    operator: relayer.address,
    resultSigner: resultSigner.address,
    stake: STAKE,
    startBalance: 100,
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
    cooldown: new MemoryFaucetCooldown(),
    expectedStake: STAKE,
    pollMs: 100,
  });
}, 150_000);

afterAll(async () => {
  if (validator) await validator.stop();
});

describe.skipIf(!canRunValidator)("solana adapter on a local validator", () => {
  it("passes the on-chain config self check and reports the relayer balance", async () => {
    await chain.selfCheck({} as never);
    expect(await chain.relayerBalance()).toBeGreaterThan(1_000_000_000n);
    expect(chain.parseWallet(players[0]?.address)).toBe(players[0]?.address);
    expect(chain.parseWallet("0xabc")).toBeNull();
    expect(chain.explorerTx("sig")).toContain("customUrl");
  });

  it("mints from the faucet with a 24 hour cooldown", async () => {
    const { guard } = setupRelay();
    const faucet = new Faucet({ chain, guard, limits, now: clock, log });
    const wallet = players[0]?.address as string;
    const first = await faucet.claim(wallet, "1.1.1.1");
    expect(first.status).toBe(200);
    expect(await chain.tokenBalanceOf(wallet)).toBe(FAUCET_AMOUNT);
    const again = await faucet.claim(wallet, "1.1.1.1");
    expect(again.status).toBe(429);
    expect(again.body).toMatchObject({ code: "COOLDOWN" });
    const status = await faucet.status(wallet);
    expect(status.body).toMatchObject({
      wallet,
      balance: FAUCET_AMOUNT.toString(),
      canClaimNow: false,
    });
    await chain.faucetClaim(players[1]?.address as string);
    expect(await chain.tokenBalanceOf(players[2]?.address as string)).toBe(0n);
  });

  it("relays gasless joins, rejects tampered and expired transactions, settles and pays out", async () => {
    const { relay } = setupRelay();
    const [a, b, c] = players as [KeyPairSigner, KeyPairSigner, KeyPairSigner];
    const matchId = newMatchId();
    await openMatch(matchId);
    const sessionA = await generateKeyPairSigner();
    const sessionB = await generateKeyPairSigner();
    const solBefore = await validator.rpc
      .getBalance(a.address, { commitment: "confirmed" })
      .send();

    const poor = await relay.prepare(
      {
        matchId,
        player: c.address,
        sessionKey: sessionA.address,
        vehicleId: 0,
      },
      matchId,
      "9.9.9.9",
    );
    expect(poor).toMatchObject({ ok: false, code: "INSUFFICIENT_BALANCE" });
    expect(
      await relay.prepare({ nope: 1 }, matchId, "9.9.9.9"),
    ).toMatchObject({ ok: false, code: "JOIN_MALFORMED" });
    expect(
      await relay.prepare(
        { matchId, player: a.address, sessionKey: sessionA.address, vehicleId: 9 },
        matchId,
        "9.9.9.9",
      ),
    ).toMatchObject({ ok: false, code: "JOIN_MALFORMED" });

    const started = performance.now();
    const prepared = await relay.prepare(
      { matchId, player: a.address, sessionKey: sessionA.address, vehicleId: 0 },
      matchId,
      "1.1.1.1",
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const event: SolJoinTxEvent = prepared.event;
    expect(event.t).toBe("solJoinTx");
    expect(event.expiresAt).toBeGreaterThan(Date.now());

    const tampered = await playerSign(a, event.tx, (m) => {
      m[m.length - 2] = (m[m.length - 2] ?? 0) ^ 1;
    });
    expect(await relay.submit({ matchId, signedTx: tampered }, matchId)).toMatchObject({
      ok: false,
      code: "TX_TAMPERED",
    });
    expect(await relay.submit({ matchId, signedTx: "AAAA" }, matchId)).toMatchObject({
      ok: false,
      code: "TX_TAMPERED",
    });
    const unsigned = await relay.submit({ matchId, signedTx: event.tx }, matchId);
    expect(unsigned).toMatchObject({ ok: false, code: "BAD_SIGNATURE" });

    const signed = await playerSign(a, event.tx);
    const joined = await relay.submit({ matchId, signedTx: signed }, matchId);
    const latencyMs = performance.now() - started;
    expect(joined).toMatchObject({ ok: true, wallet: a.address, seat: 0 });
    console.log(`solana join latency prepare->confirmed: ${latencyMs.toFixed(0)} ms`);

    const solAfter = await validator.rpc
      .getBalance(a.address, { commitment: "confirmed" })
      .send();
    expect(solAfter.value).toBe(solBefore.value);
    expect(await chain.tokenBalanceOf(a.address)).toBe(FAUCET_AMOUNT - STAKE);
    expect(await chain.sessionKeyOf(matchId, a.address)).toBe(sessionA.address);
    expect(await chain.sessionKeyOf(matchId, b.address)).toBeNull();

    expect(
      await relay.prepare(
        { matchId, player: a.address, sessionKey: sessionA.address, vehicleId: 0 },
        matchId,
        "1.1.1.1",
      ),
    ).toMatchObject({ ok: false, code: "ALREADY_JOINED" });
    expect(await relay.submit({ matchId, signedTx: signed }, matchId)).toMatchObject({
      ok: false,
      code: "TX_TAMPERED",
    });

    const second = await relay.prepare(
      { matchId, player: b.address, sessionKey: sessionB.address, vehicleId: 3 },
      matchId,
      "2.2.2.2",
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const signedB = await playerSign(b, second.event.tx);
    offsetMs = 61_000;
    expect(await relay.submit({ matchId, signedTx: signedB }, matchId)).toMatchObject({
      ok: false,
      code: "TX_EXPIRED",
    });
    offsetMs = 0;
    const retry = await relay.prepare(
      { matchId, player: b.address, sessionKey: sessionB.address, vehicleId: 3 },
      matchId,
      "2.2.2.2",
    );
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    const joinedB = await relay.submit(
      { matchId, signedTx: await playerSign(b, retry.event.tx) },
      matchId,
    );
    expect(joinedB).toMatchObject({ ok: true, wallet: b.address, seat: 1 });
    expect(await chain.vehicleOf(matchId, b.address)).toBe(3);
    expect(await chain.getPlayers(matchId)).toEqual([a.address, b.address]);
    const open = await chain.getMatch(matchId);
    expect(open).toMatchObject({
      status: MatchStatus.Open,
      playerCount: 2,
      stake: STAKE,
      pot: STAKE * 2n,
    });

    await chain.startMatch(matchId);
    expect((await chain.getMatch(matchId)).status).toBe(MatchStatus.Started);

    const settler = new Settler({
      chain,
      pendingDir: mkdtempSync(join(tmpdir(), "bump-sol-pending-")),
      backoffMs: 200,
    });
    const updates: string[] = [];
    const status = await settler.submit(
      {
        matchId,
        players: [a.address, b.address],
        finalBalances: [130, 70],
        ranks: [1, 2],
        inputLogHash: `0x${"11".repeat(32)}`,
        replayHash: `0x${"22".repeat(32)}`,
        endedAt: BigInt(Math.floor(Date.now() / 1000)),
      },
      (u) => updates.push(u.status),
    );
    expect(status).toBe("confirmed");
    expect(updates).toContain("submitted");
    expect((await chain.getMatch(matchId)).status).toBe(MatchStatus.Settled);
    expect(await chain.tokenBalanceOf(a.address)).toBe(
      FAUCET_AMOUNT - STAKE + 130n * 10n ** 9n,
    );
    expect(await chain.tokenBalanceOf(b.address)).toBe(
      FAUCET_AMOUNT - STAKE + 70n * 10n ** 9n,
    );
  });

  it("maps program errors and refunds seats on cancel", async () => {
    const { relay } = setupRelay();
    const a = players[0] as KeyPairSigner;
    const matchId = newMatchId();
    await openMatch(matchId);
    const before = await chain.tokenBalanceOf(a.address);
    const session = await generateKeyPairSigner();
    const prepared = await relay.prepare(
      { matchId, player: a.address, sessionKey: session.address, vehicleId: 1 },
      matchId,
      "3.3.3.3",
    );
    if (!prepared.ok) throw new Error("prepare failed");
    await relay.submit(
      { matchId, signedTx: await playerSign(a, prepared.event.tx) },
      matchId,
    );
    expect(await chain.tokenBalanceOf(a.address)).toBe(before - STAKE);

    await expect(chain.startMatch(matchId)).rejects.toThrow(/NotEnoughPlayers/);
    await chain.cancel(matchId);
    expect((await chain.getMatch(matchId)).status).toBe(MatchStatus.Cancelled);
    expect(await chain.tokenBalanceOf(a.address)).toBe(before);
    await expect(chain.claimRefund(matchId, a.address)).rejects.toThrow();
  });
});
