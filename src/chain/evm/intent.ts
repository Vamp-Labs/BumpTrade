import { JOIN_INTENT_TYPES, buildDomain, type JoinIntentMessage } from '@bump/shared';
import type { Address, Hex, WalletClient } from 'viem';
import { env } from '../../config/env';
import { chain } from './clients';

export type SignedJoin = JoinIntentMessage;

const INTENT_TTL_S = 120;

export async function signJoinIntent(
  client: WalletClient,
  player: Address,
  matchId: Hex,
  sessionKey: Address,
  vehicleId: number,
  joinDeadline: number
): Promise<SignedJoin> {
  if (!env.arenaAddress) throw new Error('Arena contract is not deployed yet');
  const now = Math.floor(Date.now() / 1000);
  const capped = joinDeadline > now + 5 ? Math.min(now + INTENT_TTL_S, joinDeadline) : now + INTENT_TTL_S;
  const deadline = BigInt(capped);
  const signature = await client.signTypedData({
    account: player,
    domain: buildDomain(env.arenaAddress, chain.id),
    types: JOIN_INTENT_TYPES,
    primaryType: 'JoinIntent',
    message: { matchId, player, sessionKey, vehicleId, deadline },
  });
  return { intent: { matchId, player, sessionKey, vehicleId, deadline: deadline.toString() }, signature };
}
