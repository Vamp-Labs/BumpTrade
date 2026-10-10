# 03 — Client network and chain integration engineer (R3)

**Goal:** add an **online mode** to the existing BUMP.TRADE browser game (Vite 8 + TypeScript 7 + three 0.186 + Rapier 0.21).

A player can:
- connect a wallet on **Robinhood Chain testnet (46630)**;
- stake into a match with one wallet popup;
- play a realtime 2–8 player match driven by the authoritative Colyseus server;
- watch the result settle on chain, claim the payout, and see the online leaderboard.

The existing offline single-player game must keep working unchanged.

## Context — read first

1. `docs/handoffs/contracts.md`. It is **authoritative**:
   - C1 (chain, explorer, faucet, fallback-transport rule);
   - C2 (economy constants: the HUD shows these);
   - **C3** (the contract functions you call: `join`, `claim`, `claimRefund`, `getMatch`, `claimable`; the custom errors);
   - C4 (vehicle IDs);
   - **C5** (protocol: room `arena`, `claimSeat`, input, state, events);
   - **C6** (lifecycle and phases);
   - **C7** (indexer API);
   - C8 (the `VITE_*` names);
   - C9.
2. `docs/research/realtime-architecture.md`:
   - F2.1 (Colyseus 0.18 client APIs: `predict`, `lerp`);
   - F3 (60 Hz input, 30 Hz patches, 100 ms interpolation, predict only the local car, balances only from server events);
   - F4.4 (one-signature entry, session key);
   - R4 (message schema), R5 (state machine), R7 (security model);
   - Implications → Client.
3. `docs/research/repo-audit-and-tooling.md`:
   - A2 (game loop, tick order `GameApp.ts:642-664`, hit-stop `GameLoop.ts:63-69`, debug hotkeys `GameApp.ts:378-416`);
   - **A3** (state locations and the **EventBus table**: you map server events onto these);
   - A6 (module classes);
   - A7 items 6–9;
   - A8 (Vite config, no `import.meta.env` yet);
   - Implications → Client.
4. `docs/research/robinhood-chain.md`:
   - Network parameters;
   - §3 (faucets);
   - §5 (viem `robinhoodTestnet` ≥ 2.55.0; public RPC has no WSS);
   - §7 (MetaMask add-network values);
   - §9 (trademark: the non-affiliation disclaimer);
   - Implications → Client.
5. `docs/handoffs/00-overview.md`: §3 (D6, D7, D11, D14, D15), **§7 (the demo path, which is your P0 script)**, §9, §10.
6. UI sources: `docs/onboard/prd.md` §3–5, `src/ui/GameplayHUD.css`, and the styles injected by `src/ui/OnboardingUI.ts:869+`. The design inventory is embedded below under Constraints.

## Tools — skills and MCP

- **Colyseus `colyseus` skill**, if the user approved it (`.claude/skills/colyseus/`). Invoke it before writing SDK, room, `predict` or `lerp` code.
- **If it is not installed**, use `https://docs.colyseus.io/llms.txt` with `/sdk`, `/netcode/client-prediction`, `/netcode` and `/state/schema`, read at 0.18.
- viem: `https://viem.sh/llms.txt` (`createWalletClient` with `custom(provider)`, `writeContract`, `waitForTransactionReceipt`, `readContract`, `generatePrivateKey`, `privateKeyToAccount`, `signMessage`, `switchChain`/`addChain`, `BaseError.walk` / `ContractFunctionRevertedError` for custom-error decoding).
- EIP-6963: `https://eips.ethereum.org/EIPS/eip-6963`.
- `work:reuse-first` (installed). Invoke it before writing any UI, so new panels reuse the existing classes and tokens.
- `work:animation-qa` (installed). Invoke it before finishing any new animation; it covers the reduced-motion and cleanup checks.

## Owned paths

You may write **only**:
- `src/**`
- `public/**`. Add nothing large. **Never** modify `public/models/**`.
- `index.html`
- `vite.config.ts`
- `tsconfig.json`, the client tsconfig. It may extend `tsconfig.base.json`, which R4 owns.

**Read-only for you:**
- the root `package.json` and the lockfile (R4; ask the PM for dependencies or scripts);
- `packages/shared/**` and `server/**` (R2);
- `contracts/**` (R1);
- `indexer/**` (R4).

You consume the `@bump/shared` and `@bump/contracts` workspace packages; R4 adds them to the root `package.json` as `workspace:*` dependencies.

## Responsibilities

