# Repo audit and tooling

Research date: 2026-10-09. Scope: the BUMP.TRADE client at `/home/cn/Projects/Personal/3d`, read-only, plus the skills and MCP servers that fit the multiplayer stack. Paths are relative to the repo root unless they are absolute. Chain specifics and the realtime architecture are covered by the sibling files `docs/research/robinhood-chain.md` and `docs/research/realtime-architecture.md` and are not repeated here.

## Summary

- **Netcode readiness: not ready, but the split is tractable.** The 21,074-line client has no networking code. The simulation core is three.js-math-only and runs headless: `CarPhysics`, `PhysicsWorld`, `BoostController`, `CarAI`, `Config`, `VehicleTypes`, `PowerUpTypes`, `CollisionTypes`. I smoke-tested `three` 0.186.1 and `@dimforge/rapier3d-compat` 0.21.0 in Node v26.2.0, and both import, construct and step with no DOM. Every rule-bearing class is entangled with presentation, though: `CollisionSystem`, `MatchManager`, `CarController`, `ComboManager`, `BountySystem`, `PowerUpManager`, the arena colliders and the void check. They call `SoundManager`, the HUD, `performance.now()`, `Math.random()`, `setTimeout`, canvas textures and a hard-coded `'player_car'`. About 2.8k lines of sim have to come out of them. The rest (around 18k lines) stays client-only.
- **The timing model is half-fixed.** Physics runs on a fixed 60 Hz accumulator (`src/core/GameLoop.ts:23,71-79`). The match timer, power-up pickup and expiry, and the combo window all tick on the variable render `dt` instead (`src/core/GameApp.ts:712-715`, `src/vehicles/CarController.ts:360-376`, `src/ui/GameplayHUD.ts:1141`). The final ranking, which decides the winner, is computed inside the HUD (`src/ui/GameplayHUD.ts:1269-1301`).
- **The zero-sum transfer holds at the bump.** `stolen = max(0, min(dmg, victim.balance))`, then the victim is debited and the attacker credited the same amount (`src/collision/CollisionSystem.ts:365-371`, `474-479`). `addMoney` has no other caller. Money still leaves or appears in four places:
  - void-pit elimination burns the balance (`src/vehicles/CarController.ts:210,244`);
  - `reset()` refills to `maxBalance`, not to the starting bag (`src/vehicles/CarController.ts:532`);
  - `repair()` and `setBalance()` are unbacked mutators (`:153-156`, `:184-201`);
  - starting bags differ by car, from $69 to $500 (`src/vehicles/VehicleTypes.ts:123-507`).
- **The AI can become server bots almost unchanged.** `CarAI.update(dt)` returns the same 5-field `VehicleInput` a human produces and has no randomness (`src/ai/CarAI.ts:27-115`). The open question is economic: what is a bot's balance worth when humans stake on chain?
- **Tooling:** there is no git repo, no `.gitignore`, no lint, no test, no CI. `tsc` (TypeScript 7.0.2) type-checks clean in about 0.4 s. `dist/` ships two `.blend` source files.
- **Layout:** keep the Vite client at the repo root and turn the root into a pnpm workspace. Add `packages/shared` (headless sim plus protocol), `server/`, `contracts/` and `indexer/`. Moving the client into `apps/client` would break 10 Blender/texture scripts that hard-code `/home/cn/Projects/Personal/3d/public/models` (`scripts/*.py`), and it buys little.
- **`docs/reskin/` belongs to another project** (Tagei → Lucky Games) and is irrelevant here.
- **Tooling candidates (nothing installed):**
  - Contracts: OpenZeppelin skills and the OpenZeppelin Contracts MCP, Trail of Bits and Cyfrin Solidity skills.
  - Game server: the Colyseus skill, only if Colyseus is chosen.
  - Indexer: the Envio docs MCP, only if Envio is chosen.
  - Ops: Railway is already installed.
  - Chain data: no explorer or data MCP covers Robinhood **testnet**. Blockscout, Etherscan and Alchemy were rejected or deferred. Agents should query the testnet explorer's Blockscout `/api/v2` over HTTP instead.

## Findings

### A. Repo audit

#### A1. Structure map

| Folder | Lines (files) | Responsibility | Key classes / files |
|---|---|---|---|
| `src/main.ts` | 32 | Bootstraps `GameApp` on `#webgl-canvas` and exposes debug globals on `window` | `main.ts:4-25` |
| `src/core/` | 1,550 (6) | Composition root, loop, match timeline, config, event bus, asset loading | `GameApp.ts` 751, `GameLoop.ts` 89, `MatchManager.ts` 268, `EventBus.ts` 56, `Config.ts` 175, `AssetManager.ts` 211 (GLTFLoader, `AssetManager.ts:2,53`) |
| `src/physics/` | 49 (1) | Rapier world wrapper, collider→entity map, `step()` | `PhysicsWorld.ts:21-44` |
| `src/vehicles/` | 7,292 (18) | Car physics, controller (balance/power-ups/state), visuals, VFX, audio, 7 procedural model builders, archetype configs | `CarPhysics.ts` 334, `CarController.ts` 550, `HeroCar.ts` 84, `VehicleFactory.ts` 55, `VehicleTypes.ts` 537, `BoostController.ts` 39, `CarVisual.ts` 619, `CarVFX.ts` 515, `*ModelBuilder.ts` (7 files, ~4.2k) |
| `src/collision/` | 787 (2) | Reads the Rapier event queue, classifies impacts, skill moments, knockback, **cash transfer** | `CollisionSystem.ts` 726, `CollisionTypes.ts` 61 |
| `src/combat/` | 320 (2) | Combo multiplier (player only), bounty tiers, AI target scoring | `ComboManager.ts` 137, `BountySystem.ts` 183 |
| `src/ai/` | 362 (2) | Opponent spawning, AI driving, retargeting | `CarAI.ts` 116, `OpponentManager.ts` 246 |
| `src/arena/` | 2,065 (8) | Floor and wall colliders and visuals, void pits, props, timed arena events | `NeonMarketArena.ts` 106, `ArenaFloor.ts` 70, `ArenaBumperWalls.ts` 353, `MarginVoidPits.ts` 254, `ArenaEvents.ts` 295, `ArenaProps.ts` 404, `ArenaFloorTextureGenerator.ts` 569 |
| `src/pickups/` | 1,184 (3) | Cosmetic cash scatter, power-up crates (spawn, collect), power-up configs | `PickupManager.ts` 400, `PowerUpManager.ts` 718, `PowerUpTypes.ts` 66 |
| `src/input/` | 137 (1) | Keyboard → `VehicleInput` and debug hotkeys | `InputManager.ts:6-12` (input type), `:29-32` (window listeners) |
| `src/camera/` | 162 (1) | Follow, spectator, shake, punch | `GameCamera.ts` |
| `src/ui/` | 3,565 (3) | DOM HUD (timer, ranking, result modal), onboarding/menus, motion helpers | `GameplayHUD.ts` 1,492, `OnboardingUI.ts` 1,787, `MotionFX.ts` 286 |
| `src/showroom/` | 709 (1) | 3D turntable for menu, vehicle select and leaderboard | `ShowroomStage.ts` |
| `src/vfx/` | 254 (2) | Skid marks, shockwaves | `SkidMarkManager.ts`, `ShockwaveManager.ts` |
| `src/audio/` | 904 (1) | WebAudio synth SFX singleton | `SoundManager.ts:48-49` (AudioContext) |
| `src/textures/` | 1,296 (1) | Canvas-generated car textures | `CarTextureGenerator.ts` |
| `src/rendering/` | 74 (1) | Bloom post-processing | `PostProcessing.ts` |
| `src/debug/` | 90 (1) | Rapier debug lines, DOM metrics overlay | `DebugRenderer.ts` |
| `src/test/` | 241 (1) | `TestArena.ts`, which nothing imports (a grep for `TestArena` finds no importer). It is not a test suite. | — |

