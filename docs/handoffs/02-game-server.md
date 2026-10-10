# 02 — Realtime game server engineer (R2)

**Goal:** build the authoritative realtime server for BUMP.TRADE.
- A Colyseus 0.18 Node server runs one headless Rapier world per room at a fixed 60 Hz, for 2–8 staked players.
- It owns the zero-sum money ledger, streams state to clients, and settles each match on **Robinhood Chain testnet (46630)** with one EIP-712-signed `settle` transaction.
- To do this, you first build `@bump/shared`: a headless, DOM-free copy of the game simulation plus the wire protocol. Both the server and the client import it.

## Context — read first

1. `docs/handoffs/contracts.md`. It is **authoritative**: C1, **C2 (economy and ledger rules, ranking)**, **C3 (contract functions you call, EIP-712 `Result`)**, C4 (vehicle IDs), **C5 (protocol: you provide it)**, **C6 (room lifecycle, input-log format)**, C8 (env vars), C9 (versions and layout).
2. `docs/research/realtime-architecture.md`, in full:
   - F1 (authority; F1.3 is the Node smoke test; F1.4–F1.5 cover determinism);
   - F2.1 (Colyseus 0.18 netcode APIs);
   - F3 (tick rates, prediction, no physics rewind, bandwidth);
   - F4–F5, F8 (repo blockers);
   - R3–R7;
   - Implications → Realtime game server engineer.
3. `docs/research/repo-audit-and-tooling.md`:
   - A2 (tick order `GameApp.ts:642-664`, timing problems);
   - A3 (state locations, EventBus table, zero-sum audit);
   - A4 (physics, damage computation `CollisionSystem.ts:112-438`, and the **nondeterminism table**);
   - A5 (`CarAI` as bots);
   - A6 (module classification);
   - A7 (refactor list, items 1–12);
   - Implications → Realtime game server engineer.
4. `docs/research/robinhood-chain.md`:
   - Network parameters;
   - §5 (viem `robinhoodTestnet`; the public RPC has **no WSS and no filters**);
   - §8 (providers);
   - §9 (bot-traffic terms);
   - Implications → Realtime game server engineer.
5. `docs/handoffs/00-overview.md`, sections 3 (especially D1, D2, D5, D7, D11, D12, D13, D16), 7 (demo path), 9 and 10.

## Tools — skills and MCP

- **Colyseus `colyseus` skill**, if the user approved it (check `.claude/skills/colyseus/`). Invoke it before writing room, schema, input or prediction code.
- **If it is not installed**, use `https://docs.colyseus.io/llms.txt` and the pages `/netcode`, `/netcode/server-input`, `/netcode/client-prediction`, `/netcode/determinism`, `/room` and `/state/schema`, read at **0.18.9**.
- viem: `https://viem.sh/llms.txt` (`signTypedData`, `readContract`, `writeContract`, `waitForTransactionReceipt`, `fallback`, `nonceManager`).
- Rapier: `https://rapier.rs/docs/user_guides/javascript/getting_started_js`. There is no llms.txt.

## Owned paths

You may write **only**:
- `packages/shared/**`: `@bump/shared` (`src/sim/`, `src/protocol/`, `src/chain/`, `src/rng/`, tests, `package.json`, `tsconfig.json`)
- `server/**`: `@bump/server` (`src/`, tests, `package.json`, `tsconfig.json`, `Dockerfile` or `railway` start command if R4 asks for one)

**Read-only for you:**
- `src/**` (the client): you read it to copy and clean logic, and you never edit it (decision D11).
- `contracts/**`, `indexer/**`, and the root files.

Dependencies come from contracts.md C9 and are installed by R4. If you need another one, ask the PM.

## Responsibilities

- Build a headless simulation package that reproduces today's car physics and collision economy, deterministic per tick, with a per-tick zero-sum assertion.
- Build the wire protocol shared by server and client.
- Build the Colyseus room: lobby, seat claim, countdown, live sim at 60 Hz, end.
- Build chain I/O: `openMatch`, `startMatch`, `settle`, `cancel`, and the seat check through `readContract`.
- Build the EIP-712 signer, the input log and its hash, and settlement retry.
- Provide health and telemetry.

## Scope

### In scope
- `@bump/shared`:
  - `sim/`: `SimWorld`, `SimCar`, `ArenaSim`, `CollisionRules`, `MatchRules`, `Economy`, `Ranking`, power-ups, `CarAI` as a policy;
  - `protocol/`: the C5 schemas, message types and enums;
  - `chain/`: the EIP-712 `RESULT_TYPES`, the domain builder, the payout helper, and the `claimSeat` message builder;
  - `rng/`: a seeded PRNG.
