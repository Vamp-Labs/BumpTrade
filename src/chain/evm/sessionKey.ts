import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';

export interface SessionKey {
  readonly privateKey: Hex;
  readonly account: PrivateKeyAccount;
}

const PREFIX = 'bump.session.';
const KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const memory = new Map<string, SessionKey>();

function storageKey(matchId: string): string {
  return `${PREFIX}${matchId.toLowerCase()}`;
}

function fromPrivateKey(privateKey: Hex): SessionKey {
  return { privateKey, account: privateKeyToAccount(privateKey) };
}

function persist(matchId: string, privateKey: Hex): void {
  try {
    sessionStorage.setItem(storageKey(matchId), privateKey);
  } catch {
    return;
  }
}

export function createSessionKey(matchId: string): SessionKey {
  const key = fromPrivateKey(generatePrivateKey());
  memory.set(storageKey(matchId), key);
  persist(matchId, key.privateKey);
  return key;
}

export function loadSessionKey(matchId: string): SessionKey | null {
  const id = storageKey(matchId);
  const cached = memory.get(id);
  if (cached) return cached;
  try {
    const stored = sessionStorage.getItem(id);
    if (stored && KEY_PATTERN.test(stored)) {
      const key = fromPrivateKey(stored as Hex);
      memory.set(id, key);
      return key;
    }
  } catch {
    return null;
  }
  return null;
}

export function clearSessionKey(matchId: string): void {
  const id = storageKey(matchId);
  memory.delete(id);
  try {
    sessionStorage.removeItem(id);
  } catch {
    return;
  }
}
