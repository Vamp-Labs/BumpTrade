import type { ChainGateway } from "../chain/ChainGateway";

export class RelayerGuard {
  private cached: { value: bigint; at: number } | null = null;

  constructor(
    private readonly chain: ChainGateway,
    readonly minBalanceWei: bigint,
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
    return (await this.balance()) < this.minBalanceWei;
  }

  invalidate(): void {
    this.cached = null;
  }
}
