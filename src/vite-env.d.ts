/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_GAME_SERVER_URL?: string;
  readonly VITE_INDEXER_URL?: string;
  readonly VITE_ARENA_ADDRESS?: string;
  readonly VITE_TOKEN_ADDRESS?: string;
  readonly VITE_EXPLORER_URL?: string;
  readonly VITE_ENABLE_EVM?: string;
  readonly VITE_CHAIN_DEFAULT?: string;
  readonly VITE_SOL_CLUSTER?: string;
  readonly VITE_SOL_RPC_URL?: string;
  readonly VITE_SOL_PROGRAM_ID?: string;
  readonly VITE_SOL_MINT?: string;
  readonly VITE_SOL_GAME_SERVER_URL?: string;
  readonly VITE_SOL_LEADERBOARD_URL?: string;
  readonly VITE_SOL_EXPLORER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