Other root items:
- `public/models/` (68 MB): 7 GLBs, `hood_bull.blend` and `.blend1`, and 32 MB of textures.
- `dist/` (73 MB), already built.
- `scripts/`: 10 Python Blender/texture scripts.
- `renders/`: screenshots.
- Three ~2.4 MB PNGs at the root, and an empty `prd.nd`.
- `pnpm-lock.yaml`: pnpm 11 multi-document lockfile, `lockfileVersion '9.0'` (`pnpm-lock.yaml:2,190`).

Installed versions match `package.json`: three 0.186.1, rapier3d-compat 0.21.0, typescript 7.0.2, vite 8.3.2, motion 14.0.0.

#### A2. Game loop and timing

- **Loop.** `GameLoop` runs on `requestAnimationFrame` (`GameLoop.ts:38,87`):
  - fixed step 1/60 s and at most 5 substeps (`:23-24`);
  - frame delta capped at 0.15 s (`:58-60`);
  - accumulator loop (`:71-79`).
  It computes an interpolation `alpha` (`:82`) that `GameApp` ignores: `renderTick(dt)` takes no alpha (`GameApp.ts:112-115`), and visuals read the live physics state. **Hit-stop pauses the whole simulation** (`GameLoop.ts:63-69`). Collisions trigger it (`GameApp.ts:303`) and so does match end (`GameApp.ts:103`, `MatchManager.ts:233-235`). A server cannot freeze the world for one client, so hit-stop has to become a client-only visual effect.
- **Fixed physics tick** (`GameApp.ts:642-664`). The order is:
  1. `inputManager.sampleInput()` (`:647`);
  2. `playerCar.controller.stepPhysics(dt, input)` (`:650`);
  3. `opponentManager.stepPhysics(dt)`, where the AI produces inputs (`:653`, `OpponentManager.ts:153-170`);
  4. **`physicsWorld.step(dt)`**, which calls `world.step(eventQueue)` (`GameApp.ts:656` → `PhysicsWorld.ts:41-44`);
  5. `collisionSystem.update()` (`GameApp.ts:659`);
  6. `arena.checkVoidHazards()` (`:663`).
  `CollisionSystem.update` hard-codes `dt = 1/60` (`CollisionSystem.ts:67`).
- **Variable render tick** (`GameApp.ts:666-750`). It re-samples input (`:692`) and runs `controller.update` (visuals, **power-up expiry**, state machine). It also runs, **on render dt**:
  - `pickupManager.update` (`:712`);
  - `powerUpManager.update` (`:713`), which does **power-up collection** (`PowerUpManager.ts:665-690`);
  - `arena.update` (`:714`);
  - `matchManager.update(dt)` (`:715`), which is the **round timer**.

  The HUD runs `ComboManager.get().update(dt)` (`GameplayHUD.ts:1141`), so the **combo window** ticks inside UI code. During hit-stop the render tick gets `frameDelta * 0.1` (`GameLoop.ts:66`), which slows the match clock.
- **Input flow.** `InputManager` keeps a `Set` of pressed `KeyboardEvent.code`s from window listeners (`InputManager.ts:29-32,39-76`). `sampleInput()` maps them to `VehicleInput {throttle, steer, brake, boost, handbrake}` (`:6-12,105-132`). From there, `CarController.stepPhysics` runs the boost state, then `CarPhysics.step`, which applies drive, steer, grip and the arena clamp to the Rapier body (`CarController.ts:313-343`, `CarPhysics.ts:127-263`). The hotkeys R (reset all cars), T (toggle AI), V/B (swap vehicles) and C (camera) change authoritative state directly (`GameApp.ts:378-416`).
- **Match timer and end.**
  - `MatchManager` holds a 90 s round, `totalDuration = 90` (`MatchManager.ts:11`). The brief's "~3-minute rounds" is not what the code does.
  - It runs a timeline: fire bursts at 20 s and 40 s, Market Drop at 50 s, Double Steal Surge at 60 s, a random minor event at 66 s, Final 20, and a 10 s countdown (`:102-226`).
  - At 0 it calls `handleMatchComplete()`, which sets FREEZE, hit-stops, then sets COMPLETED after `setTimeout(550)` (`:228-249`).
  - The round also ends early when 1 or fewer cars are alive (`GameApp.ts:371-374`), and FINAL DUEL fires at 2 alive (`:352-368`).
  - The HUD keeps a **second, independent timer** (`GameplayHUD.ts:66,1177-1178`).

#### A3. Where game state lives

The state is entangled. It sits on the same objects that own three.js meshes, and the HUD writes straight from it.

| State | Location | Notes |
|---|---|---|
| Balance, max balance, damage ratio, vehicle state (`IDLE`…`ELIMINATED`) | `CarController` fields (`CarController.ts:26-37`) | Every mutation also updates visuals (`:133-135,165-166`) |
| Elimination | `CarController.eliminate()` (`:208-232`) | Sets balance to 0, locks the body, plays VFX and audio, emits `vehicle_eliminated`. **No elimination order or time is recorded.** |
| Combo | `ComboManager` singleton (`ComboManager.ts:14-28`) | Tracks only `'player_car'` (`:35`); ticked by the HUD (`GameplayHUD.ts:1141`) |
| Bounty | `BountySystem` singleton (`BountySystem.ts:14-25`) | Writes `visual.setBountyTier` (`:91,98`) and reads it back for AI scoring (`:160`) |
| Power-ups (active, remaining) | `CarController.activePowerUps` (`CarController.ts:40`) | Expire on render dt (`:360-376`); world crates in `PowerUpManager.powerUps` with meshes |
| Cash drops | `PickupManager.pickups` (`PickupManager.ts:28`) | **Cosmetic only**: balance is transferred at impact, and the absorb step only emits `money_collected` (`:281-296`). Any car can absorb any drop (`:342-365`). |
| Match phase and timer | `MatchManager.state/timeRemaining` (`MatchManager.ts:12-13`) plus the HUD's own `roundTimer` | Calls `GameplayHUD` and `SoundManager` directly |
| Surge window | `CollisionSystem.surgeEndTime`, set from `performance.now()` on `arena_event` (`CollisionSystem.ts:39-43`) | The rule state reaches the rules through a visual class's event |
| Ranking / winner | `GameplayHUD.updateRanking()` (`GameplayHUD.ts:1269-1301`) | Alive first, then cash descending. Eliminated cars all have $0, so their order is insertion order. |
| App state (menu, gameplay) | `GameApp.state` (`GameApp.ts:28,53`) | |

**EventBus.** It is a process-wide singleton string-keyed bus with untyped payloads (`EventBus.ts:5-51`). It is never cleared between matches. On a multi-room server it has to become an instance per room.

