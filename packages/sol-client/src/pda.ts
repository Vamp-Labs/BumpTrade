import type { Address, ProgramDerivedAddress } from "@solana/kit";
import {
  BUMP_ARENA_PROGRAM_ADDRESS,
  findMatchAccountPda,
  findConfigPda as generatedConfigPda,
  findVaultPda as generatedVaultPda,
} from "./generated";

export const PROGRAM_ID: Address = BUMP_ARENA_PROGRAM_ADDRESS;

export function matchIdBytes(matchId: Uint8Array | string): Uint8Array {
  if (typeof matchId !== "string") {
    if (matchId.length !== 32) throw new Error("matchId must be 32 bytes");
    return matchId;
  }
  const hex = matchId.startsWith("0x") ? matchId.slice(2) : matchId;
  if (!/^[0-9a-fA-F]{64}$/.test(hex))
    throw new Error("matchId must be 32 bytes of hex");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++)
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function findConfigPda(): Promise<ProgramDerivedAddress> {
  return generatedConfigPda();
}

export async function findMatchPda(
  matchId: Uint8Array | string,
): Promise<ProgramDerivedAddress> {
  return findMatchAccountPda({ matchId: matchIdBytes(matchId) });
}

export async function findVaultPda(
  matchId: Uint8Array | string,
): Promise<ProgramDerivedAddress> {
  return generatedVaultPda({ matchId: matchIdBytes(matchId) });
}