- `@bump/server`: the Colyseus app, `ArenaRoom`, ChainGateway (viem), Settler, InputLog, health endpoint and config.

### Out of scope
- Any edit to `src/` (the client and its offline mode belong to R3), and any rendering, audio or UI.
- The contract (R1), the indexer and deployment infrastructure (R4), and client prediction code. You *provide* the shared `stepCar` that client prediction reuses; R3 wires it in.
- Bots in staked rooms. A practice room with bots is P2.

## Objectives

1. Every bump on both clients shows the same amount, decided by the server alone, and `Σ balances` never changes.
2. Every staked match ends either `SETTLED` on chain within the settle window or provably refundable.

## Requirements

**`@bump/shared`.** Do this first: R3 is blocked on `protocol/`.

- **P0 — `protocol/` first:**
  - The C5 Colyseus Schema classes `Car` and `MatchState`; the input definition; the event union types; and the `Phase`, `CarState`, `PowerUpKind`, `MarketEventKind`, `Tier` and skill bitmask enums.
  - The vehicle ID table from C4.
  - Publish these and tell the PM, so R3 can start.
  - Verify each Colyseus API against the 0.18.9 docs. Keep the C5 wire semantics; if an API name differs, report it.
- **P0 — `sim/`**, *copied and cleaned* from the client (D11):
  - From `src/physics/PhysicsWorld.ts`, `src/vehicles/CarPhysics.ts`, `BoostController.ts`, `VehicleTypes.ts` (handling stats only), `src/core/Config.ts` and `src/pickups/PowerUpTypes.ts`;
  - plus the rule parts of `src/collision/CollisionSystem.ts`, `src/vehicles/CarController.ts` (balance, elimination, power-up timers), `src/combat/ComboManager.ts`, `src/combat/BountySystem.ts`, `src/pickups/PowerUpManager.ts` (spawn and collect), `src/core/MatchManager.ts` (timeline);
  - plus the colliders from `src/arena/ArenaFloor.ts`, `ArenaBumperWalls.ts`, `MarginVoidPits.ts` (check only) and `ArenaEvents.ts` (surge state).

  The cleaned copy must:
  - never import `document`, `window`, audio, HUD, `GLTFLoader` or any three.js scene object. Only `three` math types and Rapier compat are allowed. `tsconfig` `lib` must exclude `DOM`, so the compiler enforces this;
  - replace every time source in audit A4 (`performance.now`, `Date.now`, `setTimeout`) with `tick × FIXED_DT`, where `FIXED_DT = 1/60`;
  - replace every gameplay `Math.random` with a seeded PRNG held in room state: Market event pick, power-up type and power-up position;
  - rate-limit contacts **per car pair** in ticks (about 3 ticks ≈ 50 ms), not globally (`CollisionSystem.ts:14,85-94` is the bug);
  - be per-instance, with no singletons: one EventBus, Combo and Bounty per world;
  - have no `'player_car'` special case. Combo applies to every car;
  - emit typed events (`bump`, `eliminate`, `marketEvent`, `phase`) as return values or a listener list per world;
  - expose `stepCar(car, input, dt)` as a pure function, so R3's client prediction runs the same car physics;
  - contain no hit-stop. Hit-stop is a client cosmetic.
- **P0 — `Economy`:**
  - `transfer(from, to, amount)` with `amount = min(damage, from.balance)`, integer only.
  - Non-bump elimination redistribution per contracts.md C2 rule 3. Track the last hitter per victim with its tick.
  - An assertion every tick that `Σ balance == playerCount × START_BALANCE`. It throws in tests and logs plus alerts in production.
  - Every player starts at `START_BALANCE`; the vehicle's `baseStartingBag` is ignored.
  - No `reset`, `repair` or `setBalance` in the public API.
- **P0 — `Ranking`:** C2 ordering. Alive cars by balance descending, then seat; eliminated cars by elimination tick descending, then seat. It records the elimination tick.
- **P0 — `chain/`:**
  - `RESULT_TYPES` and `buildDomain(address)` that match contracts.md C3 exactly;
  - `computePayouts(stake, startBalance, finalBalances)`, which mirrors the contract's floor math. It is used only for display and is never sent on chain;
  - `seatMessage({matchId, wallet, roomId, issuedAt})`, which returns the exact C5 text.
