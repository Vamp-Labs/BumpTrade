# S2 — Chain-agnostic core and the Solana game-server adapter

Read first: `00-overview.md`, `01-contracts.md` (C1, C3, C4, C5, C8), `server/README.md`, `server/src/chain/*`, `server/src/relay/*`, `server/src/rooms/ArenaRoom.ts`, `packages/shared/src/chain/*`, `STATUS.md`. Load the `solana-dev` skill for phase B.

## Phase A (day 1, no Solana dependency): refactor, EVM behaviour unchanged

1. Introduce `ArenaChain` (C3) in `server/src/chain/ArenaChain.ts`; move signing of results into the adapter (`settle(result)` signs internally).
2. `server/src/chain/evm/` wraps today's `ViemChainGateway` (move files, keep logic). `Settler`, `RefundKeeper`, `JoinRelay`, `Faucet`, `RelayerGuard`, `ArenaRoom` depend only on `ArenaChain`.
3. Make shared types chain-agnostic where C1/C3/C5 say so (`WalletId = string`, `Hex32`, `ClaimSeatMessage.scheme`, seat proof verification by scheme). EIP-712 helpers stay in `packages/shared/src/chain/` for the EVM adapter and client.
4. `CHAIN` env selects the adapter (`evm` keeps every existing env name working). Until phase B lands, `CHAIN=solana` fails fast with a clear message.
5. Gate: `pnpm typecheck:all`, `pnpm test:all` (all 40 existing shared+server tests, including the anvil integration test) green with `CHAIN=evm`. No change to message shapes the EVM client uses.

## Phase B (day 2, after S1 publishes `@bump/sol-client` + devnet program id in STATUS.md)

1. `server/src/chain/solana/`: `SolanaArenaChain implements ArenaChain` with `@solana/kit` + `@bump/sol-client`. Relayer = fee payer and operator; result signer co-signs `settle`; mint authority mints for the faucet (create ATA if missing, relayer pays rent). Player ATAs passed as remaining accounts in seat order.
2. Solana join relay (C4): `solJoinPrepare` → validate (existing rate limits, balance, Open, seat free) → build unsigned `join_match` tx (fee payer relayer, recent blockhash, expiry ~60 s) → `ev solJoinTx` → `solJoinSubmit` → verify message bytes identical, sign as relayer, send, confirm, `ev joinResult` or errors (`TX_EXPIRED`, `TX_TAMPERED` + existing codes). One pending join per wallet.
3. Seat proof `scheme: "ed25519"` verified against `sessionKeyOf` (base58) from the match account.
4. Faucet cooldown on Solana stored in Postgres (`bump_sol.faucet_claims`, created on boot if missing); in-memory fallback only for tests.
5. Tests: unit tests for the Solana adapter against LiteSVM or `solana-test-validator` with the S1 program `.so` (skip cleanly if unavailable), tamper/expiry tests for the join relay, ed25519 seat proof tests. Keep all EVM tests green.
6. Update `server/README.md` env table (C8 names).

## Constraints

- Own only the paths listed for S2 in `00-overview.md`. Do not touch `src/`, `solana/`, `contracts/`, `indexer/`, Railway or Dockerfiles.
- Never print or store secrets; read keys only from the C8 env names. Tests use throwaway keys. No devnet transactions in tests (local only).
- Message types you add to `packages/shared/src/protocol/` must match C4 exactly; S3 codes against them in parallel. Write them first and note the commit in `STATUS.md`.
- `flock /tmp/bump-build.lock` around builds/tests.

## Report

Phase A: files moved/changed, test results with `CHAIN=evm`. Phase B: adapter files, test results, measured join latency (prepare → confirmed) on a local validator, deviations, anything S3/S4 must know.
