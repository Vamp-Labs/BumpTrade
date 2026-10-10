# contracts.md — every interface that crosses a role boundary

Status: **v1, frozen for dispatch** (PM, 2026-10-09). C1-C4 and C8 revised for the gasless mock-token design by R1 on 2026-10-09 (`05-gasless-mock-token.md`). Roles build against this file, not against each other's code.

- If your implementation needs a change here, stop and report it to the PM. Do not diverge.
- The PM updates this file and notifies every consumer.
- Where a handoff restates part of this file and the two differ, **this file wins**.

Roles:
- **R1 Contracts:** `01-smart-contracts.md`
- **R2 Game server:** `02-game-server.md`
- **R3 Client:** `03-client-network-chain.md`
- **R4 Indexer/Ops:** `04-indexer-ops.md`

---

## C1. Chain

| Field | Value | Source |
|---|---|---|
| Network | Robinhood Chain Testnet (Arbitrum Nitro rollup, settles to Sepolia, ArbOS 61) | `docs/research/robinhood-chain.md` § Network parameters |
| Chain ID | **46630** (`0xb626`) | curl-verified 2026-10-09 |
| viem chain object | `import { robinhoodTestnet } from 'viem/chains'` (needs viem ≥ 2.55.0; pinned 2.57.4) | github.com/wevm/viem `src/chains/definitions/robinhoodTestnet.ts` |
| Public RPC (HTTP only) | `https://rpc.testnet.chain.robinhood.com`: no WSS, no `eth_newFilter`, no archive state, rate-limited | curl-verified |
| Keyed RPC (optional, preferred for server/indexer) | `https://robinhood-testnet.g.alchemy.com/v2/<key>` / `wss://robinhood-testnet.g.alchemy.com/v2/<key>` | docs.robinhood.com/chain/connecting (WSS unverified) |
| Explorer | `https://explorer.testnet.chain.robinhood.com` (Blockscout v10.2.6). Tx link: `/tx/<hash>`. Address link: `/address/<addr>` | curl-verified |
| Verifier | `--verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/` | docs.robinhood.com/chain/deploy-smart-contracts |
| ETH faucet (relayer top-ups only) | `https://faucet.testnet.chain.robinhood.com/` (0.01 ETH / 24 h) ; Alchemy `https://www.alchemy.com/faucets/robinhood-testnet` (0.1 ETH / 24 h, needs mainnet activity) | robinhood-chain.md §3 |
| Gas | ETH, flat 0.01 gwei base fee, 0 priority, L1 fee 0, FCFS ordering, ~0.16 s blocks. Players never pay it: the relayer (`operator`) pays for every game transaction. Relayer ETH is the only scarce resource. | curl-verified |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | eth_getCode verified |

Chain rules every role obeys:
- Never use `block.number` for time. On Arbitrum it is an L1 estimate; use `block.timestamp`.
- Never use `prevrandao` for randomness.
- Never rely on priority fees for ordering.
- Never ship the public RPC as the only transport. Use viem `fallback([keyed, public])` when a keyed URL is configured.

## C2. Stake and economy constants (staked rooms)

| Constant | Value | Where it lives |
|---|---|---|
| Stake asset | `BUMP`, the free `MockBUMP` ERC20 (18 decimals); claim 1000 per wallet per 24 h | `BumpArena.token()` |
| `STAKE_AMOUNT` | `100000000000000000000` (100 BUMP), replaces `STAKE_WEI` | server env, passed to `openMatch` |
| `START_BALANCE` | `100` in-game $ for **every** player, regardless of vehicle | server env, passed to `openMatch`, stored on chain |
| `MIN_PLAYERS` / `MAX_PLAYERS` | 2 / 8 | server env, `maxPlayers` on chain |
| `MATCH_DURATION_S` | 90 | server env |
| `JOIN_WINDOW_S` | 120 | server env → `joinDeadline = now + JOIN_WINDOW_S` |
| `FILL_TIMER_S` | 30, counted from the moment the 2nd seat is claimed | server env |
| `SETTLE_WINDOW_S` | 3600 | contract constructor (immutable) → `settleDeadline = joinDeadline + SETTLE_WINDOW_S` |
| Fee | 0. Only rounding dust goes to `treasury`. | contract |
| Join | gasless: the player signs a `JoinIntent` (C3), the relayer submits `joinWithSig` | contract |