- **P0 — Arena spawn:** 8 spawn slots indexed by seat, so 8 cars fit. Today there are 6 (`OpponentManager.ts:52-59`).
- **P0 — Tests** (vitest):
  1. A headless 8-car bot match (`CarAI` policies) for 90 s of ticks finishes, and the zero-sum assertion never fires.
  2. The same seed and the same input log produce an identical final state hash in two runs within the same process.
  3. Simultaneous bumps between two different pairs in the same tick both transfer.
  4. Ranking tie-breaks.
  5. Redistribution on a void or disconnect elimination.
  6. `computePayouts` matches the contract's floor math, including dust.

**`@bump/server`:**

- **P0 — Bootstrap.** A Colyseus 0.18.9 server on `PORT` (default 2567) with `@colyseus/ws-transport`:
  - define room `arena` (`ArenaRoom`);
  - serve `GET /health` returning `{ ok: true, rooms }`;
  - load config from the env names in C8, fail fast on missing chain variables, and never log key material.
- **P0 — `ArenaRoom`:**
  - `maxClients = 8 + headroom for lobby spectators` (16), `patchRate = 33`, `setFixedTimestep(step, 60)`.
  - Input definition with a `sanitize` clamp, buffer 32, one input applied per tick per seat.
  - `allowReconnection(client, 10)`.
  - Implement the C6 lifecycle exactly. Each phase change sets `state.phase` and broadcasts `phase`; the countdown lasts 3 s.
  - On a `claimSeat` message:
    - verify per C5 with `recoverMessageAddress` against `readContract(sessionKeyOf(matchId, wallet))`;
    - check the 60 s freshness window and single use;
    - bind `client.sessionId → wallet`, add the car from `vehicleOf` and the seat from its `getPlayers` index, and broadcast `seat`.
    - Rejections send `error` with the C5 codes.
  - Spawn cars for **all** on-chain players after the `startMatch` receipt (C6 step 3). A disconnected car stays and is idle.
  - At the end: build `Result`, sign it with `SIGNER_PRIVATE_KEY` (viem `signTypedData`), broadcast `matchEnd` with the ranking, the display payouts from `computePayouts`, the hashes and the signature, then submit `settle` from `RELAYER_PRIVATE_KEY`.
  - Relayer writes `openMatch`, `startMatch`, `settle` and `cancel`:
    - use a nonce manager;
    - time out a receipt after 15 s;
    - retry with backoff until `settleDeadline`;
    - broadcast `settlement` status;
    - a sanctioned or dropped transaction is treated as a timeout and retried.
  - Chain reads use `readContract` with `blockTag: 'latest'`. The transport is `fallback([http(RH_RPC_URL), http(public)])`. `RH_WSS_URL` is optional and never required.
  - Persist pending settlements to `REPLAY_DIR/pending/*.json`, so that a restart re-submits them before the deadline.
- **P0 — InputLog:** record per C6 and compute `inputLogHash` with viem `keccak256`. `replayHash = 0x0` in P0.
- **P0 — `docs`:** `server/README.md` covering env names, how to run (`pnpm --filter @bump/server dev`), and how to run two local clients against it. No secret values.
- **P1 — Replay file** per C6, written to `REPLAY_DIR`, with `replayHash` committed.
- **P1 — Telemetry:** tick time p50/p99 per room (target p99 < 4 ms with 8 cars), bytes out per second, per-client RTT, settlement lag (ENDED → confirmed). Logged as JSON lines and exposed at `GET /metrics.json`.
- **P1 — Prediction support:** confirm the Colyseus `predict.sim` "opaque engine" contract (`adopt` and `pose`) on the client SDK. Provide R3 with `adoptCar(world, carState)` and `poseCar(world)` helpers in `@bump/shared`.
- **P1 — RTT gate:** refuse `claimSeat` when RTT is above 150 ms (configurable).
- **P2:**
  - A practice room `arena_practice`, stake 0, no chain, bots fill empty seats with `CarAI`.
  - Price-driven market events from mainnet Chainlink (D18).
  - A `-deterministic-compat` benchmark.

## Dependencies

- **Before starting:** R4 Part A (workspace, dependencies installed, `packages/shared` and `server` registered).
- **For E2E:**
  - R1's deployed `BumpArena` (`@bump/contracts` `deployments`) and the EIP-712 test vector.
  - Until the deploy lands, develop against **anvil**: run `anvil` and deploy with R1's script. If R1's script is not ready yet, mock `ChainGateway` behind an interface, with the same method set as C3.
