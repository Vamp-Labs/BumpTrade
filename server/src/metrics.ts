const WINDOW = 600;

export interface RoomMetricsSnapshot {
  roomId: string;
  phase: number;
  ticks: number;
  tickMsP50: number;
  tickMsP99: number;
  tickMsMax: number;
}

export class RoomMetrics {
  private readonly samples = new Float64Array(WINDOW);
  private count = 0;
  private total = 0;

  constructor(
    readonly roomId: string,
    private readonly phase: () => number,
  ) {}

  record(ms: number): void {
    this.samples[this.total % WINDOW] = ms;
    this.total += 1;
    this.count = Math.min(this.count + 1, WINDOW);
  }

  snapshot(): RoomMetricsSnapshot {
    const sorted = Array.from(this.samples.subarray(0, this.count)).sort(
      (a, b) => a - b,
    );
    const at = (q: number): number =>
      sorted.length === 0
        ? 0
        : (sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ??
          0);
    return {
      roomId: this.roomId,
      phase: this.phase(),
      ticks: this.total,
      tickMsP50: at(0.5),
      tickMsP99: at(0.99),
      tickMsMax: sorted[sorted.length - 1] ?? 0,
    };
  }
}

export class Metrics {
  private readonly rooms = new Map<string, RoomMetrics>();
  private readonly settlementLagsMs: number[] = [];

  register(metrics: RoomMetrics): void {
    this.rooms.set(metrics.roomId, metrics);
  }

  unregister(roomId: string): void {
    this.rooms.delete(roomId);
  }

  recordSettlementLag(ms: number): void {
    this.settlementLagsMs.push(ms);
    if (this.settlementLagsMs.length > 100) this.settlementLagsMs.shift();
  }

  snapshot() {
    return {
      rooms: Array.from(this.rooms.values()).map((room) => room.snapshot()),
      settlementLagMs: this.settlementLagsMs.slice(),
      bytesOutPerSecond: null,
      rttMs: null,
    };
  }
}