**Ledger rules.** These are binding for R2 and are enforced on chain by R1 through the sum check.

1. A bump moves `amount = min(calculatedDamage, victim.balance)` from victim to attacker, atomically, in one tick. The money moves at impact. Floor cash is cosmetic only.
2. Nothing creates money. There is no CASH RAIN, no passive income, no `reset()` or `repair()` refill, and no per-vehicle starting bag in staked rooms.
3. An elimination not caused by a bump (void pit, disconnect timeout) moves the remaining balance:
   - to the **last car that bumped the victim within 5 s**, if there is one;
   - otherwise split equally (floor) among the cars still alive, with the remainder going to the alive car with the **lowest seat index**.
4. A balance of 0 means eliminated, one-way, with no respawn.
5. **Invariant, asserted every tick:** `Σ balance == playerCount × START_BALANCE`.

**Ranking** (used in the signed result):
- Cars still alive rank first, ordered by balance descending, ties broken by lower seat index.
- Eliminated cars follow, ordered by elimination tick descending (eliminated later ranks higher), ties broken by lower seat index.
- Ranks run 1..n. Rank 1 is the winner.

**Payout.** The contract computes it; the server never sends payout numbers.
- `payout_i = stake × finalBalance_i / START_BALANCE`, floored.
- `dust = pot − Σ payout_i` is transferred to `treasury` in the same `settle` transaction. Payouts are pushed straight to the players; there is no claim step.

## C3. Contracts `MockBUMP` and `BumpArena` (R1 provides; R2, R3 and R4 consume)

Revised 2026-10-09 by `05-gasless-mock-token.md`: the stake is a free ERC20 and play is gasless. Where an older section below (C5 `stakeWei`/`payoutWei` and the `join` transaction, C6 step 2, C7 `...Wei` names, C8 stake env) still says ETH or a player `join` transaction, **this section and 05 win**; amounts are token base units (18 decimals) and the field names keep their `Wei` suffix only until R2/R3/R4 rename them (R4 renamed its C7 fields to `...Amount`).

Solidity `^0.8.33`, `evm_version = "prague"`, OpenZeppelin Contracts **5.6.1**.

### MockBUMP (`contracts/src/MockBUMP.sol`)

ERC20 + ERC20Permit + Ownable, name `Bump Token`, symbol `BUMP`, 18 decimals. The only mint path is `claim`.

```solidity
constructor(address owner_)                      // owner is the deployer
uint256 constant CLAIM_AMOUNT = 1000e18;
uint256 constant CLAIM_COOLDOWN = 24 hours;

function claim(address to) external;            // anyone may call for any `to`; reverts ClaimCooldown(nextClaimAt) before nextClaimAt[to]
function nextClaimAt(address) view returns (uint256);   // 0 = never claimed = claimable now; claimable when block.timestamp >= value
function setArena(address) external;            // onlyOwner, once; ArenaAlreadySet(), ZeroAddress()
function arena() view returns (address);
// transferFrom: when msg.sender == arena the allowance check is skipped (no approve, no permit needed). Testnet only.

event Claimed(address indexed to, uint256 amount, uint256 nextClaimAt);
event ArenaSet(address arena);
error ClaimCooldown(uint256 nextClaimAt); error ArenaAlreadySet(); error ZeroAddress();
```

### BumpArena

