import type { Address, Hex } from "viem";

export const CHAIN_ID = 46630;

export const RESULT_TYPES = {
  Result: [
    { name: "matchId", type: "bytes32" },
    { name: "players", type: "address[]" },
    { name: "finalBalances", type: "uint32[]" },
    { name: "ranks", type: "uint8[]" },
    { name: "inputLogHash", type: "bytes32" },
    { name: "replayHash", type: "bytes32" },
    { name: "endedAt", type: "uint64" },
  ],
} as const;

export const RESULT_TYPE_STRING =
  "Result(bytes32 matchId,address[] players,uint32[] finalBalances,uint8[] ranks,bytes32 inputLogHash,bytes32 replayHash,uint64 endedAt)";

export const buildDomain = (
  verifyingContract: Address,
  chainId: number = CHAIN_ID,
) =>
  ({
    name: "BumpArena",
    version: "1",
    chainId,
    verifyingContract,
  }) as const;

export interface ResultMessage {
  matchId: Hex;
  players: Address[];
  finalBalances: number[];
  ranks: number[];
  inputLogHash: Hex;
  replayHash: Hex;
  endedAt: bigint;
}

export const computePayouts = (
  stakeWei: bigint,
  startBalance: number,
  finalBalances: readonly number[],
): { payouts: bigint[]; dust: bigint; pot: bigint } => {
  const pot = stakeWei * BigInt(finalBalances.length);
  const payouts = finalBalances.map(
    (balance) => (stakeWei * BigInt(balance)) / BigInt(startBalance),
  );
  const paid = payouts.reduce((sum, payout) => sum + payout, 0n);
  return { payouts, dust: pot - paid, pot };
};

export interface SeatMessageInput {
  matchId: Hex;
  wallet: string;
  roomId: string;
  issuedAt: number;
}

export const seatMessage = ({
  matchId,
  wallet,
  roomId,
  issuedAt,
}: SeatMessageInput): string =>
  [
    "BUMP.TRADE seat",
    `match: ${matchId.toLowerCase()}`,
    `wallet: ${wallet.toLowerCase()}`,
    `room: ${roomId}`,
    `issuedAt: ${issuedAt}`,
  ].join("\n");