| Event | Payload | Emitted at | Listened at |
|---|---|---|---|
| `collision` | `CollisionEvent` (`CollisionTypes.ts:18-39`) | `CollisionSystem.ts:411,515` | `GameApp.ts:306`, `GameplayHUD.ts:474` |
| `skill_moment` | `SkillMomentEvent` (`CollisionTypes.ts:41-51`) | `CollisionSystem.ts:429,558,622` | `GameplayHUD.ts:559` |
| `money_scatter` | `{position, amount, normal}` | `CollisionSystem.ts:374,481` | `GameApp.ts:320` → `PickupManager.spawnScatter` |
| `money_collected` | `{carId, amount, position}` | `PickupManager.ts:286` | `GameApp.ts:325`, `GameplayHUD.ts:629` (shows "YOU PICKED UP $x" even though the balance does not change) |
| `vehicle_eliminated` | `{carId, position}` | `CarController.ts:228` | `GameApp.ts:336` |
| `vehicle_liquidated` | `{carId, pitLocation}` | `MarginVoidPits.ts:244` | `GameApp.ts:330`, `GameplayHUD.ts:662` |
| `arena_event` | `{type: FIRE_BURST\|MARKET_FLASH\|BLACKOUT\|MARKET_CRASH\|DOUBLE_STEAL_SURGE, title, subtitle, duration}` | `ArenaEvents.ts:141,153,172,191,209` | `CollisionSystem.ts:39`, `GameplayHUD.ts:656` |
| `market_event_telegraph` | `{secondsLeft, eventName, subtitle, isFinal}` | `MatchManager.ts:130,143,159,172` | `GameplayHUD.ts:623` |
| `match_started` | `{duration}` | `MatchManager.ts:70,86` | none |
| `final_20_started` | — | `MatchManager.ts:198` | none |
| `match_completed` | — | `MatchManager.ts:246` | none |
| `final_duel` | `{opponentName, opponentCash, playerCash}` | `GameApp.ts:363` | `GameplayHUD.ts:591` |
| `combo_updated` | `ComboState` | `ComboManager.ts:55` | `GameplayHUD.ts:598` |
| `combo_lost` | `{lastCombo, reason}` | `ComboManager.ts:70,88` | `GameplayHUD.ts:603` |
| `combo_reset` | — | `ComboManager.ts:100` | none |
| `bounty_tier_changed` | `{carId, carName, isPlayer, oldTier, newTier, balance, info}` | `BountySystem.ts:105` | `GameplayHUD.ts:609` |
| `powerup_collected` | `{carId, isPlayer, type, config, position}` | `PowerUpManager.ts:680` | `GameplayHUD.ts:644` |

Payloads carry `THREE.Vector3` instances. To go over the wire they must be serialized as `[x, y, z]`.

**Zero-sum audit.** Every money mutation in `src/` was grepped.
- *Holds.* A vehicle-vehicle bump computes `stolenCash = max(0, min(calculatedDamage, victim.balance))`, then calls `victim.subtractBalance(stolen)` and `attacker.addMoney(stolen)` (`CollisionSystem.ts:365-371`). A wall slam does the same (`:474-479`). `subtractBalance` clamps a second time (`CarController.ts:129`). The only callers of `addMoney` are those two transfers. Arena cash spawns are stubbed out on purpose (`PickupManager.ts:194-200`). Shield sets damage to 0 (`CollisionSystem.ts:362`). Market events only multiply transfers (`:361`, `ArenaEvents.ts:199-215`).
- *Breaks or leaks:*
  1. **Void-pit liquidation destroys the victim's balance.** `triggerFall` calls `eliminate()`, which sets `balance = 0` with no transfer (`CarController.ts:234-245,210`). This counts as "an explicitly designed economy event" only if the PRD says so (`docs/mechanics/prd.md` §20). It may be unreachable today, because the ground is one flat cuboid over the whole arena (`ArenaFloor.ts:62`), the pit visuals are not added to the scene (`NeonMarketArena.ts:49-50`), and the trigger needs `y < -0.6` (`Config.ts:168`). That is an inference; it was not tested.
  2. **`reset()` refills `balance = maxBalance`** (`CarController.ts:532`), and `maxBalance` ratchets up to the highest balance ever reached (`:161-163`). Play Again and Restart therefore mint money for that round's winners (`GameApp.ts:519-521`).
  3. `repair()` (`:153-156`) and `setBalance()` (`:184-201`) are unbacked mutators with no callers today. Keep them out of the shared sim's public API.
  4. **Starting bags differ by vehicle**: hood_bull 85, hood_bear 120, then 200, 150, 500, 420 and 69 (`VehicleTypes.ts:123,187,251,315,379,443,507`). A stake on chain has to map onto these, or the bags have to be normalized.
  5. **The PRD diverges from the code.** `docs/mechanics/prd.md` §7-8 has the attacker physically collect the dropped cash. The code credits it instantly and the drops are cosmetic. `docs/designgame/prd.md` §7 "CASH RAIN — Arena menghasilkan banyak cash" ("the arena produces lots of cash") conflicts with `docs/mechanics/prd.md` §21 (cash must come from a finite pool) and §20.

#### A4. Physics

- **World.** `PhysicsWorld.create()` runs `RAPIER.init()` with gravity −9.81 and `new EventQueue(true)` (`PhysicsWorld.ts:21-27`). `step()` sets `world.timestep` and calls `world.step(eventQueue)` (`:41-44`). Colliders map to `{id, type: vehicle|wall|ground|obstacle}` by handle (`:29-39`).
- **Cars** (`CarPhysics.ts:36-92`). A dynamic body with additional mass, damping, X/Z rotations locked and CCD on. It has two colliders:
  - a bumper `roundCuboid` with restitution `config.bounce`, friction 0.12, `COLLISION_EVENTS` and `DYNAMIC_DYNAMIC`;
  - a cabin cuboid.
  Both are registered as `vehicle`. The drive model is impulse-based: thrust (`:187-196`), lateral grip (`:204-213`), anti-hop (`:216-219`), a speed clamp (`:222-228`), and a hard arena clamp at ±22 m that teleports and reflects velocity (`:231-259`).
- **Arena colliders.** These live inside visual classes that also build canvas textures:
  - ground cuboid (`ArenaFloor.ts:57-68`);
  - 8 walls (`ArenaBumperWalls.ts:275-294`);
  - corner blocks (`:343-350`).
- **Collision reading.** `CollisionSystem.update()` drains `eventQueue.drainCollisionEvents` and keeps only `started` (`CollisionSystem.ts:76-77`). Contacts within 50 ms of the last handled contact anywhere are dropped, because there is **one global `lastCollisionTime`** (`:14,84-86,94,106`). With 8 players, simultaneous bumps in different corners would be lost.
- **Damage and steal** (`CollisionSystem.ts:112-438`). These are computed from **velocities read after the step**, not from contact impulses:
  - `impactSpeed = |vA − vB|` (`:118-119`), ignored below 1.2 m/s (`:122`);
  - the attacker is the car whose velocity points more at the other (`:125-141`);
  - angle quality comes from forward/right dot products (`:150-169`);
  - the speed multiplier is ×1, ×1.25 or ×1.5 (`:172-179`);
  - skill moments use time windows (`:196-263`), then tier (`:266-276`), then combo (player only, `:288-292`);
  - knockback impulses are applied manually (`:294-333`);
  - base damage is 8, 15, 20 or 35, multiplied by speed, combo, skills, Titan, surge and shield (`:337-362`).
  Wall hits and wall slams follow at `:440-517`; near misses at `:522-570`; corner pins at `:575-638`.
- **Nondeterminism in sim-relevant code.** Each occurrence must move to the server (authoritative) or onto a seeded RNG or tick clock:

| file:line | Call | Effect | Fix |
|---|---|---|---|
| `src/core/MatchManager.ts:184` | `Math.random()` | Picks Market Crash or Market Flash at 66 s | Server-side seeded RNG |
| `src/pickups/PowerUpManager.ts:594` | `Math.random()` | Power-up type | Seeded RNG |
| `src/pickups/PowerUpManager.ts:596-597` | `Math.random()` | Power-up spawn x and z | Seeded RNG |
| `src/collision/CollisionSystem.ts:41` | `performance.now()` | End of the Double Steal Surge window | Tick clock |
| `src/collision/CollisionSystem.ts:85` | `performance.now()` | Global 50 ms contact rate limit | Per-pair, tick-based |
| `src/collision/CollisionSystem.ts:113` | `performance.now()` | Bank shot (1.2 s), revenge (5 s), chain (1.2 s) windows, surge check (`:361`) | Tick clock |
| `src/collision/CollisionSystem.ts:441` | `performance.now()` | Wall-slam window (1.5 s) | Tick clock |
| `src/collision/CollisionSystem.ts:523` | `performance.now()` | Near-miss cooldown (3 s) | Tick clock |
| `src/vehicles/CarController.ts:307,461` | `performance.now()` | "Drifting recently" window (800 ms), which feeds the DRIFT_BUMP ×1.25 | Tick clock |
| `src/core/MatchManager.ts:244` | `setTimeout(550)` | FREEZE → COMPLETED | Tick count |
| `src/core/GameLoop.ts:37` | `performance.now()` | Loop driver | Client only; the server owns its own clock |

Cosmetic-only randomness can stay on the client:
- `PickupManager.ts:163,164,170,187,228,230,241,361`, plus the `setInterval` at `:384` (as long as drops stay cosmetic);
- `ArenaEvents.ts:237,241`;
- `CarAnimation.ts:141`;
- `GameCamera.ts:37,43,143-151`;
- `CarController.ts:393`;
- 78 calls in `CarVFX.ts`;
- `CarVisual.ts`, `GameplayHUD.ts`, `OnboardingUI.ts`, `textures/*`, `SoundManager.ts`.

On determinism itself: `@dimforge/rapier3d-deterministic-compat` 0.21.0 exists on npm (`npm view`, 2026-10-09). It matters only if clients must re-simulate bit-exactly; that choice belongs to the realtime-architecture research.

#### A5. AI opponents as server bots

- `CarAI.update(dt): VehicleInput` (`CarAI.ts:27-115`) is a pure policy: stuck → reverse, otherwise chase the target, steer away from void pits (`VOID_CONFIG`), and boost when aligned at 3-18 m. It uses no randomness, no time source and no DOM. It reads only `controller.getPhysicsState()` and `isEliminated()`.
- Target choice is `BountySystem.getBestTargetForAI` (`BountySystem.ts:147-178`). It reads `controller.visual.getBountyTier()` (`:160`), which has to switch to a sim-side tier.
- **Verdict: usable as server bots.** A bot produces inputs that go into the same per-tick input slot as a human's. `OpponentManager` itself is client-bound (scene, `VehicleFactory`, `OpponentManager.ts:19-37,82-89`). It assumes one human target (`:91,125-146`), 6 fixed spawn slots (`:52-59`) and 7 archetypes (`VehicleFactory.ts:7-15`). An 8-player room needs 8 slots.
- **Economic caveat.** In a zero-sum stake game, money a human takes from a bot comes from whoever funded the bot. Bots need either zero or house-funded balances, or they must be excluded from payouts. This is a contracts decision.

#### A6. Netcode readiness by module

Legend: **(a)** shared sim, runs headless in Node now; **(b)** client-only presentation; **(c)** entangled, needs splitting. "three-math" means it imports `three` only for Vector3/Quaternion/MathUtils, which works in Node: verified by importing `three` 0.186.1, constructing a `Mesh`, and confirming that `document.createElement` throws `ReferenceError` (Node v26.2.0, 2026-10-09).

| Module | Class | Why |
|---|---|---|
| `core/Config.ts` | a | Pure data |
| `core/EventBus.ts` | a* | Headless, but a process singleton (`EventBus.ts:8-18`), so it needs one instance per room |
| `physics/PhysicsWorld.ts` | a | Rapier only (Rapier 0.21 stepped in Node: 600 steps in about 89 ms for one body) |
| `vehicles/CarPhysics.ts` | a | three-math plus Rapier |
| `vehicles/BoostController.ts` | a | Pure |
| `vehicles/VehicleTypes.ts` | a | Pure config, no imports (it also holds visual colour fields) |
| `pickups/PowerUpTypes.ts` | a | Pure data |
| `collision/CollisionTypes.ts` | a | Types only (three types) |
| `ai/CarAI.ts` | a | three-math; typed against `HeroCar` (`CarAI.ts:3`), so retype it to a sim-car interface |
| `vehicles/CarTypes.ts` | c (types) | `CarPhysicsState` is shared; `CarNodeBindings` uses `THREE.Object3D` (`CarTypes.ts:26-30`) |
| `input/InputManager.ts` | c | `VehicleInput` (`:6-12`) is shared; the class uses `window` (`:29-32`) |
| `collision/CollisionSystem.ts` | c | Rules plus `SoundManager` (`:323,330,433,435,488,549,619`), juice hooks, `performance.now`, `'player_car'` (`:288,551,560`) |
| `core/MatchManager.ts` | c | Timeline rules plus `GameplayHUD` and `SoundManager` calls, `Math.random`, `setTimeout` |
| `vehicles/CarController.ts` | c | Balance, elimination and power-up rules mixed with `CarVisual`/`CarVFX`/`CarAudio` and a shield mesh (`:69-88`) |
| `vehicles/HeroCar.ts`, `VehicleFactory.ts` | c | Construction loads GLB and adds to the scene (`HeroCar.ts:42-58`) |
| `combat/ComboManager.ts` | c | Singleton, player-only, `SoundManager` (`:52`), ticked by the HUD |
| `combat/BountySystem.ts` | c | Singleton; writes and reads `visual` bounty tier |
| `ai/OpponentManager.ts` | c | Scene plus factory; the retarget logic is shareable |
| `arena/ArenaFloor.ts`, `ArenaBumperWalls.ts` | c | Rapier colliders next to canvas textures (`ArenaBumperWalls.ts:91,133`) |
| `arena/MarginVoidPits.ts` | c | `checkVoidHazards` (`:226-253`) is sim; the rest is canvas and meshes |
| `arena/ArenaEvents.ts` | c | Surge state (`:30-33,203-219`) is sim; flames, lights and canvas are presentation (`:48`) |
| `arena/NeonMarketArena.ts` | c | Composes both |
| `pickups/PowerUpManager.ts` | c | Spawn and collect (`:592-700`) is sim; crates, sprites and canvas (`:86,269,316,399`) are presentation |
| `core/GameLoop.ts` | c | Accumulator reusable; `requestAnimationFrame` and hit-stop are client-only |
| `core/GameApp.ts` | b/c | Client composition root; the tick order (`:642-664`) is what the server reproduces |
| `pickups/PickupManager.ts` | b | Cosmetic. It becomes **c** if PRD §7-8 "collect to receive" is implemented. |
| `ui/*`, `audio/SoundManager.ts`, `camera/GameCamera.ts`, `rendering/*`, `vfx/*`, `showroom/*`, `textures/*`, `debug/*`, `vehicles/CarVisual.ts`, `CarVFX.ts`, `CarAnimation.ts`, `CarAudio.ts`, `*ModelBuilder.ts`, `core/AssetManager.ts`, `arena/ArenaProps.ts`, `ElectricCeiling.ts`, `ArenaFloorTextureGenerator.ts`, `main.ts` | b | DOM, WebGL, WebAudio, GLTFLoader, canvas |
| `test/TestArena.ts` | — | Dead code |

#### A7. What must change for multiplayer

**Refactor list, in dependency order:**

