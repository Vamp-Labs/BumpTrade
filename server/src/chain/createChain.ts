import type { JoinProtocol } from "../relay/JoinRelay";
import type { ServerConfig } from "../config";
import type { ArenaChain } from "./ArenaChain";
import { EvmArenaChain, EvmJoinProtocol } from "./evm";

export interface ChainRuntime {
  chain: ArenaChain;
  joinProtocol: JoinProtocol;
}

export const createChain = (config: ServerConfig): ChainRuntime => {
  if (config.chain === "evm" && config.evm) {
    const chain = new EvmArenaChain({
      rpcUrl: config.evm.rpcUrl,
      wssUrl: config.evm.wssUrl,
      arenaAddress: config.evm.arenaAddress,
      tokenAddress: config.evm.tokenAddress,
      relayerPrivateKey: config.evm.relayerPrivateKey,
      signerPrivateKey: config.evm.signerPrivateKey,
    });
    return { chain, joinProtocol: new EvmJoinProtocol(chain) };
  }
  throw new Error(`chain adapter "${config.chain}" is not available yet`);
};
