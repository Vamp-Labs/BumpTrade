import type { ChainId } from "@bump/shared";
import { deployments } from "@bump/sol-client";
import { getBase58Encoder, isAddress as isSolAddress } from "@solana/kit";
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

export interface SolanaChainConfig {
  cluster: string;
  rpcUrl: string;
  wsUrl: string | null;
  programId: string;
  mint: string;
  treasury: string;
  relayerSecret: Uint8Array;
  resultSignerSecret: Uint8Array;
  mintAuthoritySecret: Uint8Array;
}

export interface ServerConfig {
  chain: ChainId;
  port: number;
  evm: EvmChainConfig | null;
  solana: SolanaChainConfig | null;
  databaseUrl: string | null;
  databaseSchema: string;
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

const DEFAULT_SOL_RPC_URL = "https://api.devnet.solana.com";
const SOLANA_VARIABLES = [
  "SOL_RELAYER_SECRET",
  "SOL_RESULT_SIGNER_SECRET",
  "SOL_MINT_AUTHORITY_SECRET",
] as const;

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

const readSecret = (env: Env, name: string): Uint8Array => {
  const raw = (env[name] ?? "").trim();
  let bytes: Uint8Array | null = null;
  try {
    bytes = getBase58Encoder().encode(raw) as Uint8Array;
  } catch {
    bytes = null;
  }
  if (bytes === null || bytes.length !== 64) {
    throw new Error(`${name} must be a base58 64-byte secret key`);
  }
  return bytes;
};

const readSolAddress = (
  env: Env,
  name: string,
  fallback: string | null,
): string => {
  const raw = env[name] && env[name] !== "" ? env[name] : fallback;
  if (!raw) throw new Error(`${name} is required`);
  if (!isSolAddress(raw)) throw new Error(`${name} must be a Solana address`);
  return raw;
};

const readChain = (env: Env): ChainId => {
  const raw = env.CHAIN === undefined || env.CHAIN === "" ? "solana" : env.CHAIN;
  if (raw !== "evm" && raw !== "solana") {
    throw new Error('CHAIN must be "evm" or "solana"');
  }
  return raw;
};

const loadCommon = (env: Env, defaultStake: string) => {
  const minPlayers = readInt(env, "MIN_PLAYERS", 2, 2, 8);
  const maxPlayers = readInt(env, "MAX_PLAYERS", 8, minPlayers, 8);
  const stakeAmount = readBigInt(env, "STAKE_AMOUNT", defaultStake);
  if (stakeAmount <= 0n) throw new Error("STAKE_AMOUNT must be positive");
  return {
    port: readInt(env, "PORT", 2567, 1, 65535),
    stakeAmount,
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
    databaseUrl:
      env.DATABASE_URL && env.DATABASE_URL !== "" ? env.DATABASE_URL : null,
    databaseSchema:
      env.DATABASE_SCHEMA && env.DATABASE_SCHEMA !== ""
        ? env.DATABASE_SCHEMA
        : "bump_sol",
  };
};

const loadSolana = (env: Env): ServerConfig => {
  const missing = SOLANA_VARIABLES.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `missing required environment variables: ${missing.join(", ")}`,
    );
  }
  const relayerMinBalance = readBigInt(env, "RELAYER_MIN_BALANCE", "50000000");
  const deployed = deployments.pending ? null : deployments;
  return {
    ...loadCommon(env, "100000000000"),
    chain: "solana",
    evm: null,
    solana: {
      cluster:
        env.SOL_CLUSTER && env.SOL_CLUSTER !== "" ? env.SOL_CLUSTER : "devnet",
      rpcUrl:
        env.SOL_RPC_URL && env.SOL_RPC_URL !== ""
          ? env.SOL_RPC_URL
          : DEFAULT_SOL_RPC_URL,
      wsUrl: env.SOL_WS_URL && env.SOL_WS_URL !== "" ? env.SOL_WS_URL : null,
      programId: readSolAddress(env, "SOL_PROGRAM_ID", deployments.programId),
      mint: readSolAddress(env, "SOL_MINT", deployed?.mint ?? null),
      treasury: readSolAddress(env, "SOL_TREASURY", deployed?.treasury ?? null),
      relayerSecret: readSecret(env, "SOL_RELAYER_SECRET"),
      resultSignerSecret: readSecret(env, "SOL_RESULT_SIGNER_SECRET"),
      mintAuthoritySecret: readSecret(env, "SOL_MINT_AUTHORITY_SECRET"),
    },
    relayerMinBalance,
  };
};

export const loadConfig = (env: Env): ServerConfig => {
  const chain = readChain(env);
  if (chain === "solana") return loadSolana(env);
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
    ...loadCommon(env, "100000000000000000000"),
    chain,
    solana: null,
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
    relayerMinBalance,
  };
};