```solidity
enum Status { None, Open, Started, Settled, Cancelled, Refunding }

struct Result {                    // unchanged
    bytes32   matchId;
    address[] players;        // MUST equal getPlayers(matchId), same order (join order)
    uint32[]  finalBalances;  // same index as players; Σ == players.length × startBalance
    uint8[]   ranks;          // permutation of 1..n, same index as players
    bytes32   inputLogHash;   // keccak256 of the canonical input log (C6), 0x0 allowed
    bytes32   replayHash;     // keccak256 of the replay file (C6), 0x0 allowed
    uint64    endedAt;        // unix seconds
}

struct JoinIntent {                // new, EIP-712
    bytes32 matchId;
    address player;
    address sessionKey;       // the key the player will use for claimSeat (C5); non-zero
    uint8   vehicleId;        // < 7
    uint256 deadline;         // unix seconds; the intent is valid while block.timestamp <= deadline
}

struct MatchView {                 // unchanged; stake and pot are token units
    uint256 stake; uint32 startBalance; uint8 maxPlayers; uint8 playerCount;
    Status status; uint64 joinDeadline; uint64 settleDeadline; uint256 pot;
}

constructor(address owner_, address signer_, address operator_, address treasury_, uint64 settleWindow_, address token_)

function openMatch(bytes32 matchId, uint256 stake, uint8 maxPlayers, uint32 startBalance, uint64 joinDeadline) external;   // onlyOperator, whenNotPaused
function joinWithSig(JoinIntent calldata intent, bytes calldata signature) external;     // anyone (the relayer) may submit; signature must recover to intent.player; whenNotPaused
function join(bytes32 matchId, address sessionKey, uint8 vehicleId) external;             // direct join by a player who has gas; whenNotPaused
function startMatch(bytes32 matchId) external;                                            // onlyOperator, whenNotPaused, playerCount >= 2
function settle(Result calldata result, bytes calldata signature) external;               // permissionless, signature-gated, whenNotPaused; pushes payouts
function cancel(bytes32 matchId) external;                                                // operator while Open; anyone while Open && now > joinDeadline && playerCount < 2; pushes stakes back
function claimRefund(bytes32 matchId, address player) external;                           // ANYONE may call for any joined player; status Open|Started|Refunding, now > settleDeadline; pushes the stake

function setSigner(address) external;  function setOperator(address) external;  function setTreasury(address) external;   // onlyOwner
function pause() external;  function unpause() external;                                                                  // onlyOwner

function getMatch(bytes32 matchId) external view returns (MatchView memory);
function getPlayers(bytes32 matchId) external view returns (address[] memory);
function sessionKeyOf(bytes32 matchId, address player) external view returns (address);
function vehicleOf(bytes32 matchId, address player) external view returns (uint8);
function hashResult(Result calldata result) external view returns (bytes32);   // full EIP-712 digest
function hashJoin(JoinIntent calldata intent) external view returns (bytes32); // full EIP-712 digest
function token() external view returns (address);
function signer() external view returns (address);
function operator() external view returns (address);
function treasury() external view returns (address);
function settleWindow() external view returns (uint64);
// eip712Domain() from OZ EIP712 (ERC-5267)
```

The ETH `claim()`, `claimable()` and the `Claimed` event are gone: payouts and refunds are pushed in the same transaction. Nothing in the arena is payable and it never holds ETH.

**Rules for `join` and `joinWithSig`:**
- `status == Open`, `block.timestamp <= joinDeadline`, `playerCount < maxPlayers`, the player has not already joined, `sessionKey != address(0)`, `vehicleId < 7`.
- `joinWithSig` also requires `block.timestamp <= intent.deadline` (else `IntentExpired`) and a valid signature (else `BadSignature`). Replay is impossible because a player can join a match once (`AlreadyJoined`).
- The arena pulls `stake` tokens with `token.transferFrom(player, arena, stake)`. No approve or permit is needed because of `MockBUMP.setArena`. If the player's balance is too short the call reverts with the token's `ERC20InsufficientBalance(player, balance, needed)` (R2 must pre-check `balanceOf`).
- `PlayerJoined(matchId, player, sessionKey, vehicleId, seat)` is emitted with the player (not the relayer) as `player`.