1. **Extract `packages/shared`**, a headless sim with no DOM in its `lib`, so the compiler enforces the boundary. It should contain:
   - **Move as-is:** `Config`, `VehicleTypes`, `PowerUpTypes`, `CollisionTypes`, `PhysicsWorld`, `CarPhysics`, `BoostController`, `CarAI`, and `VehicleInput`.
   - **New `SimCar`:** balance, eliminated and elimination tick, boost, power-ups with tick-based expiry, drift-recent tick, hit timers, combo and bounty per car.
   - **`ArenaSim`:** the ground, wall and corner colliders and the void check.
   - **`CollisionRules`**, extracted from `CollisionSystem`. It returns a list of typed events and calls no audio and no hooks.
   - **`MatchRules`:** the timeline from `MatchManager`, the power-up spawn and collect, and end conditions (time out, or ≤1 alive).
   - **`Economy.transfer(from, to, amount)`**, with a per-tick invariant assert that the sum of balances, plus any explicitly burned amount, stays constant.
   - **`Ranking`** (out of `GameplayHUD.ts:1269-1301`) and **`MatchResult`** for signing.
2. **Tick clock.** Replace every time source in A4 with `tick * FIXED_DT`. Make the contact rate limit per pair. Fix the server's sim Hz (60 Hz, matching `GameLoop.ts:23`, unless the realtime research picks otherwise).
3. **Seeded RNG**, carried in room state, for the three gameplay `Math.random()` sites.
4. **Move all rules into the fixed step:** match timer, power-up collection and expiry, combo window. Delete the HUD's second timer and render the server's time instead.
5. **Make `MatchManager` authority-agnostic.** The sim emits events; the client maps them to `SoundManager`, HUD and `ArenaEvents` visuals. The server never imports presentation.
6. **Per-room instances instead of singletons** (`EventBus`, `ComboManager`, `BountySystem`). Remove `'player_car'` from rules (22 refs). The client keeps a `localPlayerId`.
7. **Client remote cars.** Replace `OpponentManager`'s AI-driven bodies with snapshot-driven `RemoteCar`s. They keep the existing `HeroCar` visuals but have no Rapier body, or a kinematic one. `CarController` gets a "view" path that takes authoritative balance, power-ups and eliminated state. The local car runs prediction through the shared `CarPhysics`.
8. **Inputs become commands.** `VehicleInput` is already a 5-field serializable struct (`InputManager.ts:6-12`); add `{seq, tick}`. Disable or strip the R/T/V/B hotkeys (`GameApp.ts:378-416`) in network mode. Gate the `window.__*` debug globals (`main.ts:17-22`).
9. **Hit-stop is client-only.** Drop it from the sim (`GameLoop.ts:63-69`, `MatchManager.ts:233`).
10. **Record the elimination order and tick** so ranks among eliminated players are deterministic. That is needed for a signed result.
11. **Close the economy gaps:** void burn, `reset()` refill, unbacked mutators, per-vehicle starting bags, PRD collect-versus-instant, and bot balances.
12. **Roster and timing:** 8 spawn slots instead of 6; round length (90 s in code versus about 3 min in the brief).

**Layout options and cost.**

| Option | Moves | Cost |
|---|---|---|
| A. Client stays at root; root becomes a pnpm workspace (recommended) | None. Add `pnpm-workspace.yaml` (`packages: [packages/*, server, indexer, contracts]`) | Root `package.json` serves as both client app and workspace root, so client dependencies sit at the root (acceptable with pnpm) |
| B. `apps/client` | Move `src/`, `public/` (68 MB), `index.html`, `vite.config.ts`, `tsconfig.json` | No import rewrites (all imports are relative; `AssetManager.ts:53` loads `/models/…` from `publicDir`). But 10 scripts hard-code `/home/cn/Projects/Personal/3d/public/models` (`scripts/blender_build_fleet.py:17-18`, `scripts/blender_build_hood_bull.py:27-29`, `scripts/blender_build_hood_bull_v9.py:43-45`, `scripts/generate_*_pbr_textures.py:16-17`, `scripts/blender_open_hood_bull_mcp.py:4`, `scripts/blender_preview_hood_bull.py:11`, and others), docs cite `public/models`, and with no git, moving 68 MB is not reversible from history. |

**Proposed smallest viable layout (option A):**

```text
/                      Vite client (src/, public/, index.html, vite.config.ts, tsconfig.json)  + workspace root
pnpm-workspace.yaml
tsconfig.base.json     shared compiler options (strict), extended by every package
packages/shared/       @bump/shared - headless sim, protocol messages, MatchResult + EIP-712 types, seeded RNG
server/                @bump/server - Node authoritative rooms, bots, result signing
contracts/             Foundry project (src/, test/, script/) + package.json exporting ABI + deployments/<chainId>.json
indexer/               @bump/indexer - event indexer + leaderboard API
.github/workflows/ci.yml   (or Railway build checks)
```

**Ownership map:**

| Path | Owner | Notes |
|---|---|---|
| Root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `tsconfig.json`, `vite.config.ts` | **Client chain + network integration engineer** (the client is the root package) | Other roles send dependency changes as `pnpm --filter <pkg> add …` requests. Only the owner runs `pnpm install` at the root, so `pnpm-lock.yaml` has a single writer. Without git, parallel lockfile edits cannot be merged. |
| `src/`, `public/`, `index.html` | Client engineer | Exception: phase 0 extraction, below |
| `packages/shared/` | **Realtime game server engineer** | The client engineer reviews it. The client consumes it through `workspace:*`. |
| `server/` | Realtime game server engineer | |
| `contracts/` (including exported ABI and `deployments/*.json`) | **Smart contracts engineer** | The Solidity EIP-712 typehash is the source of truth; `packages/shared` mirrors it, with a shared test vector |
| `indexer/`, Railway config, CI workflow, `.gitignore`, `.env.example` | **Indexer/ops engineer** | |
| `docs/research/`, `docs/handoffs/` | PM | |

**Phase 0 sequencing:**
1. Run `git init` and add a `.gitignore`. Owner: ops. This happens before any dispatch.
2. The server engineer holds an exclusive lock on the `src/` files being split (`CollisionSystem`, `MatchManager`, `CarController`, `ComboManager`, `BountySystem`, `PowerUpManager`, the arena colliders) while extracting `packages/shared`.
3. Ownership of `src/` passes back to the client engineer.

#### A8. Tooling gaps

