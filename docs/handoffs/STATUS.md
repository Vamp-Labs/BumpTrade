# Status

## Current step
Step 8: approval gate. Waiting for the user's explicit "yes". **No implementer has been dispatched.**

## User overrides to the standard PM flow (Candra, 2026-10-09)
- **Research cap:** at most **3 markdown files** under `docs/research/`.
  - So there is no `00-brief.md`: the brief was embedded in each research agent's prompt.
  - And there is no `05-synthesis.md`: the synthesis lives in `docs/handoffs/00-overview.md` §3–5 and §13.
- **Tooling:** skills and MCP servers are researched and listed only. Nothing is installed without the user's approval; see `docs/research/repo-audit-and-tooling.md` §C and `00-overview.md` §11.
- **Stop point:** stop after research and handoffs. No implementer dispatch.
- **Hard rule** (relayed by the coordinator, 2026-10-09):
  - Only new markdown files under `docs/research/` and `docs/handoffs/`.
  - Nothing in `src/`, `scripts/`, `public/`, `package.json`, the lockfile, `vite.config.ts`, `tsconfig.json`, `index.html`, or the existing PRDs and docs is edited, created or deleted.
  - No installs, no scaffolding, no builds that write files.
  - Anything that would need such a change is listed as "awaiting user confirmation" (`00-overview.md` §12).

## Done — step, output file, date
- **Step 1:** read the PRDs and docs.
  - Files: `docs/update prd.md`, `docs/designgame/prd.md`, `docs/mechanics/prd.md`, `docs/update/prd.md` §25/§29, `docs/onboard/prd.md` §3–5.
  - Also grepped all docs for chain and multiplayer mentions.
  - Date: 2026-10-09.
- **Steps 2–3:** brief embedded in the prompts; 3 research tracks dispatched concurrently (2026-10-09).
- **Step 4:** synthesis in `docs/handoffs/00-overview.md`.
  - One research error was corrected: in `docs/research/realtime-architecture.md` F4.3, the uniform starting balance of 85 was wrong. Starting bags are per vehicle (`HeroCar.ts:61-68`); verified by the PM in code (2026-10-09).
- **Step 5:** tooling candidates in `docs/research/repo-audit-and-tooling.md` §C. **Not installed**, by user rule (2026-10-09).
- **Step 6–7:** handoffs written (2026-10-09):
  - `00-overview.md`, `contracts.md`
  - `01-smart-contracts.md`, `02-game-server.md`, `03-client-network-chain.md`, `04-indexer-ops.md`
- **Check:** only files under `docs/research/` and `docs/handoffs/` were created this session. Verified with `find -newer`.

## Agents — name, role or track, dispatched / returned / failed, result in one line
- **research-chain** → `docs/research/robinhood-chain.md`: returned. Testnet 46630 verified by curl. The public RPC is HTTP-only. viem has `robinhoodTestnet` (≥2.55.0). EntryPoints v0.6–v0.9 are on chain. No Chainlink testnet feeds.
- **research-realtime** → `docs/research/realtime-architecture.md`: returned. Recommends Colyseus 0.18 with headless Rapier at 60 Hz, escrow plus one EIP-712 settlement, Ponder and Railway. One finding was corrected by the PM: F4.3.
- **research-repo-tooling** → `docs/research/repo-audit-and-tooling.md`: returned. The sim core runs headless. The rules are entangled with presentation. Four zero-sum leaks found. No git, lint or tests. Tooling candidates listed, none installed.

## Review — acceptance criteria per role: pass / fail, with the failure
(none yet: no implementers dispatched)

## Blocked on the user
- **Approval gate:** reply "yes" to dispatch, or give corrections.
- `00-overview.md` §12:
  - approve `git init`;
  - fund the deployer, relayer and demo wallets from the faucet; import the deployer keystore;
  - approve the skill and MCP installs;
  - confirm the D12, D13, D4 and D5 defaults;
  - the HOOD trademark question;
  - the Vite-not-Next.js deviation (D14);
  - an optional Alchemy key;
  - what to do with `docs/reskin/`.


---

# R4 (Indexer and ops), 2026-10-09

## Part A: workspace. DONE
- `git init -b main` done (no commit, nothing staged). `.gitignore`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `.env.example` created.
- Manifests: `packages/shared`, `server`, `indexer`, `contracts` (placeholder). Root `package.json` updated as in 04; `dev`/`build`/`preview` untouched.
- One `pnpm install` ran; `pnpm install --frozen-lockfile` exits 0. All C9 versions match; rapier is exactly 0.21.0 everywhere.
- `pnpm build` passes (tsc + vite build). `pnpm typecheck:all` passes. `pnpm test:all` passes (no tests yet, `--passWithNoTests`).
- `pnpm lint` is red as advisory: 83 errors, 343 warnings, all in `src/` (R3). Not fixed.
- `tsx` pinned at 4.23.15, `hono` at 4.13.13 (Ponder 0.18.0 peers: hono >=4.5, viem >=2.35).