- **Chain module** (`src/chain/`): wallet discovery, connect and chain switch, balance, the session key, `join`, `claim`, `claimRefund`, contract reads, and error decoding.
- **Network module** (`src/net/`): the Colyseus connection, the lobby and seat claim, the 60 Hz input send, state and event handling, remote car interpolation, and the local car (server-driven in P0, predicted in P1).
- **Online mode in `GameApp`:**
  - the authority path is replaced by the server;
  - offline mode is untouched;
  - the HUD, VFX and SFX are fed from server events through the existing EventBus;
  - hit-stop becomes cosmetic;
  - the debug hotkeys are off.
- **UI:** PLAY ONLINE entry, wallet panel, lobby panel, settlement/result panel, online leaderboard tab, and the disclaimer (P1).
- **Config:** `VITE_*` env typing and defaults.

## Scope

### In scope
Everything under Owned paths that is needed for demo-path steps 1–11 (`00-overview.md` §7) and for the two money-safety failure paths.

### Out of scope
- Simulation rules, physics constants, the economy and ranking: you **consume** `@bump/shared`; you never redefine them.
- The server, the contract, the indexer and deployment.
- Rewriting offline mode onto `@bump/shared`. That is P2 and needs a PM decision.
- New 3D assets, Blender scripts and the car models.
- Next.js or React. The client stays vanilla TS and DOM (decision D14).
- Account abstraction and gas sponsorship (P2).

## Objectives

1. Two browsers on the same machine complete the whole demo path against the real testnet. Bumps show identical amounts on both screens.
2. Money paths are honest. The UI never shows a balance, payout or "settled" state that the server or the chain has not confirmed.

## Requirements

**Config:**
- **P0** — `src/config/env.ts` reads the C8 `VITE_*` names, typed through `ImportMetaEnv` in `src/vite-env.d.ts`, with defaults:
  - chain `46630`;
  - RPC `https://rpc.testnet.chain.robinhood.com`;
  - server `ws://localhost:2567`;
  - indexer `http://localhost:42069`;
  - explorer `https://explorer.testnet.chain.robinhood.com`;
  - faucet `https://faucet.testnet.chain.robinhood.com/`;
  - arena address from `@bump/contracts` `deployments`, with `VITE_ARENA_ADDRESS` as an override.

**Chain** (`src/chain/`):
- **P0 — Wallet discovery and connection:**
  - EIP-6963 discovery: listen for `eip6963:announceProvider`, dispatch `eip6963:requestProvider`, and fall back to `window.ethereum`.
  - Connect with `eth_requestAccounts`.
  - `switchChain` to 46630, falling back to `addChain` with `robinhoodTestnet` from `viem/chains`.
  - React to `accountsChanged` and `chainChanged`.
- **P0 — Clients:**
  - a public client using `fallback([http(VITE_RPC_URL), http(public)])` (C1 rule);
  - a wallet client over `custom(provider)`.
- **P0 — Session key:**
  - generated per match with `generatePrivateKey()`;
  - kept in memory and in `sessionStorage` under `bump.session.<matchId>`, so a reload can re-claim the seat. It holds no funds and only authorises the seat;
  - cleared after SETTLED or CANCELLED.
- **P0 — Contract calls:**
  - `join(matchId, sessionKey.address, vehicleId)` with `value = BigInt(state.stakeWei)`;
  - `claim()`, `claimRefund(matchId)`;
  - reads of `getMatch`, `claimable` and the wallet balance.
- **P0 — Revert decoding:** decode the C3 custom errors into short UI copy. Examples: `WrongStake` → "Stake amount changed, refresh"; `JoinClosed` → "Join window closed"; `MatchFull` → "Match is full".

**Network** (`src/net/`):
- **P0 — Room and seat:**
  - `@colyseus/sdk` `joinOrCreate('arena', { vehicleId })`, which makes you a lobby member.
  - After the `join` receipt, send `claimSeat` with `seatMessage(...)` from `@bump/shared` signed by the **session key**. This is a local account, so there is no popup.
  - Handle `error` codes.
  - Reconnect within 10 s, then re-claim with a fresh `issuedAt`.
- **P0 — Input:** during LIVE, send 60 Hz input from `InputManager.sampleInput()`, encoded per C5: `round(x × 100)` and the button bits. Send nothing outside LIVE.
- **P0 — Remote cars:**
  - Interpolate them 100 ms behind (Colyseus `lerp`, or a snapshot buffer of your own if `lerp` is not available), from the quantized `Car` state.
  - Render each with the existing `VehicleFactory` and `HeroCar` visuals for its `vehicle` ID.
  - Its Rapier body is **kinematic position-based**, or it has no body, so it never fights the server. Visuals that read physics state (wheels, tilt, skid) must still animate, using kinematic velocity or the velocity values in the snapshot.
