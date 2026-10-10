# RAILWAY: new service `server-sol` (preparation only, the PM deploys)

Nothing here has been executed. The existing `server` (CHAIN=evm), `indexer`, `client` and `Postgres` services are not touched.

## Service `server-sol`

| Setting | Value |
|---|---|
| Source | this repo, branch `feat/solana` (or `main` after merge) |
| Builder | Dockerfile, path `Dockerfile.server` (root directory: repo root) |
| Start | from the Dockerfile (`pnpm --filter @bump/server start`) |
| Region | `asia-southeast1-eqsg3a` (set it, then redeploy; a region-only change does not move a running deployment) |
| Replicas | 1 (Colyseus rooms and the pending-settlement files are local state) |
| Public domain | generate one; HTTPS and WSS are served on it |
| Healthcheck path | `/health` (returns `{"ok":true,"rooms":N}`), timeout 60 s |
| Restart policy | on failure |
| Volume | optional, mount at `/app/server/replays` if settlement retries must survive redeploys |

## Variables (by name)

Plain values the agent may set:

- `CHAIN=solana`
- `SOL_CLUSTER=devnet`
- `SOL_RPC_URL` (public `https://api.devnet.solana.com` or a Helius devnet URL; if the URL embeds an API key treat it as a secret)
- `SOL_WS_URL` (optional)
- `SOL_PROGRAM_ID` (`3LDXSuMuzP33VZ31sar4ZN1YB13pta7NRuR6aDJmwVgz`)
- `SOL_MINT`, `SOL_TREASURY` (from `solana/deployments/devnet.json` after the deploy)
- `RELAYER_MIN_BALANCE` (lamports, default 50000000)
- `DATABASE_SCHEMA=bump_sol`
- `STAKE_AMOUNT` (base units, must equal the on-chain config stake: `100000000000` for 100 BUMP at 9 decimals unless the deploy used another value)
- `START_BALANCE`, `MATCH_DURATION_S`, `JOIN_WINDOW_S`, `FILL_TIMER_S`, `MIN_PLAYERS`, `MAX_PLAYERS` (same values as the EVM `server` service)
- `CORS_ORIGINS` (the client public origin, comma separated)

Secrets, set by the PM only:

- `SOL_RELAYER_SECRET`
- `SOL_RESULT_SIGNER_SECRET`
- `SOL_MINT_AUTHORITY_SECRET`
- `DATABASE_URL` (reference the existing Postgres service: `${{Postgres.DATABASE_URL}}`; the leaderboard tables live in schema `bump_sol`, so the EVM schema is not affected)

`PORT` is injected by Railway. The server reads `STAKE_AMOUNT` and the limits from env as in C8.

## Client service

Set on the existing `client` service, then redeploy it (Vite bakes them at build time):

- `VITE_CHAIN_DEFAULT=solana`
- `VITE_SOL_CLUSTER=devnet`
- `VITE_SOL_RPC_URL`
- `VITE_SOL_PROGRAM_ID`
- `VITE_SOL_MINT`
- `VITE_SOL_GAME_SERVER_URL` (`wss://<server-sol domain>`)
- `VITE_SOL_LEADERBOARD_URL` (`https://<server-sol domain>`, the leaderboard is served by the same service)
- `VITE_SOL_EXPLORER_URL` (`https://explorer.solana.com`, cluster query is added by the client)

Existing `VITE_*` EVM variables stay unchanged.

## After deploy

```
SERVER_URL=https://<server-sol domain> SOL_MINT=<mint> tools/ops/check-solana.sh
```

Expect: program deployed, config initialized, relayer balance above `RELAYER_MIN_BALANCE`, mint supply, `/metrics.json` 200, `/ready` 200 with `{"ready":true,"chain":"solana","decimals":...}`.

Wiring needed in `server/src/index.ts` (S2): `createLeaderboard({ databaseUrl: DATABASE_URL, schema: DATABASE_SCHEMA ?? "bump_sol", chain: "solana", decimals: 9, corsOrigins })` and delegation of unknown HTTP routes to `handleRequest` (see the frozen hook in STATUS.md). Without `DATABASE_URL` the leaderboard is in memory and is lost on restart.
