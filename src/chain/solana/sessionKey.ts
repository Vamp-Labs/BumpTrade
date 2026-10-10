import { ed25519 } from '@noble/curves/ed25519';
import { getAddressDecoder, getBase58Decoder } from '@solana/kit';
import type { SessionKeyHandle } from '../port';

const PREFIX = 'bump.session.sol.';
const SEED_PATTERN = /^[0-9a-f]{64}$/;
const memory = new Map<string, Uint8Array>();
const addressDecoder = getAddressDecoder();
const signatureDecoder = getBase58Decoder();

function storageKey(matchId: string): string {
  return `${PREFIX}${matchId.toLowerCase()}`;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function handle(seed: Uint8Array): SessionKeyHandle {
  return {
    publicId: addressDecoder.decode(ed25519.getPublicKey(seed)),
    scheme: 'ed25519',
    signSeat: async (text) => signatureDecoder.decode(ed25519.sign(new TextEncoder().encode(text), seed)),
  };
}

export function createSessionKey(matchId: string): SessionKeyHandle {
  const seed = ed25519.utils.randomPrivateKey();
  memory.set(storageKey(matchId), seed);
  try {
    sessionStorage.setItem(storageKey(matchId), toHex(seed));
  } catch {
    return handle(seed);
  }
  return handle(seed);
}

export function loadSessionKey(matchId: string): SessionKeyHandle | null {
  const id = storageKey(matchId);
  const cached = memory.get(id);
  if (cached) return handle(cached);
  try {
    const stored = sessionStorage.getItem(id);
    if (stored && SEED_PATTERN.test(stored)) {
      const seed = fromHex(stored);
      memory.set(id, seed);
      return handle(seed);
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
