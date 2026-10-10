# Realtime architecture

Track: realtime multiplayer + chain integration for BUMP.TRADE on Robinhood Chain testnet.
Author: research agent (research-realtime). Date read for every URL below: 2026-10-09.
Chain parameters (chain ID, RPC/WSS URLs, block time, faucet, AA support) are owned by the sibling report `docs/research/robinhood-chain.md` and are not repeated here.

## Summary

**Recommendation in one line:** one authoritative **Colyseus 0.18** Node server per region runs **Rapier 0.21 headless** at a fixed 60 Hz for each 8-player room. It owns all physics, collisions and the zero-sum balance ledger. Clients send only inputs and get 30 Hz binary state patches, predict their own car, and interpolate the other cars about 100 ms in the past. The chain handles only **stake escrow on entry**, **one EIP-712 server-signed settlement per match** (payout proportional to final in-match balance, with input-log and replay hashes committed), and **events**. A **Ponder** indexer turns those events into the leaderboard and match history. Everything runs on Railway.

Key points:

1. **Authority.** Money moves when collision code reads velocities that come from physics (`src/collision/CollisionSystem.ts:116-144`, `:364-371`). Anyone who controls physics or collision detection therefore controls the money. P2P, host-authoritative and lockstep all let a client do that. Only a server-authoritative simulation does not. Rapier's JS build runs headless in Node: verified locally, see F1.3.
2. **Framework.** Colyseus 0.18 (Sept 2026) adds built-in fixed-tick input queues, client prediction with an explicit **Rapier "opaque engine"** mode, interpolation and lag compensation (F2.1). Every other option either lacks rooms and netcode (raw `ws`/uWS), cannot run Rapier WASM (Nakama's goja runtime), needs UDP the host does not offer (Geckos.io on Railway), cannot keep 8 players on one instance (Vercel WebSockets), or no longer exists (Hathora, shut down 2026-05-05).
3. **Netcode numbers.** 60 Hz simulation and input, 30 Hz snapshots, 100 ms interpolation buffer. That is about **7–17 KB/s down per client** and about **0.6 KB/s up**. An 8-player room needs about **0.5–1.1 Mbit/s of server egress**, about 10–25 MB per 3-minute match.
4. **Chain.** Per-bump transactions are impossible. A match has hundreds of ledger events and at least 1 soft-confirmation of latency each, while the game needs a 16.7 ms tick. A player signs exactly **one** wallet transaction, `join(matchId, sessionKey)` with value = stake. All other auth uses a browser-generated session key registered by that same transaction. Settlement can be submitted by anyone because the contract checks the operator's EIP-712 signature. A player-callable refund after a timeout limits what a server outage can cost.
5. **Repo blockers found** (each must be fixed before money is real): a void-pit elimination destroys the balance (`CarController.ts:208-210`); `reset()` mints a full bag (`CarController.ts:530-532`); a single global 50 ms collision throttle drops simultaneous bumps between different pairs (`CollisionSystem.ts:14,85-94`); wall-clock `performance.now()` and `Math.random()` sit in the game logic; the match timer is 90 s (`MatchManager.ts:11`) but the PRD says 2:40–3:00; and the PRDs contradict each other on cash pickup and CASH RAIN (F8).

## Findings

### F1 — Authority model with money at stake

**F1.1 Where money is computed today.** The balance transfer runs inside the collision handler. The handler drains Rapier's event queue (`src/collision/CollisionSystem.ts:76`), derives relative velocity from both cars' physics state (`:116-119`), derives impact force from speed × mass (`:144`), and then runs `stolenCash = min(calculatedDamage, victim.balance)`. It applies `victim.subtractBalance` and `attacker.addMoney` atomically (`:364-371`). A second, wall-slam transfer runs at `:470-480`. These are the only two ledger writes during play. The physical cash spray is cosmetic, because the balance already moved at impact (`src/pickups/PickupManager.ts:283`). The whole simulation, including the AI, steps in the browser (`src/core/GameApp.ts:647-660`) on a fixed 1/60 s accumulator loop (`src/core/GameLoop.ts:72`, `:122-128`). `CollisionSystem.update()` also hard-codes `dt = 1/60` (`:67`).

**F1.2 Why authority must sit with the server.** Damage is a function of velocity, impact angle, speed tier, combo, boost, shield and event multipliers (`CollisionSystem.ts:339-362`). A client that simulates its own car can report any velocity. A client that runs collision detection can invent contacts or suppress them, for example ignoring hits while its SHIELD is down. A client that holds the ledger can simply write balances. The money is zero-sum and real (mechanics PRD `docs/mechanics/prd.md:633-660`), so any authority a client holds is a direct theft vector. The three candidate models compare as follows:

| Model | Who runs Rapier + ledger | Cheat resistance | Fit |
|---|---|---|---|
| P2P / host-authoritative | One player's browser | None vs the host. The host can edit balances or velocities. | Rejected for stakes |
| Deterministic lockstep (all peers simulate, exchange inputs only) | Every client | Resists state edits, but needs bit-exact cross-platform determinism of **all** game code (not just Rapier), adds input delay = slowest RTT, a peer can stall the match by withholding inputs, and every client sees every input (no hidden info) | Rejected: one stalling peer can freeze a staked match; the repo's game code is not deterministic (F1.5) |
| **Server-authoritative** (server simulates, clients send inputs) | Server | Clients can only send inputs. The server clamps and rate-limits them. | **Chosen** |

Industry references follow the same model. Valve's Source engine runs an authoritative server with client prediction, entity interpolation (default view delay about 100 ms) and server-side lag compensation (https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking; direct fetch returned HTTP 403, content corroborated via search snippets and the Valve Interpolation page https://developer.valvesoftware.com/wiki/Interpolation). Rocket League is the closest comparable, with physics cars bumping each other. Its server holds a per-client **input buffer** and can tell clients to speed up or slow down slightly to keep that buffer smooth (official Epic help page: https://www.epicgames.com/help/en-US/c-Category_RocketLeague/c-RocketLeague_Gameplay/rocket-league-input-buffering-settings-a000084497). Its talk "It IS Rocket Science!" by Jared Cone (GDC 2018, https://www.youtube.com/watch?v=ueEmiDM94IE, described at https://www.gamedeveloper.com/design/video-the-rocket-science-behind-i-rocket-league-s-i-physics) is reported by secondary sources to use a fixed 120 Hz physics tick on dedicated servers. I could not open the transcript, so that figure is listed under Assumptions.

**F1.3 Rapier runs headless in Node.** I verified this on 2026-10-09 with the repo's installed `@dimforge/rapier3d-compat@0.21.0` on Node v26.2.0 and a Ryzen 5 5500U, using a scratch script outside the repo. `await RAPIER.init()` works in Node because the compat build inlines the WASM as base64 (https://rapier.rs/docs/user_guides/javascript/getting_started_js). The test was 8 dynamic 850 kg cuboids plus a ground plane with CCD-style collision events, 10,800 steps (3 min at 60 Hz). It took **374 ms cold and 140 ms warm**, about **13–35 µs per step**, and produced 49 collision events. `world.takeSnapshot()` was 20.5 KB. Two runs in the same process gave identical snapshot hashes. Process RSS was 338 MB with two worlds alive. The real `CarPhysics`/`CarController` force code (`src/vehicles/CarPhysics.ts:188-258`) adds JS work per step, but the 16.7 ms tick budget leaves room for dozens of rooms per vCPU. That rooms-per-vCPU estimate is an Assumption until profiled. `CarPhysics.ts` imports `three` only for math types (`:1`, `:23-24`), which also runs in Node.

**F1.4 Rapier determinism guarantees (current versions).**
- npm on 2026-10-09: `@dimforge/rapier3d-compat`, `-deterministic`, `-deterministic-compat` and `-simd-compat` are all **0.21.0**, published 2026-09-25.
- The 0.21.0 package README says the main build "does **not** guarantee cross-platform determinism … still locally deterministic, on the same machine." The deterministic build is "a less optimized build but with a guarantee of a cross-platform deterministic execution" (https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-deterministic-compat@0.21.0/README.md).
- The JS determinism guide is broader. It claims the WASM build is fully cross-platform deterministic given the same version, identical construction and insertion order, and no `Math.sin`/`Math.cos` in initial values, with a check via `takeSnapshot()` hashes (https://rapier.rs/docs/user_guides/javascript/determinism). **The README is the stricter, package-specific statement, so trust the README.**
- The Rust guide says the `enhanced-determinism` feature is required, is incompatible with `simd8`, and needs IEEE 754-2008 compliance (https://rapier.rs/docs/user_guides/rust/determinism).
- Neither source states a performance cost. That needs measuring.

**F1.5 Determinism of the game code, which matters for replays and disputes.** Even with a deterministic Rapier build, the gameplay layer is not deterministic. It uses `performance.now()` for collision throttling and timers (`CollisionSystem.ts:41,85,113,441,523`; `CarController.ts:307,461`), and `Math.random()` for scatter and RNG. Colyseus' determinism contract names exactly these sources of divergence (`Math.random()`, `Date.now()`, unordered-map iteration, shared mutable state). It also requires "the same Rapier build on client and server" (https://docs.colyseus.io/netcode/determinism). Server authority does not require determinism, because reconciliation corrects drift. Replay-based dispute verification does: a third party must re-run the input log and get the same balances.

### F2 — Transport and room framework

| Option | Current version (npm/GitHub, 2026-10-09) | Maintenance | Fits 8-player Rapier physics? | Hosting implications |
|---|---|---|---|---|
| **Colyseus** | `colyseus` 0.18.9 (2026-09-30), `@colyseus/core` 0.18.18, `@colyseus/schema` 5.0.36 (2026-10-03), client `@colyseus/sdk` 0.18.5 (2026-10-03). `colyseus.js` is stale at 0.16.22. Node `>= 22.x`. MIT, 7.35k stars, pushed 2026-10-07. | Very active | **Yes.** It has a fixed-tick server, input buffers, prediction with a documented Rapier "opaque engine" mode, interpolation, rewind, rooms and matchmaking, reconnection, and binary delta state. | Plain Node process with WebSocket by default. One process is enough for the demo. Redis presence is needed only for multi-process. Optional managed Colyseus Cloud. |
| raw `ws` | 8.22.0 (2026-09-26) | Active | Possible, but rooms, matchmaking, reconnection, state encoding, prediction and rewind all have to be hand-written | Any Node host |
| uWebSockets.js | v20.71.0 (GitHub release 2026-09-16). **Not on npm**: install from GitHub tag. Apache-2.0 plus "all rights reserved" notice. | Active | Transport only, same gaps as `ws`. Colyseus can use it via `@colyseus/uwebsockets-transport` 0.18.4. | Native binary per Node ABI |
| Geckos.io | `@geckos.io/server`/`client` 3.1.0 (2026-03-27). Last commit 2026-03-27. | Slow | UDP-like WebRTC datachannels avoid TCP head-of-line blocking, but there are no rooms or netcode | Needs TCP 9208 for signalling plus a **UDP port range (1025–65535 by default)**, with your own STUN/TURN in production (https://github.com/geckosio/geckos.io). Railway documents only HTTP/WebSocket and a TCP proxy, no UDP (https://docs.railway.com/networking/public-networking/specs-and-limits). Fly.io supports UDP only with a dedicated IPv4 and a `fly-global-services` bind (https://docs.fly.io/networking/udp-and-tcp). |
| WebTransport | Browser support: Chrome 97+, Edge 98+, Firefox 114+, **Safari/iOS Safari 26.4+**, about 91.6% global (https://caniuse.com/webtransport). Node has no built-in server. Colyseus' `@colyseus/h3-transport` uses `@fails-components/webtransport`. | Colyseus marks it **experimental, "hasn't been battle tested"** (https://docs.colyseus.io/server/transport/webtransport) | It would enable `.unreliable()` schema fields (https://docs.colyseus.io/state/schema) | Needs HTTP/3/QUIC over UDP plus a TLS cert. Not supported on Railway. |
| PartyKit / Cloudflare Durable Objects | `partykit` 0.0.115 (last modified 2025-09-11, stale). Successor `partyserver` 0.5.10 / `partysocket` 1.3.0 in `cloudflare/partykit`, README says "Work in Progress". | Cloudflare-owned | Weak. A 30–60 Hz `setInterval` prevents hibernation and so accrues duration billing (https://developers.cloudflare.com/durable-objects/best-practices/websockets/). The CPU budget is 30 s per invocation by default (https://developers.cloudflare.com/durable-objects/platform/limits/). Rapier WASM size versus the Worker script limit is unverified. | Edge-hosted, no server to run. Good for lobbies and chat, poor for a 60 Hz physics loop. |
| Nakama | v3.41.0 (GitHub release 2026-09-18), `@heroiclabs/nakama-js` 2.8.0. Apache-2.0. | Active | **No for Rapier.** The TS runtime is the goja VM, ES5 only, with "no support for libraries that require Node, web/browser APIs, or native support" (https://heroiclabs.com/docs/nakama/server-framework/typescript-runtime/). Rapier would need Go bindings. | Go server plus CockroachDB/Postgres (https://github.com/heroiclabs/nakama) |
| Hathora | — | **Shut down 2026-05-05.** Announced 2026-03-04, customers handed to Nitrado GameFabric (https://crux.supercraft.host/blog/hathora-shut-down-where-to-go-after-may-2026/, https://gamesbeat.com/?p=318174; secondary sources) | — | Alternatives Edgegap and GameFabric are container fleets, overkill for a testnet demo |
| Vercel Functions WebSockets | Public beta since 2026-06-22 | Beta | **No.** "A new connection, including a reconnect, can land on any instance", and in-memory state does not cross instances. Connections close at max duration: 300 s on Hobby, up to 800/1800 s on Pro (https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections, https://vercel.com/docs/functions/limitations). Nothing guarantees all 8 players of a room share one instance. | Fine for the static client only |

**F2.1 Colyseus 0.18 netcode details** (https://docs.colyseus.io/netcode, `/netcode/server-input`, `/netcode/client-prediction`, `/netcode/lag-compensation`, `/room`):
- **Fixed tick:** `setFixedTimestep(ctx => step(ctx), 30, { subSteps: 2 })`. The rate is advertised to clients in the handshake, and `ctx` provides `dt`, `tick`, `subSteps` and `subDt`. Apply input once per step, not once per sub-step, "to avoid double-firing impulses". `setSimulationInterval` is deprecated and non-deterministic.
- **Inputs:** `defineInput(Schema, { bufferMaxSize })` defaults to 32 per client. Consumption is via iterate, `next()` or `drain()`, and `sanitize` clamps values on arrival. Inputs must be flat primitive schemas.
- **Prediction:** `predict.reconciler` for single-entity state. `predict.sim` handles an **"opaque engine (Rapier)"**: you supply `adopt` (seed server scalars into the engine before replay) and `pose`. Limitation: contact caches, sleeping islands and solver accumulators are **not** rolled back, so reseed both position and velocity.
- **Interpolation:** remote entities use `lerp` at a default **100 ms** delay. Reconciler `smoothMs` defaults to one patch interval (the examples use 65). The `snap` threshold has no default.
- **Lag compensation:** `allowRewindState({ maxRewindMs })` defaults to 500 ms. `rewind.lastSeenBy(sessionId)` clamps to the window. The only documented use is hitscan `overlaps()` tests.
- **Room defaults:** `patchRate = 50` ms (20 Hz), `maxClients = Infinity`, `autoDispose = true`. Hooks are `onAuth(client, options, context)`, `allowReconnection` and `lock()`.
- **Schema:** at most **63 fields** per Schema (startup fails at 64). Types include `int8…uint32`, `float32/64`, `t.quantized()` and `t.angle()` (8/16/32-bit), plus `.view()` filtering. `.unreliable()` requires WebTransport.
- Demos listed include **"Colyseus Karts"**, but the source is sponsor-only.

### F3 — Netcode design and numbers

**F3.1 Tick rates.**
- **Simulation: 60 Hz.** This matches `GameLoop` (`src/core/GameLoop.ts:72`) and the hard-coded `dt` (`CollisionSystem.ts:67`), so car tuning carries over unchanged. Rocket League reportedly runs its physics at 120 Hz (Assumption A3). At 38 m/s boost (`src/core/Config.ts:40`), a car moves 0.63 m per 60 Hz tick, and CCD is already on (`CarPhysics.ts:53`).
- **Input: 60 Hz**, one input per step. This is Colyseus' rule "one input per fixed step".
- **Snapshots (patches): 30 Hz** (`patchRate = 33`). A boosting car moves about 1.3 m between patches.
- **Interpolation delay: 100 ms**, adaptive up to 150 ms. Gaffer's rule is to buffer about 3× the send interval to survive two lost packets, and he measures that 30 pps needs about 150 ms once jitter is included (https://gafferongames.com/post/snapshot_interpolation/). Over WebSocket/TCP, loss shows up as head-of-line stalls rather than gaps, so 100 ms plus jitter adaptation is enough. Valve's default is also 100 ms.

**F3.2 Client-side prediction and reconciliation** (https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html). The client tags each input with a sequence number or tick. The server echoes the last processed tick. The client adopts the server state and re-applies inputs that were not yet acknowledged. With Colyseus, `predict.sim` with Rapier `adopt`/`pose` does this. **Predict only the local car.** Remote cars are interpolated about 100 ms in the past, so a predicted car-to-car contact will often be wrong. When it is, let the server's correction arrive and blend it with `smoothMs` of about 65 ms, snapping above about 3 m. Optimistic *cosmetic* impact feedback (sound, shake, sparks) can fire locally via `predict.defineEvent`. **Balance numbers on the HUD only change from server events, never from prediction.**

**F3.3 Lag compensation for collisions.** Rewind (Valve, Colyseus `allowRewindState`) is designed for hitscan, where one ray is tested against past positions. A physical car-to-car contact changes **both** bodies' momentum, so you cannot rewind one car without changing the victim's present. **Do not rewind physics contacts.** The server resolves bumps in its present tick. Mitigations:
- (a) Keep players on one region and gate staked joins on RTT, for example refusing joins above about 150 ms RTT (Assumption).
- (b) Optionally use `rewind.lastSeenBy` to *classify* angle quality (PERFECT/BAD, `CollisionSystem.ts:345-346`) from the attacker's view, while the momentum still comes from the present.

**F3.4 Bandwidth estimate (8 cars).**

Hand-packed per-car record:

| Field | Encoding | Bytes |
|---|---|---|
| id | u8 | 1 |
| position x,y,z | 3 × u16 quantized over the 48 m arena (`Config.ts:104-105`), ≈0.73 mm/step | 6 |
| orientation | smallest-three quaternion, 2+9+9+9 bits (https://gafferongames.com/post/snapshot_compression/) | 4 |
| linear velocity | 3 × i16 at 0.01 m/s | 6 |
| angular velocity | 3 × i16 at 0.001 rad/s | 6 |
| boost meter | u8 | 1 |
| flags (boosting, drifting, shield, heavy, magnet, turbo, critical, eliminated) | u8 | 1 |
| balance | u32 (normally sent only on change via events) | 4 |
| **Total** | | **29** |

| Scenario | Down per client | Up per client | Room egress (8 clients) | Per 3-min match |
|---|---|---|---|---|
| Hand-packed, full snapshot, 30 Hz: 8 × 29 + about 12 B header (tick u32, ack tick u32, server time) ≈ 244 B | 7.3 KB/s ≈ 59 kbit/s (+≈1.5 KB/s TCP/IP+WS framing) | input ≈ 7 B (tick u32, throttle i8, steer i8, buttons u8) + framing ≈ 10 B × 60 Hz = 0.6 KB/s | ≈ 0.47–0.6 Mbit/s | ≈ 10.5 MB |
| Colyseus schema with plain `float32` (≈5 B per changed field incl. index; ≈69 B/car) | ≈ 17 KB/s ≈ 133 kbit/s | same | ≈ 1.1 Mbit/s | ≈ 25 MB |
| Colyseus schema with `t.quantized()` 16-bit (≈3 B/field; ≈43 B/car) | ≈ 10 KB/s | same | ≈ 0.7 Mbit/s | ≈ 15 MB |

Delta compression comes free with Colyseus Schema patches: unchanged fields are not sent, and resting or eliminated cars cost almost nothing. Further savings come from omitting velocities for cars at rest (Gaffer's "at rest" bit) and sending balance only through `bump` events. The approach is binary schema rather than msgpack (`@msgpack/msgpack` 3.1.3) or flatbuffers (25.9.23), because Colyseus Schema already does binary deltas plus field-level quantization. Manual `DataView` packing is only worth it if a raw-`ws` fallback is ever built.

**F3.5 State sync versus snapshot interpolation.** Gaffer's state-sync model runs physics on both ends and sends input plus state with a priority accumulator. It also quantizes state **on both sides before each step** so that extrapolation does not drift (https://gafferongames.com/post/state_synchronization/). That applies to the predicted local car: when adopting server state, quantize it the same way the wire did before stepping.

### F4 — On chain versus off chain

**F4.1 Why per-bump transactions are infeasible.** The server ticks every 16.7 ms. A match produces tens to hundreds of transfers (`CollisionSystem.ts:364-371` runs on every non-throttled contact), each of which would need a signed transaction and a sequencer confirmation. On Arbitrum-style chains, soft finality is "a sub-second provisional confirmation that depends on the Sequencer behaving honestly", with 250 ms blocks on Arbitrum One (https://docs.arbitrum.io/how-arbitrum-works/deep-dives/sequencer); Robinhood values are in `robinhood-chain.md`. Even at 250 ms, the chain is 15× slower than the tick, introduces nonce and ordering contention among 8 writers, and costs gas per bump. The chain also cannot compute the collisions; Rapier lives on the server. A fully onchain game such as Sky Strife (an RTS on Lattice's Redstone OP-stack L2, built with MUD) runs actions as transactions: 400k transactions over 4,800 playtest matches (https://www.blockchaingamer.biz/?p=28858, https://decrypt.co/229005/redstone-network-launches-fully-on-chain-ethereum-games). That works for strategy pacing, not for 60 Hz physics. **For a testnet demo the acceptable pattern is: escrow in, off-chain authoritative match, one signed settlement out.**

**F4.2 Settlement primitive.** EIP-712 typed data uses the domain fields `name`, `version`, `chainId`, `verifyingContract` and `salt`. It "does not include replay protection", so the contract must make settlement idempotent per `matchId` (https://eips.ethereum.org/EIPS/eip-712). Use OpenZeppelin Contracts 5.6.1 (npm, 2026-09-24) for `EIP712`, `ECDSA`/`SignatureChecker` and `ReentrancyGuard`. Use Foundry v1.8.5 (GitHub release 2026-10-05) for building and testing.

**F4.3 Payout mapping.** In a staked room every player must start at the same in-game balance B₀. **That is not true today. PM correction, 2026-10-09:** `CarController` defaults to 85 (`src/vehicles/CarController.ts:33,53`), but `HeroCar` passes `config.baseStartingBag` (`src/vehicles/HeroCar.ts:61-68`). That value is set per vehicle and ranges from $69 to $500 (`src/vehicles/VehicleTypes.ts:123,187,251,315,379,443,507`), as `repo-audit-and-tooling.md` A3 found. Staked rooms must therefore override it with a uniform B₀. The PRD examples use $185–$320. Stake S maps to B₀. In-match money is conserved (Σ balance = N·B₀, `docs/mechanics/prd.md:633-660`), so `payout_i = floor(N·S · balance_i / (N·B₀)) = floor(S · balance_i / B₀)`. Rounding dust plus an optional fee go to the treasury. An eliminated player gets 0, and the top balance is the winner (designgame PRD §15). The contract checks `Σ payouts + dust + fee == pot`. Conservation only holds once the F8 blockers are fixed.

**F4.4 Single signature on entry.**
- One wallet transaction, `join(matchId, sessionKey)`, with `msg.value = stake` (testnet native token) does three things: it deposits, binds the wallet to the match, and registers an ephemeral browser-generated **session key** address.
- The WebSocket `onAuth` then needs only a challenge signed by that session key. That key lives in memory or `sessionStorage` and never needs a wallet popup. The server checks the `PlayerJoined(matchId, player, sessionKey)` event, or `readContract`, for the binding.
- If an ERC-20 stake is used instead, ERC-2612 `permit` folds the approval into the same transaction (https://eips.ethereum.org/EIPS/eip-2612).
- Account abstraction is **optional polish**. EIP-7702 is Final and lets an EOA delegate to code for batching and "privilege de-escalation" (sub-keys), but it enforces no permissions itself; "standardized extension / module systems" must (https://eips.ethereum.org/EIPS/eip-7702).
- Alchemy lists **Bundler API and Gas Manager** as supported on Robinhood Chain testnet, but not the Debug or Trace API (https://www.alchemy.com/rpc/robinhood-testnet.md). Gasless joins via ERC-4337 (`permissionless` 0.4.1, `@zerodev/sdk` 5.5.10) are therefore possible later. They are not needed for one signature.

**F4.5 Leaderboard.** Do **not** store sorted leaderboards on chain; sorting costs gas and grows unbounded. Emit `PlayerResult` events per player per match and index them (F5).

**F4.6 Vehicle ownership.** ERC-721 or ERC-1155 for the seven cosmetic vehicles (`src/vehicles/*ModelBuilder.ts`) is optional. If it is added, vehicles must stay **cosmetic or stat-equal** in staked rooms. Otherwise ownership becomes pay-to-win in a zero-sum money game, because vehicle stats feed damage (`CollisionSystem.ts:358`, `isAttackerTitan` ×2.00). The server reads `ownerOf` at join time.

**F4.7 Anti-cheat and disputes.**
- The server is a trusted operator.
- Each settlement commits `inputLogHash` (keccak of the canonical per-tick input log) and `replayHash`/`finalStateHash`. The replay file (inputs, seed, Rapier package and version, server build SHA) goes to object storage, so anyone can re-run it once F1.5 determinism is in place.
- Elympics uses the same pattern in production: off-chain gameplay, a **signed replay file**, inputs signed with a gameplay-specific key "so that no inputs can be forged either by other players or the malicious game server itself", and escrow-gated matchmaking (https://elympics.ai/products/blockchain-connect).
- An optimistic dispute window (settlement final only after N minutes with no challenge) is a **later option** only.

### F5 — Chain event listening and indexing

**F5.1 viem.** `viem` is 2.57.4 (2026-10-08); `wagmi` is 3.7.7 and `@wagmi/core` 3.6.5. `watchContractEvent` uses `eth_subscribe("logs")` on a WebSocket transport (`poll: false` default). Over HTTP it polls `eth_newFilter`/`eth_getFilterChanges` and falls back to `eth_getLogs`. Options are `pollingInterval`, `batch` (default true), `fromBlock`, `onLogs` and `onError` (https://viem.sh/docs/contract/watchContractEvent). The page says nothing about reorgs, so treat a subscription as a hint: **always backfill with `getLogs(fromBlock = lastSeen+1)` after reconnect, and confirm with `readContract` before starting a match.**

**F5.2 Confirmation levels on Arbitrum/Orbit chains** (https://docs.arbitrum.io/how-arbitrum-works/reference/finality-and-reorgs):

| Level | Meaning | Reorg exposure |
|---|---|---|
| `latest` (soft) | Sequencer-ordered; can revert if the sequencer misbehaves | Full unfinalized window |
| `safe` | Batch posted and safe on the parent chain | Deep parent-chain reorg only |
| `finalized` | Batch posted and finalized on the parent chain | None |

Do not index the Fast Feed. Block numbers there are tentative and have no hash. Orbit chains derive `safe`/`finalized` from the parent chain only if `use-finality-data` is on, so call `eth_getBlockByNumber('safe'|'finalized')` on the Robinhood RPC to check they lag the head. For a testnet demo, use `latest` for joins (UX) and `latest` plus a reorg window in the indexer. Payout claims settle on chain regardless.

**F5.3 Indexers.**

| Indexer | Version (2026-10-09) | Arbitrary EVM chain via RPC? | Notes |
|---|---|---|---|
| **Ponder** | `ponder` 0.18.0 (2026-10-06), Node ≥ 22.12, MIT, active | Yes. `chains: { id, rpc, ws }`; `ws` enables realtime subscriptions with polling fallback; `pollingInterval` default 1000 ms; `reorgWindow` default 180 s (https://ponder.sh/docs/config/chains) | TypeScript and viem, same language as the server. Hono custom API in `src/api/index.ts` with a read-only Drizzle `db`; GraphQL and SQL-over-HTTP (https://ponder.sh/docs/query/api-endpoints). Production needs Postgres in the same private network (<50 ms) and a separate schema per deployment, which can use Railway deployment IDs. `/health` and `/ready` endpoints (https://ponder.sh/docs/production/self-hosting). |
| Envio HyperIndex | `envio` 3.14.0 (2026-10-08) | Yes. `rpc: [{url, for: sync}]` plus a `for: realtime` WS; "Any provider that implements the standard EVM JSON-RPC API works" (https://docs.envio.dev/docs/HyperIndex/rpc-sync) | HyperSync (10–100× faster) only on chains Envio supports; Robinhood support not found. Reorg handling over plain RPC is not documented. |
| Goldsky | hosted | Lists **Robinhood Chain mainnet and testnet** across Turbo, Edge RPC, Compose and Subgraphs (https://docs.goldsky.com/chains/supported-networks) | Good hosted fallback. Pricing via sales. |
| The Graph | `@graphprotocol/graph-cli` 0.98.1 | No Robinhood Chain support found in search | Skip |
| rindexer | v0.43.4 (GitHub release 2026-10-05), Rust | Yes, any EVM chain via YAML RPC plus chain ID (https://github.com/joshstevens19/rindexer) | No-code Postgres plus GraphQL. Reorg handling undocumented. Different language from the team. |

Because Alchemy does not support Debug or Trace on Robinhood testnet (F4.4), any indexer must be **event-only**, with no call traces.

### F6 — Hosting

| Host | WebSockets | UDP | Notes |
|---|---|---|---|
| **Railway** | Supported over HTTP/1.1, "can stay open indefinitely, even while idle", exempt from the 15-min HTTP limit (https://docs.railway.com/networking/public-networking/specs-and-limits) | Not documented (TCP proxy only) | The user already has Railway tooling. Runs Node, Postgres for Ponder and buckets for replays in one project. |
| Fly.io | (container, standard) | Yes, with dedicated IPv4, `fly-global-services` bind and same internal/external port; plan for about 1300 B MTU (https://docs.fly.io/networking/udp-and-tcp) | Only needed if moving to Geckos or WebTransport later |
| Render / VPS | Long-lived processes | VPS: yes | VPS is cheapest per CPU but you operate it yourself |
| Cloudflare Durable Objects | Yes, with hibernation | No | A 60 Hz loop prevents hibernation (F2) |
| Vercel Functions | Beta, max 300–1800 s, no instance affinity | No | Client static hosting only |

Local dev on the 14 GB machine is fine: Colyseus plus Rapier at about 340 MB RSS (F1.3), Ponder plus Postgres about 0.5 GB (Assumption), and anvil. Colyseus requires Node ≥ 22 and Ponder ≥ 22.12; the local Node is v26.2.0.

### F7 — Comparable products and their patterns

| Product | What is on chain | Gameplay authority | Pattern |
|---|---|---|---|
| Rocket League (non-crypto, closest gameplay) | — | Dedicated authoritative servers with a server-side input buffer and client time-scaling (official Epic help page) | Server-authoritative physics cars |
| Elympics duels | Escrow and prize pool, on-chain settlement | Off-chain, "Deterministic simulation" tag, signed replay, signed inputs (https://elympics.ai/products/blockchain-connect) | **Escrow → off-chain match → signed result/replay → settle.** Closest crypto pattern to this recommendation. |
| Off The Grid (GUNZ, Avalanche L1) | Items as NFTs, GUN token balances | Conventional game servers (inferred; secondary sources, https://decrypt.co/resources/what-is-off-the-grid-battle-royale-shooter-avalanche) | Assets on chain, gameplay off chain |
| Sky Strife (Redstone, MUD) | Every action | Chain | Fully onchain. Works for RTS pacing, not realtime physics. |
| Deskillz (self-reported, 2026-07) | Entry fee escrow, prize settlement (https://peerpush.com/p/deskillz) | Off-chain | Escrow plus operator settlement. Unverified. |

### F8 — Repo issues that block a money-safe server port

1. **A void-pit or forced elimination destroys money.** `eliminate()` sets `balance = 0` (`src/vehicles/CarController.ts:208-210`) even if the car still had money, for example after falling into a void pit (`src/arena/MarginVoidPits.ts`). That breaks Σ balance = constant. Fix: on non-bump elimination, credit the remaining balance to the last hitter within a window, as `recentVictimHits` already tracks (`CollisionSystem.ts:463-468`), or else split it pro-rata among survivors. This is a design decision.
2. **`reset()` mints money.** It sets `balance = maxBalance` (`CarController.ts:530-532`). The server must forbid it in staked rooms.
3. **The collision throttle is global.** A single `lastCollisionTime` (`CollisionSystem.ts:14,85-94`) drops *every* contact within 50 ms of any other contact. With 8 players, simultaneous bumps between different pairs are lost, and so is their money. Make it per-pair and tick-based.
4. **Wall-clock and RNG in game logic** (F1.5): replace with tick counters and a seeded PRNG on the server.
5. **Match length.** The code says 90 s (`src/core/MatchManager.ts:11`); `docs/update/prd.md:694-731` says 2:40–3:00.
6. **PRD contradictions on money flow.**
   - `docs/designgame/prd.md:242` adds CASH RAIN. `docs/update/prd.md:11` and `:854` forbid it. `docs/mechanics/prd.md:680-684` allows it only from "a clearly defined finite event pool".
   - `docs/mechanics/prd.md:196-278` (§7–8) says money leaves the target on hit and the attacker must **pick it up**. `docs/update/prd.md:9-15` says there is **no** money pickup.
   - The code transfers at impact and makes pickup cosmetic (`CollisionSystem.ts:370-371`, `PickupManager.ts:283`).
   - Uncollected cash despawns after 120 s (`Config.ts:161`). With a real pickup, despawn would destroy money.
   - **Recommendation: keep the code's instant atomic transfer for the server ledger. Cash on the floor stays cosmetic, and CASH RAIN is excluded from staked rooms.**

## Recommendations

**R1 — Architecture (ASCII).**

```
 Browser client (Vite 8 + TS + three 0.186)                      Railway project "bump-trade"
 ┌───────────────────────────────────────────┐                    ┌───────────────────────────────────────────┐
 │ Renderer/HUD (existing src/ui, vfx)       │                    │ game-server (Node ≥22, Colyseus 0.18)     │
 │ NetClient: @colyseus/sdk 0.18             │  WSS (binary)      │  MatchRoom ×N  (maxClients 8)             │
 │  - room.input() 60 Hz ───────────────────┼──────────────────▶│   setFixedTimestep 60 Hz                  │
 │  - predict.sim(Rapier) local car          │◀──────────────────┼─  Rapier 0.21 headless world per room      │
 │  - lerp remote cars, 100 ms               │  patches 30 Hz +   │   CollisionSystem (server) → Ledger       │
 │ Rapier 0.21 (same build as server)        │  events            │   input log + replay writer               │
 │ Wallet: viem 2.57 + EIP-6963 injected     │                    │  ChainWatcher (viem WSS watch + backfill) │
 │  - join(matchId, sessionKey) {value:S}    │                    │  Settler: EIP-712 signer + relayer        │
 │ Leaderboard view ◀── HTTPS ──────────────┼─────┐              └───────┬───────────────▲───────────────────┘
 └──────────────┬────────────────────────────┘     │                      │settle(tx)     │PlayerJoined (WSS)
                │ join tx (1 signature)            │              ┌───────▼───────────────┴───────────────────┐
                ▼                                   │              │ Robinhood Chain testnet (Arbitrum Orbit)  │
        ┌───────────────────────────────────────────┼─────────────▶│  BumpArena.sol: escrow, settle, refund,   │
        │                                           │              │  events: MatchOpened/PlayerJoined/        │
        │                                           │              │  MatchSettled/PlayerResult/Refunded       │
        │                                           │              └───────┬───────────────────────────────────┘
        │                                           │                      │ logs (RPC + WSS)
        │                                    ┌──────┴──────────────────────▼──────┐   ┌──────────────────────┐
        │                                    │ indexer: Ponder 0.18 (Hono API,    │──▶│ Postgres (Railway)   │
        │                                    │ GraphQL/SQL) /leaderboard /matches │   └──────────────────────┘
        │                                    └────────────────────────────────────┘
        │                                    replay files → Railway bucket (hash committed on chain)
```

**R2 — Chosen libraries (exact versions, npm/GitHub on 2026-10-09).**

| Area | Choice |
|---|---|
| Server framework | `colyseus` 0.18.9, `@colyseus/core` 0.18.18, `@colyseus/schema` 5.0.36, default `@colyseus/ws-transport` 0.18.4. Node 22 LTS or later. |
| Client SDK | `@colyseus/sdk` 0.18.5. **Not** `colyseus.js`. |
| Physics | `@dimforge/rapier3d-compat` 0.21.0 on both sides, pinned exact (no caret). Benchmark `@dimforge/rapier3d-deterministic-compat` 0.21.0 and switch both sides if its cost is acceptable, because replay verification needs it (F1.4). |
| Chain | `viem` 2.57.4 (server and client). Optional `@wagmi/core` 3.6.5 (the client has no React, so RainbowKit 2.2.11 does not fit). EIP-6963 multi-injected-provider discovery for wallets. |
| Contracts | Foundry v1.8.5, `@openzeppelin/contracts` 5.6.1 |
| Indexer | `ponder` 0.18.0 plus Postgres. Hosted fallback: Goldsky subgraph. |
| Hosting | Railway: game-server, ponder, Postgres, bucket. The static client can also go on Railway or Vercel. |

**R3 — Netcode parameters.**
- Fixed timestep 60 Hz; `subSteps: 1` initially.
- `defineInput(InputSchema, { bufferMaxSize: 32 })` with `sanitize` clamping throttle and steer to [-1, 1] and booleans to bits.
- `patchRate = 33`. Use `t.quantized()` for position, quaternion and velocity fields.
- Remote cars on `lerp` with `delay: 100`. Reconciler `smoothMs: 65`, `snap: 3` m, `warnOnDivergence: 0.25` m.
- `allowRewindState({ maxRewindMs: 500 })` for angle classification only (F3.3).
- `allowReconnection(client, 10)` s. A disconnected car stays in the arena, idle and still hittable, so its money stays in play.
- Refuse staked joins above 150 ms RTT.
- Kick a client with no input for 5 s; the car remains in play.

**R4 — Message schema sketch** (Colyseus Schema for state, `room.input()` for input, `broadcast` for events).

```ts
// ---------- client → server (room.input, 60 Hz, flat primitives) ----------
const InputSchema = schema({
  tick:     t.uint32(),        // client predicted tick (ack/reconcile key)
  throttle: t.int8(),          // -100..100  (VehicleInput.throttle × 100, src/input/InputManager.ts:7)
  steer:    t.int8(),          // -100..100
  buttons:  t.uint8(),         // bit0 brake, bit1 boost, bit2 handbrake, bit3 usePowerUp
}, "Input");

// ---------- server → client state (patched at 30 Hz, deltas only) ----------
const Car = schema({
  sessionId: t.string(), wallet: t.string(), vehicle: t.uint8(),     // VehicleType index
  px: t.quantized(-26, 26, 16), py: t.quantized(-6, 12, 16), pz: t.quantized(-26, 26, 16),
  qx: t.quantized(-1, 1, 16), qy: t.quantized(-1, 1, 16), qz: t.quantized(-1, 1, 16), qw: t.quantized(-1, 1, 16),
  vx: t.quantized(-60, 60, 16), vy: t.quantized(-60, 60, 16), vz: t.quantized(-60, 60, 16),
  wx: t.quantized(-20, 20, 16), wy: t.quantized(-20, 20, 16), wz: t.quantized(-20, 20, 16),
  boost: t.uint8(), flags: t.uint8(), powerUp: t.uint8(), powerUpMs: t.uint16(),
  balance: t.uint32(),  // integer cents/units — authoritative ledger mirror
  state: t.uint8(),     // ALIVE | CRITICAL | ELIMINATED | DISCONNECTED
}, "Car");
const MatchState = schema({
  matchId: t.string(),   // bytes32 hex, same id as on chain
  phase: t.uint8(),      // LOBBY|STAKED|COUNTDOWN|LIVE|ENDED|SETTLED|REFUNDED
  tick: t.uint32(), endsAtTick: t.uint32(), marketEvent: t.uint8(), eventEndsAtTick: t.uint32(),
  cars: t.map(Car),
}, "MatchState");
// (the "ack" = last processed input tick per client is provided by the Colyseus prediction layer)

// ---------- server → client events (broadcast, reliable) ----------
type Bump        = { t:"bump", tick, attacker, victim, amount, tier, angle, skills: number /*bitmask headOn|bank|drift|boost|double|revenge|titan|surge*/, x, z, nx, nz };
type CashDrop    = { t:"cashDrop", tick, from, to, amount, x, z, n: number /*pieces*/ };   // cosmetic; ledger already moved
type CashPickup  = { t:"cashPickup", tick, carId, amount };                                 // cosmetic (PickupManager.ts:283)
type Eliminate   = { t:"eliminate", tick, carId, by?: string, cause: "bankrupt"|"voidPit"|"disconnectTimeout", redistributed: [string, number][] };
type MatchStart  = { t:"matchStart", matchId, startTick, durationTicks, seed: string, rapier: "0.21.0", serverBuild: string };
type MatchEnd    = { t:"matchEnd", matchId, endTick, ranking: { wallet, balance, payout }[], inputLogHash, replayHash, resultSig };
type MarketEvent = { t:"marketEvent", tick, kind, durationTicks };   // 60 s event, FINAL 20, FINAL 10 (MatchManager.ts:152-195)
```

**R5 — Match lifecycle state machine.**

```
            openMatch(matchId) by operator (or lazily on first join)
                  │
               ┌──▼───┐ players connect to room (spectate-only until staked);
               │LOBBY │ each wallet sends join(matchId, sessionKey){value:S}
               └──┬───┘
   all N joined   │   or fill timer (60 s) with ≥2 joined           joinDeadline passed with <2
   (PlayerJoined  │                                                 or server never started
    seen+read)    ▼                                                          │
               ┌──────┐ room.lock(); vehicles bound; seed fixed              │
               │STAKED│──────────────────────────────────────────────┐       │
               └──┬───┘                                              │       │
                  │ all session keys authenticated over WSS          │       │
                  ▼                                                  │       │
             ┌─────────┐ 3–5 s countdown, inputs ignored             │       │
             │COUNTDOWN│                                             │       │
             └────┬────┘                                             │       │
                  ▼                                                  │       │
               ┌──────┐ 60 Hz authoritative sim, ledger, events,     │       │
               │ LIVE │ input log; 160–180 s (MatchManager timer)    │       │
               └──┬───┘ or ≤1 car alive                              │       │
                  ▼                                                  │       │
               ┌──────┐ compute payouts, write replay, hash,         │ server crash /
               │ENDED │ sign EIP-712 Result, broadcast matchEnd      │ no settle by
               └──┬───┘                                              │ settleDeadline
                  │ settle(result, sig) mined (operator relayer      │ (e.g. start+1 h)
                  │ or any player as fallback)                       ▼       ▼
               ┌───────┐                                         ┌────────┐
               │SETTLED│  claim()/push payouts                   │REFUNDED│ claimRefund() per player
               └───────┘                                         └────────┘
```

**R6 — On-chain / off-chain split.**

| Concern | On chain (BumpArena.sol) | Off chain |
|---|---|---|
| Lobby / matchmaking | `openMatch(matchId, stake, maxPlayers, joinDeadline)`; `join(matchId, sessionKey)` payable; `MatchOpened` and `PlayerJoined` events | Colyseus matchmaker, room fill timer, RTT gate |
| Stake custody | Escrow balance per match | — |
| Player auth to game server | Session-key binding in `PlayerJoined` | WSS `onAuth` challenge signed by the session key |
| Physics, collisions, balances, power-ups, events | — | Authoritative server only |
| Result | `settle(Result, sig)`: verify EIP-712 signer, `status == Open`, Σ = pot, store `resultHash`, credit `claimable`, emit `MatchSettled` and `PlayerResult` | Server computes the result and signs it with the settlement key |
| Payout | Pull `claim()`, or push to ≤8 players in `settle` | — |
| Liveness failure | `cancel()` before start; `claimRefund()` after `settleDeadline` | — |
| Leaderboard / history | Events only | Ponder → Postgres → `/leaderboard`, `/matches/:id` |
| Replays / disputes | `inputLogHash`, `replayHash` in the event | Replay file in a Railway bucket; optimistic challenge later |
| Vehicles | Optional ERC-721/1155 ownership | Stats stay identical in staked rooms |
| Operator governance | `owner` can `setSigner`, `setFee` (0 on testnet), `pause` | Keys in Railway variables (testnet) |

**R7 — Security model.**

*A malicious client cannot:* teleport, change velocity, invent or suppress collisions, edit any balance, extend power-ups, or alter the timer. The server owns all of these, and inputs are clamped to [-1, 1] plus 4 bits by `sanitize`. It cannot settle a fake result, because that needs the operator's EIP-712 signature with chainId and verifyingContract bound. It cannot replay a result: there is one settle per `matchId` (EIP-712 has no replay protection of its own). It cannot hijack someone else's seat, because the WSS auth must be signed by the session key registered by that wallet's own `join` transaction.

*A malicious client can:* run input bots or aim-assist (perfect steering inputs), which only behaviour analysis can detect. It can lag-switch or send inputs in bursts; this is bounded by the input buffer (32), by the server not rewinding physics, and by the RTT gate. It can see all other cars' state, which is harmless because there is no hidden information. It can disconnect, but its car stays as a target and its stake stays at risk. It can grief by refusing to pay gas for `join`, which leaves the room unfilled; the fill timer then starts with ≥2 players or refunds. It can collude with other players by teaming up or deliberately feeding money to one player. That cannot be prevented in a free-for-all; mitigate with matchmaking that avoids repeated wallet groupings (Assumption).

*A malicious or compromised server can:* sign any payout split among the joined players, bias physics, or favour a wallet. It can withhold settlement.

*What limits it:*
- (1) The contract only pays addresses that actually joined that `matchId`, and only up to the pot, so the server can redistribute but cannot steal more than the pot.
- (2) `settleDeadline` plus `claimRefund` cap the cost of withholding to a delay.
- (3) Committed `inputLogHash` and `replayHash` make tampering detectable after the fact, provided determinism (F1.5) is achieved and the replay is published.
- (4) A separate signer key with `setSigner` rotation and `pause`.
- (5) Later: inputs signed per tick by the session key (Elympics pattern), so the server cannot forge a player's inputs, plus an optimistic challenge window.

On testnet, document that the operator is trusted.

## Alternative: no authoritative server

Added 2026-10-09 at the user's request. Research only; nothing was built or installed. Sources read 2026-10-09 unless marked as general knowledge.

**The option.** Free matches (no stakes) run browser-to-browser over WebRTC data channels. Chain testnet records only results for a leaderboard. Two sub-variants:
- **P2P-star (host-authoritative):** one player's browser runs Rapier and the ledger; the others send inputs and render snapshots.
- **P2P-lockstep:** every browser simulates and they exchange inputs only.
- **Hosted relay** (a third form): a dumb WebSocket relay forwards messages with no simulation. It solves NAT but is still a server process.

### A1. Cheating and trust: who computes the result

| Question | Recommended (Colyseus, staked) | P2P-star | P2P-lockstep |
|---|---|---|---|
| Who computes balances | Server only | The host's browser | Every browser, independently |
| Can one player forge the result | No | **Yes, if they are the host**; non-hosts cannot, but cannot prove the host wrong either | Not alone, if the result needs every player's signature |
| Can a player edit their own velocity or balance | No (inputs only, clamped) | Only as host | Only by sending illegal inputs; state edits are detected as hash mismatch |
| Can a player stall or grief | Cost: their own stake | Host can end the match | **Yes**: withholding inputs freezes the room (table in F1.2) |
| Attestation | Operator EIP-712 signature checked by the contract | None unless players co-sign | All players co-sign the final state hash |

**How a result would be attested with no server.** Each player signs the same EIP-712 `Result` (same typed data as contracts.md C3, without payouts) with their wallet or session key. A contract `recordResult(result, signatures[])` accepts it when every listed player has signed and each address is distinct. A disagreeing player simply does not sign, so nothing is recorded. This gives "all participants agree", not "the result is true".

**The hard limit: wallets are free.** A single person can run two wallets, play themselves, and sign any result. With no stake and no identity, a leaderboard of attested results proves nothing about skill. This holds for both sub-variants. Mitigations that exist (a per-wallet rate limit, an allowlist, a minimum faucet-age check) are all off-chain trust or social controls. The leaderboard would have to be labelled "self-reported". Not sourced; this follows from the design.

### A2. Rapier determinism across browsers

- Per the Rapier 0.21.0 package README, the main `-compat` build "does **not** guarantee cross-platform determinism"; `rapier3d-deterministic-compat` 0.21.0 does, at an unmeasured speed cost (F1.4, https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-deterministic-compat@0.21.0/README.md). Lockstep therefore needs the deterministic build on every client.
- The Rapier JS guide adds a condition: no `Math.sin`/`Math.cos` in initial values (https://rapier.rs/docs/user_guides/javascript/determinism, F1.4).
- Browser engines may return different results for `Math.sin`, `Math.cos`, `Math.atan2` and similar. The ECMAScript spec leaves them implementation-approximated (general knowledge, not fetched). In the repo these appear in the sim-relevant files: `CarPhysics.ts` 4 calls, `CarController.ts` 1, `PowerUpManager.ts` 10 (grep, 2026-10-09). All would need replacing with deterministic implementations.
- Everything in F1.5 still applies: `performance.now()`, `Math.random()`, `setTimeout` in the rules (audit A4).
- **I did not test Rapier across Chrome, Firefox and Safari.** Lockstep determinism across browsers is unverified and is the riskiest assumption in this option.
- P2P-star avoids the determinism requirement (the host's state is the truth), at the cost of host trust.

### A3. NAT traversal and signalling

- **A signalling channel is still required.** MDN: "WebRTC can't create connections without some sort of server in the middle … the signal channel" (https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity). So "no game server" still means at least one small always-reachable service.
- Options for signalling:
  - **Trystero** 0.26.0 (npm, modified 2026-10-04) uses public infrastructure for peer discovery: BitTorrent trackers by default, with Nostr, MQTT, Supabase, Firebase, IPFS and a self-hosted WebSocket relay as alternatives (README via search, 2026-10-09). No server of your own, but the public relays and trackers are not under your control.
  - Colyseus or any WebSocket on Railway as a signalling-only room: a few KB per match, trivial cost, and it is still one WebSocket server.
  - `peerjs` 1.5.5 (last published 2025-06-07) and `simple-peer` 9.11.1 (2023-01-26) are stale. Not recommended.
- **STUN** is free (Cloudflare's `stun.cloudflare.com` is free and unlimited, per Cloudflare's TURN FAQ search result).
- **TURN** is needed when two peers cannot connect directly (symmetric NATs, some mobile and corporate networks). MDN describes relay candidates but gives no share of affected connections; a commonly quoted 10–20% is **uncited** (Assumption A9). Cloudflare Realtime TURN is $0.05/GB egress with 1,000 GB/month free (https://developers.cloudflare.com/realtime/pricing/, via search; confirm on the official page).
- **Bandwidth if relayed (my arithmetic from F3.4):**
  - P2P-star: the host uploads one snapshot stream per peer, 7 × 7–17 KB/s ≈ 50–120 KB/s ≈ 0.4–1 Mbit/s up from a home connection, and nothing for the others. Fine on good connections, poor on mobile.
  - Lockstep: inputs only, about 0.6 KB/s per peer pair, trivial.
  - The room total is the same as before, about 10–25 MB per 3-minute match (F3.4). At that size, 1,000 free GB covers thousands of fully relayed matches, so TURN cost is negligible at demo scale.
- **Privacy:** direct WebRTC connections reveal each peer's IP address to the other peers (general knowledge). A relay or TURN-only mode hides it, at the cost of latency.
- **Host migration:** in P2P-star, if the host closes the tab the match ends. Migration with a money-like ledger is a separate hard problem and is out of scope.

### A4. Hosting cost and complexity

| Item | Recommended | P2P variant |
|---|---|---|
| Realtime service | Colyseus on Railway, one process; about 340 MB RSS in a bare-Rapier test (F1.3) | Signalling only (Trystero public relays: none; or a tiny WebSocket service) |
| Physics in the cloud | Yes, per room | None |
| TURN | Not needed (client to server over WebSocket) | Likely needed for some players |
| Relayer key and signer key | Yes, two funded keys | None. Each player submits their own `recordResult`, or one volunteer does; each submitter needs testnet ETH and a wallet popup |
| Indexer | Ponder + Postgres | **Still recommended.** A client could read events with `getLogs`, but the public RPC accepted a 100k-block range, and 100k blocks is only about 4.4 hours at 0.16 s blocks (chain §5, §2), so a full-history scan needs many paged calls. A small Ponder (PGlite) is the cheaper path. |
| Complexity | A server, but the rules live in one trusted place | No server to run, but rules, determinism, NAT failures, host loss and reconnection logic all move into the browser |

The honest saving is one Railway service and two server keys. The cost moves to determinism work (lockstep) or host trust (star) plus TURN and connection-failure handling. For a 3-minute, 8-player physics match, the server-based design is the less complex one overall.

### A5. What happens to each role under the P2P variant

- **R1 contracts:** much smaller. `BumpLeaderboard.recordResult(Result, bytes[] signatures)`: verify every player's EIP-712 signature, one record per `matchId`, emit `MatchRecorded` and `PlayerResult`. No escrow, no `join`, `startMatch`, `cancel`, `claim`, `claimRefund`, signer, operator, treasury or pause. The `Result` struct drops payouts and keeps ranks, final balances and hashes.
- **R2 game server:** the Colyseus server disappears. `@bump/shared` (headless rules, protocol, tick clock, seeded RNG, economy assertions) is **still the core deliverable**: P2P-lockstep needs it in the browser, P2P-star needs the same rules in the host. The room, settlement signer, relayer and `ArenaRoom` go away. If Trystero is used, nothing replaces them server-side. If not, a small signalling service remains.
- **R3 client:** grows. WebRTC transport (data channels, reliable plus unreliable), signalling, host election or lockstep scheduler, input delay buffer, desync detection (state hashes), result co-signing UI, and a wallet submit flow for `recordResult`. No stake panel, no claim.
- **R4 indexer/ops:** keeps the indexer (smaller schema: no stakes or payouts). Railway needs only the indexer, plus an optional signalling service. Part A (workspace) is unchanged.

### A6. Could staking ever be added later?

**Not safely on pure P2P.**
- With n-of-n co-signing, the loser of a staked match can refuse to sign. A timeout fallback (refund or draw) makes withholding free for the loser, so stakes would reward cheating by refusal.
- With P2P-star, the host can sign any result for the room.
- A fraud-proof or optimistic-dispute design would have to re-run Rapier to judge a dispute, which is not feasible on chain and needs bit-exact determinism off chain (A2) plus a referee service.
- Wallets are free, so collusion and self-play cost nothing (A1).

**A staked mode needs a trusted referee**, i.e. the authoritative server in this document's recommended design. This makes the two options sequential rather than exclusive: building `@bump/shared` first (R2's phase 0) serves both. A free P2P mode could ship first, with the Colyseus server and the escrow contract added when stakes are wanted.

### A7. Recommendation

- **Keep the Colyseus authoritative design as the plan** for this project. The user's brief was realtime play tied to the chain with results and rewards; only the server option can make results trustworthy, and it is the only one that supports stakes.
- **The P2P no-stakes variant is viable** as a cheaper demo or as a phase-0 step, but it is a different product: an unverifiable leaderboard of self-reported results, with real risk in cross-browser determinism and NAT failures. If chosen, prefer **P2P-star with a signalling-only server** over lockstep, because it avoids the determinism requirement; accept that the host is trusted.
- **If the goal is "lowest cost for a demo", the cheapest honest option is neither**: run the recommended server locally (no hosting cost until the P1 Railway step) and leave Railway deployment as P1. That already has no hosting bill during development.

### A8. Which handoffs change under the P2P variant

| Handoff | Change |
|---|---|
| `contracts.md` | C3 replaced by a `recordResult` leaderboard contract; C2 stake constants dropped; C5 protocol replaced by a WebRTC data-channel protocol; C6 lifecycle shortened to lobby → live → co-sign → record |
| `01-smart-contracts.md` | Much smaller scope (A5) |
| `02-game-server.md` | `server/` removed; `@bump/shared` stays and gains lockstep helpers; the room and settler tasks are dropped |
| `03-client-network-chain.md` | Large additions (A5); the stake panels are dropped |
| `04-indexer-ops.md` | Schema simplified; Railway scope reduced |
| `00-overview.md` | Gets a short variant note (done; recommended plan unchanged) |

**The two WebSocket questions, answered plainly.**
- **Recommended design:** the game server needs one WebSocket endpoint (Colyseus, `ws://…:2567` locally, WSS on Railway). Players' browsers connect to it.
- **The chain does not need a WebSocket in this design.** The server and client use plain HTTP JSON-RPC (`readContract`, `writeContract`, receipts) against the public RPC (chain §5 curl-verified: it has no WSS), and the indexer polls over HTTP; `RH_WSS_URL` and `PONDER_WS_URL_46630` are optional extras. The same is true of the P2P variant, where the chain only receives `recordResult` transactions over HTTP.

**New assumption for this section:** A9. The share of WebRTC connections that need TURN relaying is not established by a primary source here.

## Implications per role

### Smart contracts engineer (Solidity/Foundry: escrow, results, leaderboard events)
- Write `BumpArena.sol` with OZ 5.6.1 `EIP712("BumpArena","1")`, `ECDSA`, `ReentrancyGuard`, `Ownable2Step` and `Pausable`. Build with Foundry v1.8.5 (`forge test`, `forge script` deploy to the Robinhood testnet RPC from `robinhood-chain.md`).
- Storage per match: `stake`, `maxPlayers`, `joinDeadline`, `settleDeadline`, `status{Open,Live?,Settled,Cancelled}`, `players[]`, `sessionKeyOf[player]`, `pot`.
- Hash `Result{ bytes32 matchId; address[] players; uint256[] finalBalances; uint256[] payouts; bytes32 inputLogHash; bytes32 replayHash; uint64 endedAt; }` exactly as the server encodes it. Ship a shared fixture (JSON plus signature) that both `forge test` and the server's viem `signTypedData` test pass.
- Invariants to fuzz:
  - Σ payouts + fee + dust == pot.
  - Payouts only go to joined players.
  - A match settles at most once.
  - A refund is impossible after settle, and settle is impossible after refund.
  - `join` is impossible after lock or start and when full.
  - Value must equal stake exactly.
- Make `settle` permissionless (signature-gated) so a player can submit it if the relayer is down.
- Use pull payments (`claimable[addr]`, `claim()`) to avoid a reverting receiver blocking the payout loop.
- Events (indexed fields first): `MatchOpened(matchId, stake, maxPlayers, joinDeadline)`, `PlayerJoined(matchId, player, sessionKey, vehicleId)`, `MatchSettled(matchId, resultHash, inputLogHash, replayHash)`, `PlayerResult(matchId, player, finalBalance, rank, payout)`, `Refunded(matchId, player, amount)`. These are the indexer's whole input, so freeze them early.
- ERC-721 vehicles are out of scope for v1 (F4.6).

### Realtime game server engineer (Node/TS authoritative Rapier server, rooms, settlement signer)
- New package `server/`: Node 22+, `colyseus` 0.18.9, `@colyseus/schema` 5.0.36, `@dimforge/rapier3d-compat` 0.21.0 pinned exactly, `viem` 2.57.4.
- Port and reuse `src/physics/PhysicsWorld.ts`, `src/vehicles/CarPhysics.ts`, `CarController` physics parts, `src/collision/CollisionSystem.ts`, `src/combat/*`, `src/pickups/PowerUpManager.ts` logic and `MatchManager` timeline. **Strip** all three.js scene, visual, Sound and EventBus-to-HUD coupling into an interface, so that one `step(world, inputs, tick)` module is shared by server and client prediction (Colyseus determinism contract).
- Fix F8 items 1–4: per-pair tick-based throttle, no `reset()` in staked rooms, redistribution of the balance on non-bump elimination, tick counters plus seeded PRNG instead of `performance.now()`/`Math.random()`.
- Make the ledger integer-only, with an assertion every tick that Σ balance == N·B₀.
- `MatchRoom`: `maxClients = 8`, `patchRate = 33`, `setFixedTimestep(step, 60)`, `defineInput` with `sanitize`, `allowReconnection(10 s)`, `lock()` at STAKED.
  - `onAuth` verifies the session-key signature over `(matchId, sessionId, nonce)` and checks `sessionKeyOf[wallet]` via `readContract`.
  - Run AI only for disconnected-then-timed-out cars if the design says so (default: idle wreck that stays hittable).
- ChainWatcher: viem `webSocket` transport plus `watchContractEvent(PlayerJoined)`. On every (re)connect, backfill with `getLogs` from the last seen block. Confirm with `readContract` before STAKED.
- Settler:
  - Build `Result`, `signTypedData` with the signer key, submit `settle` from a separate relayer key, and wait for the receipt.
  - Retry with backoff. Store pending settlements in Postgres or a file so a crash can resume before `settleDeadline`.
- Replay: append per-tick inputs to a binary log. At ENDED, keccak it, upload `{seed, rapierPkg@ver, serverSha, inputs}` to the bucket, and put both hashes into `Result`.
- Telemetry: per-room tick time (p99 below 4 ms target), drift EMA per client, RTT, and bytes per second out.

### Client chain + network integration engineer (Vite/TS browser client: networking, prediction/interpolation, wallet, chain reads)
- Add `@colyseus/sdk` 0.18.5 and `viem` 2.57.4. Wallet via EIP-6963 discovery, plus `@wagmi/core` 3.6.5 if connector management is wanted. No React, so no RainbowKit.
- Generate the session key with viem `generatePrivateKey()`/`privateKeyToAccount`, kept in memory or `sessionStorage`. Call `join(matchId, sessionKey.address)` with `value: stake`: **one wallet popup**. Then `client.joinById(roomId, { sessionSig })`.
- Replace the local authority path in `src/core/GameApp.ts:647-660`:
  - Local car: `predict.sim` with a client Rapier world containing only the local car plus static arena colliders (`src/arena/*`). Implement `adopt` (set translation, rotation, linvel and angvel from the server) and `pose`.
  - Remote cars: `lerp` at 100 ms, kinematic and visual only.
  - Keep `GameLoop` fixed 60 Hz (`src/core/GameLoop.ts:72`), but drive the tick from the SDK's `predict.tick()`.
  - Hit-stop (`GameLoop.ts:95-118`) must become render-only and must not pause prediction.
- HUD balances, rank, eliminations and cash VFX are driven **only** by server events (`bump`, `cashDrop`, `eliminate`, `matchEnd`). Keep `PickupManager` purely cosmetic. Show "Settling…" until `MatchSettled` for this `matchId` is seen (viem `watchContractEvent` or the Ponder API), then show `claim()` or the result.
- Handle: wrong chain (EIP-712 domain chainId mismatch), a rejected or slow join transaction, reconnect inside 10 s, spectator mode after elimination (existing mechanics PRD §12), and the refund path UI after `settleDeadline`.

### Indexer/ops engineer (indexer, leaderboard API, deploy/hosting)
- Ponder 0.18.0:
  - `ponder.config.ts` with the chain `{ id, rpc, ws }` from `robinhood-chain.md`, `reorgWindow` default 180 s, and the `BumpArena` ABI and start block.
  - Tables `match`, `matchPlayer`, `playerStats(wallet, matches, wins, totalPayout, netPnL, bestBalance)`.
  - Hono routes `/leaderboard?window=all|7d`, `/matches/:id`, `/players/:wallet`, plus GraphQL.
  - Events only, because Robinhood testnet has no Debug or Trace on Alchemy.
- Railway project services:
  - `game-server` (Colyseus, public WSS domain, health route).
  - `ponder` (`DATABASE_SCHEMA` = Railway deployment ID, `--views-schema` for zero-downtime, `/ready` as the healthcheck).
  - Postgres in the same private network.
  - A bucket for replays.
  - Optionally the static client.
- Pick one Railway region nearest the players. Indonesia is the user's locale, so check whether an Asia region exists (Q4).
- Secrets: `SETTLER_SIGNER_PK` and `RELAYER_PK` (testnet, funded via faucet), RPC/WSS URLs. Rotate the signer via `setSigner`.
- Monitoring: game-server tick p99, rooms, CCU, egress (≈0.5–1.1 Mbit/s per live room); settlement lag (ENDED → `MatchSettled`); Ponder `/ready`; relayer balance alerts.
- Goldsky subgraph is the hosted fallback if self-hosting Ponder is a problem; Robinhood testnet is listed.
- Local dev on 14 GB: run anvil, `game-server`, `ponder dev` with PGlite or Postgres in Docker, and Vite at the same time (≈1–1.5 GB total, Assumption). Builds go through the `safebuild` shims.

## Assumptions and open questions

**Assumptions (not verified from a primary source):**
- A1: Real per-room CPU with the full `CarController` and collision code is below 1 ms per tick. Only the bare-Rapier figure (13–35 µs/step) was measured.
- A2: The performance cost of `rapier3d-deterministic-compat` versus `-compat` is unknown. The README only says "less optimized".
- A3: Rocket League's 120 Hz physics on dedicated servers and 60 Hz updates come from secondary sources (forum, glasp summary); the talk transcript was not accessible. Overwatch's 16 ms command frames and its "client ahead by ½ RTT + 1 frame" also come from secondary sources (https://edgegap.com/blog/game-backend-deep-dive-overwatch-2016-netcode-architecture-rollback). GDC Vault (https://gdcvault.com/play/1024001) is members-only.
- A4: The RTT gate of 150 ms, the 3 m snap threshold, the 0.25 m divergence warning, the 5 s idle kick and the 10 s reconnection window are engineering defaults, not sourced.
- A5: Bandwidth figures are my arithmetic from the field table plus Colyseus' type sizes. The ≈5 B per float32 field patch cost (index plus value) is an estimate. Measure it with the Colyseus monitor.
- A6: Ponder plus Postgres at about 0.5 GB RSS in local dev.
- A7: Rapier WASM fits within Cloudflare Workers script limits. Not checked, and moot because DOs were rejected.
- A8: Collusion detection through matchmaking.

**Open questions for Candra / PM:**
- Q1: Money pickup. Is it the instant transfer the code does now (recommended) or a real pickup (mechanics PRD §7–8)? CASH RAIN: exclude it from staked rooms?
- Q2: What happens to a positive balance when a car dies in a void pit or fire: last hitter, pro-rata, or treasury? Today it is destroyed.
- Q3: Payout curve. Purely proportional to final balance (as briefed), or winner bonus or top-3 only? It changes the incentive to "turtle".
- Q4: Railway region availability near Indonesia, and the target player geography.
- Q5: Stake asset on testnet. Native gas token or a mock ERC-20? Does Robinhood Chain testnet support EIP-7702, and which ArbOS version? Defer to `robinhood-chain.md`.
- Q6: Minimum players to start a staked match (2?) and the fill timer (60 s?).
- Q7: Should AI bots ever fill staked rooms? Recommendation: no. Bots holding stakes would need a treasury-funded seat.
- Q8: Is the `-deterministic-compat` switch worth it for v1 (replay verification), or should it be deferred with the dispute work?
- Q9: Legal: real-money skill wagering is jurisdiction-dependent. Fine on testnet, but must be decided before any mainnet.

## Sources

All URLs read 2026-10-09.

**Repo (file:line)**
- `package.json` (versions: three ^0.186.1, rapier3d-compat ^0.21.0, motion ^14.0.0, vite ^8.3.2)
- `src/physics/PhysicsWorld.ts:21-27,41-44`
- `src/core/GameLoop.ts:72,95-118,122-128`
- `src/core/GameApp.ts:647-660`
- `src/core/MatchManager.ts:11,152-195`
- `src/core/Config.ts:40,104-105,161`
- `src/collision/CollisionSystem.ts:14,41,67,76,85-94,113-144,339-371,441,463-480,523`
- `src/vehicles/CarController.ts:33,53-62,158-163,208-210,307,461,530-532`
- `src/vehicles/CarPhysics.ts:1,23-24,53,188-258`
- `src/input/InputManager.ts:6-12`
- `src/pickups/PickupManager.ts:147-170,283`
- `docs/designgame/prd.md:55-58,242`, §9 (`:310-392`), §13–15 (`:539-624`)
- `docs/mechanics/prd.md:196-278,633-684`
- `docs/update/prd.md:9-15,694-731,841-860`
- `docs/handoffs/STATUS.md`

**npm registry / GitHub API** (via `npm view` / `api.github.com`)
- @dimforge/rapier3d{,-compat,-deterministic,-deterministic-compat,-simd-compat} 0.21.0
- colyseus 0.18.9, @colyseus/core 0.18.18, @colyseus/schema 5.0.36, @colyseus/sdk 0.18.5, colyseus.js 0.16.22, @colyseus/ws-transport 0.18.4, @colyseus/uwebsockets-transport 0.18.4
- ws 8.22.0, @geckos.io/server 3.1.0
- partykit 0.0.115, partyserver 0.5.10, partysocket 1.3.0
- @heroiclabs/nakama-js 2.8.0
- viem 2.57.4, wagmi 3.7.7, @wagmi/core 3.6.5
- ponder 0.18.0, envio 3.14.0, @graphprotocol/graph-cli 0.98.1
- @msgpack/msgpack 3.1.3, flatbuffers 25.9.23
- @rainbow-me/rainbowkit 2.2.11, @reown/appkit 1.8.24, permissionless 0.4.1, @zerodev/sdk 5.5.10
- @openzeppelin/contracts 5.6.1
- GitHub releases: foundry v1.8.5, rindexer v0.43.4, uWebSockets.js v20.71.0, nakama v3.41.0; geckos.io last commit 2026-03-27; colyseus MIT

**Physics / netcode**
- https://rapier.rs/docs/user_guides/javascript/determinism
- https://rapier.rs/docs/user_guides/javascript/getting_started_js
- https://rapier.rs/docs/user_guides/rust/determinism
- https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-deterministic-compat@0.21.0/README.md
- https://github.com/dimforge/rapier.js
- https://docs.colyseus.io/
- https://docs.colyseus.io/netcode
- https://docs.colyseus.io/netcode/server-input
- https://docs.colyseus.io/netcode/client-prediction
- https://docs.colyseus.io/netcode/determinism
- https://docs.colyseus.io/netcode/lag-compensation
- https://docs.colyseus.io/room
- https://docs.colyseus.io/state/schema
- https://docs.colyseus.io/migrating/0.18
- https://docs.colyseus.io/server/transport/webtransport
- https://gafferongames.com/post/snapshot_interpolation/
- https://gafferongames.com/post/snapshot_compression/
- https://gafferongames.com/post/state_synchronization/
- https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html
- https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking (403 on direct fetch; via search)
- https://developer.valvesoftware.com/wiki/Interpolation
- https://www.youtube.com/watch?v=ueEmiDM94IE
- https://www.gamedeveloper.com/design/video-the-rocket-science-behind-i-rocket-league-s-i-physics
- https://www.epicgames.com/help/en-US/c-Category_RocketLeague/c-RocketLeague_Gameplay/rocket-league-input-buffering-settings-a000084497
- https://gdcvault.com/play/1024001
- https://edgegap.com/blog/game-backend-deep-dive-overwatch-2016-netcode-architecture-rollback

**Transport / hosting**
- https://caniuse.com/webtransport
- https://github.com/uNetworking/uWebSockets.js
- https://github.com/geckosio/geckos.io
- https://github.com/cloudflare/partykit
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://github.com/heroiclabs/nakama
- https://heroiclabs.com/docs/nakama/server-framework/typescript-runtime/
- https://github.com/heroiclabs/nakama/releases
- https://crux.supercraft.host/blog/hathora-shut-down-where-to-go-after-may-2026/
- https://gamesbeat.com/?p=318174
- https://docs.railway.com/reference/public-networking
- https://docs.railway.com/networking/public-networking/specs-and-limits
- https://docs.fly.io/networking/udp-and-tcp
- https://vercel.com/docs/functions/limitations
- https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections

**Chain / indexing**
- https://viem.sh/docs/contract/watchContractEvent
- https://docs.arbitrum.io/how-arbitrum-works/deep-dives/sequencer
- https://docs.arbitrum.io/how-arbitrum-works/reference/finality-and-reorgs
- https://eips.ethereum.org/EIPS/eip-712
- https://eips.ethereum.org/EIPS/eip-7702
- https://eips.ethereum.org/EIPS/eip-2612
- https://eips.ethereum.org/EIPS/eip-6963
- https://www.alchemy.com/rpc/robinhood-testnet.md
- https://ponder.sh/docs/config/chains
- https://ponder.sh/docs/query/api-endpoints
- https://ponder.sh/docs/production/self-hosting
- https://docs.envio.dev/docs/HyperIndex/rpc-sync
- https://docs.goldsky.com/chains/supported-networks
- https://github.com/joshstevens19/rindexer

**Comparables**
- https://elympics.ai/products/blockchain-connect
- https://www.blockchaingamer.biz/?p=28858
- https://decrypt.co/229005/redstone-network-launches-fully-on-chain-ethereum-games
- https://decrypt.co/resources/what-is-off-the-grid-battle-royale-shooter-avalanche
- https://peerpush.com/p/deskillz

**P2P alternative (read 2026-10-09)**
- https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity
- https://developers.cloudflare.com/realtime/pricing/ and https://developers.cloudflare.com/realtime/turn/faq/ (via search result, not opened directly)
- https://github.com/dmotz/trystero (README via search); npm `trystero` 0.26.0, `peerjs` 1.5.5, `simple-peer` 9.11.1 (`npm view`)