**Rules for `settle`:** unchanged checks (status `Started`, `block.timestamp <= settleDeadline`, lengths and order, balance sum, rank permutation, signer). Effects: `status = Settled`, then `token.transfer(player_i, payout_i)` for each player with `payout_i > 0`, `token.transfer(treasury, dust)` when `dust > 0`, one `PlayerResult` per player, then `MatchSettled`. After `settle` the arena's token balance for that match is exactly 0.

**`claimRefund(matchId, player)`** transfers `stake` once per player and sets `status = Refunding` (settlement is impossible afterwards). `Refunded(matchId, player, amount)` carries the refunded player. **`cancel`** sets `Cancelled` and transfers every joined player their stake; it emits `MatchCancelled` only (no per-player `Refunded`).

**Events** (frozen shapes; `Claimed` removed):

```solidity
event MatchOpened(bytes32 indexed matchId, uint256 stake, uint8 maxPlayers, uint32 startBalance, uint64 joinDeadline, uint64 settleDeadline);
event PlayerJoined(bytes32 indexed matchId, address indexed player, address sessionKey, uint8 vehicleId, uint8 seat);
event MatchStarted(bytes32 indexed matchId, uint8 playerCount);
event PlayerResult(bytes32 indexed matchId, address indexed player, uint32 finalBalance, uint8 rank, uint256 payout);
event MatchSettled(bytes32 indexed matchId, bytes32 resultHash, bytes32 inputLogHash, bytes32 replayHash, address winner, uint256 pot);
event MatchCancelled(bytes32 indexed matchId);
event Refunded(bytes32 indexed matchId, address indexed player, uint256 amount);
event SignerUpdated(address signer);
event OperatorUpdated(address operator);
event TreasuryUpdated(address treasury);
```

`seat` in `PlayerJoined` is the 0-based join index, the same as the index in `getPlayers`.

**Custom errors** (R3 maps to UI copy): `NotOperator`, `BadStatus`, `JoinClosed`, `IntentExpired`, `MatchFull`, `AlreadyJoined`, `ZeroSessionKey`, `BadVehicle`, `NotEnoughPlayers`, `PlayersMismatch`, `BalanceSumMismatch`, `BadRanks`, `BadSignature`, `SettleWindowClosed`, `TooEarly`, `NotJoined`, `AlreadyRefunded`, `MatchExists`, `InvalidMatchParams`, `ZeroAddress`. `WrongStake`, `NothingToClaim` and `TransferFailed` no longer exist. Token errors (`ERC20InsufficientBalance`, `ERC20InsufficientAllowance`, `ClaimCooldown`) bubble up from `MockBUMP`: decode reverts with both `bumpArenaAbi` and `mockBumpAbi`.

**EIP-712** (one domain for both messages):
- Domain: `{ name: "BumpArena", version: "1", chainId: 46630, verifyingContract: <BumpArena address> }`
- `Result(bytes32 matchId,address[] players,uint32[] finalBalances,uint8[] ranks,bytes32 inputLogHash,bytes32 replayHash,uint64 endedAt)`: unchanged. Arrays are encoded per EIP-712 (`keccak256` of the concatenated 32-byte-padded elements).
- `JoinIntent(bytes32 matchId,address player,address sessionKey,uint8 vehicleId,uint256 deadline)`. viem types: `matchId bytes32`, `player address`, `sessionKey address`, `vehicleId uint8`, `deadline uint256` (pass a `bigint`).
- Test vectors, the source of truth for R2's and R3's signing tests (both signed with public anvil keys that must never be funded):
  - `contracts/test/fixtures/result-vector.json`: `{ domain, types, primaryType, message, result, digest, signerAddress, signature }`, anvil key #0.
  - `contracts/test/fixtures/join-vector.json`: same shape for `JoinIntent` (`message.deadline` is a decimal string), signed by anvil key #1 (`0x7099…79C8`). Solidity checks it in `JoinIntentVector.t.sol` and `node contracts/script/check-vector.mjs` re-derives both digests with viem.

