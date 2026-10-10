# @bump/indexer

Ponder 0.18 indexer for `BumpArena` on Robinhood Chain testnet (46630). It serves the C7 leaderboard and match-history API.

## Run locally

```
pnpm --filter @bump/indexer dev
```

With `DATABASE_URL` unset, Ponder uses PGlite under `indexer/.ponder/`. The API is at `http://localhost:42069`.

## Routes

- `GET /leaderboard?window=all|7d&limit=`
- `GET /matches?wallet=&limit=`
- `GET /matches/:matchId`
- `GET /players/:wallet`
- `GET /ready` (Ponder built-in)

## Environment names

- `PONDER_RPC_URL_46630`
- `PONDER_WS_URL_46630` (optional)
- `DATABASE_URL` (unset means PGlite)
- `DATABASE_SCHEMA` (use `bump_v2`; the old ETH-stake schema is abandoned)
- `ARENA_ADDRESS` (optional override; defaults to `deployments.BumpArena.address` from `@bump/contracts`)
- `ARENA_START_BLOCK` (optional override; defaults to `deployments.BumpArena.blockNumber`)
- `CORS_ORIGINS`

The ABI is `bumpArenaAbi` from `@bump/contracts`. `MockBUMP` events (`Claimed`) are not indexed.

## Amount fields

Amounts are decimal strings of BUMP base units (18 decimals): `stakeAmount`, `potAmount`, `payoutAmount`, `totalPayoutAmount`, `totalStakeAmount`, `netPnlAmount`. Stats count settled matches only. A cancelled match marks all its seats `refunded` (the arena emits only `MatchCancelled`); a post-deadline `Refunded` marks that player and sets the match `refunding`. See C7 in `docs/handoffs/contracts.md`.

## Local chain

Run anvil with `--chain-id 46630`, deploy `MockBUMP` and `BumpArena` (`contracts/script/Deploy.s.sol`), then start the indexer with `PONDER_RPC_URL_46630=http://127.0.0.1:8545`, `ARENA_ADDRESS` and `ARENA_START_BLOCK` set (the overrides replace the testnet deployment).

## Reset

Changing the contract means a new `DATABASE_SCHEMA`; Ponder refuses a schema still in use by another app. Locally delete `indexer/.ponder/`.
