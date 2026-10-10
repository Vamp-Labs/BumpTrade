import type { ServerConfig } from "../config";
import type { JoinProtocol } from "../relay/JoinRelay";
import type { ArenaChain } from "./ArenaChain";
import { EvmArenaChain, EvmJoinProtocol } from "./evm";
import type { FaucetCooldown } from "./solana/cooldown";
import { SolanaArenaChain } from "./solana/SolanaArenaChain";

export interface ChainRuntime {
  chain: ArenaChain;
  joinProtocol: JoinProtocol | null;
  solana: SolanaArenaChain | null;
}

export const createChain = async (
  config: ServerConfig,
  cooldown?: FaucetCooldown,
): Promise<ChainRuntime> => {
  if (config.chain === "evm" && config.evm) {
    const chain = new EvmArenaChain({
      rpcUrl: config.evm.rpcUrl,
      wssUrl: config.evm.wssUrl,
      arenaAddress: config.evm.arenaAddress,
      tokenAddress: config.evm.tokenAddress,
      relayerPrivateKey: config.evm.relayerPrivateKey,
      signerPrivateKey: config.evm.signerPrivateKey,
    });
    return { chain, joinProtocol: new EvmJoinProtocol(chain), solana: null };
  }
  if (config.chain === "solana" && config.solana) {
    const chain = await SolanaArenaChain.create(config.solana, {
      cooldown,
      expectedStake: config.stakeAmount,
    });
    return { chain, joinProtocol: null, solana: chain };
  }
  throw new Error(`chain adapter "${config.chain}" is not configured`);
};