- **P0 — Local car:**
  - Render it from the latest server state with light smoothing and **no** 100 ms buffer. This is enough on localhost.
  - **P1:** full prediction with `predict.sim` and `stepCar`, `adoptCar` and `poseCar` from `@bump/shared` (provided by R2): `smoothMs 65`, snap at 3 m.
- **P0 — State to HUD:**
  - The HUD bag, every car's balance, the timer (from `tick`, `liveStartTick` and `endsAtTick`), the ranking and eliminated state all come **only** from server state and events.
  - Disable the HUD's own round timer and ranking computation in online mode (`GameplayHUD.ts:66,1177-1178,1269-1301`).
- **P0 — Server events to the existing EventBus** (audit A3 table), so the existing VFX, SFX and HUD react without being rewritten:

| Server event | Re-emit as | Notes |
|---|---|---|
| `bump` | `collision` (built `CollisionEvent`) + `money_scatter {position, amount, normal}` | position from `x, z`; floor cash is cosmetic and must never change a balance |
| `eliminate` | `vehicle_eliminated {carId, position}`, plus `vehicle_liquidated` when `cause === 'voidPit'` | then spectator camera for the local player |
| `marketEvent` | `arena_event` / `market_event_telegraph` | via `MarketEventKind` → existing types |
| `phase` | drives the lobby, countdown, ROUND COMPLETE and result screens | |
| `matchEnd` | the result view | |
| `settlement` | the settlement panel | |

- **P0 — Online-mode guards:**
  - Hit-stop is render-only and never pauses networking or input (`GameLoop.ts:63-69`).
  - The R, T, V and B debug hotkeys are disabled.
  - The `window.__*` debug globals are off.
  - No local AI opponents are spawned.

**UI.** Follow the design inventory below; reuse the existing classes first.
- **P0 — Main menu:** add **PLAY ONLINE** next to PLAY and LEADERBOARD (`OnboardingUI.ts:518-525`) as a secondary button styled like `.btn-leaderboard-cta`. PLAY stays the hot CTA. Online flow: wallet panel → existing vehicle select → lobby.
- **P0 — Wallet panel:** connect button, short address, chain badge "Robinhood Chain Testnet", ETH balance, a wrong-chain state with a "Switch network" action, and a "Get testnet ETH" faucet link shown when `balance < stake + 0.00001 ETH`.
- **P0 — Lobby panel:** match ID (`0x1234…abcd`), stake in ETH, seats `n/8`, join countdown (from `joinDeadline`), fill timer (`fillEndsAt`), and the "Stake & Join" button.
  - States: idle → wallet confirm → pending (explorer tx link) → seat confirmed.
  - Failures: rejected, reverted with the decoded error, stale.
- **P0 — Countdown 3-2-1**, using the existing HUD countdown styling if present; otherwise Orbitron 900, centred.
- **P0 — Result and settlement panel:** final ranking (rank, short wallet, final balance, payout in ETH from `matchEnd.ranking[].payoutWei`), then **Settling…** → **Settled** with an explorer link to the `settle` transaction, then **Claim**.
  - Claim is enabled when `claimable(address) > 0` and the wallet balance updates after the receipt.
  - **CANCELLED** shows "Match cancelled, stake returned" and Claim.
  - **SETTLE_FAILED**, or a match whose `settleDeadline` has passed while still unsettled, shows **Claim refund** (`claimRefund`). The button shows only when the chain allows it, so check `getMatch` status and deadline.
- **P0 — Leaderboard:** an **Online** tab on the existing LEADERBOARD screen fed by `GET /leaderboard?window=all` (C7). Rows show rank, short wallet, matches, wins, net PnL in ETH, and best balance. It has loading, empty ("No settled matches yet") and error states. The existing offline podium stays as the default tab.
- **P1** — the non-affiliation disclaimer in the menu footer: "BUMP.TRADE is not affiliated with, endorsed by, or officially connected with Robinhood Markets, Inc." (Robinhood Terms §5.7(b)).
- **P1** — a match history list for the connected wallet (`GET /matches?wallet=`).
- **P1** — local-car prediction (above), plus a network stats overlay (RTT, patch rate) behind a URL flag `?net=1`.
- **P2** — a practice mode against R2's `arena_practice` room.

## Dependencies