## Deviations in Part A
- `pnpm-workspace.yaml` has `blockExoticSubdeps: false`. `colyseus@0.18.9` pulls `@colyseus/uwebsockets-transport`, which depends on a GitHub tarball (`uWebSockets.js`); pnpm 11 refuses it otherwise. Supply-chain relaxation, flag to PM.
- `allowBuilds`: `esbuild: true`, `msgpackr-extract: false` (optional native speedup).
- pnpm added `minimumReleaseAgeExclude` for `viem@2.57.4` and `ox@0.14.54` (too new for the default age gate).
- Each package tsconfig (`packages/shared`, `server`, `indexer`) extends `tsconfig.base.json` with `lib: ["ES2022"]`, `types: []`. Empty `export {};` stubs sit in `packages/shared/src/index.ts`, `server/src/index.ts` so typecheck passes. R2 overwrites them. R2 may need `types` or `lib` changes in its own tsconfig.
- `contracts/package.json` exports `./abi/index.ts`, which does not exist yet. R1 creates it. Until then `@bump/contracts` imports will not resolve.

## Part B: indexer (P0). DONE against a local anvil, not against the real contract
- Files: `indexer/ponder.config.ts`, `ponder.schema.ts`, `src/index.ts`, `src/api/index.ts`, `README.md`, `abis/BumpArenaEvents.ts` (local copy of the C3 events), generated `ponder-env.d.ts`.
- Verified with a throwaway event-emitter contract on anvil (`--chain-id 46630`): settled match returns rank 1 and 2 with payouts, leaderboard shows `matches:1`, winner `wins:1`, a cancelled match counts for nothing, restart gives byte-identical `/players/:wallet`, CORS header present, `/ready` 200. `ponder dev` also starts against the public testnet RPC and reaches live.
- Deviation: `matches` and `totalStakeWei` increment at `PlayerResult` (settle time), not at `PlayerJoined`, so unsettled and cancelled matches never touch `playerStats` and no reversal is needed. `MatchCancelled` and `Refunded` only set status and `refunded`. End results match 04's acceptance criteria 4-6.
- `PlayerJoined` still grows `match.potWei`; `MatchSettled` overwrites it with the on-chain pot.
- `window=7d` is computed per request from `matchPlayer` joined to `match`; `window=all` reads `playerStats`.

## Blocked / waiting
- Needs R1: `contracts/abi/index.ts` exporting `bumpArenaAbi` and `deployments`. Then switch `ponder.config.ts` to them and delete `indexer/abis/`. Until the testnet deploy, set `ARENA_ADDRESS` and `ARENA_START_BLOCK` in the env.
- If the contract adds fields to the events, tell R4; the schema follows C3 exactly.
- P1 (Railway, CI, vite build hygiene) not started. Railway needs the user logged in.

## What R1-R3 need to know
- Only R4 runs `pnpm install` / `pnpm add`. Send dependency requests via the PM. Run scripts with `pnpm --filter <pkg> <script>` or `pnpm -r`.
- `.env.example` at the root lists every C8 name. Never create or commit `.env`.
- Ports: indexer 42069. Indexer env: `PONDER_RPC_URL_46630`, `ARENA_ADDRESS`, `ARENA_START_BLOCK`, `CORS_ORIGINS`.
- R3: `@bump/shared` and `@bump/contracts` are already workspace deps of the root, so `import ... from "@bump/shared"` works once R2 fills it. The root `tsconfig.json` was not changed.
- Git is initialised but empty: nothing is committed.


---

# R1 (Smart contracts), 2026-10-09

## DONE except the testnet deploy (awaiting user)
- `@bump/contracts` resolves: `contracts/abi/index.ts` exports `bumpArenaAbi` (generated into `contracts/abi/BumpArena.ts` by `node contracts/script/export-abi.mjs`) and `deployments`. ABI frozen against C3.
- `forge build` clean in `src/` and `script/`. `forge test`: 77 passed, 0 failed (65 unit, 8 fuzz at 256 runs, 5 invariants at 256 runs x depth 64 with 16384 calls, 3 vector tests). `node contracts/script/check-vector.mjs` prints the same digest as the JSON and exits 0.
- Test vector: `contracts/test/fixtures/result-vector.json` (`message` and `result` hold the same object).
- Anvil deploy proven with `Deploy.s.sol` (chain id 46630 local, unlocked account) and `record-deployment.mjs`. The local broadcast output was deleted.
- `settle` gas: 2 players 121,067, 8 players 276,376 (details and review in `contracts/README.md`).

