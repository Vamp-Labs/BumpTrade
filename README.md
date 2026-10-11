# BUMP.TRADE

Real-time 3D multiplayer bumper-car arena. **Solana devnet is the default chain**; Robinhood Chain testnet stays supported behind the same chain adapter. Bump other cars, knock them out of the arena, last car standing wins. Stakes are a free mock token (`BUMP`) and play is gasless: a player only signs a message, the server relayer pays the gas.

> Testnet demo. Not affiliated with, endorsed by, or connected with Robinhood Markets, Inc.

## How it works

- **Client** (`src/`): Vite + three.js + Rapier. Offline mode against AI bots, and an online mode with wallet connect, free `BUMP` faucet and one-signature join.
- **Game server** (`server/`): Colyseus 0.18 over WebSocket. Runs the authoritative Rapier simulation at 60 Hz, streams 30 Hz snapshots, relays gasless joins (Solana: server-built transaction the player signs once; EVM: `joinWithSig`), signs match results, and serves a server-side RPC proxy and the Solana leaderboard.
- **Solana program** (`solana/`): Anchor `bump_arena` (escrow, gasless join, settle, refund) with a Codama client in `packages/sol-client/`.
- **EVM contracts** (`contracts/`): Foundry. `BumpArena` escrows `BUMP` stakes, verifies the signed result and pushes payouts; `MockBUMP` is the free ERC20 with a 24 h faucet.
- **Indexer** (`indexer/`, EVM only): Ponder. Indexes arena events and serves the leaderboard and match history API.
- **Shared** (`packages/shared/`): protocol schemas, message types and the deterministic game rules used by server and client.

## Deployments

### Solana devnet (default)

| Item | Address |
|---|---|
| Program `bump_arena` | `3LDXSuMuzP33VZ31sar4ZN1YB13pta7NRuR6aDJmwVgz` |
| BUMP mint (9 decimals) | `J1t1uz6csJ7V5wMsjtbv8y4KJLs27r63KYDxiBQBADBG` |
| Treasury | `knS3QhH1v8LRrCru2SpMQbtwbbDtFwQjYRYPYeBtsfS` |

Record: `solana/deployments/devnet.json`. Gasless for players: the server relayer pays fees, a player signs one transaction. Leaderboard is written by the server to Postgres. Hosted on Railway (Singapore): client, `server-sol`, Postgres.

### Robinhood Chain testnet (chain id 46630, supported, currently not hosted)

| Contract | Address |
|---|---|
| `BumpArena` | `0xf00dAfa18463fDf3274bBe93EEB92f8Bf7567803` |
| `MockBUMP` | `0x45AEF2fD87009Ff78EB29B7ac4346812093c2928` |

Full deployment record: `contracts/deployments/46630.json`. The EVM server and indexer are stopped on Railway; set `VITE_ENABLE_EVM=true` on the client and redeploy `server` and `indexer` to bring it back.

## Repository layout

```
src/                 3D game client (Vite)
public/models/       vehicle GLBs (textures embedded)
packages/shared/     protocol + shared game rules
server/              Colyseus game server
indexer/             Ponder indexer + leaderboard API
solana/              Anchor program, tests, deploy script
packages/sol-client/ generated Solana TypeScript client
contracts/           Foundry (EVM) contracts, tests, deploy scripts
tools/e2e/           two-browser end-to-end harness with mock Wallet Standard wallets
docs/                PRDs, design notes, research, role handoffs, screenshots
tools/asset-pipeline Blender and texture generation scripts used to build the GLBs
Dockerfile.server    Railway image for the game server
Dockerfile.indexer   Railway image for the indexer
```

## Verified end to end

A two-browser harness (`tools/e2e/solana-local`) with mock Wallet Standard wallets plays a full match and checks faucet, one-signature gasless join, settle payouts, vault balance and leaderboard. It runs against a local validator, against devnet, and against the live Railway deployment (`E2E_RAILWAY_SERVICE=server-sol`).

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

## License

MIT, see `LICENSE`. Third-party dependencies keep their own licenses.