**Package `@bump/contracts`** (`contracts/package.json`, owned by R1) exports:
- `bumpArenaAbi` (`contracts/abi/BumpArena.ts`) and `mockBumpAbi` (`contracts/abi/MockBUMP.ts`), `as const` ABIs generated from `forge build` output by `contracts/script/export-abi.mjs`.
- `deployments`, from `contracts/deployments/46630.json`:

```json
{ "chainId": 46630,
  "MockBUMP":  { "address": "0x…", "blockNumber": 0, "txHash": "0x…" },
  "BumpArena": { "address": "0x…", "blockNumber": 0, "txHash": "0x…" },
  "owner": "0x…", "signer": "0x…", "operator": "0x…", "treasury": "0x…", "settleWindow": 3600 }
```

Until the PM deploys, the file carries `"status": "pending"` and zero addresses. Do not use an address while `status` is present; `record-deployment.mjs` writes the final file without it.

## C4. Vehicle IDs (shared)

| id | VehicleType (`src/vehicles/VehicleTypes.ts:1`) |
|---|---|
| 0 | `hood_bull` |
| 1 | `hood_bear` |
| 2 | `tsla_racer` |
| 3 | `nvda_ai` |
| 4 | `gold_whale` |
| 5 | `gme_ape` |
| 6 | `doge_kart` |

The `vehicleId` field of `JoinIntent` (C3) and of `join` uses this table. This order matches `VehicleFactory.VEHICLE_TYPES` (`src/vehicles/VehicleFactory.ts:7-15`).
- Vehicle handling stats stay as they are today.
- The vehicle's `baseStartingBag` is **ignored** in staked rooms; `START_BALANCE` applies to everyone.

## C5. Realtime protocol: Colyseus 0.18 (R2 provides, R3 consumes)

**Packages:**
- server: `colyseus` 0.18.9, `@colyseus/schema` 5.0.36, `@colyseus/ws-transport` 0.18.4;
- client: `@colyseus/sdk` 0.18.5 (**not** `colyseus.js`).

**Endpoints:**
- Default WS endpoint `ws://localhost:2567`. Room name: **`arena`**.
- HTTP `GET /health` returns `200 {"ok":true,"rooms":<n>}`.

**Shared definitions.** All Schema classes, enums and message types below live in `packages/shared/src/protocol/` and are exported from `@bump/shared`. The client imports them; it never redeclares them.

> R2 must check every Colyseus API named here (`defineInput`, `setFixedTimestep`, `room.input`, `predict.*`, `t.quantized`) against https://docs.colyseus.io/llms.txt at 0.18.9 before coding. If an API differs, keep the wire semantics below and report the difference to the PM.

**Join:** `client.joinOrCreate('arena', { vehicleId: number })`. Every joiner starts as a *lobby member* with no car.

**Client to server.**
- **`claimSeat` message**, sent after the player's `join` transaction is mined:
  `{ wallet: Address, sessionKey: Address, issuedAt: number /*unix ms*/, signature: Hex }`.
  - `signature` is an EIP-191 `personal_sign` **by the session key** (a local viem account, so no wallet popup) of exactly this text:
    ```
    BUMP.TRADE seat
    match: <matchId 0x-hex lowercase>
    wallet: <wallet lowercase>
    room: <roomId>
    issuedAt: <issuedAt>
    ```
  - The server accepts it when the recovered address equals `sessionKeyOf(matchId, wallet)` (via `readContract`), `|now − issuedAt| ≤ 60 000`, and the signature has not been used before.
  - On success the server binds `client.sessionId → wallet`. A reconnect may re-claim with a new signature.
