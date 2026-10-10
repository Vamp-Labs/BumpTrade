import { createConfig } from "ponder";
import type { Address } from "viem";
import { bumpArenaAbi, deployments } from "@bump/contracts";

const arenaAddress = (process.env.ARENA_ADDRESS ||
  deployments.BumpArena.address) as Address;

const startBlock = process.env.ARENA_START_BLOCK
  ? Number(process.env.ARENA_START_BLOCK)
  : deployments.BumpArena.blockNumber;

const wsUrl = process.env.PONDER_WS_URL_46630;

export default createConfig({
  chains: {
    robinhoodTestnet: {
      id: 46630,
      rpc:
        process.env.PONDER_RPC_URL_46630 ??
        "https://rpc.testnet.chain.robinhood.com",
      ...(wsUrl ? { ws: wsUrl } : {}),
    },
  },
  contracts: {
    BumpArena: {
      abi: bumpArenaAbi,
      chain: "robinhoodTestnet",
      address: arenaAddress,
      startBlock,
    },
  },
});
