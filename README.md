# BUMP.TRADE

Real-time 3D multiplayer bumper-car arena on **Robinhood Chain testnet**. Bump other cars, knock them out of the arena, last car standing wins. Stakes are a free mock token (`BUMP`) and play is gasless: a player only signs a message, the server relayer pays the gas.

> Testnet demo. Not affiliated with, endorsed by, or connected with Robinhood Markets, Inc.

## How it works

- **Client** (`src/`): Vite + three.js + Rapier. Offline mode against AI bots, and an online mode with wallet connect, free `BUMP` faucet and one-signature join.
- **Game server** (`server/`): Colyseus 0.18 over WebSocket. Runs the authoritative Rapier simulation at 60 Hz, streams 30 Hz snapshots, relays joins (`joinWithSig`) and signs match results (EIP-712).
- **Contracts** (`contracts/`): Foundry. `BumpArena` escrows `BUMP` stakes, verifies the signed result and pushes payouts; `MockBUMP` is the free ERC20 with a 24 h faucet.
- **Indexer** (`indexer/`): Ponder. Indexes arena events and serves the leaderboard and match history API.
- **Shared** (`packages/shared/`): protocol schemas, message types and the deterministic game rules used by server and client.

## Deployments (Robinhood Chain testnet, chain id 46630)

| Contract | Address |
|---|---|
| `BumpArena` | `0xf00dAfa18463fDf3274bBe93EEB92f8Bf7567803` |
| `MockBUMP` | `0x45AEF2fD87009Ff78EB29B7ac4346812093c2928` |

Full deployment record: `contracts/deployments/46630.json`. Hosted on Railway (Singapore).

## Repository layout

```
src/                 3D game client (Vite)
public/models/       vehicle GLBs (textures embedded)
packages/shared/     protocol + shared game rules
server/              Colyseus game server
indexer/             Ponder indexer + leaderboard API
contracts/           Foundry contracts, tests, deploy scripts
docs/                PRDs, design notes, research, role handoffs, screenshots
tools/asset-pipeline Blender and texture generation scripts used to build the GLBs
Dockerfile.server    Railway image for the game server
Dockerfile.indexer   Railway image for the indexer
```

## Getting started

Requirements: Node >= 22.12, pnpm 11, Foundry.

```bash
git clone --recurse-submodules https://github.com/Vamp-Labs/BumpTrade.git
cd BumpTrade
pnpm install
cp .env.example .env        # fill in values, never commit .env

pnpm dev                     # client at http://localhost:5173
pnpm --filter @bump/server start
pnpm --filter @bump/indexer dev
```

Checks:

```bash
pnpm build && pnpm typecheck:all && pnpm test:all
cd contracts && forge test
```

Environment variable names are listed in `.env.example`; per-package details are in `server/README.md`, `indexer/README.md` and `contracts/README.md`.