- **Before starting:** R4 Part A (workspace with `@colyseus/sdk`, `viem` and the workspace packages installed).
- **R2 `@bump/shared/protocol`** must exist before `src/net/` compiles. Until then, build `src/chain/` and the UI panels, both of which are independent.
- **R1 `@bump/contracts`** (`bumpArenaAbi`, `deployments`). Until the testnet deploy lands, point `VITE_ARENA_ADDRESS` at an anvil deploy, with `VITE_RPC_URL=http://127.0.0.1:8545` and a local chain configuration, for development only.
- **R4 indexer** on :42069 for the leaderboard tab.
- **The user:** two funded test wallets in two browser profiles, for the demo.

## Interfaces (contracts.md is authoritative)

- **Consume:**
  - C3: `join`, `claim`, `claimRefund`, `getMatch`, `claimable`, the custom errors, and the events (optional; reads are enough);
  - C5: room `arena`, `claimSeat`, input, the `Car`/`MatchState` schemas, and the events `seat`, `bump`, `eliminate`, `marketEvent`, `phase`, `matchStart`, `matchEnd`, `settlement`, `error`;
  - C7: `/leaderboard`, `/matches`, `/players/:wallet`;
  - from `@bump/shared`: protocol types and enums, the vehicle ID table, `seatMessage`, `computePayouts` (display only), and (P1) `stepCar`, `adoptCar`, `poseCar`.
- **Provide:** nothing to other roles. Report UX problems with the protocol to the PM.

## Constraints

**The design inventory below is the contract for every new panel.**

Sources:
- `docs/onboard/prd.md:65-193`;
- `src/ui/GameplayHUD.css:1-60`, plus the colour frequency across the file;
- `src/ui/OnboardingUI.ts:1002-1091`;
- `index.html:7-9`.

- **Visual language** (`docs/onboard/prd.md` §3):
  - "Glass panels: translucent dark glass, low-opacity background, subtle border, mild blur, very soft shadow, slight inner highlight."
  - "Avoid: large opaque cards, heavy borders, excessive glow, giant gradients."
  - From the HUD PRD: "3D arena = hero, HUD = support."
- **Glass panel recipe** (`GameplayHUD.css:46-58` `.hud-bag-card`):
  - `background: rgba(10, 16, 28, 0.62)`;
  - `backdrop-filter: blur(20px) saturate(190%)` with the `-webkit-` twin;
  - `border: 1px solid rgba(255,255,255,0.09)`;
  - `border-radius: 14px`;
  - `padding: 12px 16px`;
  - `box-shadow: 0 12px 36px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)`.
- **Colour tokens** (Lucky Games palette declared at `GameplayHUD.css:1-7`; uses counted across the file):

| Token | Hex | Role |
|---|---|---|
| Lucky green | `#1ef66d` (34 uses) | primary CTA, gain, positive, player highlight, success |
| CTA text on green | `#041a0c` | text on the green CTA |
| Hot red | `#f80757` (24) | loss, danger, eliminated, errors. The damage vignette uses `rgba(255,59,95,…)`. |
| Gold | `#fcbe20` (21) | first place, champion, Gold Whale, payout highlight |
| Cyan | `#2dbdf1` (20) | secondary highlight, TSLA, info, pending states |
| Purple | `#c084fc` | NVDA AI |
| Orange | `#f08204` | warnings, critical bag |
| White | `#ffffff` | headings, important numbers |
| Secondary text | `#bcd1ef` | labels |
| Muted text | `#8b9bb4` | captions, helper text |
| Line | `#243149` | dividers, borders on solid surfaces |
| Panel | `#1a263b` | solid panel; also `rgba(26,38,59,0.65)` for glass buttons |
| Sheet | `#111b2d` | modal sheet |
| Well | `#0e1726` | inset wells, inputs |

- **Typography** (`index.html:9`, `docs/onboard/prd.md` §5):
  - **Orbitron** 600/800/900 for headings, CTAs and big numbers ("bold + condensed + arcade + modern");
  - **JetBrains Mono** 400/700/800 for data, addresses, amounts, stats and body text. Addresses and wei/ETH amounts are always JetBrains Mono.
- **Buttons** (`OnboardingUI.ts:1046-1091`):
  - **Primary CTA** `.btn-play-cta`: 270×58, background `#1ef66d`, radius 12px, glow `0 0 30px rgba(30,246,109,.45)`, text `#041a0c` in Orbitron 900 20px. Hover scales to 1.04 with a stronger glow; active scales to 0.98.
  - **Secondary** `.btn-leaderboard-cta`: 270×48, glass `rgba(26,38,59,.65)`, border `rgba(255,255,255,.10)`, blur 20px, radius 12px.
  - Rule: **one hot (green) CTA per screen.** In the lobby it is "Stake & Join"; in the result view it is "Claim".
