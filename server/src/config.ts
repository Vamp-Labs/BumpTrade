import type { ChainId } from "@bump/shared";
import type { Address } from "viem";
import { isAddress } from "viem";

export const PUBLIC_RPC_URL = "https://rpc.testnet.chain.robinhood.com";

export interface EvmChainConfig {
  rpcUrl: string;
  wssUrl: string | null;
  arenaAddress: Address;
  signerPrivateKey: `0x${string}`;
  relayerPrivateKey: `0x${string}`;
  tokenAddress: Address | null;
}

export interface ServerConfig {
  chain: ChainId;
  port: number;
  evm: EvmChainConfig | null;
  stakeAmount: bigint;
  relayerMinBalance: bigint;
  corsOrigins: string[];
  limits: LimitConfig;
  startBalance: number;
  minPlayers: number;
  maxPlayers: number;
  matchDurationS: number;
  joinWindowS: number;
  fillTimerS: number;
  replayDir: string;
  serverBuild: string;
}

export interface LimitConfig {
  faucetPerIpPerHour: number;
  faucetGlobalPerHour: number;
  joinPerIpPerHour: number;
}

export type Env = Record<string, string | undefined>;

const CHAIN_VARIABLES = [
  "ARENA_ADDRESS",
  "SIGNER_PRIVATE_KEY",
  "RELAYER_PRIVATE_KEY",
] as const;

const readInt = (
  env: Env,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number => {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer in [${min}, ${max}]`);
  }
  return value;
};

const readBigInt = (env: Env, name: string, fallback: string): bigint => {
  const raw = env[name];
  try {
    return BigInt(raw !== undefined && raw !== "" ? raw : fallback);
  } catch {
    throw new Error(`${name} must be an integer string`);
  }
};

const parseOrigins = (raw: string | undefined): string[] => {
  const origins = (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");
  return origins.length > 0 ? origins : ["http://localhost:5173"];
};

const readKey = (env: Env, name: string): `0x${string}` => {
  const raw = env[name] ?? "";
  const prefixed = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) {
    throw new Error(`${name} must be a 32-byte hex string`);
  }
  return prefixed as `0x${string}`;
};

const readChain = (env: Env): ChainId => {
  const raw = env.CHAIN === undefined || env.CHAIN === "" ? "solana" : env.CHAIN;
  if (raw !== "evm" && raw !== "solana") {
    throw new Error('CHAIN must be "evm" or "solana"');
  }
  return raw;
};

export const loadConfig = (env: Env): ServerConfig => {
  const chain = readChain(env);
  if (chain === "solana") {
    throw new Error(
      "CHAIN=solana is not available yet: the Solana adapter lands in phase B. Set CHAIN=evm to run the Robinhood Chain server.",
    );
  }
  const missing = CHAIN_VARIABLES.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `missing required environment variables: ${missing.join(", ")}`,
    );
  }

  const arena = env.ARENA_ADDRESS ?? "";
  if (!isAddress(arena)) {
    throw new Error("ARENA_ADDRESS must be an address");
  }

  const minPlayers = readInt(env, "MIN_PLAYERS", 2, 2, 8);
  const maxPlayers = readInt(env, "MAX_PLAYERS", 8, minPlayers, 8);

  const stakeAmount = readBigInt(env, "STAKE_AMOUNT", "100000000000000000000");
  if (stakeAmount <= 0n) throw new Error("STAKE_AMOUNT must be positive");
  const relayerMinBalance = readBigInt(
    env,
    "RELAYER_MIN_BALANCE_WEI",
    "2000000000000000",
  );

  const token = env.TOKEN_ADDRESS ?? "";
  if (token !== "" && !isAddress(token)) {
    throw new Error("TOKEN_ADDRESS must be an address");
  }

  return {
    chain,
    port: readInt(env, "PORT", 2567, 1, 65535),
    evm: {
      rpcUrl:
        env.RH_RPC_URL && env.RH_RPC_URL !== ""
          ? env.RH_RPC_URL
          : PUBLIC_RPC_URL,
      wssUrl: env.RH_WSS_URL && env.RH_WSS_URL !== "" ? env.RH_WSS_URL : null,
      arenaAddress: arena,
      signerPrivateKey: readKey(env, "SIGNER_PRIVATE_KEY"),
      relayerPrivateKey: readKey(env, "RELAYER_PRIVATE_KEY"),
      tokenAddress: token === "" ? null : (token as Address),
    },
    stakeAmount,
    relayerMinBalance,
    corsOrigins: parseOrigins(env.CORS_ORIGINS),
    limits: {
      faucetPerIpPerHour: readInt(env, "FAUCET_PER_IP_PER_HOUR", 5, 1, 100000),
      faucetGlobalPerHour: readInt(
        env,
        "FAUCET_GLOBAL_PER_HOUR",
        300,
        1,
        1000000,
      ),
      joinPerIpPerHour: readInt(env, "JOIN_PER_IP_PER_HOUR", 20, 1, 100000),
    },
    startBalance: readInt(env, "START_BALANCE", 100, 1, 1_000_000),
    minPlayers,
    maxPlayers,
    matchDurationS: readInt(env, "MATCH_DURATION_S", 90, 5, 3600),
    joinWindowS: readInt(env, "JOIN_WINDOW_S", 120, 5, 3600),
    fillTimerS: readInt(env, "FILL_TIMER_S", 30, 1, 600),
    replayDir:
      env.REPLAY_DIR && env.REPLAY_DIR !== "" ? env.REPLAY_DIR : "./replays",
    serverBuild:
      env.SERVER_BUILD && env.SERVER_BUILD !== "" ? env.SERVER_BUILD : "dev",
  };
};
