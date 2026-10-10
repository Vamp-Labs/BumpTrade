import type { JoinIntentTyped } from "@bump/shared";
import type { Address, Hex } from "viem";

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

export interface SettleResult {
  matchId: Hex;
  players: Address[];
  finalBalances: number[];
  ranks: number[];
  inputLogHash: Hex;
  replayHash: Hex;
  endedAt: bigint;
}

export interface OpenMatchParams {
  matchId: Hex;
  stake: bigint;
  maxPlayers: number;
  startBalance: number;
  joinDeadline: bigint;
}

export interface ChainGateway {
  openMatch(params: OpenMatchParams): Promise<Hex>;
  startMatch(matchId: Hex): Promise<Hex>;
  cancel(matchId: Hex): Promise<Hex>;
  settle(
    result: SettleResult,
    signature: Hex,
    onSubmitted?: (hash: Hex) => void,
  ): Promise<Hex>;
  getMatch(matchId: Hex): Promise<OnChainMatch>;
  getPlayers(matchId: Hex): Promise<Address[]>;
  sessionKeyOf(matchId: Hex, wallet: Address): Promise<Address>;
  vehicleOf(matchId: Hex, wallet: Address): Promise<number>;
  hashResult(result: SettleResult): Promise<Hex>;
  joinWithSig(intent: JoinIntentTyped, signature: Hex): Promise<Hex>;
  claimRefund(matchId: Hex, player: Address): Promise<Hex>;
  faucetClaim(wallet: Address): Promise<Hex>;
  tokenBalanceOf(wallet: Address): Promise<bigint>;
  nextClaimAt(wallet: Address): Promise<bigint>;
  relayerBalance(): Promise<bigint>;
  tokenAddress(): Promise<Address>;
}