- **Input** (60 Hz, flat primitives, one per fixed tick):
  `{ tick: uint32, throttle: int8 (−100..100), steer: int8 (−100..100), buttons: uint8 }`
  - Buttons: bit0 brake, bit1 boost, bit2 handbrake, bit3 usePowerUp.
  - The server sanitises the input: values are clamped, unknown bits are dropped, and input from a client without a seat is ignored.
  - `throttle/steer = round(VehicleInput.x × 100)` (`src/input/InputManager.ts:6-12`).

**Server to client state** (Schema, patched at 30 Hz, `patchRate = 33`):

```ts
Car {
  wallet: string; seat: uint8; vehicle: uint8; connected: boolean;
  px, py, pz: quantized(-26..26 / -6..12, 16 bit); qx, qy, qz, qw: quantized(-1..1, 16 bit);
  vx, vy, vz: quantized(-60..60, 16 bit); wx, wy, wz: quantized(-20..20, 16 bit);
  boost: uint8 (0..100); flags: uint8 /* bit0 boosting, bit1 drifting, bit2 shield, bit3 heavyHit, bit4 magnet, bit5 turbo, bit6 critical, bit7 eliminated */;
  powerUp: uint8 /* 0 none, 1 TURBO, 2 HEAVY_HIT, 3 CASH_MAGNET, 4 SHIELD */; powerUpMs: uint16;
  balance: uint32; state: uint8 /* 0 ALIVE, 1 CRITICAL, 2 ELIMINATED, 3 DISCONNECTED */;
}
MatchState {
  matchId: string /* bytes32 hex */; phase: uint8; stakeWei: string; startBalance: uint32;
  joinDeadline: uint32 /* unix s */; fillEndsAt: uint32 /* unix s, 0 = not started */;
  tick: uint32; liveStartTick: uint32; endsAtTick: uint32;
  marketEvent: uint8; eventEndsAtTick: uint32;
  lobby: number /* lobby members connected */; cars: Map<wallet, Car>;
}
Phase: 0 LOBBY, 1 COUNTDOWN, 2 LIVE, 3 ENDED, 4 SETTLED, 5 CANCELLED, 6 SETTLE_FAILED
```

**Server to client events** (`room.broadcast`, reliable). The field `t` is the message type.

```ts
{ t:'seat',        wallet, seat, vehicle }
{ t:'bump',        tick, kind:'car'|'wall', attacker, victim, amount, tier: 'LIGHT'|'MEDIUM'|'HEAVY'|'CRITICAL', skills: number, x, z, nx, nz }
{ t:'eliminate',   tick, car, by: string|null, cause:'bankrupt'|'voidPit'|'disconnectTimeout', redistributed: [wallet, amount][] }
{ t:'marketEvent', tick, kind: number, title: string, durationTicks }
{ t:'phase',       phase, tick }
{ t:'matchStart',  matchId, liveStartTick, durationTicks, seed: Hex, rapier: '0.21.0', serverBuild: string }
{ t:'matchEnd',    matchId, endTick, ranking: { wallet, finalBalance, rank, payoutWei: string }[], inputLogHash, replayHash, resultSignature }
{ t:'settlement',  matchId, status:'opened'|'started'|'submitted'|'confirmed'|'failed'|'cancelled', txHash?: Hex, error?: string }
{ t:'error',       code: 'SEAT_REJECTED'|'NOT_JOINED'|'STALE_AUTH'|'ROOM_FULL'|'CHAIN_UNAVAILABLE', message }
```

- `skills` is a bitmask: headOn, bank, drift, boost, double, revenge, titan, surge (bit0..bit7).
- `tier` uses the names in `CollisionTypes.ts`.
- `kind` in `marketEvent` uses the enum in `@bump/shared`.
- All wallets are lowercase.

**Timing:**
- 60 Hz fixed simulation, 1 input per tick, 30 Hz patches.
- Remote cars are interpolated 100 ms behind.
- The local car is predicted (P1) with reconcile `smoothMs 65` and snap at 3 m.
- `allowReconnection` 10 s. A disconnected car stays in the arena, idle and hittable. After 30 s disconnected *while LIVE* the car remains a target; it is not removed.

