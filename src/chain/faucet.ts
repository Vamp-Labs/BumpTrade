import type { Address } from 'viem';
import { env } from '../config/env';
import { readNextClaimAt } from './token';

export interface FaucetState {
  claiming: boolean;
  nextClaimAt: number;
  txHash: string | null;
  error: string | null;
}

type Listener = (state: FaucetState) => void;

const SERVER_ERROR_COPY: Record<string, string> = {
  COOLDOWN: 'Already claimed today',
  ClaimCooldown: 'Already claimed today',
  RATE_LIMITED: 'Too many requests from this network, try later',
  GLOBAL_LIMIT: 'Faucet is busy, try again later',
  RELAYER_LOW: 'Gas sponsor is low on funds, try again later',
  CHAIN_UNAVAILABLE: 'Chain unavailable, try again',
  CLAIM_FAILED: 'Claim failed, try again',
  INVALID_ADDRESS: 'Invalid wallet address',
  JOIN_MALFORMED: 'Join request was invalid, retry',
  BAD_SIGNATURE: 'Signature rejected, sign again',
  INTENT_EXPIRED: 'Signature expired, sign again',
  WRONG_MATCH: 'Match changed, retry',
  MATCH_CLOSED: 'Join window closed',
  INSUFFICIENT_BALANCE: 'Not enough BUMP to stake',
  JOIN_PENDING: 'Join already in progress',
  JOIN_FAILED: 'Join failed, try again',
  ROOM_FULL: 'Match is full',
  SEAT_REJECTED: 'Seat claim rejected',
  NOT_JOINED: 'This wallet has not joined yet',
};

export function describeServerCode(code: string, fallback: string, retryAfterS?: number): string {
  const copy = SERVER_ERROR_COPY[code];
  if (!copy) return /RELAYER/i.test(code) ? SERVER_ERROR_COPY.RELAYER_LOW! : fallback || 'Request failed';
  if (code === 'RATE_LIMITED' && retryAfterS && retryAfterS > 0) {
    return `${copy} (${Math.ceil(retryAfterS / 60)} min)`;
  }
  return copy;
}

function readNumber(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export class FaucetController {
  private state: FaucetState = { claiming: false, nextClaimAt: 0, txHash: null, error: null };
  private listeners = new Set<Listener>();
  private lastAddress: string | null = null;

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): FaucetState {
    return this.state;
  }

  private patch(next: Partial<FaucetState>): void {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener(this.state);
  }

  public secondsLeft(): number {
    return Math.max(0, Math.ceil(this.state.nextClaimAt - Date.now() / 1000));
  }

  public async refresh(address: Address): Promise<void> {
    if (this.lastAddress !== address.toLowerCase()) {
      this.lastAddress = address.toLowerCase();
      this.patch({ nextClaimAt: 0, txHash: null, error: null });
    }
    try {
      const nextClaimAt = await this.fetchNextClaimAt(address);
      if (this.lastAddress === address.toLowerCase()) this.patch({ nextClaimAt });
    } catch {
      return;
    }
  }

  private async fetchNextClaimAt(address: Address): Promise<number> {
    try {
      const response = await fetch(`${env.gameServerHttpUrl}/faucet/status?wallet=${address}`);
      if (response.ok) {
        const body = asRecord(await response.json());
        if (typeof body.nextClaimAt === 'number') return body.nextClaimAt;
      }
    } catch {
      return readNextClaimAt(address);
    }
    return readNextClaimAt(address);
  }

  public async claim(address: Address): Promise<boolean> {
    if (this.state.claiming) return false;
    this.patch({ claiming: true, error: null, txHash: null });
    try {
      const response = await fetch(`${env.gameServerHttpUrl}/faucet`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: address }),
      });
      let body: Record<string, unknown> = {};
      try {
        body = asRecord(await response.json());
      } catch {
        body = {};
      }
      if (!response.ok) {
        const code = String(body.code ?? '');
        const message = String(body.message ?? '');
        const nextClaimAt = readNumber(body.nextClaimAt);
        this.patch({
          claiming: false,
          nextClaimAt: nextClaimAt || this.state.nextClaimAt,
          error: describeServerCode(code, message || `Faucet returned ${response.status}`, readNumber(body.retryAfterS)),
        });
        return false;
      }
      this.patch({
        claiming: false,
        nextClaimAt: readNumber(body.nextClaimAt),
        txHash: typeof body.txHash === 'string' ? body.txHash : null,
      });
      return true;
    } catch {
      this.patch({ claiming: false, error: 'Faucet unreachable, try again' });
      return false;
    }
  }
}

export const faucet = new FaucetController();

export function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
