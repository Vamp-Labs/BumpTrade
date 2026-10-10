import type { ChainGateway } from "../chain/ChainGateway";
import type { RefundKeeper } from "../chain/RefundKeeper";
import type { Settler } from "../chain/Settler";
import type { ServerConfig } from "../config";
import type { Metrics } from "../metrics";
import type { Faucet } from "../relay/Faucet";
import type { JoinRelay } from "../relay/JoinRelay";
import type { RelayerGuard } from "../relay/RelayerGuard";

export interface RoomContext {
  config: ServerConfig;
  chain: ChainGateway;
  settler: Settler;
  log: (line: Record<string, unknown>) => void;
  now: () => number;
  stats: { rooms: number };
  metrics: Metrics;
  guard: RelayerGuard;
  joinRelay: JoinRelay;
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