## C6. Room lifecycle (R2 implements; R3 renders; R4 indexes the chain side)

| Step | Server action | Chain call (relayer) | Phase |
|---|---|---|---|
| 1 | Room created; `matchId = random bytes32` | `openMatch(matchId, STAKE_AMOUNT, MAX_PLAYERS, START_BALANCE, now+JOIN_WINDOW_S)`, then broadcast `settlement{opened}` | LOBBY |
| 2 | Players sign a `JoinIntent` (R3, no transaction); the server verifies it and the player's BUMP balance, then submits `joinWithSig` (relayer). Then `claimSeat` | `joinWithSig(intent, sig)` | LOBBY |
| 3 | `seated ≥ 2` and (`full` or `FILL_TIMER_S` elapsed) | `startMatch(matchId)`. After the receipt, re-read `getPlayers` and spawn a car for **every** on-chain player (unclaimed seats are idle cars) | COUNTDOWN (3 s) |
| 4 | 60 Hz authoritative sim, ledger, events, input log | — | LIVE |
| 5 | Timer reaches 0 or ≤ 1 alive; compute ranks, sign `Result` | — | ENDED |
| 6 | Submit | `settle(result, sig)` with retry and backoff until `settleDeadline`, broadcasting `settlement{submitted→confirmed\|failed}` | SETTLED / SETTLE_FAILED |
| 7 | `joinDeadline` passes with < 2 on-chain players | `cancel(matchId)` | CANCELLED |

**Input log** (for `inputLogHash`):
- The canonical bytes are, per tick in ascending order and per seat in ascending order, `u32 tick | u8 seat | i8 throttle | i8 steer | u8 buttons`.
- A seat with no input that tick writes `0,0,0`.
- `inputLogHash = keccak256(bytes)`.

**Replay file** (P1): JSON `{ matchId, seed, rapier:'0.21.0', serverBuild, startBalance, players, vehicles, inputLogBase64 }`. `replayHash = keccak256(utf8(json))`. In P0 the replay hash may be `0x0`.

## C7. Indexer HTTP API (R4 provides, R3 consumes)

Base URL `VITE_INDEXER_URL`, default `http://localhost:42069`. All amounts are decimal strings of BUMP token base units (18 decimals; R3 formats them as BUMP), all addresses lowercase, and all times unix seconds. Payouts and refunds are pushed on chain, so there is nothing to claim.

```
GET /leaderboard?window=all|7d&limit=50
  → { window, updatedAt, rows: [{ wallet, matches, wins, totalPayoutAmount, totalStakeAmount, netPnlAmount, bestBalance }] }   // sorted netPnlAmount desc
GET /matches?wallet=0x…&limit=20
  → { rows: [MatchSummary] }
GET /matches/:matchId
  → MatchDetail = { matchId, status:'open'|'started'|'settled'|'cancelled'|'refunding', stakeAmount, startBalance, maxPlayers,
      openedAt, startedAt|null, settledAt|null, settleTx|null, resultHash|null, inputLogHash|null, replayHash|null, winner|null, potAmount,
      players: [{ wallet, seat, vehicleId, finalBalance|null, rank|null, payoutAmount|null, refunded: boolean }] }
GET /players/:wallet
  → { wallet, matches, wins, totalPayoutAmount, totalStakeAmount, netPnlAmount, bestBalance, claimableHint: null }
GET /ready   (Ponder built-in, 200 when caught up)
```

- `MatchSummary` has the same top-level fields as `MatchDetail` without `players`, plus the caller's `{ rank, payoutAmount }` when `wallet` is given.
- `refunded` is true for every seat of a cancelled match (the arena emits only `MatchCancelled`) and for each player that has a `Refunded` event. `claimableHint` is always `null` and kept only for shape.
- `matches`, `wins`, `totalStakeAmount` and `totalPayoutAmount` count settled matches only.
- CORS: allow `VITE_*` client origins (`http://localhost:5173` plus the deployed client origin).

