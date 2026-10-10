import type { ChainId } from '@bump/shared';
import { env } from '../config/env';
import { formatTokenAmount } from './format';

export interface ChainMeta {
  id: ChainId;
  label: string;
  pill: string;
  decimals: number;
  gameServerUrl: string;
  gameServerHttpUrl: string;
  leaderboardUrl: string;
  explorerTx(tx: string): string;
  explorerAddress(address: string): string;
  formatAmount(amount: bigint, digits?: number): string;
}

function solSuffix(): string {
  return env.sol.cluster === 'mainnet-beta' ? '' : `?cluster=${env.sol.cluster}`;
}

export const CHAIN_META: Record<ChainId, ChainMeta> = {
  solana: {
    id: 'solana',
    label: 'Solana Devnet',
    pill: 'Solana Devnet',
    decimals: 9,
    gameServerUrl: env.sol.gameServerUrl,
    gameServerHttpUrl: env.sol.gameServerHttpUrl,
    leaderboardUrl: env.sol.leaderboardUrl,
    explorerTx: (tx) => `${env.sol.explorerUrl}/tx/${tx}${solSuffix()}`,
    explorerAddress: (address) => `${env.sol.explorerUrl}/address/${address}${solSuffix()}`,
    formatAmount: (amount, digits) => formatTokenAmount(amount, 9, digits),
  },
  evm: {
    id: 'evm',
    label: 'Robinhood Chain Testnet',
    pill: 'Robinhood Chain',
    decimals: 18,
    gameServerUrl: env.gameServerUrl,
    gameServerHttpUrl: env.gameServerHttpUrl,
    leaderboardUrl: env.indexerUrl,
    explorerTx: (tx) => `${env.explorerUrl}/tx/${tx}`,
    explorerAddress: (address) => `${env.explorerUrl}/address/${address}`,
    formatAmount: (amount, digits) => formatTokenAmount(amount, 18, digits),
  },
};

export const CHAIN_IDS: readonly ChainId[] = ['solana', 'evm'];
