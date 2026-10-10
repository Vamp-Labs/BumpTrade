# S4 — Solana leaderboard and Railway ops

Read first: `00-overview.md`, `01-contracts.md` (C7, C8), `indexer/src/api/index.ts` and `indexer/ponder.schema.ts` (the response shape you must match), `Dockerfile.server`, `server/src/app.ts`, `STATUS.md`. Load the `use-railway` skill for the deploy part.

## Deliver

1. `server/src/leaderboard/` (new): Postgres writer + read API for Solana.
   - Schema `bump_sol` (from `DATABASE_SCHEMA`), tables `matches`, `match_players`, `player_stats`, created on boot if missing (idempotent migrations).
   - Writer is called by the settlement flow after `settle` is confirmed (S2 exposes a hook; agree the hook signature in `STATUS.md`): stores match, per-player final balance, rank, payout, stake, `settleTx` signature, timestamps. Cancelled matches and refunds update status only and never touch stats (same rules as the Ponder indexer).
   - Routes on the Solana server, mounted only when `CHAIN=solana`: `/leaderboard?window=all|7d&limit=`, `/players/:wallet`, `/matches/:matchId`, `/matches?wallet=&limit=`, `/ready`; JSON identical to the indexer (C7) plus `chain` and `decimals`; CORS from `CORS_ORIGINS`.
   - Tests with a throwaway Postgres (pglite is acceptable) covering settle, cancel, idempotent re-write after restart, 7d window.
2. Railway (after the PM deploys the program and says go): new service `server-sol` from `Dockerfile.server` with `CHAIN=solana` and C8 variables (secrets are set by the PM; you set non-secret values only), public domain, healthcheck; client service gets the `VITE_SOL_*` variables and a redeploy. Region `asia-southeast1-eqsg3a` (redeploy after changing region; region-only changes do not move a running deployment). Existing `server`, `indexer`, `client`, `Postgres` keep working.
3. Ops checks: script `tools/ops/check-solana.sh` that prints program id, config account, relayer SOL balance, mint supply, server `/metrics.json`, leaderboard `/ready`.

## Constraints

- Own only the S4 paths in `00-overview.md`. Do not touch program, client chain code or the EVM server behaviour.
- Never print secrets. Never touch mainnet. Do not delete or rename existing Railway services.
- `flock /tmp/bump-build.lock` around builds/tests.

## Report

Files, tests, Railway service ids and URLs, variables set (names only), health check output, anything blocked.
