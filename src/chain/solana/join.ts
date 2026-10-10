import { PROGRAM_ID } from '@bump/sol-client';
import type { Hex32, ServerEvent } from '@bump/shared';
import { getCompiledTransactionMessageDecoder, getTransactionDecoder } from '@solana/kit';
import type { JoinContext } from '../port';
import { ServerJoinError } from '../serverError';
import { createSessionKey, loadSessionKey } from './sessionKey';
import { solWallet } from './wallet';

const PREPARE_TIMEOUT_MS = 15_000;
const CONFIRM_TIMEOUT_MS = 60_000;
const EXPIRY_MARGIN_MS = 1000;
const SEAT_CODES = new Set(['STALE_AUTH', 'SEAT_REJECTED', 'NOT_JOINED']);

type ErrorEvent = Extract<ServerEvent, { t: 'error' }>;

function isJoinError(event: ServerEvent): event is ErrorEvent {
  return event.t === 'error' && !SEAT_CODES.has(event.code);
}

function fail(event: ErrorEvent): never {
  throw new ServerJoinError(event.code, event.message, event.retryAfterS);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function assertJoinTransaction(wire: Uint8Array, player: string): void {
  const transaction = getTransactionDecoder().decode(wire);
  const message = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
  const accounts: readonly string[] = message.staticAccounts;
  if (!accounts.includes(player) || !accounts.includes(PROGRAM_ID)) {
    throw new ServerJoinError('TX_TAMPERED', 'The arena sent an unexpected transaction');
  }
}

async function attempt(ctx: JoinContext, player: string): Promise<void> {
  const key = loadSessionKey(ctx.matchId) ?? createSessionKey(ctx.matchId);
  const prepared = ctx.net.awaitEvent(
    (event) => (event.t === 'solJoinTx' && event.matchId === ctx.matchId) || isJoinError(event) ? 'take' : 'ignore',
    PREPARE_TIMEOUT_MS
  );
  void prepared.catch(() => undefined);
  ctx.net.sendSolJoinPrepare({ matchId: ctx.matchId as Hex32, player, sessionKey: key.publicId, vehicleId: ctx.vehicleId });
  const reply = await prepared;
  if (reply.t === 'error') fail(reply);
  if (reply.t !== 'solJoinTx') throw new Error('Unexpected arena reply');
  if (Date.now() >= reply.expiresAt - EXPIRY_MARGIN_MS) throw new ServerJoinError('TX_EXPIRED', 'Transaction expired');

  const wire = fromBase64(reply.tx);
  assertJoinTransaction(wire, player);
  const signed = await solWallet.signTransaction(wire);
  if (Date.now() >= reply.expiresAt) throw new ServerJoinError('TX_EXPIRED', 'Transaction expired');

  const confirmed = ctx.net.awaitEvent((event) => {
    if (event.t === 'joinResult' && event.wallet === player) return 'see';
    return isJoinError(event) ? 'take' : 'ignore';
  }, CONFIRM_TIMEOUT_MS);
  void confirmed.catch(() => undefined);
  ctx.net.sendSolJoinSubmit({ matchId: ctx.matchId as Hex32, signedTx: toBase64(signed) });
  ctx.onSigned?.();
  const result = await confirmed;
  if (result.t === 'error') fail(result);
}

export async function joinSolana(ctx: JoinContext): Promise<void> {
  const player = solWallet.getState().address;
  if (!player || !solWallet.isReady()) throw new Error('Connect your wallet first');
  try {
    await attempt(ctx, player);
  } catch (error) {
    if (!(error instanceof ServerJoinError) || error.code !== 'TX_EXPIRED') throw error;
    await attempt(ctx, player);
  }
}
