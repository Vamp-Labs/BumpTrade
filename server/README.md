# @bump/server

Authoritative Colyseus 0.18.9 game server for BUMP.TRADE. One room (`arena`) per match runs a headless Rapier 0.21.0 world at 60 Hz, patches state at 30 Hz, owns the zero-sum ledger, and settles each match on Robinhood Chain testnet (46630) with one EIP-712 signed `settle` transaction.

## Environment variable names

Values are never committed. Set them in a local env file that is not tracked.

| Name | Required | Default | Meaning |
|---|---|---|---|
| `ARENA_ADDRESS` | yes | none | deployed `BumpArena` address |
| `SIGNER_PRIVATE_KEY` | yes | none | key that signs the `Result` (must equal the contract `signer`) |
| `RELAYER_PRIVATE_KEY` | yes | none | key that sends `openMatch`, `startMatch`, `settle`, `cancel`, `joinWithSig`, `claimRefund` and the faucet `claim` (must equal the contract `operator`, needs testnet ETH; the only account that pays gas) |
| `RH_RPC_URL` | no | public testnet RPC | keyed RPC preferred; the public RPC is added as a fallback |
| `RH_WSS_URL` | no | none | optional, never required |
| `PORT` | no | 2567 | HTTP and WebSocket port |
| `STAKE_AMOUNT` | no | 100000000000000000000 | stake per seat in BUMP base units (18 decimals) |
| `TOKEN_ADDRESS` | no | `arena.token()` | `MockBUMP` address; read from the arena when unset |
| `RELAYER_MIN_BALANCE_WEI` | no | 2000000000000000 | faucet and join are refused (`RELAYER_LOW`) below this relayer ETH balance |
| `CORS_ORIGINS` | no | `http://localhost:5173` | comma separated browser origins allowed for HTTP and matchmaking |
| `FAUCET_PER_IP_PER_HOUR` | no | 5 | faucet calls per IP per hour |
| `FAUCET_GLOBAL_PER_HOUR` | no | 300 | faucet transactions per hour, all callers |
| `JOIN_PER_IP_PER_HOUR` | no | 20 | relayed joins per IP per hour |
| `START_BALANCE` | no | 100 | in-game balance for every player |
| `MIN_PLAYERS` / `MAX_PLAYERS` | no | 2 / 8 | seats |
| `MATCH_DURATION_S` | no | 90 | live round length |
| `JOIN_WINDOW_S` | no | 120 | `joinDeadline = now + JOIN_WINDOW_S` |
| `FILL_TIMER_S` | no | 30 | counted from the 2nd claimed seat |
| `REPLAY_DIR` | no | `./replays` | `pending/` holds unsettled results, `replays/` holds replay files |
| `SERVER_BUILD` | no | `dev` | build id written to `matchStart` and the replay file |

The server fails fast when `ARENA_ADDRESS`, `SIGNER_PRIVATE_KEY` or `RELAYER_PRIVATE_KEY` is missing or malformed, and never logs key material.

## Run

```
pnpm --filter @bump/server dev
pnpm --filter @bump/server typecheck
pnpm --filter @bump/server test
```

Endpoints: WebSocket `ws://localhost:2567` (room `arena`), `GET /health` returns `{"ok":true,"rooms":n}`, `GET /metrics.json` returns tick timing, settlement lag and `relayerBalanceWei`.

## Gasless join and faucet

- `POST /faucet {"wallet"}` returns `200 {txHash, nextClaimAt}` or `{code, message, retryAfterS, nextClaimAt?}` with codes `INVALID_ADDRESS` (400), `COOLDOWN` / `RATE_LIMITED` / `GLOBAL_LIMIT` (429), `RELAYER_LOW` / `CHAIN_UNAVAILABLE` (503), `CLAIM_FAILED` (502). `GET /faucet/status?wallet=` returns `{wallet, balance, nextClaimAt, canClaimNow}`.
- Room message `joinIntent` carries `{intent: {matchId, player, sessionKey, vehicleId, deadline}, signature}` (EIP-712 `JoinIntent`, `deadline` a decimal string). The server checks the signature, `matchId`, deadline, Open state, capacity and token balance, then the relayer calls `joinWithSig`. The client receives `{t:'joinResult', wallet, seat, txHash}` or `{t:'error', code, message, retryAfterS?}` on the `ev` channel, then sends `claimSeat`.
- Limits: one pending join per wallet, joins and faucet calls per IP per hour, a global faucet ceiling, and the relayer balance guard. The client IP is `x-real-ip`, else the last `x-forwarded-for` hop, else the socket address.
- Refund keeper: every open and started match is tracked in `REPLAY_DIR/tracked/`. After `settleDeadline` the relayer calls `claimRefund(matchId, player)` for each player of an unsettled match (tokens are pushed back), and cancels an Open match under the minimum once its join window has passed. Settled and cancelled matches are dropped.

## Two local clients

1. Run the server with the env above (anvil with `--chain-id 46630` and a locally deployed `BumpArena` works; `RH_RPC_URL=http://127.0.0.1:8545`).
2. Start the Vite client (`pnpm dev` at the repo root) in two browser profiles with two wallets (no ETH needed).
3. Both clients call `joinOrCreate('arena')`, read `state.matchId`, claim BUMP from `POST /faucet` if needed, send a signed `joinIntent` (no transaction, no gas), wait for `joinResult`, then send `claimSeat` signed by the session key.
4. With `MAX_PLAYERS=2` the match starts as soon as both seats are claimed. Otherwise it starts `FILL_TIMER_S` after the second claim.

## Wire details R3 needs

- Server events travel on one channel: `room.onMessage('ev', (event) => ...)`; `event.t` is the type.
- Client input: `const input = room.input<InputFrame>(); input.data.throttle = ...; input.send();` once per tick.
- The input log hashed into `inputLogHash` is big-endian: `u32 tick | u8 seat | i8 throttle | i8 steer | u8 buttons` per seat per tick, ticks counted from 0 at the first LIVE tick.
- `replayHash = keccak256(utf8(replay JSON))` of `REPLAY_DIR/replays/<matchId>.json`.
