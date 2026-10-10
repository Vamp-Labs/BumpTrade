import type { Address, Hex } from "viem";

export const JOIN_INTENT_TYPES = {
  JoinIntent: [
    { name: "matchId", type: "bytes32" },
    { name: "player", type: "address" },
    { name: "sessionKey", type: "address" },
    { name: "vehicleId", type: "uint8" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const JOIN_INTENT_TYPE_STRING =
  "JoinIntent(bytes32 matchId,address player,address sessionKey,uint8 vehicleId,uint256 deadline)";

export interface JoinIntentWire {
  matchId: Hex;
  player: Address;
  sessionKey: Address;
  vehicleId: number;
  deadline: string;
}

export interface JoinIntentTyped {
  matchId: Hex;
  player: Address;
  sessionKey: Address;
  vehicleId: number;
  deadline: bigint;
}

export const toTypedJoinIntent = (wire: JoinIntentWire): JoinIntentTyped => ({
  matchId: wire.matchId,
  player: wire.player,
  sessionKey: wire.sessionKey,
  vehicleId: wire.vehicleId,
  deadline: BigInt(wire.deadline),
});
