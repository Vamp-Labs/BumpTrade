# 04 — Indexer and ops engineer (R4)

**Goal:** two parts.
1. **Part A:** give the team a working pnpm workspace in which the other three roles can build in parallel without touching each other's files. This means git, `.gitignore`, the workspace, one install of every pinned dependency, shared tsconfig and lint, and an `.env.example`.
2. **Part B:** build the realtime **leaderboard and match-history indexer** for `BumpArena` on **Robinhood Chain testnet (46630)** with Ponder 0.18, then deploy the game server, indexer and Postgres on Railway (P1).

## Context — read first

1. `docs/handoffs/contracts.md`. It is **authoritative**: C1 (chain, public RPC limits), **C3 (events you index)**, C6 (lifecycle, used to derive match status), **C7 (the API you provide)**, **C8 (env names and `.env.example`)**, **C9 (layout, versions, ports)**.
2. `docs/research/repo-audit-and-tooling.md`:
   - **A7** (layout option A, ownership map);
   - **A8** (tooling gaps: no git, no `.gitignore`, `dist/` ships `.blend` files, no lint/test/CI, TS 7.0.2, pnpm 11 lockfile);
   - B (Railway skill and MCP already installed; do not run the `curl | sh` lines);
   - Implications → Indexer/ops.
3. `docs/research/realtime-architecture.md`:
   - F5 (viem watching, Arbitrum confirmation levels, the Ponder `{id, rpc, ws}` config, `reorgWindow`);
   - F6 (Railway: WebSockets stay open, there is no UDP);
   - Implications → Indexer/ops.
4. `docs/research/robinhood-chain.md`:
   - Network parameters;
   - §5 (the public RPC: `eth_getLogs` over a 100k-block range works, `eth_newBlockFilter` does not, no archive);
   - §8 (indexers: Goldsky supports testnet; The Graph and Envio do not);
   - §9 (testnet may be terminated);
   - Implications → Indexer/ops.
5. `docs/handoffs/00-overview.md`: §3 (D8, D9, D10, D17), §6 (dispatch order: **Part A runs first, alone**), §9 (the ownership table you enforce), §10, §12 (items needing the user).

## Tools — skills and MCP

- **`use-railway` skill and `railway` MCP.** Both are already installed at user scope. Invoke the skill before any Railway work: projects, services, variables, domains, logs. **Never run the `curl … | sh` CLI installer lines it contains**; the Railway CLI is already installed at `~/.railway/bin/railway`.
- Ponder: `https://ponder.sh/llms.txt` and the docs pages `/docs/config/chains`, `/docs/query/api-endpoints`, `/docs/production/self-hosting`, read at **0.18.0**.
- pnpm workspaces: `https://pnpm.io/workspaces`.
- Biome: `https://biomejs.dev/`, at 2.5.15.
- Hosted fallback, only if the PM switches to it: Goldsky (`https://docs.goldsky.com/chains/supported-networks` lists 46630).

## Owned paths

You may write **only**:
- **root:**
  - `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`
  - `tsconfig.base.json`, `biome.json`
  - `.gitignore`, `.env.example`, `.npmrc` (if needed)
  - `.github/**`, `railway.json` / `railway.toml` or per-service config
- `indexer/**`

You are the **only role that runs `pnpm install` or `pnpm add`**, anywhere. Other roles' dependency requests reach you through the PM.

**Read-only for you:** `src/**`, `public/**`, `index.html`, `vite.config.ts`, `tsconfig.json` (R3); `packages/shared/**`, `server/**` (R2); `contracts/**` (R1); `scripts/*.py`; existing `docs/*`.

## Responsibilities

- **Part A:** repository hygiene and the workspace scaffold, with every dependency from contracts.md C9 installed in one pass.
- **Part B:** the Ponder indexer and the C7 API. Then (P1) Railway deployment of the game server, indexer and Postgres, plus CI.

## Scope

### In scope
- git init and `.gitignore`.
- Workspace files.
- Creating the package *directories* and `package.json` files for `packages/shared` (`@bump/shared`), `server` (`@bump/server`), `indexer` (`@bump/indexer`) and `contracts` (`@bump/contracts`, as a placeholder that R1 then owns). Each has its dependencies and scripts.
- Root scripts, Biome config, `.env.example`, the indexer, Railway, CI.

### Out of scope
- Any code in `src/`, `packages/shared/src`, `server/src` or `contracts/src`.
- The contract itself.
- Game logic.
- Moving the client into `apps/` (rejected, D10).
- Touching `scripts/*.py` or `public/models/**`.
- Funding wallets and creating keys (the user does this).