- **Radii in use:** 4, 6, 8, 12, 14, 16 px and 9999px (pills). Pills are for chips and badges, such as the chain badge and seat count.
- **Screens:** `.screen-view` / `.screen-view.active`, with a 0.35 s opacity and visibility fade (`OnboardingUI.ts:1002-1014`). New screens use the same mechanism.
- **States every new control needs:** hover, focus-visible (a 2px `#2dbdf1` outline), active, disabled (opacity .45, no glow), loading (a spinner or pulsing label, using `#2dbdf1`), empty, and error (`#f80757` text with a short reason).
- **Motion:**
  - No `prefers-reduced-motion` handling exists anywhere in `src/` today. Every new animation you add must check `window.matchMedia('(prefers-reduced-motion: reduce)')` and fall back to an instant change.
  - Use the existing `MotionFX` helpers and `motion` 14 where they fit.
- **HUD rule:** never cover the arena with large opaque cards during LIVE. Lobby and result panels are fine outside LIVE.

**Technical constraints:**
- Pin `@dimforge/rapier3d-compat` to exactly 0.21.0.
- The client never computes a balance, a payout or a "settled" state on its own:
  - balances come from server state;
  - payouts come from `matchEnd` and are confirmed against `claimable`;
  - "Settled" means `settlement.status === 'confirmed'`, or `getMatch().status === Settled`.
- Never put a wallet private key anywhere. The session key is a throwaway, per-match key, created only through viem.
- Offline mode stays playable exactly as today: PLAY → vehicle select → local match with AI.

**Standing rules:**
- English everywhere.
- **No comments in code.**
- Strict TypeScript: no new `any`, no `@ts-ignore`, no non-null assertions on real nullables. Existing `as any` in files you touch should be removed where practical.
- No new dependency beyond C9 without asking the PM.
- Invoke the skills listed above.
- Every animation respects reduced motion.
- Never read, write or echo `.env*` files or secrets. `VITE_*` values are public by nature, but you still never read `.env` files; use `import.meta.env`.
- No git commit, push, `add -A` or `add .`.
- Write only in your owned paths.
- Report red as red.
- Memory: `vite build` is heavy, so never run it while another role builds. Prefer `pnpm exec tsc --noEmit -p .` while iterating.

## Deliverables

- **P0:**
  - `src/config/env.ts`, `src/vite-env.d.ts` (`ImportMetaEnv`);
  - `src/chain/{wallet.ts, clients.ts, sessionKey.ts, arena.ts, errors.ts}`;
  - `src/net/{NetClient.ts, RemoteCar.ts, LocalNetCar.ts, eventBridge.ts, inputEncoder.ts}`;
  - `src/ui/online/{WalletPanel.ts, LobbyPanel.ts, ResultPanel.ts, OnlineLeaderboard.ts, online.css}`;
  - the online-mode branch in `src/core/GameApp.ts`;
  - the PLAY ONLINE entry in `src/ui/OnboardingUI.ts`.
- **P1:** prediction, the disclaimer, match history, and the `?net=1` overlay.

## Acceptance criteria

1. `pnpm exec tsc --noEmit -p .` exits 0, and `pnpm build` exits 0 (run alone).
2. **Offline regression:** PLAY → vehicle select → a local match against AI starts and ends exactly as before. This is checked manually in the browser by the PM.
3. **Demo path:** with the server, indexer and testnet contract up, two browser profiles complete `00-overview.md` §7 steps 1–11.
   - Exactly **one** wallet popup per player for joining and one for claiming.
   - Each bump shows the same amount on both screens.
   - The bags sum to 200 throughout.
   - The settle tx link opens on the explorer.
   - The online leaderboard lists both wallets.
4. **Cancel path:** a lobby that never gets a second player shows "Match cancelled" after the join window, and Claim returns the stake.
5. `grep -rn "performance.now\|Math.random" src/net src/chain` shows no use that affects balances, ranking or timers. Cosmetic uses only.
6. Every new animation has a reduced-motion branch. Check: `grep -rn "prefers-reduced-motion" src/ui/online src/net` is non-empty, and the PM verifies it with DevTools emulation.
7. No `//` or `/* */` comments in new or modified files. Comments that already exist in untouched lines of existing files may stay.
8. No file outside the owned paths was created or modified.
