import { mockBumpAbi } from '@bump/contracts';
import type { Address } from 'viem';
import { env } from '../../config/env';
import { formatTokenAmount } from '../format';
import { publicClient } from './clients';

export const TOKEN_DECIMALS = 18;
export const DEFAULT_STAKE = 100n * 10n ** 18n;
export const CLAIM_AMOUNT = 1000n * 10n ** 18n;

export function isTokenConfigured(): boolean {
  return env.tokenAddress !== null;
}

export function formatBump(amount: bigint, digits = 2): string {
  return formatTokenAmount(amount, TOKEN_DECIMALS, digits);
}

export async function readTokenBalance(account: Address): Promise<bigint> {
  if (!env.tokenAddress) throw new Error('Token address is not configured');
  return publicClient.readContract({
    address: env.tokenAddress,
    abi: mockBumpAbi,
    functionName: 'balanceOf',
    args: [account],
  });
}

export async function readNextClaimAt(account: Address): Promise<number> {
  if (!env.tokenAddress) return 0;
  const value = await publicClient.readContract({
    address: env.tokenAddress,
    abi: mockBumpAbi,
    functionName: 'nextClaimAt',
    args: [account],
  });
  return Number(value);
}
