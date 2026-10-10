import type { AccountMeta, Address, Instruction } from "@solana/kit";
import { AccountRole } from "@solana/kit";

export function withRemainingAccounts<T extends Instruction>(
  instruction: T,
  addresses: readonly Address[],
): T {
  const metas: AccountMeta[] = addresses.map((address) => ({
    address,
    role: AccountRole.WRITABLE,
  }));
  return {
    ...instruction,
    accounts: [...(instruction.accounts ?? []), ...metas],
  };
}
