import type { ChainId } from '@bump/shared';
import type { NetClient } from '../net/NetClient';
import { env } from '../config/env';
import { evmChain } from './evm';
import { CHAIN_IDS, CHAIN_META } from './meta';
import { solanaChain } from './solana';

export type { ChainId };
export { CHAIN_IDS, CHAIN_META };

export type MatchStatus = 'none' | 'open' | 'started' | 'settled' | 'cancelled' | 'refunding';

export interface MatchSnapshot {
  stake: bigint;
  startBalance: number;
  maxPlayers: number;
  playerCount: number;
  status: MatchStatus;
  joinDeadline: number;
  settleDeadline: number;
  pot: bigint;
}

export type WalletStatus = 'disconnected' | 'connecting' | 'connected';

export interface ChainWalletOption {
  id: string;
  name: string;
  icon: string;
}

export interface ChainWalletState {
  status: WalletStatus;
  options: ChainWalletOption[];
  selectedId: string | null;
  address: string | null;
  networkOk: boolean;
  bumpBalance: bigint | null;
  error: string | null;
}

export interface ChainWallet {
  discover(): void;
  list(): ChainWalletOption[];
  connect(id: string, silent?: boolean): Promise<void>;
  disconnect(forget?: boolean): void;
  subscribe(listener: (state: ChainWalletState) => void): () => void;
  getState(): ChainWalletState;
  isReady(): boolean;
  refreshBalance(): Promise<void>;
  switchNetwork?(): Promise<void>;
}

export interface SessionKeyHandle {
  publicId: string;
  scheme: 'evm' | 'ed25519';
  signSeat(text: string): Promise<string>;
}

export interface JoinContext {
  net: NetClient;
  matchId: string;
  vehicleId: number;
  joinDeadline: number;
  onSigned?: () => void;
}

export interface ChainErrorInfo {
  kind: 'rejected' | 'revert' | 'network' | 'other';
  message: string;
  code?: string;
}

export interface ClientChain {
  readonly id: ChainId;
  readonly label: string;
  readonly decimals: number;
  readonly gameServerUrl: string;
  readonly gameServerHttpUrl: string;
  readonly leaderboardUrl: string;
  readonly defaultStake: bigint;
  readonly claimAmount: bigint;
  wallet: ChainWallet;
  isConfigured(): boolean;
  isTokenConfigured(): boolean;
  join(ctx: JoinContext): Promise<void>;
  readMatch(matchId: string): Promise<MatchSnapshot>;
  readSessionKeyOf(matchId: string, wallet: string): Promise<string | null>;
  tokenBalance(wallet: string): Promise<bigint>;
  nextClaimAtFallback(wallet: string): Promise<number>;
  createSessionKey(matchId: string): SessionKeyHandle;
  loadSessionKey(matchId: string): SessionKeyHandle | null;
  clearSessionKey(matchId: string): void;
  describeError(error: unknown): ChainErrorInfo;
  formatAmount(amount: bigint, digits?: number): string;
  explorerTx(tx: string): string;
  explorerAddress(addr: string): string;
}

const CHAIN_KEY = 'bump.chain';

function readStored(): ChainId {
  try {
    const stored = localStorage.getItem(CHAIN_KEY);
    if (stored === 'solana' || stored === 'evm') return stored;
  } catch {
    return env.chainDefault;
  }
  return env.chainDefault;
}

function chainOf(id: ChainId): ClientChain {
  return id === 'evm' ? evmChain : solanaChain;
}

let activeId: ChainId = readStored();
const listeners = new Set<(chain: ClientChain) => void>();

function mark(id: ChainId): void {
  document.body.dataset.chain = id;
}

export function getActiveChain(): ClientChain {
  return chainOf(activeId);
}

export function setActiveChain(id: ChainId): void {
  if (id === activeId) return;
  chainOf(activeId).wallet.disconnect(false);
  activeId = id;
  try {
    localStorage.setItem(CHAIN_KEY, id);
  } catch {
    mark(id);
  }
  mark(id);
  const next = chainOf(id);
  for (const listener of listeners) listener(next);
  next.wallet.discover();
}

export function onActiveChainChange(listener: (chain: ClientChain) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

mark(activeId);