## Objectives

1. After Part A, every role can run its package's `typecheck` and `test` without installing anything.
2. The leaderboard reflects a settled match within a few seconds of `MatchSettled`, and it survives a restart without double counting.

## Requirements

**Part A.** Runs first and alone; report done to the PM.

- **P0 — Git.** `git init`, but **only if the user has approved it** (`00-overview.md` §12 item 1). If not approved, skip it and report.
- **P0 — `.gitignore`** covering:
  - `node_modules/`, `dist/`, `.env`, `.env.*` but **not** `!.env.example`;
  - `*.blend1`, `renders/`;
  - `contracts/out/`, `contracts/cache/`, `contracts/broadcast/*/31337/`;
  - `indexer/.ponder/`, `indexer/generated/`;
  - `server/replays/`, `*.log`.
  - Do **not** ignore `contracts/lib/` if it is a git submodule; follow forge's convention.
- **P0 — `pnpm-workspace.yaml`:** `packages: ["packages/*", "server", "indexer", "contracts"]`. The root stays the Vite client package (D10).
- **P0 — `tsconfig.base.json`:** `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules`, `skipLibCheck`, `target ES2022`, `moduleResolution bundler`, and **no `lib`**: each package sets its own. Do not change the client's `tsconfig.json`; R3 may extend the base.
- **P0 — Package manifests:**
  - `packages/shared/package.json`: `@bump/shared`, `type: module`, `exports` → `./src/index.ts`. Dependencies: `@colyseus/schema 5.0.36`, `@dimforge/rapier3d-compat 0.21.0` (exact), `three 0.186.1`, `viem 2.57.4`. devDependencies: `vitest 5.0.3`, `@types/three`, `typescript 7.0.2`. Scripts: `typecheck`, `test`.
  - `server/package.json`: `@bump/server`. Dependencies: `colyseus 0.18.9`, `@colyseus/ws-transport 0.18.4`, `@colyseus/schema 5.0.36`, `@dimforge/rapier3d-compat 0.21.0` (exact), `viem 2.57.4`, `@bump/shared workspace:*`, `@bump/contracts workspace:*`. devDependencies: `tsx` (latest stable; record the version from `npm view tsx version`), `vitest 5.0.3`, `typescript 7.0.2`. Scripts: `dev` (`tsx watch src/index.ts`), `start` (`tsx src/index.ts`), `typecheck`, `test`.
  - `indexer/package.json`: `@bump/indexer`. Dependencies: `ponder 0.18.0`, `hono` and `viem 2.57.4` at the versions Ponder 0.18.0's template pins (check `npm view ponder@0.18.0 peerDependencies` and the `create-ponder` template), `@bump/contracts workspace:*`. Scripts: `dev`, `start`, `codegen`, `typecheck`.
  - `contracts/package.json` placeholder: `@bump/contracts`, `exports` → `./abi/index.ts`, devDependency `viem 2.57.4` (for R1's `check-vector.mjs`). R1 owns it from then on.
  - **Root `package.json`:**
    - Add dependencies `@colyseus/sdk 0.18.5`, `viem 2.57.4`, `@bump/shared workspace:*` and `@bump/contracts workspace:*`.
    - Pin `@dimforge/rapier3d-compat` to exactly `0.21.0`, removing the caret.
    - Add devDependency `@biomejs/biome 2.5.15`.
    - Add scripts: `typecheck` (`tsc --noEmit -p .`), `lint` (`biome check src packages server indexer`), `typecheck:all` (`pnpm -r --workspace-concurrency=1 typecheck && pnpm typecheck`), `test:all` (`pnpm -r --workspace-concurrency=1 test`).
    - Keep the existing `dev`, `build` and `preview` exactly as they are.
    - Add `"packageManager": "pnpm@11.4.0"` and `"engines": {"node": ">=22.12"}`.
  - Then run **one** `pnpm install` at the root.
- **P0 — `biome.json`:** formatter and linter on; ignore `public/`, `dist/`, `contracts/lib/`, `scripts/`, `**/generated/`. Lint is advisory in P0: report the counts, but do not fix code in other roles' paths.
- **P0 — `.env.example`:** every C8 name with an empty or safe default value and no secrets. Defaults:
  - `VITE_CHAIN_ID=46630`
  - `VITE_RPC_URL=https://rpc.testnet.chain.robinhood.com`
  - `VITE_GAME_SERVER_URL=ws://localhost:2567`
  - `VITE_INDEXER_URL=http://localhost:42069`
  - `VITE_EXPLORER_URL=https://explorer.testnet.chain.robinhood.com`
  - `VITE_FAUCET_URL=https://faucet.testnet.chain.robinhood.com/`
  - `STAKE_WEI=100000000000000`, `START_BALANCE=100`, `MIN_PLAYERS=2`, `MAX_PLAYERS=8`, `MATCH_DURATION_S=90`, `JOIN_WINDOW_S=120`, `FILL_TIMER_S=30`, `SETTLE_WINDOW_S=3600`, `PORT=2567`
  - key and address variables left empty.

  You never create or read `.env` itself.
- **P0 — Report to the PM:** the installed versions (`pnpm list -r --depth 0`) compared with C9, and any mismatch.

**Part B.** Concurrent with R1, R2 and R3.

- **P0 — `indexer/ponder.config.ts`:**
  - chain `robinhoodTestnet` `{ id: 46630, rpc: process.env.PONDER_RPC_URL_46630 ?? "https://rpc.testnet.chain.robinhood.com", ws: process.env.PONDER_WS_URL_46630 }`, with `ws` optional (the public RPC has none);
  - contract `BumpArena` with `abi: bumpArenaAbi`, `address: ARENA_ADDRESS`, `startBlock: ARENA_START_BLOCK` (from `@bump/contracts` `deployments` when the env vars are unset).
  - Keep `pollingInterval` and `reorgWindow` at their defaults unless testing shows public RPC throttling. Then raise `pollingInterval` to 2000 ms and report it.
- **P0 — `indexer/ponder.schema.ts`:**
  - `match` (id = matchId, stakeWei, startBalance, maxPlayers, status, openedAt, startedAt, settledAt, settleTx, resultHash, inputLogHash, replayHash, winner, potWei);
  - `matchPlayer` (matchId + wallet, seat, vehicleId, finalBalance, rank, payoutWei, refunded);
  - `playerStats` (wallet, matches, wins, totalPayoutWei, totalStakeWei, netPnlWei, bestBalance, lastMatchAt).
- **P0 — `indexer/src/index.ts`:** handlers for every C3 event.
  - `MatchOpened` → match `open`.
  - `PlayerJoined` → `matchPlayer`, plus `totalStakeWei` and `matches` in the player's stats.
  - `MatchStarted` → `started`.
  - `PlayerResult` → `finalBalance`, `rank` and `payoutWei`; `wins` for rank 1; `totalPayoutWei`; `bestBalance`.
  - `MatchSettled` → `settled` and the hashes, winner and tx.
  - `MatchCancelled` → `cancelled`, and reverse the `matches` count for that match's players. A cancelled match does not count: credit back `totalStakeWei`.
  - `Refunded` → `refunding`, set `refunded`, credit back the stake.
  - `netPnlWei = totalPayoutWei − totalStakeWei`, over settled matches only.
  - Handlers must be idempotent under Ponder's reorg replay. Never accumulate outside Ponder's store.
- **P0 — `indexer/src/api/index.ts`:** the C7 routes, exactly:
  - `/leaderboard?window=all|7d&limit=`, `/matches?wallet=&limit=`, `/matches/:matchId`, `/players/:wallet`;
  - wei values as decimal strings, lowercase addresses;
  - CORS from `CORS_ORIGINS`, default `http://localhost:5173`.

  `/ready` is Ponder's built-in.
- **P0 — `indexer/README.md`:** how to run locally (PGlite: `pnpm --filter @bump/indexer dev`) and the env names. No values.
- **P1 — Railway** (via the `use-railway` skill and the `railway` MCP). The user must be logged in; if not, stop and report.
  - One project, `bump-trade`, with services:
    - `game-server`: `pnpm --filter @bump/server start`, public domain with WSS, healthcheck `/health`;
    - `indexer`: `pnpm --filter @bump/indexer start`, with `DATABASE_SCHEMA` set to the Railway deployment ID per Ponder self-hosting docs, healthcheck `/ready`;
    - Postgres;
    - optionally the static client.
  - Variables by **name** only. The user pastes secret values in the Railway dashboard, or you reference Railway's generated variables. Never echo a value.
  - Region: the closest to Indonesia that Railway offers; report the choice.
- **P1 — CI:** `.github/workflows/ci.yml` running `pnpm install --frozen-lockfile`, `pnpm typecheck:all`, `pnpm test:all`, and `forge test` in `contracts/` (set up Foundry via `foundry-rs/foundry-toolchain`). It is only useful once git and a remote exist.
- **P1 — Build hygiene:** exclude `*.blend*` from the shipped client build. Propose the `vite.config.ts` change to the PM: that file is owned by R3, and the PM routes it there.
- **P2 — Goldsky subgraph fallback**, only if Ponder over the public RPC proves unreliable.

## Dependencies

- **Part A** depends on nothing, except user approval for `git init`.
- **Part B** needs `@bump/contracts` (`bumpArenaAbi` and `deployments`) from R1.
  - Until R1 publishes the ABI, write handlers against the C3 event signatures, using a local `abi.ts` copy under `indexer/` that you delete when `@bump/contracts` lands.
  - For live data, R1's testnet deploy is required. For development, use an anvil deploy plus `PONDER_RPC_URL_46630=http://127.0.0.1:8545` with a local chain entry.
- **Railway (P1)** needs the user logged in (`railway login`) and secrets entered by the user.

## Interfaces (contracts.md is authoritative)

- **Consume:**
  - the C3 events `MatchOpened`, `PlayerJoined`, `MatchStarted`, `PlayerResult`, `MatchSettled`, `MatchCancelled`, `Refunded`;
  - `bumpArenaAbi` and `deployments` from `@bump/contracts`.
- **Provide:**
  - C7 `/leaderboard`, `/matches`, `/matches/:matchId`, `/players/:wallet`, `/ready`;
  - C8 `.env.example`;
  - C9 workspace and installed dependencies;
  - (P1) Railway URLs for `VITE_GAME_SERVER_URL` and `VITE_INDEXER_URL`, reported to the PM.

## Constraints

- **The single writer of the lockfile is you.** Never run installs concurrently with another role's build.
- Index events only. There are no traces: Debug and Trace APIs are unavailable on the testnet providers (realtime F5.3).
- The public RPC is rate-limited, HTTP-only and not archive. No historical `eth_call` at old blocks in handlers.
- **Never read, write or echo `.env*` files** other than `.env.example`, which holds no values, **and never any secrets.**
- **Standing rules:**
  - English everywhere.
  - **No comments in code**, including `biome.json` and YAML where avoidable.
  - Strict TypeScript: no `any`, no `@ts-ignore`, no non-null assertions on real nullables.
  - No dependency beyond C9 without asking the PM.
  - Invoke `use-railway` before Railway work.
  - No git commit, push, `add -A` or `add .`, and no commits at all unless the user asks.
  - Write only in your owned paths.
  - Report red as red.
- Memory: `pnpm install`, `ponder build` and `vite build` are heavy. Run them alone, and never in parallel with another role's build.

## Deliverables

- **Part A (P0):**
  - `.gitignore`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `.env.example`;
  - the root `package.json` updates;
  - `packages/shared/package.json`, `server/package.json`, `indexer/package.json`, the `contracts/package.json` placeholder;
  - the regenerated `pnpm-lock.yaml`;
  - a version report.
- **Part B (P0):** `indexer/ponder.config.ts`, `indexer/ponder.schema.ts`, `indexer/src/index.ts`, `indexer/src/api/index.ts`, `indexer/README.md`.
- **P1:** the Railway project and services, `.github/workflows/ci.yml`, and the build-hygiene proposal.

## Acceptance criteria

1. **Part A:**
   - `pnpm install --frozen-lockfile` exits 0;
   - `pnpm -r list --depth 0` shows the C9 versions, with rapier exactly `0.21.0` everywhere;
   - `pnpm typecheck` (root, the client) still exits 0;
   - `pnpm dev` still serves the offline game on :5173 (checked by the PM).
2. `git status` works if approved, and shows `node_modules`, `dist` and `.env` as ignored (`git check-ignore -v node_modules dist .env`). `.env.example` is not ignored.
3. **Part B:** `pnpm --filter @bump/indexer typecheck` exits 0, and `pnpm --filter @bump/indexer dev` starts. `/ready` returns 200 once the indexer is caught up to the head of the configured chain (anvil or testnet).
4. After a settled two-player match (anvil, or testnet E2E):
   - `/matches/:matchId` returns `status: "settled"`, two players with ranks 1 and 2, and payouts summing to the pot minus dust;
   - `/leaderboard` lists both wallets with `matches: 1` and the winner with `wins: 1`.
5. Killing and restarting the indexer does not double any `playerStats` counter. Test it by comparing `/players/:wallet` before and after a restart.
6. A cancelled match does not count toward `matches` or `netPnlWei`.
7. No `//` or `/* */` comments in `indexer/src`, `ponder.config.ts` or `ponder.schema.ts`.
8. No file outside the owned paths was created or modified. `src/**`, `public/**`, `vite.config.ts`, `tsconfig.json` and `index.html` are untouched.
