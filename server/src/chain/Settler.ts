import {
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import type { ChainResult, Hex32, TxRef, WalletId } from "@bump/shared";
import { type ArenaChain, MatchStatus } from "./ArenaChain";

export type SettleStatus = "submitted" | "confirmed" | "failed";

export interface SettleUpdate {
  status: SettleStatus;
  txHash?: TxRef;
  error?: string;
}

interface PendingFile {
  matchId: Hex32;
  players: WalletId[];
  finalBalances: number[];
  ranks: number[];
  inputLogHash: Hex32;
  replayHash: Hex32;
  endedAt: string;
}

export interface SettlerOptions {
  chain: ArenaChain;
  pendingDir: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  backoffMs?: number;
  maxBackoffMs?: number;
  log?: (line: Record<string, unknown>) => void;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class Settler {
  private readonly active = new Set<string>();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly backoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly log: (line: Record<string, unknown>) => void;

  constructor(private readonly options: SettlerOptions) {
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
    this.backoffMs = options.backoffMs ?? 1000;
    this.maxBackoffMs = options.maxBackoffMs ?? 15_000;
    this.log = options.log ?? (() => undefined);
  }

  async persist(result: ChainResult): Promise<void> {
    await mkdir(this.options.pendingDir, { recursive: true });
    const file: PendingFile = {
      matchId: result.matchId,
      players: result.players,
      finalBalances: result.finalBalances,
      ranks: result.ranks,
      inputLogHash: result.inputLogHash,
      replayHash: result.replayHash,
      endedAt: result.endedAt.toString(),
    };
    const target = this.pathFor(result.matchId);
    await writeFile(`${target}.tmp`, JSON.stringify(file), "utf8");
    await rename(`${target}.tmp`, target);
  }

  async submit(
    result: ChainResult,
    onUpdate: (update: SettleUpdate) => void,
  ): Promise<SettleStatus> {
    const matchId = result.matchId;
    if (this.active.has(matchId)) return "submitted";
    this.active.add(matchId);
    try {
      await this.persist(result);
      const status = await this.retryLoop(result, onUpdate);
      if (status === "confirmed") {
        await this.remove(matchId);
      } else {
        await this.archiveFailed(matchId);
      }
      return status;
    } finally {
      this.active.delete(matchId);
    }
  }

  async resumePending(
    onUpdate: (matchId: Hex32, update: SettleUpdate) => void,
  ): Promise<number> {
    let names: string[];
    try {
      names = await readdir(this.options.pendingDir);
    } catch {
      return 0;
    }
    let resumed = 0;
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const raw = await readFile(join(this.options.pendingDir, name), "utf8");
      const file = JSON.parse(raw) as PendingFile;
      const result: ChainResult = {
        matchId: file.matchId,
        players: file.players,
        finalBalances: file.finalBalances,
        ranks: file.ranks,
        inputLogHash: file.inputLogHash,
        replayHash: file.replayHash,
        endedAt: BigInt(file.endedAt),
      };
      resumed += 1;
      void this.submit(result, (update) => onUpdate(file.matchId, update));
    }
    return resumed;
  }

  private async retryLoop(
    result: ChainResult,
    onUpdate: (update: SettleUpdate) => void,
  ): Promise<SettleStatus> {
    let delay = this.backoffMs;
    let lastError = "unknown";
    let lastHash: TxRef | undefined;

    for (;;) {
      let deadline: bigint | null = null;
      try {
        const view = await this.options.chain.getMatch(result.matchId);
        if (view.status === MatchStatus.Settled) {
          onUpdate({ status: "confirmed", txHash: lastHash });
          return "confirmed";
        }
        if (
          view.status === MatchStatus.Cancelled ||
          view.status === MatchStatus.Refunding
        ) {
          lastError = `match is not settleable (status ${view.status})`;
          onUpdate({ status: "failed", error: lastError });
          return "failed";
        }
        deadline = view.settleDeadline;
      } catch (error) {
        lastError = errorMessage(error);
      }

      if (
        deadline !== null &&
        BigInt(Math.floor(this.now() / 1000)) > deadline
      ) {
        onUpdate({ status: "failed", error: "settle deadline passed" });
        return "failed";
      }

      if (deadline !== null) {
        try {
          const hash = await this.options.chain.settle(result, (submitted) => {
            lastHash = submitted;
            onUpdate({ status: "submitted", txHash: submitted });
          });
          onUpdate({ status: "confirmed", txHash: hash });
          return "confirmed";
        } catch (error) {
          lastError = errorMessage(error);
          this.log({
            evt: "settle_retry",
            matchId: result.matchId,
            error: lastError,
            delayMs: delay,
          });
        }
      }

      await this.sleep(delay);
      delay = Math.min(delay * 2, this.maxBackoffMs);
    }
  }

  private pathFor(matchId: Hex32): string {
    return join(this.options.pendingDir, `${matchId}.json`);
  }

  private async remove(matchId: Hex32): Promise<void> {
    try {
      await unlink(this.pathFor(matchId));
    } catch {
      return;
    }
  }

  private async archiveFailed(matchId: Hex32): Promise<void> {
    try {
      await rename(
        this.pathFor(matchId),
        join(this.options.pendingDir, `${matchId}.failed`),
      );
    } catch {
      return;
    }
  }
}

const errorMessage = (error: unknown): string => {
  if (error instanceof Error)
    return error.message.split("\n")[0] ?? error.message;
  return String(error);
};
