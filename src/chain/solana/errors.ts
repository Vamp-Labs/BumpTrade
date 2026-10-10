import { describeServerCode, ServerJoinError } from '../serverError';
import type { ChainErrorInfo } from '../port';

const REJECTED = /reject|denied|declin|cancel|user closed|4001/i;

function readCode(error: unknown): number | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'number' ? code : null;
}

export function describeSolError(error: unknown): ChainErrorInfo {
  if (error instanceof ServerJoinError) {
    return { kind: 'other', message: describeServerCode(error.code, error.message, error.retryAfterS), code: error.code };
  }
  const message = error instanceof Error ? error.message : '';
  if (readCode(error) === 4001 || REJECTED.test(message)) return { kind: 'rejected', message: 'Signature rejected in wallet' };
  if (/network|fetch|timeout|timed out|failed to fetch/i.test(message)) return { kind: 'network', message: 'Network error, try again' };
  return { kind: 'other', message: message || 'Unknown error' };
}
