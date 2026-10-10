import type {
  ChainId,
  ChainResult,
  Hex32,
  TxRef,
  WalletId,
} from "@bump/shared";

export type { ChainId, ChainResult, Hex32, TxRef, WalletId };

export const MatchStatus = {
  None: 0,
  Open: 1,
  Started: 2,
  Settled: 3,
  Cancelled: 4,
  Refunding: 5,
} as const;

export interface OnChainMatch {
  stake: bigint;
  startBalance: number;
  maxPlayers: number;
  playerCount: number;
  status: number;
  joinDeadline: bigint;
  settleDeadline: bigint;
  pot: bigint;
}

export interface OpenMatchParams {
  matchId: Hex32;
  stake: bigint;
  maxPlayers: number;
  startBalance: number;
  joinDeadline: bigint;
}

export interface ArenaChain {
  readonly id: ChainId;
  readonly decimals: number;
  readonly relayerId: string;
  readonly signerId: string;
  openMatch(params: OpenMatchParams): Promise<TxRef>;
  startMatch(matchId: Hex32): Promise<TxRef>;
  cancel(matchId: Hex32): Promise<TxRef>;
  settle(
    result: ChainResult,
    onSubmitted?: (tx: TxRef) => void,
  ): Promise<TxRef>;
  signResult(result: ChainResult): Promise<string>;
  selfCheck?(sample: ChainResult): Promise<void>;
  getMatch(matchId: Hex32): Promise<OnChainMatch>;
  getPlayers(matchId: Hex32): Promise<WalletId[]>;
  sessionKeyOf(matchId: Hex32, wallet: WalletId): Promise<string | null>;
  vehicleOf(matchId: Hex32, wallet: WalletId): Promise<number>;
  claimRefund(matchId: Hex32, player: WalletId): Promise<TxRef>;
  faucetClaim(wallet: WalletId): Promise<TxRef>;
  tokenBalanceOf(wallet: WalletId): Promise<bigint>;
  nextClaimAt(wallet: WalletId): Promise<number>;
  relayerBalance(): Promise<bigint>;
  explorerTx(tx: TxRef): string;
  parseWallet(raw: unknown): WalletId | null;
  walletKey(wallet: WalletId): string;
}
