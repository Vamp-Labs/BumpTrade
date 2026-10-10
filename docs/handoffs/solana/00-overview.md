# 00 — Solana default, Robinhood second: overview and agent workflow

Status: DRAFT, waiting for Candra's "yes". Do not dispatch before that.

## Goal

One product, two chains, one hackathon submission (Colosseum Crypto World's Fair, deadline 2026-10-12 23:59 PT = 2026-10-13 13:59 WIB; one team = one submission). Solana devnet is the default chain; Robinhood Chain testnet stays fully working as the second chain. The game, physics, Colyseus server, shared rules and UI are shared; only the chain layer differs, behind adapters.

## What already exists (do not rebuild)

- `src/` Vite + three.js client with offline mode and an EVM online mode (wallet, faucet, one-signature join).
- `server/` Colyseus authoritative server. Chain access goes through `server/src/chain/ChainGateway.ts` (interface) and `ViemChainGateway.ts` (EVM). Join relay `server/src/relay/JoinRelay.ts`, faucet `relay/Faucet.ts`, settlement `chain/Settler.ts`, refunds `chain/RefundKeeper.ts`.
- `packages/shared/` protocol, sim, `chain/join.ts` (EIP-712 JoinIntent), `chain/result.ts` (Result, `computePayouts`, `seatMessage`).
- `contracts/` Foundry BumpArena + MockBUMP, deployed on Robinhood Chain testnet (see `contracts/deployments/46630.json`).
- `indexer/` Ponder, EVM only.
- Live on Railway (Singapore): `client`, `server` (EVM), `indexer`, `Postgres`.

## Target architecture

```
                 client (one build, chain selector, default solana)
                   |                         |
        wss server-sol (CHAIN=solana)   wss server (CHAIN=evm, unchanged)
                   |                         |
   Anchor program bump_arena (devnet)   BumpArena.sol (Robinhood testnet)
   SPL mint BUMP (server mint auth)     MockBUMP ERC20
   leaderboard: server -> Postgres      leaderboard: Ponder indexer
```

Frozen interfaces live in `01-contracts.md`. Every agent builds against it and never edits it; change requests go to `STATUS.md` and the PM decides.

## Roles and ownership

| Role | Delivers | Owns (may edit) | Must not touch |
|---|---|---|---|
| S1 Program | Anchor program `bump_arena`, tests, devnet deploy script, Codama TS client in `packages/sol-client` | `solana/`, `packages/sol-client/` | everything else |
| S2 Core + server | Phase A: chain-agnostic `ArenaChain` port, EVM adapter (behaviour unchanged, all existing tests green). Phase B: Solana server adapter, Solana join relay, faucet, settle, refunds | `packages/shared/src/chain/`, `packages/shared/src/protocol/` (chain messages only), `server/src/chain/`, `server/src/relay/`, `server/src/config.ts`, `server/test/` | `src/`, `contracts/`, `solana/`, `indexer/` |
| S3 Client | Client `ClientChain` port, EVM adapter (behaviour unchanged), Solana adapter (Wallet Standard, sign transaction, ed25519 session key), chain selector UI (default Solana), per-chain decimals and explorer links | `src/chain/`, `src/ui/online/`, `src/net/` (chain call sites only), `src/config/env.ts`, `src/vite-env.d.ts` | server, contracts, solana, indexer |
| S4 Ops + leaderboard | Solana leaderboard writer + `/leaderboard` API on the Solana server (same JSON shape as the indexer), Railway `server-sol` service, client env, Dockerfile updates, devnet health checks | `server/src/leaderboard/` (new), `Dockerfile.*`, Railway config, `.env.example` (append only) | program, client chain code |
| PM (main session) | Keys, contracts doc, reviews, merges, deploy, two-browser E2E (headless Chrome with mock wallets), submission | docs, `.env` | — |

## Order

1. PM: freeze `01-contracts.md`, generate devnet keypairs (outside the repo, values only in `.env`), fund deployer (Candra may need faucet.solana.com).
2. Day 1 parallel: S1 (program, local tests, devnet deploy, IDL + Codama client) and S2 phase A (refactor, EVM unchanged).
3. Day 2 parallel, after S1 publishes program id + client: S2 phase B, S3, S4.
4. Day 3: PM integration, E2E two browsers on both chains, Railway deploy, fixes, repo public, submit.

## Rules for every agent

- Load the `solana-dev` skill (Solana Foundation) for any Solana work; verify library versions against current docs before using them (anchor-cli 1.0.1, solana-cli 3.1.14, rust 1.96 are installed locally).
- Devnet and local validator only. Never mainnet. Never print, store or ask for private keys; read keys only through the env names in `01-contracts.md`. Local tests use freshly generated throwaway keys.
- One branch: `feat/solana`. Commit only files you own, small commits, message ends with the attribution trailer from the PM brief. Do not push; the PM pushes.
- 14 GB machine: wrap every heavy build/test in `flock /tmp/bump-build.lock <cmd>`; never leave validators, dev servers or Chrome running.
- Robinhood (EVM) must keep working: `pnpm build`, `pnpm typecheck:all`, `pnpm test:all`, `cd contracts && forge test` stay green after your change.
- Code style: match the surrounding code, no comments beyond what the file already uses.
- Keep `STATUS.md` updated: what is done, what you need from whom, anything that blocks you. Write the interface you publish early.

## Gates (PM checks before moving on)

- G1 end of day 1: program deployed on devnet, IDL and `packages/sol-client` exported; EVM still green after S2 phase A.
- G2 end of day 2: a headless two-browser match on Solana devnet goes join → play → settle → payouts visible; EVM match still works.
- G3 day 3: Railway live for both chains, leaderboard per chain, demo video updated if needed, repo public.

## Open decisions (Candra)

1. Vehicle names (HOOD BULL / HOOD BEAR) on the Solana default: rename now or after submission. Default in this plan: keep, change only chain copy.
2. Settle trust model: the result signer key co-signs the `settle` transaction (simple, chosen) instead of an in-program ed25519 check. Players keep a refund path after the settle window either way.
3. Devnet RPC: public `api.devnet.solana.com` (rate limited) or a free Helius devnet key.
4. Submission materials required by Colosseum (pitch video, demo video, repo) to be checked on the submit page.