- **Keys:** the user generates `SIGNER_PRIVATE_KEY` and `RELAYER_PRIVATE_KEY`, funds the relayer from the faucet, and puts both in a local env that you never read or print. You only reference `process.env.<NAME>`.
- **Consumers:**
  - R3 consumes `@bump/shared` (protocol, `stepCar`, `chain/` helpers) and the room.
  - R4 deploys the server on Railway (P1) and needs your start command and health path.

## Interfaces (contracts.md is authoritative)

- **Provide:**
  - C5: room `arena`, `claimSeat`, input, `Car` and `MatchState` schemas, the events `seat`, `bump`, `eliminate`, `marketEvent`, `phase`, `matchStart`, `matchEnd`, `settlement` and `error`;
  - `GET /health`;
  - the `@bump/shared` exports `protocol/*`, `sim/stepCar`, `chain/{RESULT_TYPES, buildDomain, computePayouts, seatMessage}`, and the vehicle ID table.
- **Consume:**
  - from R1, `bumpArenaAbi` and `deployments` (`@bump/contracts`): `openMatch`, `startMatch`, `settle`, `cancel`, `getMatch`, `getPlayers`, `sessionKeyOf`, `vehicleOf`, `hashResult` (for a startup self-check that your digest equals the contract's);
  - the EIP-712 `Result` type string, exactly:
    `Result(bytes32 matchId,address[] players,uint32[] finalBalances,uint8[] ranks,bytes32 inputLogHash,bytes32 replayHash,uint64 endedAt)`.

## Constraints

- Server authority is absolute:
  - clients never send positions, velocities, balances or collision claims;
  - **never rewind physics contacts** (realtime F3.3);
  - balance changes only through `Economy`.
- Pin `@dimforge/rapier3d-compat` to exactly `0.21.0`, the same build as the client.
- Respect the Robinhood public RPC terms (no disruptive bot traffic): cache `sessionKeyOf` per (match, wallet) and keep reads to a handful per match.
- **Standing rules:**
  - English everywhere.
  - **No comments in code.**
  - Strict TypeScript: no `any`, no `@ts-ignore`, no non-null assertions on real nullables.
  - No new dependency beyond C9 without asking the PM.
  - Invoke the approved skills.
  - Never read, write or echo `.env*` files or keys.
  - No git commit, push, `add -A` or `add .`.
  - Write only in `packages/shared/**` and `server/**`.
  - Report red as red.
- Memory: the server dev process is light (about 340 MB). Never run a server build concurrently with `vite build` or `ponder build`.

## Deliverables

- **P0:**
  - `packages/shared/src/protocol/*`, `sim/*`, `chain/*`, `rng/*` and its tests;
  - `server/src/index.ts` (bootstrap), `rooms/ArenaRoom.ts`, `chain/ChainGateway.ts`, `chain/Settler.ts`, `log/InputLog.ts`, `config.ts` and tests;
  - `server/README.md`.
- **P1:** the replay writer, `/metrics.json`, the `adoptCar`/`poseCar` helpers, and the RTT gate.

## Acceptance criteria

1. `pnpm --filter @bump/shared typecheck`, `pnpm --filter @bump/server typecheck` and `pnpm --filter @bump/shared test` all exit 0. The 6 shared tests listed above exist and pass.
2. `grep -rnE "document|window|AudioContext|GLTFLoader|performance\.now|Date\.now|Math\.random|setTimeout" packages/shared/src` returns nothing. The one exception is `Date.now()` in `chain/seatMessage`, which never runs inside the sim.
3. `packages/shared/tsconfig.json` has no `DOM` in `lib`, and typecheck passes.
4. A vitest in `@bump/server` signs the `message` from `contracts/test/fixtures/result-vector.json` with the vector's test key using `buildDomain` and `RESULT_TYPES`, and gets **exactly** the vector's `digest` and `signature`.
5. With anvil, the deployed `BumpArena` and two scripted Colyseus test clients, an integration test runs a full match and the contract's `getMatch(matchId).status == Settled`. The flow is open, join ×2, `claimSeat` ×2, start, 90 s of ticks or a forced end, then settle. The `PlayerResult` balances sum to `2 × START_BALANCE`.
6. A test where the server is killed after ENDED and restarted shows the pending settlement re-submitted and confirmed.
7. `GET /health` returns 200 while the server runs.
8. No `//` or `/* */` comments in `packages/shared/src` or `server/src`.
9. No file outside `packages/shared/**` and `server/**` was created or modified.
