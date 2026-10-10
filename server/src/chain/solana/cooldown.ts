export const FAUCET_COOLDOWN_S = 24 * 60 * 60;

export interface FaucetCooldown {
  nextClaimAt(wallet: string): Promise<number>;
  markClaimed(wallet: string, at: number): Promise<void>;
}

export class MemoryFaucetCooldown implements FaucetCooldown {
  private readonly claimed = new Map<string, number>();

  async nextClaimAt(wallet: string): Promise<number> {
    const at = this.claimed.get(wallet);
    return at === undefined ? 0 : at + FAUCET_COOLDOWN_S;
  }

  async markClaimed(wallet: string, at: number): Promise<void> {
    this.claimed.set(wallet, at);
  }
}
