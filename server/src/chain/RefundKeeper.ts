import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Hex } from "viem";
import { type ChainGateway, MatchStatus } from "./ChainGateway";

interface TrackedFile {
  matchId: Hex;
  settleDeadline: string;
}

export interface RefundKeeperOptions {
  chain: ChainGateway;
  dir: string;
  now: () => number;
  log: (line: Record<string, unknown>) => void;
  minPlayers: number;
  intervalMs?: number;
}

export class RefundKeeper {
  private readonly tracked = new Map<Hex, bigint>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly options: RefundKeeperOptions) {}

  get size(): number {
    return this.tracked.size;
  }

  async load(): Promise<number> {
    let names: string[];
    try {
      names = await readdir(this.options.dir);
    } catch {
      return 0;
    }
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      try {
        const file = JSON.parse(
          await readFile(join(this.options.dir, name), "utf8"),
        ) as TrackedFile;
        this.tracked.set(file.matchId, BigInt(file.settleDeadline));
      } catch (error) {
        this.options.log({
          evt: "keeper_load_failed",
          name,
          error: String(error),
        });
      }
    }
    return this.tracked.size;
  }

  async track(matchId: Hex, settleDeadline: bigint): Promise<void> {
    this.tracked.set(matchId, settleDeadline);
    try {
      await mkdir(this.options.dir, { recursive: true });
      const file: TrackedFile = {
        matchId,
        settleDeadline: settleDeadline.toString(),
      };
      await writeFile(this.path(matchId), JSON.stringify(file), "utf8");
    } catch (error) {
      this.options.log({ evt: "keeper_track_failed", error: String(error) });
    }
  }

  async forget(matchId: Hex): Promise<void> {
    this.tracked.delete(matchId);
    try {
      await unlink(this.path(matchId));
    } catch {
      return;
    }
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.sweep();
    }, this.options.intervalMs ?? 60_000);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const matchId of Array.from(this.tracked.keys())) {
        await this.process(matchId);
      }
    } finally {
      this.running = false;
    }
  }

  private async process(matchId: Hex): Promise<void> {
    const { chain, now, log } = this.options;
    try {
      const view = await chain.getMatch(matchId);
      const nowS = BigInt(Math.floor(now() / 1000));
      if (
        view.status === MatchStatus.None ||
        view.status === MatchStatus.Settled ||
        view.status === MatchStatus.Cancelled
      ) {
        await this.forget(matchId);
        return;
      }
      if (
        view.status === MatchStatus.Open &&
        nowS > view.joinDeadline &&
        view.playerCount < this.options.minPlayers
      ) {
        const hash = await chain.cancel(matchId);
        log({ evt: "keeper_cancel", matchId, txHash: hash });
        await this.forget(matchId);
        return;
      }
      if (nowS <= view.settleDeadline) return;

      const players = await chain.getPlayers(matchId);
      let pending = 0;
      for (const player of players) {
        try {
          const hash = await chain.claimRefund(matchId, player);
          log({ evt: "keeper_refund", matchId, player, txHash: hash });
        } catch (error) {
          if (String(error).includes("AlreadyRefunded")) continue;
          pending += 1;
          log({
            evt: "keeper_refund_failed",
            matchId,
            player,
            error: String(error).split("\n")[0],
          });
        }
      }
      if (pending === 0) await this.forget(matchId);
    } catch (error) {
      log({
        evt: "keeper_failed",
        matchId,
        error: String(error).split("\n")[0],
      });
    }
  }

  private path(matchId: Hex): string {
    return join(this.options.dir, `${matchId}.json`);
  }
}
