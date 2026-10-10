import { deployments } from '@bump/contracts';
import { deployments as solDeployments } from '@bump/sol-client';
import type { Address } from 'viem';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function readString(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function trimSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function readChainId(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 46630;
}

function resolveAddress(override: string | undefined, fallback: string): Address | null {
  const candidate = override?.trim() || fallback;
  if (!ADDRESS_PATTERN.test(candidate)) return null;
  if (candidate.toLowerCase() === ZERO_ADDRESS) return null;
  return candidate as Address;
}

function resolveBase58(override: string | undefined, fallback: string | null): string | null {
  const candidate = override?.trim() || fallback;
  return candidate && BASE58_PATTERN.test(candidate) ? candidate : null;
}

function httpBase(wsUrl: string): string {
  return trimSlash(wsUrl.replace(/^ws(s?):\/\//i, 'http$1://'));
}

const meta = import.meta.env;
const gameServerUrl = readString(meta.VITE_GAME_SERVER_URL, 'ws://localhost:2567');
const solGameServerUrl = readString(meta.VITE_SOL_GAME_SERVER_URL, 'ws://localhost:2567');
const solCluster = readString(meta.VITE_SOL_CLUSTER, solDeployments.cluster || 'devnet');

export const env = {
  enableEvm: meta.VITE_ENABLE_EVM?.trim() === 'true',
  chainDefault: meta.VITE_CHAIN_DEFAULT?.trim() === 'evm' && meta.VITE_ENABLE_EVM?.trim() === 'true' ? ('evm' as const) : ('solana' as const),
  chainId: readChainId(meta.VITE_CHAIN_ID),
  rpcUrl: readString(meta.VITE_RPC_URL, 'https://rpc.testnet.chain.robinhood.com'),
  publicRpcUrl: 'https://rpc.testnet.chain.robinhood.com',
  gameServerUrl,
  gameServerHttpUrl: httpBase(gameServerUrl),
  indexerUrl: trimSlash(readString(meta.VITE_INDEXER_URL, 'http://localhost:42069')),
  explorerUrl: trimSlash(readString(meta.VITE_EXPLORER_URL, 'https://explorer.testnet.chain.robinhood.com')),
  arenaAddress: resolveAddress(meta.VITE_ARENA_ADDRESS, deployments.BumpArena.address),
  tokenAddress: resolveAddress(meta.VITE_TOKEN_ADDRESS, deployments.MockBUMP.address),
  sol: {
    cluster: solCluster,
    rpcUrl: trimSlash(readString(meta.VITE_SOL_RPC_URL, 'https://api.devnet.solana.com')),
    programId: resolveBase58(meta.VITE_SOL_PROGRAM_ID, solDeployments.programId),
    mint: resolveBase58(meta.VITE_SOL_MINT, solDeployments.mint),
    gameServerUrl: solGameServerUrl,
    gameServerHttpUrl: httpBase(solGameServerUrl),
    leaderboardUrl: trimSlash(readString(meta.VITE_SOL_LEADERBOARD_URL, httpBase(solGameServerUrl))),
    explorerUrl: trimSlash(readString(meta.VITE_SOL_EXPLORER_URL, 'https://explorer.solana.com')),
  },
} as const;

export function txUrl(hash: string): string {
  return `${env.explorerUrl}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${env.explorerUrl}/address/${address}`;
}