- **No git repository.** There is no `.git` (checked 2026-10-09), and no `.gitignore`, `.editorconfig`, formatter or lint config. `dist/` (73 MB) and `node_modules/` (135 MB) would be committed by accident. `public/models/hood_bull.blend` and `.blend1` are copied into `dist/models/` and shipped. Three large PNGs and an empty `prd.nd` sit at the root.
- **Scripts:** only `dev`, `build` (`tsc && vite build`) and `preview` (`package.json` scripts). There is no `typecheck`, `lint`, `test` or `format` script, and no test runner or tests (`src/test/TestArena.ts` is an unused scene).
- **TypeScript 7.0.2** (the native compiler; `node_modules/.bin/tsc --version`).
  - `tsconfig.json` sets `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules`, `noEmit`, `moduleResolution: bundler`, `target ES2022`, `lib: [ES2022, DOM, DOM.Iterable]`, and `include: ["src"]`.
  - `tsc -p . --noEmit` exits 0 in about 0.4 s.
  - Not enabled: `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Strictness is undermined by many `as any` casts, for example `CollisionSystem.ts:299-300` and `main.ts:5-22`.
  - `packages/shared` must drop `DOM` from `lib`. Server and shared need their own tsconfig (`module: NodeNext` or bundler plus `tsx`).
- **Vite 8.3.2 config** (`vite.config.ts`): excludes rapier from `optimizeDeps`, port 5173, `build.target: esnext`. There is no `import.meta.env` usage anywhere, no `envPrefix`, and no dev proxy for the game-server WebSocket. Chain ID, RPC URL and server URL will need `VITE_*` variables.
- **No CI** (no `.github/`). Local toolchain: Node v26.2.0, pnpm 11.4.0. `package.json` has no `packageManager` or `engines` field.
- **Current npm versions** (`npm view`, 2026-10-09): vite 8.3.4 (installed 8.3.2), viem 2.57.4, @wagmi/core 3.6.5, colyseus 0.18.9, ponder 0.18.0, vitest 5.0.3, @biomejs/biome 2.5.15, eslint 10.12.0, typescript-eslint 8.71.1, skills 1.7.1.
- **Recommended additions:** `typecheck` per package, `vitest` in `packages/shared` (economy invariant, ranking and tie-break, tick-window rules) and in `server/`, Biome for lint and format (see Assumptions on typescript-eslint and TS 7), and `forge test` in `contracts/`.

#### A9. `docs/reskin/`

`docs/reskin/README.md:1-3` reads "Tagei → Lucky Games re-skin". It covers Tagei screens, BNB coin, a trade flow, the PIX mascot and `Tagei-worktrees/…` branches (`README.md:47-58`). It references `public/lucky/…` art that does not exist in this repo, whose `public/` holds only `models/`. **This is a different project and is not relevant to BUMP.TRADE.** Agents should ignore it. The user should decide whether to move it out before `git init`.

### B. Installed skills and MCP (already on this machine)

Inventory taken 2026-10-09 with `ls ~/.claude/skills ~/.agents/skills`, `~/.claude/plugins/installed_plugins.json` and `claude mcp list`. The project has no `.claude/` and no `.mcp.json`.

| Item | Kind | Applies to an EVM / this stack? | Note |
|---|---|---|---|
| `dapp`, `soroban`, `assets`, `standards`, `zk-proofs`, `agentic-payments`, `deploy-stellar-mainnet` (`~/.claude/skills/*`), `stellar-dev` plugin 1.2.0 | skill | **No.** Stellar/Soroban (frontmatter of `dapp`, `soroban`, `assets` and `standards`) | |
| `solana-dev` (`~/.agents/skills/solana-dev`, symlinked into `~/.claude/skills`) | skill | **No.** Solana/Anchor (frontmatter, author Solana Foundation, v1.1.0) | |
| `flare-general`, `flare-fassets`, `flare-ftso`, `flare-fdc`, `flare-fcc`, `flare-smart-accounts` (`flare-ai-skills` plugin 1.0.0) | skill | **Marginal.** Flare is EVM, but the skills cover Flare protocols (FTSO/FDC/FAssets) and networks, not Arbitrum or Robinhood Chain | Do not use |
| `use-railway` (`~/.agents/skills/use-railway`, identical copy in `~/.claude/skills`) | skill | **Yes, for ops.** Railway deploys, variables, domains, logs, tracing (`SKILL.md:43-50`) | It contains vendor `curl … \| sh` CLI installers (`SKILL.md:141-143`). The CLI is already installed; do not let an agent run those lines. |
| `find-skills` (`~/.agents/skills/find-skills`) | skill | Meta. Wraps `npx skills find/add` (`SKILL.md:23-30`) | Useful to the PM only |
| `railway` MCP (`railway mcp proxy`, user scope, connected) | MCP | **Yes, for ops** | Already available to every project; no project install needed |
| `plugin:vercel` MCP and `vercel` plugin 0.50.0 | MCP/plugin | Optional, for static client hosting | Hosting is not decided as Vercel |
| `create-architecture`, `code-review`, `review-edge-case-hunter`, `orchestration`, `brainstorm` | skill | Generic process skills | Usable by any role and the PM |
| `blender` MCP (`uvx mcp-for-blender`) | MCP | Asset pipeline only (`scripts/blender_*.py`) | Not needed for multiplayer |
| `figma`, `obsidian`, `spada`, `supabase`, `expo`, `claude.ai *` | MCP | No | |

Nothing installed covers Solidity/Foundry, OpenZeppelin, viem/wagmi, Arbitrum/Robinhood Chain, Colyseus, Rapier, Ponder/Envio or block explorers.

### C. Skill and MCP candidates (not installed — awaiting approval)

Everything below was vetted on 2026-10-09 by reading the vendor's GitHub org (`gh api`), the skills.sh search API, the official MCP registry (`registry.modelcontextprotocol.io/v0/servers?search=…`, 17 terms), npm metadata, and the SKILL.md files named in the vetting column. **Nothing was installed.**

The commands write to project scope: `.claude/skills/<skill>/` for skills (via `npx skills` 1.7.1, repo vercel-labs/skills, MIT) and `.mcp.json` for MCP servers. Run `npx skills add <owner/repo> --list` first to confirm the exact skill names. None of the recommended servers needs an env var.

| Name | Kind | Source URL | Version / commit date | Maintainer | Needs secret | Role | Task | Install command (do not run until approved) |
|---|---|---|---|---|---|---|---|---|
| `setup-solidity-contracts`, `develop-secure-contracts`, `upgrade-solidity-contracts` | skill | https://github.com/OpenZeppelin/openzeppelin-skills | pushed 2026-09-01; 214★; AGPL-3.0 | OpenZeppelin (vendor) | none | Smart contracts | Foundry project setup with OZ; build the stake/escrow and result-settlement contracts from audited OZ parts (Ownable/AccessControl, ReentrancyGuard, EIP712, ECDSA, SafeERC20); upgrade safety if proxies are used | `npx skills add OpenZeppelin/openzeppelin-skills --list` then `npx skills add OpenZeppelin/openzeppelin-skills -s setup-solidity-contracts -a claude-code -y`, `npx skills add OpenZeppelin/openzeppelin-skills -s develop-secure-contracts -a claude-code -y` (add `-s upgrade-solidity-contracts` only if upgradeable) |
| OpenZeppelin Contracts MCP (Solidity) | MCP (hosted, Streamable HTTP) | https://mcp.openzeppelin.com/contracts/solidity/mcp (source: https://github.com/OpenZeppelin/contracts-wizard `packages/mcp`; npm `@openzeppelin/contracts-mcp` 0.7.1) | npm 0.7.1 (2026-09-24); repo pushed 2026-10-08; 295★; AGPL-3.0 | OpenZeppelin (vendor) | none | Smart contracts | Generate Wizard baselines (ERC20 test token, access control, custom contract) to start from | `claude mcp add --scope project --transport http openzeppelin-solidity https://mcp.openzeppelin.com/contracts/solidity/mcp` |
| Trail of Bits `building-secure-contracts` (secure-workflow-guide, guidelines-advisor, token-integration-analyzer, audit-prep) and `property-based-testing` | skill (also a plugin marketplace) | https://github.com/trailofbits/skills | pushed 2026-10-07; 7,430★; CC-BY-SA-4.0 | Trail of Bits (security vendor) | none | Smart contracts | Pre-deploy review of the escrow/settlement contract; invariant tests (sum of payouts ≤ pot; signature replay) | `npx skills add trailofbits/skills --list`, then for each confirmed name: `npx skills add trailofbits/skills -s secure-workflow-guide -a claude-code -y`, `… -s guidelines-advisor …`, `… -s property-based-testing …` |
| `solidity` (Cyfrin solskill) | skill | https://github.com/Cyfrin/solskill | pushed 2026-06-18; 144★; AGPL-3.0 | Cyfrin (vendor) | none | Smart contracts | Foundry conventions, fuzz/invariant tests, keystore-based deploys (`--account`, never a plaintext key) | `npx skills add Cyfrin/solskill --list` then `npx skills add Cyfrin/solskill -s solidity -a claude-code -y` |
| `colyseus` | skill | https://github.com/colyseus/skill | pushed 2026-09-14; 2★; MIT | Colyseus (vendor) | none | Realtime game server (and client, for the SDK) | **Only if the realtime research picks Colyseus.** Pins the agent to 0.18 (npm `colyseus` 0.18.9), covering Schema state, rooms, reconnection, client prediction | `npx skills add colyseus/skill --list` then `npx skills add colyseus/skill -s colyseus -a claude-code -y` |
| Envio docs MCP | MCP (hosted HTTP) | https://docs.envio.dev/mcp (docs: https://docs.envio.dev/docs/HyperIndex/mcp-server.md) | npm `envio` 3.14.0 (2026-10-08) | Envio (vendor) | none | Indexer/ops | **Only if Envio is chosen over Ponder.** `docs_search` / `docs_fetch` for HyperIndex config and handlers. Note: `envio init` also writes its own `.claude/skills/` into the generated indexer. | `claude mcp add --scope project --transport http envio-docs https://docs.envio.dev/mcp` |
| Railway (`use-railway` skill + `railway` MCP) | skill + MCP | https://github.com/railwayapp/railway-skills (326★, MIT); hosted MCP https://mcp.railway.com | CLI 5.63.4 installed locally | Railway (vendor) | none (OAuth / `railway login`) | Indexer/ops (also deploys the game server) | Provision server, indexer and Postgres; variables, domains, logs | **Already installed at user scope** (section B); no action. Do not run the `curl … \| sh` installers in its README or SKILL.md. |

**Docs to point agents at.** These are not installs; agents read them with WebFetch (all checked 2026-10-09):
- viem: `https://viem.sh/llms.txt` and `llms-full.txt`;
- wagmi: `https://wagmi.sh/llms.txt` and `https://wagmi.sh/AGENTS.md` (client role);
- Foundry: `https://getfoundry.sh/llms.txt` (contracts);
- Arbitrum: `https://docs.arbitrum.io/llms.txt` (contracts and client, for Orbit specifics);
- Colyseus: `https://docs.colyseus.io/llms.txt`;
- Ponder: `https://ponder.sh/llms.txt`;
- three.js: `llms.txt` in the mrdoob/three.js repo.

For testnet chain data, the Robinhood testnet explorer `https://explorer.testnet.chain.robinhood.com/api/v2` (Blockscout v10.2.6) answered `/api/v2/stats` without a key. Agents can query it over HTTP, so no MCP is needed for this.

**Rejected:**
- **Blockscout MCP** (`https://mcp.blockscout.com/mcp`, registry `com.blockscout/mcp-server` v0.19.0). Its `get_chains_list` returns only Robinhood mainnet 4663, not the testnet. Since 2026-10-08 it requires a PRO API key, sent in the HTTP header `Blockscout-MCP-Pro-Api-Key`. The companion `blockscout/agent-skills` depends on that MCP. Revisit when the game moves to mainnet.
- **Alchemy MCP** (`https://mcp.alchemy.com/mcp`, registry `com.alchemy/mcp` 0.7.0, OAuth). Deferred: support for testnet 46630 is unverified without a login, and the RPC itself is covered by viem. The old `ALCHEMY_API_KEY` npm server stopped working on 2026-09-30.
- **QuickNode MCP** (npm `@quicknode/mcp` 0.1.2 with `QUICKNODE_API_KEY`; hosted `io.github.quicknode/mcp` 1.0.1). It manages endpoints and billing and does not read chain data, so it has low value here.
- **Etherscan MCP** (`io.etherscan/etherscan-mcp` 2.3.0). Its chain list has 4663 only, not the testnet. The third-party Etherscan wrappers in the registry are rejected as well.
- **PraneshASP/foundry-mcp-server** (253★). The last commit was 2026-01-17, so it is stale, and it accepts a `PRIVATE_KEY` env var. Unsafe for agents.
- **mcpdotdirect/evm-mcp-server** 2.0.4 (378★). It has no Robinhood chain, an unknown chainId silently falls back to Ethereum mainnet RPC, and it takes `EVM_PRIVATE_KEY` or `EVM_MNEMONIC`. Unsafe.
- **Community "Robinhood Chain" MCPs** (for example `nirholas` `hood-mcp` 0.1.1, `nirholas/solidity-compiler`, and several 0★ repos). They are built for trading and memecoins, sign with private keys, and default to mainnet. GitHub search also surfaced young repos with inflated stars, which are possible malware lures.
- **CloudAI-X/threejs-skills** (3,492★). It has no LICENSE file even though the README claims MIT, and the README's install command clones a different repo (`pinkforest/threejs-playground`). The project already knows three.js well; the gap is netcode, not rendering.
- **pashov/skills `solidity-auditor`** (MIT, 1,234★). It spawns 12 sub-agents per pass, which is expensive and overlaps with Trail of Bits. Optional later, before mainnet.
- **Not found:** wevm/skills; any viem or wagmi MCP (wagmi's `.agents/skills/wagmi-development` is for wagmi contributors); any foundry-rs skill or MCP; any Ponder skill or MCP; any Rapier skill, MCP or llms.txt (rapier.rs/llms.txt returns 404); an official Robinhood skill, MCP or llms.txt (docs.robinhood.com failed the TLS handshake from this machine); any OffchainLabs installable skill (the arbitrum-docs `.agents/skills` are for docs maintainers).
- **Off-topic name clashes:** `ljjluke/ponder-skill` (a reasoning plugin), `CrowdStrike/foundry-skills` and Microsoft "Foundry" (Azure), `enzed/r3f-skills` (React Three Fiber; this project uses vanilla three.js).
- **Already installed but not applicable** (section B): Stellar, Soroban, Solana and Flare skills.

**Vetting notes on the recommended skills** (SKILL.md files read in full):
- OpenZeppelin's `setup-solidity-contracts` shows the official Foundry installer `curl -L https://foundry.paradigm.xyz | bash`. Foundry should be installed by the user, not by an agent.
- OpenZeppelin's `develop-secure-contracts` runs `npx @openzeppelin/contracts-cli` and writes temporary files to `/tmp`. Acceptable.
- The Colyseus skill only reads docs and ships no scripts.
- The Cyfrin and Trail of Bits SKILL.md files contain no exfiltration, no instructions to disable safeguards and no remote code execution.

## Recommendations

1. **Before any dispatch:** run `git init`, add a `.gitignore` (`node_modules`, `dist`, `*.blend1`, `.env*`, `renders/`), and decide what happens to `docs/reskin/`. Owner: ops, with user approval.
2. **Layout option A.** Keep the client at the root, add a pnpm workspace with `packages/shared`, `server/`, `contracts/` and `indexer/`, and assign one writer for the root `package.json` and `pnpm-lock.yaml` (the client engineer).
3. **Phase 0 is the shared-sim extraction (server engineer)**, done in the order of the A7 refactor list. Its exit gate is a vitest suite that runs a headless 8-car match (bots only) for 90 s of ticks in Node and asserts these four properties:
   - zero-sum at every tick;
   - deterministic results for a fixed seed;
   - no DOM import (`lib` without DOM);
   - a ranking with elimination tie-breaks.
4. **Decide the economy rules before contracts lock the result schema:**
   - void burn;
   - starting bag per vehicle versus a normalized stake;
   - instant transfer versus collect-to-receive;
   - CASH RAIN;
   - bot balances;
   - round length (90 s or about 180 s);
   - max players (7 cars today, 8 in the PRD HUD, `docs/designgame/prd.md` "#3 / 8").
5. **Add scripts** `typecheck`, `test` and `lint` (Biome) at the root and per package. Add a CI job (GitHub Actions or a Railway pre-deploy check) that runs `pnpm -r typecheck && pnpm -r test && forge test`.
6. **Approve only the tooling in section C's table.** Install project-scope so the tools travel with the repo.

## Implications per role

- **Smart contracts engineer:**
  - The money unit in the sim is an integer dollar count (`Math.round` throughout `CollisionSystem.ts:350-361`), with per-vehicle starting bags of $69 to $500 (`VehicleTypes.ts`).
  - The contract has to define how a stake maps to a starting bag and how the sum is conserved.
  - The signed result must carry final balances plus an elimination order. The client does not record elimination order today.
  - Bots and void burns need an explicit rule.
  - Own `contracts/` and the EIP-712 typed-data definition that `packages/shared` mirrors.
- **Realtime game server engineer:**
  - Own `packages/shared` and Phase 0.
  - Reproduce the tick order from `GameApp.ts:642-664` at a fixed Hz.
  - Port the timeline from `MatchManager.ts:102-226` onto ticks, and the time windows from `CollisionSystem.ts` onto ticks.
  - Use a seeded RNG, per-room bus and state, and a per-pair contact rate limit.
  - Reuse `CarAI` as bots.
  - Never import `src/ui`, `src/audio` or three.js scene objects.
  - Rapier 0.21 compat already runs in Node 26 (smoke test above).
- **Client chain + network integration engineer:**
  - Own the root and `src/`.
  - Replace `OpponentManager` with snapshot-driven remote cars, and drive the local car with prediction through shared `CarPhysics`.
  - Map sim events to the existing HUD, SFX and VFX listeners (the event table in A3).
  - Make hit-stop and camera shake cosmetic.
  - Delete the HUD timer and the HUD ranking authority.
  - Strip the debug hotkeys in network mode.
  - Add `VITE_*` env configuration and wallet connection (viem/wagmi core; versions in A8).
- **Indexer/ops engineer:**
  - Own `git init`, `.gitignore`, CI, Railway config and `indexer/`.
  - Railway is already reachable through the installed `use-railway` skill and the `railway` MCP.
  - Exclude `*.blend*` from `public/`, or from the build, to shrink the 73 MB `dist/`.
  - The leaderboard can only be as good as the signed result schema, so take part in that schema decision.

## Assumptions and open questions

- **Void pits may be unreachable** (flat full-size ground collider, `ArenaFloor.ts:62`). This is inferred from code and not play-tested.
- **TS 7 and typescript-eslint.** I assume typescript-eslint 8.71.1 may lag TypeScript 7's new native compiler API; that is why Biome is recommended. I did not verify this.
- **Shared package without DOM.** I assume `packages/shared` can import `three` with `lib` set without `DOM` because `skipLibCheck: true` covers `@types/three`'s DOM references. Not compile-tested.
- **Open: round length.** The code has 90 s (`MatchManager.ts:11`); the brief says about 3 minutes.
- **Open: player count.** The code has 7 cars; the PRD HUD says 8.
- **Open: PRD collect-to-receive** (`docs/mechanics/prd.md` §7-8) versus instant transfer (code).
- **Open: CASH RAIN** (`docs/designgame/prd.md` §7) versus the zero-sum rule (§20-21).
- **Open: hosting the 68 MB of GLBs** (static host or CDN) is not decided.

## Sources

Repository files (read 2026-10-09):
- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `pnpm-lock.yaml`, `scripts/*.py`;
- every `src/**/*.ts` cited above;
- `docs/mechanics/prd.md` (§1, 3-4, 7-8, 20-22), `docs/designgame/prd.md` (round timer, §7 CASH RAIN), `docs/reskin/README.md`, `docs/handoffs/STATUS.md`.

Local commands (2026-10-09):
- `tsc -p . --noEmit` (exit 0);
- a Node v26.2.0 smoke test of `three` 0.186.1 and `@dimforge/rapier3d-compat` 0.21.0;
- `npm view <pkg> version` for the packages listed in A8;
- `claude mcp list`, `~/.claude/plugins/installed_plugins.json`, and the frontmatter of the skills listed in section B.

Web and API sources (all read 2026-10-09):
- **OpenZeppelin:**
  - https://github.com/OpenZeppelin/openzeppelin-skills (repo metadata, `skills/` listing, 3 SKILL.md files)
  - https://github.com/OpenZeppelin/contracts-wizard (`packages/mcp/README.md`)
  - https://github.com/OpenZeppelin/openzeppelin-mcp
  - https://mcp.openzeppelin.com/contracts/solidity/mcp (`initialize` handshake)
  - https://www.npmjs.com/package/@openzeppelin/contracts-mcp (0.7.1)
- **Contract-security skills:**
  - https://github.com/trailofbits/skills (`.claude-plugin/marketplace.json`, 4 SKILL.md files)
  - https://github.com/Cyfrin/solskill
  - https://github.com/pashov/skills
- **Game server:**
  - https://github.com/colyseus/skill (SKILL.md)
  - https://docs.colyseus.io/llms.txt
  - https://rapier.rs/llms.txt (404)
  - https://github.com/dimforge/rapier.js (archived)
- **Client:**
  - https://viem.sh/llms.txt, https://wagmi.sh/llms.txt, https://wagmi.sh/AGENTS.md
  - https://github.com/wevm/viem, https://github.com/wevm/wagmi
  - https://threejs.org/llms.txt, https://github.com/mrdoob/three.js
  - https://github.com/CloudAI-X/threejs-skills
- **Chain and contracts docs:**
  - https://getfoundry.sh/llms.txt, https://github.com/foundry-rs/foundry
  - https://docs.arbitrum.io/llms.txt, https://github.com/OffchainLabs/arbitrum-docs
- **Indexer and ops:**
  - https://ponder.sh/llms.txt, https://github.com/ponder-sh/ponder
  - https://docs.envio.dev/mcp, https://docs.envio.dev/docs/HyperIndex/mcp-server.md, https://github.com/enviodev/hyperindex
  - https://github.com/railwayapp/railway-skills, https://docs.railway.com/cli/mcp.md, https://github.com/railwayapp/railway-mcp-server (archived)
- **Chain data:**
  - https://github.com/blockscout/mcp-server, https://mcp.blockscout.com/v1/get_chains_list, https://github.com/blockscout/agent-skills
  - https://explorer.testnet.chain.robinhood.com/api/v2/stats
  - https://www.alchemy.com/docs/alchemy-mcp-server.md
  - https://www.quicknode.com/docs/robinhood/api-overview
  - https://api.etherscan.io/v2/chainlist, https://docs.etherscan.io/mcp-docs/introduction
- **Rejected servers:**
  - https://github.com/PraneshASP/foundry-mcp-server
  - https://github.com/mcpdotdirect/evm-mcp-server (`src/core/chains.ts`)
  - https://github.com/nirholas/robinhood-chain-mcp
- **Registries and tooling:**
  - https://registry.modelcontextprotocol.io/v0/servers?search= with openzeppelin, foundry, solidity, evm, viem, wagmi, arbitrum, robinhood, colyseus, rapier, threejs, ponder, envio, railway, blockscout, alchemy, quicknode and etherscan
  - https://skills.sh (`/api/search`, 12 queries)
  - https://github.com/vercel-labs/skills (README: `add`, `--list`, `-s`, `-a`, `-y`)
  - https://github.com/anthropics/claude-plugins-official (marketplace.json)
- **Not reachable:** https://docs.robinhood.com/chain/ (TLS handshake failed from this machine).
