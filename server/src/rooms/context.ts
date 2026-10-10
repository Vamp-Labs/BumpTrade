import type { ArenaChain } from "../chain/ArenaChain";
import type { RefundKeeper } from "../chain/RefundKeeper";
import type { Settler } from "../chain/Settler";
import type { Leaderboard } from "../leaderboard";
import type { ServerConfig } from "../config";
import type { Metrics } from "../metrics";
import type { Faucet } from "../relay/Faucet";
import type { JoinRelay } from "../relay/JoinRelay";
import type { SolanaJoinRelay } from "../relay/SolanaJoinRelay";
import type { RelayerGuard } from "../relay/RelayerGuard";

export interface RoomContext {
  config: ServerConfig;
  chain: ArenaChain;
  settler: Settler;
  log: (line: Record<string, unknown>) => void;
  now: () => number;
  stats: { rooms: number };
  metrics: Metrics;
  guard: RelayerGuard;
  joinRelay?: JoinRelay | null;
  solJoin?: SolanaJoinRelay | null;
  leaderboard?: Leaderboard | null;
  faucet: Faucet;
  keeper: RefundKeeper;
  receiptRetryDelayMs: number;
}

let current: RoomContext | null = null;

export const setRoomContext = (context: RoomContext): void => {
  current = context;
};

export const getRoomContext = (): RoomContext => {
  if (!current) throw new Error("room context not initialised");
  return current;
};
