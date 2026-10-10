export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number,
  ) {}

  private prune(key: string): number[] {
    const cutoff = this.now() - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((at) => at > cutoff);
    if (list.length === 0) this.hits.delete(key);
    else this.hits.set(key, list);
    return list;
  }

  retryAfterS(key: string): number {
    const list = this.prune(key);
    if (list.length < this.limit) return 0;
    const oldest = list[list.length - this.limit] ?? this.now();
    return Math.max(1, Math.ceil((oldest + this.windowMs - this.now()) / 1000));
  }

  record(key: string): void {
    const list = this.prune(key);
    list.push(this.now());
    this.hits.set(key, list);
  }

  tryConsume(key: string): number {
    const wait = this.retryAfterS(key);
    if (wait === 0) this.record(key);
    return wait;
  }

  sweep(): void {
    for (const key of Array.from(this.hits.keys())) this.prune(key);
  }
}
