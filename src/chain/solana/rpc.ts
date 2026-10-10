import { fetchMatch, findMatchPda } from '@bump/sol-client';
import { address, createSolanaRpc } from '@solana/kit';
import { env } from '../../config/env';
import type { MatchSnapshot, MatchStatus } from '../port';

const STATUS_BY_INDEX: MatchStatus[] = ['none', 'open', 'started', 'settled', 'cancelled', 'refunding'];

const rpc = createSolanaRpc(env.sol.rpcUrl);

export function isSolConfigured(): boolean {
  return env.sol.programId !== null && env.sol.mint !== null;
}

export function isSolTokenConfigured(): boolean {
  return env.sol.mint !== null;
}

async function loadMatch(matchId: string) {
  const [pda] = await findMatchPda(matchId);
  const account = await fetchMatch(rpc, pda, { commitment: 'confirmed' });
  return account.data;
}

export async function readMatch(matchId: string): Promise<MatchSnapshot> {
  const data = await loadMatch(matchId);
  return {
    stake: data.stake,
    startBalance: data.startBalance,
    maxPlayers: data.maxPlayers,
    playerCount: data.playerCount,
    status: STATUS_BY_INDEX[data.status] ?? 'none',
    joinDeadline: Number(data.joinDeadline),
    settleDeadline: Number(data.settleDeadline),
    pot: data.stake * BigInt(data.playerCount),
  };
}

export async function readSessionKeyOf(matchId: string, player: string): Promise<string | null> {
  const data = await loadMatch(matchId);
  const index = data.players.slice(0, data.playerCount).findIndex((p) => p === player);
  return index < 0 ? null : (data.sessionKeys[index] ?? null);
}

function readAmount(value: unknown): bigint {
  const info = (value as { account?: { data?: { parsed?: { info?: { tokenAmount?: { amount?: unknown } } } } } })?.account?.data
    ?.parsed?.info?.tokenAmount?.amount;
  try {
    return typeof info === 'string' ? BigInt(info) : 0n;
  } catch {
    return 0n;
  }
}

export async function readTokenBalance(owner: string): Promise<bigint> {
  if (!env.sol.mint) throw new Error('Token mint is not configured');
  const response = await rpc
    .getTokenAccountsByOwner(address(owner), { mint: address(env.sol.mint) }, { encoding: 'jsonParsed', commitment: 'confirmed' })
    .send();
  return response.value.reduce((sum, entry) => sum + readAmount(entry), 0n);
}