## Additive deviations from C3 (ABI consumers)
- Extra errors `TransferFailed()`, `InvalidMatchParams()`, `ZeroAddress()`; extra constants `RESULT_TYPEHASH`, `VEHICLE_COUNT`, `MAX_PLAYERS_LIMIT`; OZ Ownable2Step/Pausable entries. R3 should map the three extra errors to UI copy.
- `cancel` emits `MatchCancelled` only (no per-player `Refunded`). The indexer should treat cancelled-match players as refunded implicitly.

## Awaiting user: testnet deploy
- `contracts/deployments/46630.json` is a placeholder (`"status": "pending"`, zero addresses). Do not use the address until `status` is gone.
- Candra must: `cast wallet import bump-deployer --interactive`, fund it from the faucet, pick OWNER/SIGNER/OPERATOR/TREASURY addresses, then run the commands in `contracts/README.md` ("Deploy to testnet"). Afterwards `node script/record-deployment.mjs` fills `deployments/46630.json`; R4 then sets `ARENA_ADDRESS` / `ARENA_START_BLOCK`.
- R4: `contracts/abi/index.ts` now exists, so `indexer/abis/` can be replaced by `bumpArenaAbi`.


---

# R2 (Game server), 2026-10-09

## Result: P0 DONE, P1 partly done
- `pnpm --filter @bump/shared typecheck`, `pnpm --filter @bump/server typecheck`: exit 0.
- `pnpm --filter @bump/shared test`: 11 passed (the 6 required tests, plus prediction replay and economy edge cases).
- `pnpm --filter @bump/server test`: 12 passed. Includes the vector test (exact `digest` and `signature` from `contracts/test/fixtures/result-vector.json`), settler retry and restart-resume tests, and an anvil integration test.
- Integration test (anvil `--chain-id 46630`, R1's compiled `BumpArena` from `contracts/out`, two real `@colyseus/sdk` clients, an impostor claim): open, join x2, `claimSeat` x2 (impostor gets `SEAT_REJECTED`), start, bumps move money, `matchEnd`, `settle`; `getMatch.status == Settled`, `PlayerResult` balances sum to 200, `/health` is 200, replay file hashed. A second test replays a settlement outage and restarts the server: the pending file is re-submitted and confirmed. The test skips itself when `contracts/out` or anvil is missing.
- Greps clean: no `document|window|AudioContext|GLTFLoader|performance.now|Date.now|Math.random|setTimeout` in `packages/shared/src`; no comments in `packages/shared/src` or `server/src`; no `DOM` in the shared `lib`. Biome check clean on `packages/shared` and `server`.
- CPU for one 8-car room (bots, 90 s, 5400 ticks, includes the AI and the zero-sum assert, excludes Colyseus encoding): mean 0.23 ms per tick, p50 0.20 ms, p99 0.65 ms, max 5.8 ms. About 1.4 % of one core at 60 Hz. Not measured: patch encode and socket cost, real network.
- No chain transactions were sent to a real network; no deploy; no key was read or printed (only the public anvil test keys appear in tests).

## Files
- `packages/shared/src/`: `protocol/{enums,schemas,messages}.ts`, `sim/{constants,handling,spawn,types,stepCar,SimWorld,SimCar,Economy,Ranking,CollisionRules,MatchSim,CarAI,prediction}.ts`, `chain/result.ts`, `rng/Prng.ts`, `index.ts`; tests in `packages/shared/test/sim.test.ts`.
- `server/src/`: `index.ts`, `app.ts`, `config.ts`, `metrics.ts`, `rooms/{ArenaRoom,context}.ts`, `chain/{ChainGateway,ViemChainGateway,Settler}.ts`, `log/InputLog.ts`; tests in `server/test/`; `server/README.md`.
- Also edited inside my paths: `packages/shared/tsconfig.json` (include `test`), `server/tsconfig.json` (see deviation 6). Biome reformatted my files to double quotes.

## Colyseus 0.18.9 findings (checked against docs.colyseus.io and the installed types)
- Server input accessor is `this.inputs` (from `defineInput`), read with `this.inputs.get(sessionId).next()`. There is no `room.input` on the server. The **client** has `room.input<I>()` returning a handle (`input.data.x = ...; input.send()`). `defineInput(Schema, { bufferMaxSize, sanitize, idle })` works as documented. I use `idle: true` so `next()` always yields a frame (zeros when empty), which matches the input-log rule.
- `setFixedTimestep(step, 60)`: `ctx.tick` is a monotonic step index. One input is consumed per seat per step.
- `t.quantized` takes an options object: `t.quantized({ min, max, bits })`, not positional arguments. Max 63 fields per Schema (Car 22, MatchState 14).
- Server setup is `defineServer({ transport, rooms: { arena: defineRoom(ArenaRoom) }, routes: createRouter({ ... createEndpoint }) })` then `server.listen(port)`; `gracefullyShutdown(false)` for tests.
- Reconnection: `onDrop(client)` plus `allowReconnection(client, 10)`; the reconnected client keeps its `sessionId`, so the wallet binding survives without a new `claimSeat`. `allowReconnection` rejects while the room is disposing, so the promise is caught.
- `predict.sim` opaque engine: `adopt(w)` reseeds scalars on each ack, `pose(w)` returns a flat pose, contact caches and solver state are not rolled back. `adoptCar`, `poseCar`, `stepPredictedCar`, `createPredictionWorld` are provided in `@bump/shared` (P1). A replay from an adopted state in a straight line matches the server to 5 cm over 30 ticks; hard drifts will diverge for a few ticks (warm-start contacts are not restored), which is why the reconciler should smooth.
- Rapier gotcha that mattered: body mass properties (`setAdditionalMass`) are only computed on the first `world.step()`. Impulses applied before it act on a ~12 kg body. `MatchSim.create` and `createPredictionWorld` therefore run one priming step. **R3 must prime any client-side physics world the same way** (or use `createPredictionWorld`).

## Deviations from contracts.md (additive or clarifying; PM please confirm)
1. **Event channel:** all server events go through one `room.broadcast('ev', event)` and `event.t` is the type. contracts.md did not name the channel. Same channel is used with `client.send` for the per-client `settlement` replay on join.
2. **Tier names** are `LIGHT | HEAVY | PERFECT | CRITICAL` (the names in `CollisionTypes.ts`). C5 lists `MEDIUM`, but also says to use the `CollisionTypes.ts` names; there is no MEDIUM in the code.
3. **Power-up crates** were not in C5, but the client cannot show them otherwise. Added `MatchState.crates: Map<id, Crate{id,kind,x,z}>` plus events `{ t:'crateSpawn', tick, id, kind, x, z }` and `{ t:'crateTaken', tick, id, car, kind }`. `TITAN` and `HEAVY_HIT` are one kind (`2`).
4. **Wall bumps:** a wall hit with no money has `attacker = the car`, `victim = 'wall'`, `amount = 0`. A wall slam that moves money has `attacker = the slammer`, `victim = the slammed car`, `kind:'wall'`.
5. **Disconnected cars are never eliminated by a timeout** (C5 Timing says they stay as targets). The sim supports `disconnectEliminationTicks` and the redistribution path for `disconnectTimeout`; the server leaves it unset.
6. **`@types/node` is not a dependency of `@bump/server`.** Workaround in `server/tsconfig.json`: `types: ["node"]` with `typeRoots` pointing into the pnpm store (`node_modules/.pnpm/@types+node@26.6.4/...`). Please have R4 add `@types/node` as a devDependency of `@bump/server` and drop the `typeRoots` line.
7. **Input log byte order** (undefined in C6): big-endian `u32 tick | u8 seat | i8 throttle | i8 steer | u8 buttons`, tick counted from 0 at the first LIVE tick. Documented in `server/README.md`.
8. **Skipped, cosmetic only (no money effect):** near-miss CLOSE_CALL, corner PINNED and CHAIN_BUMP skill moments. Hit-stop is not in the sim.
9. **RTT gate (P1) not done**, and `bytesOutPerSecond` / `rttMs` in `/metrics.json` are `null`: Colyseus 0.18 core exposes no per-client RTT or byte counter. It needs a ping message agreed with R3.
10. Spawn slots: 8 seats on a ring of radius 12 facing the centre. Join option `vehicleId` is ignored; the vehicle comes from `vehicleOf` on chain.
11. `Settler.selfCheck` compares the local EIP-712 digest with `hashResult` on chain at startup and aborts on a mismatch; an unreachable RPC only logs.

## Notes for the others
- R3: seat claim text, input fields, schema and event names are exactly `@bump/shared` (`seatMessage`, `InputFrame`, `MatchState`, `Car`, `ServerEvent`). Quantised axes: `quantizeAxis(v)`.
- R4: the server writes `REPLAY_DIR/pending/*.json` and `REPLAY_DIR/replays/*.json` (default `./replays`); consider ignoring `server/replays/` in `.gitignore`. Start command `pnpm --filter @bump/server start`, health `GET /health`, metrics `GET /metrics.json`.
- Awaiting the user: funded relayer, signer and operator keys (`OPERATOR_ADDRESS` is the relayer's address) and the deployed address, for the testnet run.


---

# R1 second pass (gasless mock-token), 2026-10-09

## DONE except the testnet deploy (PM)
- New: `contracts/src/MockBUMP.sol` (ERC20 + Permit, `claim(address)` 1000 BUMP per recipient per 24 h, `setArena` once, arena `transferFrom` skips the allowance). Rewritten: `contracts/src/BumpArena.sol` (token stakes, `joinWithSig(JoinIntent, sig)` callable by anyone, direct `join`, pushed payouts, cancel and `claimRefund(matchId, player)` pushed, callable by anyone).
- `forge test`: 109 passed, 0 failed (58 arena unit, 22 join-by-signature unit, 12 MockBUMP incl. 1 fuzz, 10 arena fuzz at 256 runs, 8 invariants at 256 runs x depth 64 = 16384 calls, 6 vector tests). `node contracts/script/check-vector.mjs` re-derives both digests with viem and exits 0. Local anvil (chain id 46630): `Deploy.s.sol` + `record-deployment.mjs` + a viem-signed `JoinIntent` submitted by the relayer worked, the player's ETH balance did not change.
- Invariants: arena token balance == sum of live stakes (Open/Started pots, plus unrefunded stakes of Refunding matches); arena ETH balance == 0; token total supply == total claimed; a match settles at most once; settled and refunding are exclusive; pot == players x stake.
- Gas: `joinWithSig` 199,194 (first) / 167,811 (second) / 147,889 (eighth); `settle` 105,932 (2 players) / 212,133 (8 players); `claim` about 92,000 for a first claim.
- `contracts/abi/index.ts` exports `bumpArenaAbi`, `mockBumpAbi`, `deployments`. `deployments/46630.json` is a `"status": "pending"` placeholder again (zero addresses); the abandoned ETH deployment `0xdF8A07e865a18904677db7137330464178195F40` is not recorded in the repo.
- `docs/handoffs/contracts.md` C1-C4 and C8 rewritten for the new design (C3 is the new source of truth). C5 (`stakeWei`, `payoutWei`, the `join` transaction before `claimSeat`), C6 step 2 (partly patched) and C7 (`...Wei` names) are R2/R3/R4's to update.

## Deviations from 05
- `JoinIntent.matchId` is `bytes32` (05 says `uint256`): the whole system already uses a `bytes32` match id.
- `claimRefund` keeps its name but takes `(bytes32 matchId, address player)`; `cancel` still emits only `MatchCancelled`.
- `BumpArena` constructor has a trailing `token_`. Errors removed: `WrongStake`, `NothingToClaim`, `TransferFailed`; added `IntentExpired`. Event `Claimed` removed from the arena (it now exists only on `MockBUMP`).
- `VITE_FAUCET_URL` dropped from C8 (the faucet is the server's `POST /faucet`); `STAKE_AMOUNT`, `TOKEN_ADDRESS`, `RELAYER_MIN_BALANCE_WEI`, `VITE_TOKEN_ADDRESS` added. The deploy script reads no stake variable.

## Notes for R2, R3, R4
- R2: join = verify the `JoinIntent` (same EIP-712 domain as `Result`), check `intent.deadline`, `matchId`, `balanceOf(player) >= stake`, `getMatch` is Open, then relayer calls `joinWithSig(intent, sig)`. Pre-check `MockBUMP.nextClaimAt(wallet) <= now` before `claim(wallet)`. Token reverts (`ERC20InsufficientBalance`, `ClaimCooldown`) bubble up: decode with both ABIs. Refund and cancel push tokens, so a keeper can call `claimRefund(matchId, player)` for each player after `settleDeadline`.
- R3: one `eth_signTypedData_v4` per join, `deadline` as a bigint/decimal string, `vehicleId` from C4. Vectors: `contracts/test/fixtures/join-vector.json`. No approve, no permit, no claim step for winnings.
- R4: new ABI and addresses, `Claimed` from `MockBUMP` ignorable. Arena events are unchanged in shape; the arena has no `Claimed` any more. Cancelled-match players are refunded implicitly (no per-player `Refunded`).
- PM deploy: see "Deploy to testnet" in `contracts/README.md`. Deploy with the relayer keystore account (it becomes `MockBUMP` owner); the script then calls `setArena`. Run `node contracts/script/record-deployment.mjs` afterwards, which also checks `arena.token()` and `token.arena()`.



---

# R2 gasless pass (server), 2026-10-09

Status: DONE (2026-10-09). Shapes below are final. Everything is in `@bump/shared` (`packages/shared/src/chain/join.ts`, `protocol/messages.ts`) so R3 imports, never redeclares.

## Join (replaces "player sends a join tx, then claimSeat")
Client, after reading `state.matchId`, signs one EIP-712 `JoinIntent` (domain `buildDomain(arena)`, types `JOIN_INTENT_TYPES`, `deadline` as a decimal string on the wire) and sends the Colyseus message `JOIN_INTENT_MESSAGE` (`"joinIntent"`):

```ts
room.send("joinIntent", { intent: { matchId, player, sessionKey, vehicleId, deadline /* decimal string, unix s */ }, signature } satisfies JoinIntentMessage)
```

- `intent.matchId` must equal `state.matchId`; `deadline` must be in the future (pick now + 120 s or less than `state.joinDeadline`); `vehicleId` 0..6; `sessionKey` is the local key that will sign `claimSeat`.
- Success: one event on the `ev` channel, to that client only: `{ t:'joinResult', matchId, wallet /* lowercase */, seat, txHash }`. After it, send `claimSeat` exactly as before (C5). The server never binds a seat from the join alone.
- Failure: `{ t:'error', code, message, retryAfterS? }` on the `ev` channel. New codes (`JoinErrorCode`): `JOIN_MALFORMED`, `BAD_SIGNATURE`, `INTENT_EXPIRED`, `WRONG_MATCH`, `MATCH_CLOSED` (not Open, not in LOBBY, or past `joinDeadline`), `ALREADY_JOINED` (the wallet is already on chain: go straight to `claimSeat`), `INSUFFICIENT_BALANCE` (token balance below the stake: show the faucet), `JOIN_PENDING` (one join in flight for that wallet), `RATE_LIMITED` (20 joins per IP per hour; `retryAfterS`), `RELAYER_LOW`, `JOIN_FAILED`. Existing codes `ROOM_FULL`, `CHAIN_UNAVAILABLE` also apply.
- `ErrorEvent` gained optional `retryAfterS`.
- Wire names are unchanged: `MatchState.stakeWei` and `RankingRow.payoutWei` still carry those names but are now token base units (18 decimals). No rename, so R3 is not broken mid-flight.
- The direct on-chain `join` (player with gas) still works; the player then sends `claimSeat` as before.

## HTTP (same port as the websocket, 2567; CORS from `CORS_ORIGINS`, comma separated, default `http://localhost:5173`)
```
POST /faucet   body {"wallet":"0x..."}
  200 { txHash, nextClaimAt }                        // nextClaimAt unix seconds (chain value after the claim)
  4xx/5xx { code, message, retryAfterS, nextClaimAt? }   // FaucetError
    400 INVALID_ADDRESS | 429 COOLDOWN (retryAfterS and nextClaimAt from chain) | 429 RATE_LIMITED (5/IP/hour)
    429 GLOBAL_LIMIT | 503 RELAYER_LOW | 503 CHAIN_UNAVAILABLE | 502 CLAIM_FAILED
GET  /faucet/status?wallet=0x...
  200 { wallet, balance /* decimal string, token units */, nextClaimAt /* 0 = claimable now */, canClaimNow }
  400 { code:'INVALID_ADDRESS', message, retryAfterS:0 }
GET  /metrics.json  -> existing fields plus relayerBalanceWei: string | null
GET  /health        -> unchanged
```
Types: `FaucetSuccess`, `FaucetError`, `FaucetStatus`, `FaucetErrorCode` in `@bump/shared`. `/faucet/status` is the cheapest way for the client to render the countdown (one HTTP call, the server reads `balanceOf` and `nextClaimAt`).

## Server env (README table has the rest)
`STAKE_AMOUNT` (replaces `STAKE_WEI`), `TOKEN_ADDRESS` (optional, defaults to `arena.token()`), `RELAYER_MIN_BALANCE_WEI` (default 2000000000000000), `CORS_ORIGINS`, `FAUCET_*`/`JOIN_*` limit overrides.


---

# R4 gasless pass, 2026-10-09

## DONE (indexer only)
- `ponder.config.ts` uses `bumpArenaAbi` and `deployments` from `@bump/contracts`. `ARENA_ADDRESS` and `ARENA_START_BLOCK` are now optional overrides; the defaults are `deployments.BumpArena.address` (`0xf00dAfa18463fDf3274bBe93EEB92f8Bf7567803`) and `.blockNumber` (131496166, the arena's own block in `46630.json`; MockBUMP is at 131496145). `indexer/abis/` deleted and removed from `indexer/tsconfig.json`.
- Handlers unchanged in logic: the arena events have the same shape. No arena `Claimed`; `MockBUMP` is not indexed. `MatchCancelled` marks every seat `refunded` (implicit refund); `Refunded` (post-deadline `claimRefund`) marks that player and sets status `refunding` unless already cancelled. Payouts are token units pushed at settle.
- Renamed (schema and API): `stakeWei` -> `stakeAmount`, `potWei` -> `potAmount`, `payoutWei` -> `payoutAmount`, `totalPayoutWei` -> `totalPayoutAmount`, `totalStakeWei` -> `totalStakeAmount`, `netPnlWei` -> `netPnlAmount`. Same routes, same shape, `claimableHint: null` kept for shape. C7 in `contracts.md` updated.
- `.env.example`: `DATABASE_SCHEMA=bump_v2`. `indexer/README.md` updated.

## For R3
Every amount from the indexer is a decimal string of 18-decimal base units; format as BUMP. Fields: match `stakeAmount`, `potAmount`; seat and `/matches?wallet=` `payoutAmount` (nullable); stats rows `totalPayoutAmount`, `totalStakeAmount`, `netPnlAmount` (may be negative, with a leading minus). Nothing to claim: ignore `claimableHint`.

## Verification (local anvil, chain id 46630, R1's `contracts/out`, only public anvil keys)
- `pnpm --filter @bump/indexer typecheck`: exit 0.
- Deployed MockBUMP, BumpArena, `setArena`; two players `claim`ed; match A: two viem-signed `JoinIntent`s submitted via `joinWithSig`, `startMatch`, viem-signed `Result` (balances 150/50, ranks 1/2) `settle`d; match B: one join then `cancel`. On chain: p1 1050 BUMP, p2 950, arena 0.
- API: `/matches/A` settled, payouts `150e18` and `50e18`, `potAmount 200e18`, winner p1; `/matches/B` cancelled, seat `refunded: true`, no stats effect; leaderboard (`all` and `7d`) p1 `netPnlAmount +50e18`, p2 `-50e18`, `matches 1`; `/players/:wallet` and `/matches?wallet=` match; `/ready` 200.
- Restart idempotence: after stop and start on the same PGlite data `/players/:wallet` is byte-identical, 0 errors in the log.
- CORS: `Access-Control-Allow-Origin: http://localhost:5173` for the allowed origin. Ponder's own server middleware also adds `Access-Control-Allow-Origin: *` globally, so other origins are not blocked (public read-only data); not changeable from the indexer.

## Deviations
- Start block is the arena's deploy block (131496166), not 131496145 from the task text; both are in `46630.json` and the arena cannot emit earlier.
- anvil and ponder stopped, temp script and `.ponder/` deleted. Railway `DATABASE_SCHEMA` for the hosted indexer must be set to `bump_v2` (or a deployment-id schema) by the PM; I did not touch Railway config.


---

# R3 gasless pass (client), 2026-10-09

## Result: DONE against the R2 shapes; typecheck and build pass, not run against a live server
- `pnpm exec tsc --noEmit -p .` exit 0. `pnpm build` exit 0 (existing chunk-size warning only). No dev server left running, no transaction sent, no key or `.env` read.

## What changed
- Join: one `eth_signTypedData_v4` of `JoinIntent` (`src/chain/intent.ts`, uses `buildDomain`, `JOIN_INTENT_TYPES` and `JoinIntentMessage` from `@bump/shared`; `deadline` = min(now+120 s, `joinDeadline`), bigint when signing, decimal string on the wire), sent as `joinIntent` via `NetClient.sendJoin`. On `joinResult` (own wallet) the client sends `claimSeat` as before. `ALREADY_JOINED` goes straight to `claimSeat`. If neither `joinResult` nor an on-chain `sessionKeyOf` match appears within 60 s the lobby shows a retry. The chain poll (3 s) also detects a registered session key, which covers reload and a missed event.
- Removed: join transaction, ETH balance gate, ETH wording, `claim`/`claimRefund` transactions, `readClaimable`, `simulateJoin`, `sendJoin`, `waitForReceipt`, `VITE_FAUCET_URL`. The wallet panel still connects and adds/switches chain 46630 (needed for signing). No transaction popup remains.
- Token UI: BUMP balance via `balanceOf` on `MockBUMP` (`src/chain/token.ts`), "CLAIM 1000 BUMP FREE" button in the wallet panel and in the lobby when the balance is below the stake (`src/chain/faucet.ts`, `src/ui/online/faucetBlock.ts`). The button calls `POST {http base of VITE_GAME_SERVER_URL}/faucet`, shows a live countdown from `nextClaimAt` (read from `GET /faucet/status`, falling back to `nextClaimAt` on chain) and the structured error copy. Lobby shows "Stake 100 BUMP" (server `stakeWei` when present, else 100 BUMP).
- Results: payout column in BUMP, "PAID x BUMP TO YOUR WALLET" with the settle explorer link. Refund and cancel show status text only ("stake refund is being sent", "returned to your wallet").
- Errors: `src/chain/errors.ts` (viem reverts: IntentExpired, BadSignature, ERC20InsufficientBalance, ClaimCooldown, others) and `describeServerCode` in `faucet.ts` (all R2 join and faucet codes, `RELAYER_LOW`, `RATE_LIMITED` with `retryAfterS`). `INSUFFICIENT_BALANCE` re-opens the faucet block.
- Config: `src/config/env.ts` adds `tokenAddress` (`VITE_TOKEN_ADDRESS`, default `deployments.MockBUMP.address`) and `gameServerHttpUrl` (ws to http, wss to https). `src/vite-env.d.ts` and `.env.example` updated (VITE_TOKEN_ADDRESS added, VITE_FAUCET_URL removed).
- Leaderboard: reads `netPnlAmount` and falls back to `netPnlWei`, formatted as BUMP (18 decimals, 2 digits).
- Offline mode, session-key storage and reconnect are untouched.

## Deviations
- Stake and payout are read through `stakeAmount ?? stakeWei` and `payoutAmount ?? payoutWei` (`src/net/protocol.ts`), so a later R2 rename does not break the client.
- Faucet countdown uses `/faucet/status` rather than only the chain read; balance still comes from the public client as asked.
- `STAKE_WEI` in the server section of `.env.example` is left for R2/R4.

## Needs live verification
- Real `eth_signTypedData_v4` in MetaMask on chain 46630 against the deployed arena (signature accepted by R2 and by `joinWithSig`), then `joinResult` followed by `claimSeat`.
- `POST /faucet` and `GET /faucet/status` from the browser origin (CORS), the countdown after a claim, and the balance refresh after it.
- Reload mid-lobby after signing (session key reuse), and the post-`settleDeadline` refund status text.
- Indexer field names (`netPnlAmount`) once R4 deploys the rename.

## Results and deviations (R2 gasless pass)
- `pnpm --filter @bump/shared typecheck` and `@bump/server typecheck`: exit 0. `@bump/shared test`: 11 passed. `@bump/server test`: 29 passed (join-vector relay, bad signature, wrong match, expired, closed, full, already joined, low token balance, one pending join per wallet, 20/IP/hour, relayer-balance guard, faucet cooldown, 5/IP/hour, global ceiling, refund keeper, config, settler, result vector, anvil integration).
- Anvil integration (local `--chain-id 46630`, MockBUMP + BumpArena from `contracts/out`, `setArena`): two real SDK clients get BUMP from `POST /faucet`, join with a signed `joinIntent` (player ETH balance unchanged), `claimSeat`, play, settle; token balances sum to the faucet total, arena token balance 0; faucet 429 `COOLDOWN` with CORS header, OPTIONS preflight 204, `/faucet/status`, `/metrics.json` `relayerBalanceWei`; restart-resume of a pending settlement still works.
- Settle/cancel/refund: payouts and refunds are pushed, there is no claim step. New `RefundKeeper` (`server/src/chain/RefundKeeper.ts`) persists `REPLAY_DIR/tracked/<matchId>.json` at room open, and every 60 s after `settleDeadline` calls `claimRefund(matchId, player)` for every player of an unsettled match (treats `AlreadyRefunded` as done); it also cancels an Open match under `MIN_PLAYERS` past its join deadline. Settled/cancelled matches are dropped. The room still calls `cancel` itself when the join window closes under the minimum.
- Deviations: (1) wire names `stakeWei`/`payoutWei` kept (token units) so R3 is not broken; rename later in one coordinated step. (2) `JoinIntent.matchId` is bytes32 (as R1). (3) Client IP comes from `x-real-ip`, else the last `x-forwarded-for` hop, else `unknown` (one shared bucket) for HTTP, and `context.ip` for the websocket; the HTTP routes have no socket address in the Colyseus router, so a direct deployment without a proxy shares one faucet bucket. (4) CORS is applied through `matchMaker.controller.getCorsHeaders` (the Colyseus-wide hook), so matchmaking requests get the same allow-list: the request origin is echoed when it is in `CORS_ORIGINS`, otherwise the first listed origin. (5) A read failure while checking a join or a faucet claim answers `CHAIN_UNAVAILABLE` rather than proceeding.
- Not done: ERC-1271 smart-wallet signatures (EOA only); per-wallet faucet limit beyond the chain's 24 h cooldown plus an in-flight guard.
