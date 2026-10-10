import {
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { buildDomain, RESULT_TYPES } from "@bump/shared";
import { type Address, type Hex, hashTypedData, type LocalAccount } from "viem";
import {
  type ChainGateway,
  MatchStatus,
  type SettleResult,
} from "./ChainGateway";

export type SettleStatus = "submitted" | "confirmed" | "failed";

export interface SettleUpdate {
  status: SettleStatus;
  txHash?: Hex;
  error?: string;
}

export interface PendingSettlement {
  result: SettleResult;
  signature: Hex;
}

interface PendingFile {
  matchId: Hex;
  players: Address[];
  finalBalances: number[];
  ranks: number[];
  inputLogHash: Hex;
  replayHash: Hex;
  endedAt: string;
  signature: Hex;
}

export interface SettlerOptions {
  chain: ChainGateway;
  account: LocalAccount;
  arenaAddress: Address;
  chainId: number;
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

  get signerAddress(): Address {
    return this.options.account.address;
  }

  typedData(result: SettleResult) {
    return {
      domain: buildDomain(this.options.arenaAddress, this.options.chainId),
      types: RESULT_TYPES,
      primaryType: "Result",
      message: result,
    } as const;
  }

  localDigest(result: SettleResult): Hex {
    return hashTypedData(this.typedData(result));
  }

  signResult(result: SettleResult): Promise<Hex> {
    return this.options.account.signTypedData(this.typedData(result));
  }

  async selfCheck(sample: SettleResult): Promise<void> {
    const onChain = await this.options.chain.hashResult(sample);
    const local = this.localDigest(sample);
    if (onChain.toLowerCase() !== local.toLowerCase()) {
      throw new Error("EIP-712 digest mismatch between server and contract");
    }
  }

  async persist(pending: PendingSettlement): Promise<void> {
    await mkdir(this.options.pendingDir, { recursive: true });
    const file: PendingFile = {
      matchId: pending.result.matchId,
      players: pending.result.players,
      finalBalances: pending.result.finalBalances,
      ranks: pending.result.ranks,
      inputLogHash: pending.result.inputLogHash,
      replayHash: pending.result.replayHash,
      endedAt: pending.result.endedAt.toString(),
      signature: pending.signature,
    };
    const target = this.pathFor(pending.result.matchId);
    await writeFile(`${target}.tmp`, JSON.stringify(file), "utf8");
    await rename(`${target}.tmp`, target);
  }

  async submit(
    pending: PendingSettlement,
    onUpdate: (update: SettleUpdate) => void,
  ): Promise<SettleStatus> {
    const matchId = pending.result.matchId;
    if (this.active.has(matchId)) return "submitted";
    this.active.add(matchId);
    try {
      await this.persist(pending);
      const status = await this.retryLoop(pending, onUpdate);
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
    onUpdate: (matchId: Hex, update: SettleUpdate) => void,
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
      const pending: PendingSettlement = {
        result: {
          matchId: file.matchId,
          players: file.players,
          finalBalances: file.finalBalances,
          ranks: file.ranks,
          inputLogHash: file.inputLogHash,
          replayHash: file.replayHash,
          endedAt: BigInt(file.endedAt),
        },
        signature: file.signature,
      };
      resumed += 1;
      void this.submit(pending, (update) => onUpdate(file.matchId, update));
    }
    return resumed;
  }

  private async retryLoop(
    pending: PendingSettlement,
    onUpdate: (update: SettleUpdate) => void,
  ): Promise<SettleStatus> {
    const { result, signature } = pending;
    let delay = this.backoffMs;
    let lastError = "unknown";
    let lastHash: Hex | undefined;

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
          const hash = await this.options.chain.settle(
            result,
            signature,
            (submitted) => {
              lastHash = submitted;
              onUpdate({ status: "submitted", txHash: submitted });
            },
          );
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

  private pathFor(matchId: Hex): string {
    return join(this.options.pendingDir, `${matchId}.json`);
  }

  private async remove(matchId: Hex): Promise<void> {
    try {
      await unlink(this.pathFor(matchId));
    } catch {
      return;
    }
  }

  private async archiveFailed(matchId: Hex): Promise<void> {
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
