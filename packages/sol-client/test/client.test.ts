import {
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  BUMP_ARENA_ERROR__UNAUTHORIZED,
  deployments,
  findConfigPda,
  findMatchPda,
  findVaultPda,
  getJoinMatchInstructionAsync,
  getMatchDecoder,
  getSettleInstructionAsync,
  PROGRAM_ID,
  withRemainingAccounts,
} from "../src";

const ID = `0x${"ab".repeat(32)}`;
const text = (s: string) => new TextEncoder().encode(s);
const idBytes = new Uint8Array(32).fill(0xab);

describe("sol-client", () => {
  it("derives the same PDAs as the program seeds", async () => {
    const [config] = await getProgramDerivedAddress({
      programAddress: PROGRAM_ID,
      seeds: [text("config")],
    });
    const [m] = await getProgramDerivedAddress({
      programAddress: PROGRAM_ID,
      seeds: [text("match"), idBytes],
    });
    const [v] = await getProgramDerivedAddress({
      programAddress: PROGRAM_ID,
      seeds: [text("vault"), idBytes],
    });
    expect((await findConfigPda())[0]).toBe(config);
    expect((await findMatchPda(ID))[0]).toBe(m);
    expect((await findMatchPda(idBytes))[0]).toBe(m);
    expect((await findMatchPda(ID.slice(2)))[0]).toBe(m);
    expect((await findVaultPda(ID))[0]).toBe(v);
  });

  it("rejects malformed match ids", async () => {
    await expect(findMatchPda("0x1234")).rejects.toThrow();
    await expect(findMatchPda(new Uint8Array(31))).rejects.toThrow();
  });

  it("deployment placeholder points at the program and config", async () => {
    expect(deployments.programId).toBe(PROGRAM_ID);
    expect(deployments.configPda).toBe((await findConfigPda())[0]);
  });

  it("builds join_match with the frozen account order and discriminator", async () => {
    const player = await generateKeyPairSigner();
    const mint = (await generateKeyPairSigner()).address;
    const playerToken = (await generateKeyPairSigner()).address;
    const session = (await generateKeyPairSigner()).address;
    const ix = await getJoinMatchInstructionAsync({
      player,
      playerToken,
      mint,
      matchId: idBytes,
      sessionKey: session,
      vehicleId: 3,
    } as never);
    expect(ix.programAddress).toBe(PROGRAM_ID);
    expect(Array.from((ix.data as Uint8Array).slice(0, 8))).toEqual([
      244, 8, 47, 130, 192, 59, 179, 44,
    ]);
    expect(ix.accounts?.[0]?.address).toBe(player.address);
    expect(ix.accounts?.[4]?.address).toBe(playerToken);
    const data = ix.data as Uint8Array;
    expect(data.length).toBe(8 + 32 + 32 + 1);
    expect(data[data.length - 1]).toBe(3);
    expect(getAddressEncoder().encode(session)).toEqual(data.slice(40, 72));
  });

  it("appends remaining accounts for settle", async () => {
    const operator = await generateKeyPairSigner();
    const resultSigner = await generateKeyPairSigner();
    const treasury = (await generateKeyPairSigner()).address;
    const a = (await generateKeyPairSigner()).address;
    const b = (await generateKeyPairSigner()).address;
    const ix = await getSettleInstructionAsync({
      operator,
      resultSigner,
      treasury,
      matchId: idBytes,
      finalBalances: [150, 50],
      ranks: [1, 2],
      inputLogHash: new Uint8Array(32),
      replayHash: new Uint8Array(32),
      endedAt: 1n,
    } as never);
    const base = ix.accounts?.length ?? 0;
    const full = withRemainingAccounts(ix, [a, b]);
    expect(full.accounts?.length).toBe(base + 2);
    expect(full.accounts?.[base]?.address).toBe(a);
    expect(full.accounts?.[base + 1]?.address).toBe(b);
  });

  it("exposes decoders and error codes", () => {
    expect(typeof getMatchDecoder).toBe("function");
    expect(BUMP_ARENA_ERROR__UNAUTHORIZED).toBe(6014);
  });
});