## C8. Environment variable names (values never committed; `.env.example` owned by R4)

| Consumer | Names |
|---|---|
| Client (Vite) | `VITE_CHAIN_ID`, `VITE_RPC_URL`, `VITE_GAME_SERVER_URL`, `VITE_INDEXER_URL`, `VITE_ARENA_ADDRESS`, `VITE_TOKEN_ADDRESS`, `VITE_EXPLORER_URL` |
| Game server | `PORT`, `RH_RPC_URL`, `RH_WSS_URL` (optional), `ARENA_ADDRESS`, `SIGNER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY`, `STAKE_AMOUNT`, `TOKEN_ADDRESS`, `RELAYER_MIN_BALANCE_WEI`, `START_BALANCE`, `MIN_PLAYERS`, `MAX_PLAYERS`, `MATCH_DURATION_S`, `JOIN_WINDOW_S`, `FILL_TIMER_S`, `REPLAY_DIR`, `SERVER_BUILD` |
| Contracts (Foundry) | `RH_RPC_URL`, `DEPLOYER_ACCOUNT` (a `cast wallet` keystore name; never a plaintext key), `OWNER_ADDRESS`, `SIGNER_ADDRESS`, `OPERATOR_ADDRESS`, `TREASURY_ADDRESS`, `SETTLE_WINDOW_S` (the deploy script reads no stake variable: the stake is passed per match to `openMatch`) |
| Indexer (Ponder) | `PONDER_RPC_URL_46630`, `PONDER_WS_URL_46630` (optional), `DATABASE_URL` (unset = PGlite locally), `DATABASE_SCHEMA`, `ARENA_ADDRESS`, `ARENA_START_BLOCK`, `CORS_ORIGINS` (use `DATABASE_SCHEMA=bump_v2`; `Claimed` events from `MockBUMP` are ignored in v1) |

`OPERATOR_ADDRESS` is the address of `RELAYER_PRIVATE_KEY`, and `SIGNER_ADDRESS` is the address of `SIGNER_PRIVATE_KEY`. On testnet they may be the same key.

## C9. Workspace, packages, ports, versions

```
/                     Vite client (src/, public/, index.html, vite.config.ts, tsconfig.json) + pnpm workspace root
pnpm-workspace.yaml   packages: [packages/*, server, indexer, contracts]
tsconfig.base.json    strict base, extended by packages
packages/shared/      @bump/shared    — R2
server/               @bump/server    — R2
contracts/            @bump/contracts — R1 (Foundry project + ABI export)
indexer/              @bump/indexer   — R4
```

| Tool / package | Version | Notes |
|---|---|---|
| Node | ≥ 22.12 (local 26.2.0) | Colyseus needs ≥ 22; Ponder needs ≥ 22.12 |
| pnpm | 11.4.0 | the only package manager |
| TypeScript | 7.0.2 | same as root |
| three | 0.186.1 | `packages/shared` imports math types only |
| @dimforge/rapier3d-compat | **0.21.0 exact** (no caret) on server and client | |
| colyseus / @colyseus/schema / @colyseus/ws-transport | 0.18.9 / 5.0.36 / 0.18.4 | |
| @colyseus/sdk | 0.18.5 | |
| viem | 2.57.4 | |
| ponder | 0.18.0 | |
| vitest | 5.0.3 | |
| @biomejs/biome | 2.5.15 | |
| Foundry | installed 1.8.3 (`~/.foundry/bin`) | |
| OpenZeppelin Contracts | v5.6.1 via `forge install OpenZeppelin/openzeppelin-contracts@v5.6.1` | |

| Port | Service |
|---|---|
| 5173 | Vite client |
| 2567 | game server |
| 42069 | Ponder |
| 8545 | anvil (tests only) |
