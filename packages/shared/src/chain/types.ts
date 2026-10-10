export type ChainId = "solana" | "evm";
export type Hex32 = `0x${string}`;
export type WalletId = string;
export type TxRef = string;
export type SeatScheme = "evm" | "ed25519";

export interface ChainResult {
  matchId: Hex32;
  players: WalletId[];
  finalBalances: number[];
  ranks: number[];
  inputLogHash: Hex32;
  replayHash: Hex32;
  endedAt: bigint;
}
