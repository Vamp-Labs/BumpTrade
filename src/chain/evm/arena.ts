import { bumpArenaAbi } from '@bump/contracts';
import type { Address, Hex } from 'viem';
import { env } from '../config/env';
import { publicClient } from './clients';

export type MatchStatus = 'none' | 'open' | 'started' | 'settled' | 'cancelled' | 'refunding';

const STATUS_BY_INDEX: MatchStatus[] = ['none', 'open', 'started', 'settled', 'cancelled', 'refunding'];

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

function requireArena(): Address {
  if (!env.arenaAddress) throw new Error('Arena contract is not deployed yet');
  return env.arenaAddress;
}

export function isArenaConfigured(): boolean {
  return env.arenaAddress !== null;
}

export async function readMatch(matchId: Hex): Promise<MatchSnapshot> {
  const view = await publicClient.readContract({
    address: requireArena(),
    abi: bumpArenaAbi,
    functionName: 'getMatch',
    args: [matchId],
  });
  return {
    stake: view.stake,
    startBalance: Number(view.startBalance),
    maxPlayers: Number(view.maxPlayers),
    playerCount: Number(view.playerCount),
    status: STATUS_BY_INDEX[Number(view.status)] ?? 'none',
    joinDeadline: Number(view.joinDeadline),
    settleDeadline: Number(view.settleDeadline),
    pot: view.pot,
  };
}

export async function readSessionKeyOf(matchId: Hex, player: Address): Promise<Address> {
  return publicClient.readContract({
    address: requireArena(),
    abi: bumpArenaAbi,
    functionName: 'sessionKeyOf',
    args: [matchId, player],
  });
}
