import type { ArenaChain } from "../chain/ArenaChain";

export class RelayerGuard {
  private cached: { value: bigint; at: number } | null = null;

  constructor(
    private readonly chain: ArenaChain,
    readonly minBalance: bigint,
    private readonly now: () => number,
    private readonly ttlMs = 5_000,
  ) {}

  async balance(): Promise<bigint> {
    if (this.cached && this.now() - this.cached.at < this.ttlMs) {
      return this.cached.value;
    }
    const value = await this.chain.relayerBalance();
    this.cached = { value, at: this.now() };
    return value;
  }

  async isLow(): Promise<boolean> {
    return (await this.balance()) < this.minBalance;
  }

  invalidate(): void {
    this.cached = null;
  }
}
