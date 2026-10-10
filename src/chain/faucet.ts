import { walletKey } from './format';
import { getActiveChain } from './port';
import { describeServerCode } from './serverError';

export interface FaucetState {
  claiming: boolean;
  nextClaimAt: number;
  txHash: string | null;
  error: string | null;
}

type Listener = (state: FaucetState) => void;

export { describeServerCode };

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

  private scopeOf(address: string): string {
    return `${getActiveChain().id}:${walletKey(address)}`;
  }

  public async refresh(address: string): Promise<void> {
    const scope = this.scopeOf(address);
    if (this.lastAddress !== scope) {
      this.lastAddress = scope;
      this.patch({ nextClaimAt: 0, txHash: null, error: null });
    }
    try {
      const nextClaimAt = await this.fetchNextClaimAt(address);
      if (this.lastAddress === scope) this.patch({ nextClaimAt });
    } catch {
      return;
    }
  }

  private async fetchNextClaimAt(address: string): Promise<number> {
    const chain = getActiveChain();
    try {
      const response = await fetch(`${chain.gameServerHttpUrl}/faucet/status?wallet=${address}`);
      if (response.ok) {
        const body = asRecord(await response.json());
        if (typeof body.nextClaimAt === 'number') return body.nextClaimAt;
      }
    } catch {
      return chain.nextClaimAtFallback(address);
    }
    return chain.nextClaimAtFallback(address);
  }

  public async claim(address: string): Promise<boolean> {
    if (this.state.claiming) return false;
    this.patch({ claiming: true, error: null, txHash: null });
    try {
      const response = await fetch(`${getActiveChain().gameServerHttpUrl}/faucet`, {
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
