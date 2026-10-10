# 00 — Overview: BUMP.TRADE realtime on Robinhood Chain testnet

Owner: PM. Date: 2026-10-09. Status: **awaiting user approval. No implementer has been dispatched.**

This file is the plan and the synthesis. The user capped research at three files, so there is no separate `05-synthesis.md`: decisions, resolved contradictions and the fixed stack all live here.

## 1. Goal

Turn the existing single-player Vite + three.js + Rapier bumper-car arena into a **realtime multiplayer match for 2–8 players on Robinhood Chain testnet**:
- players stake testnet ETH to enter;
- an authoritative server runs the physics and the zero-sum money ledger;
- one signed settlement pays out in proportion to each player's final balance;
- an indexer serves the leaderboard.

The PRD lines that banned blockchain and multiplayer are superseded by the user's instruction of 2026-10-09:
- `docs/update prd.md:1269`
- `docs/Car Texture.md:25,891-946`
- `docs/onboard/prd.md:421` ("No Wallet")

## 2. Research index: who reads what

| File | Concluded | Read by |
|---|---|---|
| `docs/research/robinhood-chain.md` | Testnet 46630 is live, an Arbitrum Nitro rollup on Sepolia with ArbOS 61, ~0.16 s blocks and a flat 0.01 gwei fee. viem has `robinhoodTestnet` (≥2.55.0). Blockscout verifies contracts. The public RPC is HTTP-only with no filters or archive. EntryPoints v0.6–v0.9 are deployed and Pimlico, Alchemy and ZeroDev list the chain. The faucet gives 0.01 ETH plus 5 test stock tokens per day. There are no Chainlink testnet feeds. Goldsky indexes the testnet; The Graph and Envio do not. | R1 (all), R2 (§Network, §8, implications), R3 (§Network, §7), R4 (§8, §10) |
| `docs/research/realtime-architecture.md` | Recommends server-authoritative Colyseus 0.18 with headless Rapier at 60 Hz and 30 Hz patches, interpolation for remote cars and prediction for the local car. The chain does escrow plus one EIP-712 settlement. Ponder indexes; Railway hosts. Bandwidth is about 7–17 KB/s down per client. Includes the security model. | R2 (all), R3 (F2.1, F3, R3–R5, client implications), R1 (F4, R5–R7), R4 (F5, F6) |
| `docs/research/repo-audit-and-tooling.md` | The repo has no networking. The sim core already runs headless in Node. The rules are tangled with the HUD and audio and use wall-clock time and `Math.random`. Four places break the zero-sum rule. There is no git, no lint and no tests. Proposes the pnpm workspace layout and lists skill/MCP candidates (none installed). | R2 (A2–A7), R3 (A2, A3, A6, A7 items 6–9), R4 (A7 layout, A8), R1 (A3 zero-sum, implications) |
| `docs/handoffs/contracts.md` | Every cross-role interface: ABI, events, EIP-712, protocol, API, environment variables, versions | **everyone** |

## 3. Decisions

Each decision gives the finding that drives it and what was rejected.

| # | Decision | Driven by | Rejected |
|---|---|---|---|
| D1 | **Server-authoritative simulation.** One Colyseus 0.18.9 Node room per match runs Rapier 0.21.0 headless at a fixed 60 Hz and owns physics, collisions and the ledger. Clients send inputs only. | Money is computed from velocities inside the collision handler (`CollisionSystem.ts:116-144,364-371`), so whoever simulates controls the money (realtime F1.2). Rapier compat runs in Node: 8 cars for 3 min took 140–374 ms (realtime F1.3). | P2P and host-authoritative (the host can edit balances). Deterministic lockstep (the game code is not deterministic, and one peer can stall a staked match). |
| D2 | **Colyseus 0.18** for rooms, transport and netcode, over WebSocket. | It has fixed-tick input queues, a prediction "opaque engine" mode for Rapier, interpolation and reconnection (realtime F2.1). | Raw `ws`/uWS (rooms and netcode would be hand-written). Nakama (its goja runtime cannot run Rapier). Geckos.io and WebTransport (UDP, which Railway lacks; experimental in Colyseus). Cloudflare Durable Objects (a 60 Hz loop defeats hibernation). Vercel WebSockets (no room affinity). Hathora (shut down 2026-05-05). |
| D3 | **On chain: escrow on entry, one signed settlement per match, events.** Everything else stays off chain. | Per-bump transactions are infeasible: a 16.7 ms tick against ≥160 ms blocks, plus nonce contention (realtime F4.1). One 8-player settlement costs about 0.000002 ETH (chain Recommendation 1). | Per-bump transactions; sorted leaderboard storage on chain; vehicle NFTs in v1 (pay-to-win risk, realtime F4.6). |
| D4 | **Stake = native testnet ETH, 0.0001 ETH** per seat. | Simplest path; the faucet gives 0.01 ETH/day, which is about 100 entries. | Test stock tokens: their addresses are inferred, not official, and they have pause and blocklist revert paths (chain §6). A custom ERC-20 chip: an extra contract (P2). |
| D5 | **The contract computes payouts** as `stake × finalBalance / startBalance`. It enforces `Σ finalBalances == n × startBalance` and that ranks form a permutation. Dust goes to treasury; the fee is 0. | Mirrors the PRD zero-sum rule (`docs/mechanics/prd.md` §20). Moving the payout arithmetic on chain means a compromised signer can only misreport balances, not invent payouts. | A server-supplied `payouts[]` (more trust in the server, as the realtime R6 draft had it). |
| D6 | **One wallet popup per match.** `join(matchId, sessionKey, vehicleId)` with value = stake registers a browser-generated session key. The game-server seat is then claimed with a session-key `personal_sign`, which needs no popup. | Realtime F4.4; chain Recommendation 2. | ERC-4337 or EIP-7702 smart accounts and gas sponsorship (Pimlico or ZeroDev), deferred to P2: they are verified on testnet but not needed for a single signature. |
| D7 | **Server confirms seats with `readContract(sessionKeyOf)` and confirms players with `getPlayers` after `startMatch`.** No dependence on event subscriptions. | The public RPC has no WSS and no `eth_newFilter` (chain §5, curl-verified), so viem's `watchContractEvent` over the public RPC is unreliable. | Event-subscription-driven seat confirmation. |
| D8 | **Indexer: Ponder 0.18.0.** PGlite locally, Postgres on Railway. Goldsky is the hosted fallback. | Same language and viem stack as the server. Goldsky is the only hosted indexer listing testnet 46630 (chain §8). | The Graph and Envio HyperSync (mainnet only); rindexer (Rust, reorg handling undocumented). |
| D9 | **Hosting: Railway** for the game server, Ponder and Postgres. The demo path runs locally first (P0); deployment is P1. | Railway keeps WebSockets open indefinitely; the user already has the Railway skill and MCP (realtime F6, audit B). | Vercel for the game server. |
| D10 | **Layout:** the Vite client stays at the repo root, which becomes a pnpm workspace with `packages/shared`, `server/`, `contracts/` and `indexer/`. | Moving the client to `apps/client` would break 10 Blender scripts with hard-coded `public/models` paths, and there is no git history to undo a move (audit A7). | `apps/client`. |
| D11 | **The server *copies and cleans* the simulation into `packages/shared`.** It does not move it out of `src/`. The offline single-player game in `src/` stays untouched and working. R3 alone owns `src/`. | Removes the Phase 0 `src/` lock the audit proposed (audit A7), so R2 and R3 run fully in parallel with no shared files. The cost is temporary duplicated rules; unifying offline mode onto `@bump/shared` is P2. | Extract-in-place with an exclusive lock on 15+ `src/` files (serialises R2 and R3). |
| D12 | **Staked-room economy rules** (contracts.md C2): a uniform `START_BALANCE` of 100; instant transfer at impact; floor cash cosmetic; no CASH RAIN; non-bump elimination redistributes to the last hitter within 5 s, otherwise equally among survivors; no `reset()` refill; bots excluded from staked rooms; 2–8 players. | Audit A3 and realtime F8: per-vehicle bags of $69–$500, a void-pit burn, a `reset()` mint, a global 50 ms throttle that drops simultaneous bumps. These must be closed before money is real. | Per-vehicle starting bags (they break the proportional payout); burning a balance on a void fall. |
| D13 | **Round length 90 s for the testnet demo**, configurable through `MATCH_DURATION_S`. | The existing timeline is tuned for 90 s (`MatchManager.ts:11,102-226`); a shorter demo loop is easier to show. | The PRD's 2:40–3:00 (`docs/update/prd.md` §25). It stays one env change away; the user may override. |
| D14 | **The client stays Vite + vanilla three.js.** No Next.js. The client role is network, chain and UI integration inside the existing game. | The product is a WebGL game with a 21k-line client; a Next.js rewrite would add no value to realtime play. | The PM template default "frontend is always Next.js". **This is a deliberate deviation and is flagged at the gate.** |
| D15 | **Wallet:** viem 2.57.4 only, with EIP-6963 discovery written in-house (about 30 lines) and `wallet_addEthereumChain`/`wallet_switchEthereumChain` for 46630. | The client has no React, so RainbowKit and wagmi React do not fit. viem covers injected wallets (realtime R2). | `@wagmi/core` (an extra dependency with no v1 need); Privy and Dynamic (unverified on testnet). |
| D16 | **Determinism:** ship `rapier3d-compat` in v1. Commit `inputLogHash` in P0; write the replay file in P1. Benchmarking `-deterministic-compat` and third-party replay verification are P2. | Server authority does not need determinism; dispute replay does (realtime F1.4–F1.5). | Switching to the deterministic build now, at an unmeasured cost. |
| D17 | **Single owner for root manifests:** R4 owns the root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` and `tsconfig.base.json`, and installs every dependency in contracts.md C9 in one pass. | Parallel `pnpm add` calls in different packages all write the one root lockfile. With no git there is no merge. | The audit's suggestion that the client owner hold the root (the client owns `vite.config.ts` and `tsconfig.json` instead). |
| D18 | **Deferred to P2:** market events driven by live prices (mainnet Chainlink TSLA, NVDA, GME and GLD feeds read off chain). | Chain §6: no testnet feeds. | Pyth on testnet (pull model, someone must push updates). |

### Variant note: "no authoritative server" (research only, 2026-10-09)

Researched in `docs/research/realtime-architecture.md`, section "Alternative: no authoritative server". **The plan above is unchanged.**
- A free, no-stakes P2P mode over WebRTC is viable, with only results recorded on chain. It is a different product: results are self-reported, wallets are free (so a leaderboard can be farmed), and cross-browser Rapier determinism is untested.
- It still needs a signalling service, and probably TURN for some players.
- It cannot support staking safely later (a loser can withhold a signature; a host can forge a result). Staking needs the authoritative server.
- The shared simulation (`@bump/shared`, R2 phase 0) serves both options, so choosing the P2P variant first would not waste that work.
- If you want this variant, say so and I will rewrite the affected handoffs (table in section A8 of the research file). No handoff has been changed.

## 4. Contradictions resolved

| Contradiction | Sides | Resolution |
|---|---|---|
| Blockchain or multiplayer banned versus the new direction | `docs/update prd.md:1269`, `docs/Car Texture.md:25`, `docs/onboard/prd.md:421` vs. the user, 2026-10-09 | **The user wins.** Those lines described earlier asset and UI milestones. |
| CASH RAIN | `docs/designgame/prd.md` §7 (has it) vs. `docs/update/prd.md` §29 (forbids it) vs. `docs/mechanics/prd.md` §21 (finite pool only) | **Forbidden in staked rooms.** It would mint money and break D5. |
| Cash must be picked up versus instant transfer | `docs/mechanics/prd.md` §7–8 vs. `docs/update/prd.md` §29 and the code (`CollisionSystem.ts:365-371`, `PickupManager.ts:283`) | **Instant transfer; floor cash is cosmetic.** A pickup would add despawn money loss (`Config.ts:161`) and an extra ledger path. |
| Starting balance | realtime F4.3 said "every player starts at 85" vs. audit A3, which found a per-vehicle `baseStartingBag` of $69–$500 (`HeroCar.ts:61-68`, `VehicleTypes.ts:123…507`) | **The audit was right**, verified by the PM in code. The realtime file is corrected. Staked rooms use a uniform `START_BALANCE` of 100 (D12). |
| Round length | code 90 s vs. PRD 2:40–3:00 | 90 s for the demo, configurable (D13). |
| Player count | 7 archetypes and 6 AI spawn slots in code (`OpponentManager.ts:52-59`) vs. "#3 / 8" in the HUD PRD | 8 seats. Vehicles may repeat across seats. R2 defines 8 spawn slots in `@bump/shared`. |
| Who signs payouts | realtime R6: the server signs `payouts[]` vs. the chain file: pro-rata | **The contract computes payouts** (D5). |
| Event watching | realtime R2-role says use viem `watchContractEvent` over WSS vs. chain §5: the public RPC has no WSS and no filters | **Use `readContract` for correctness** (D7). WSS is only an optional optimisation when `RH_WSS_URL` is set. |
| Root ownership and extraction | audit A7: the client owns the root and the server locks `src/` files vs. this plan | D11 and D17. |
| `docs/reskin/` relevance | audit A9: "a different project, ignore" vs. `src/ui/GameplayHUD.css:1-7`, which declares the Lucky Games palette | The Tagei handoffs in `docs/reskin/` are irrelevant. **The Lucky Games colour tokens are live in this game's HUD** and are the design reference for new UI (section 8). |
| docs.robinhood.com reachability | audit: TLS failure vs. chain research: read through a reader proxy | Not a conflict. The chain file's citations stand; R1 and R3 should expect the TLS issue on this machine. |

## 5. The stack, fixed

- **Chain:** Robinhood Chain Testnet, ID 46630, viem `robinhoodTestnet`, Blockscout explorer.
- **Contracts:** Solidity ^0.8.33 with `evm_version prague`, Foundry (installed 1.8.3), OpenZeppelin Contracts 5.6.1.
- **Server:** Node ≥22.12 (local 26.2), Colyseus 0.18.9, @colyseus/schema 5.0.36, Rapier compat 0.21.0 (exact), three 0.186.1 (math only), viem 2.57.4, vitest 5.0.3.
- **Client:** Vite 8.3, TypeScript 7.0.2, three 0.186.1, Rapier compat 0.21.0 (exact), motion 14, @colyseus/sdk 0.18.5, viem 2.57.4.
- **Indexer:** Ponder 0.18.0, with PGlite locally and Postgres on Railway.
- **Ops:** pnpm 11.4 workspace, Biome 2.5.15, git, Railway.

## 6. Roles, dependency graph, dispatch order

| # | Role | Handoff | Agent type at dispatch |
|---|---|---|---|
| R1 | Smart contracts engineer | `01-smart-contracts.md` | general-purpose |
| R2 | Realtime game server engineer (shared sim, rooms, settlement) | `02-game-server.md` | general-purpose |
| R3 | Client network and chain integration engineer (existing Vite game) | `03-client-network-chain.md` | general-purpose. The client is not Next.js or React, so `me:frontend` routing does not apply (D14). |
| R4 | Indexer and ops engineer (workspace, indexer, deploy) | `04-indexer-ops.md` | general-purpose |

```
R4-A  workspace scaffold + git + single dependency install      (short; everyone waits for it)
  ├──► R1  BumpArena.sol → tests → testnet deploy → @bump/contracts (ABI + deployments)
  ├──► R2  @bump/shared sim + protocol → server rooms → settlement (needs R1 deploy for E2E; uses anvil before)
  ├──► R3  chain + net modules, lobby/settlement UI → GameApp online mode (needs R2 protocol in @bump/shared)
  └──► R4-B  Ponder indexer against the contracts.md ABI → API (needs R1 deploy for live data)
E2E: R1 deployed + R2 running + R3 online mode + R4 indexer → PM walks the demo path
```

**Dispatch order after "yes":**
1. Dispatch R4 Part A alone.
2. When it reports done, dispatch R1, R2, R3 and R4 Part B concurrently. Their owned paths do not overlap.
   - R3 builds against the `@bump/shared` protocol types. R2 publishes those first, as R2 P0 step 1.
   - Until then, R3 works on `src/chain/` and the UI panels.
3. Each role finishes every P0 before any P1.
4. The PM walks the demo path end to end before any role starts P1.

**Memory note (14 GB machine):** never run two heavy builds at once. Only one role at a time may run `vite build`, `ponder build` or `forge build --via-ir`. Typecheck and tests are fine to overlap.

## 7. The demo path (defines P0)

This runs locally: the server on :2567, Ponder on :42069 and Vite on :5173, against the **real testnet** with the deployed `BumpArena`. Use two browser profiles with two funded MetaMask wallets.

1. Open `http://localhost:5173`. The main menu shows **PLAY ONLINE** next to the existing PLAY (offline) and LEADERBOARD.
2. Press **PLAY ONLINE**, then **Connect wallet**. An EIP-6963 wallet picker appears. The client switches or adds chain 46630 and shows the address, the testnet ETH balance and, if the balance is below the stake, a faucet link.
3. Pick a vehicle on the existing vehicle-select screen.
4. The lobby panel shows the match ID (short), a 0.0001 ETH stake, seats 1/8, a join countdown and a "Stake & Join" button.
5. Press **Stake & Join**: exactly **one wallet popup**. A pending state with an explorer link follows, then "Seat confirmed". The seat comes from the session-key `claimSeat`, with no popup.
6. Browser 2 does steps 1–5. The lobby shows 2/8 and the fill timer runs (30 s), then COUNTDOWN 3‑2‑1.
7. **LIVE.** Both players drive.
   - Remote cars move smoothly.
   - A bump shows the existing BUMP feedback, and the HUD bag changes by the same amount on both screens: one up, one down.
   - The HUD timer and ranking come from the server.
8. The match ends at 90 s, or when one car is left with the other eliminated at $0. ROUND COMPLETE leads to the result view with final balances and ranks.
9. The result view shows **Settling…**, then **Settled** with an explorer link to the `settle` transaction and each payout in ETH. The two payouts sum to 0.0002 ETH minus dust.
10. Press **Claim**: one wallet popup, and the wallet balance increases.
11. Press **LEADERBOARD**: the online tab lists both wallets with matches, wins and net PnL from the indexer API, including this match.

**Failure paths that are also P0, because they protect money:**
- A join that is never filled is cancelled after 120 s, and its refund is claimable with the Claim button.
- A server crash before settlement makes `claimRefund` available after `settleDeadline`. The UI shows the button only after the deadline.

## 8. Design reference for new UI (R3)

New UI (lobby, wallet, settlement and online leaderboard panels) must look like the existing HUD and menus. The sources are `docs/onboard/prd.md` §3–5 (glass panels, colour roles, typography) and `src/ui/GameplayHUD.css`. The inventory is embedded verbatim in `03-client-network-chain.md` §Constraints.

## 9. Priority and ownership rules

- **Priority.** Every requirement is tagged:
  - **P0:** on the demo path; must work end to end.
  - **P1:** makes the product credible (prediction, Railway deploy, replay file, CI).
  - **P2:** only if time remains.
- **No role starts a P1 while any P0 on the demo path is red.**
- **Every path has exactly one owner:**

| Path | Owner |
|---|---|
| `contracts/**` (Foundry project, `abi/`, `deployments/`, `package.json`) | R1 |
| `packages/shared/**` and `server/**` | R2 |
| `src/**`, `public/**`, `index.html`, `vite.config.ts`, `tsconfig.json` (client) | R3 |
| Root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `biome.json`, `.gitignore`, `.env.example`, `.github/**`, `railway.*`/`*.railway.json`, `indexer/**` | R4 |
| `docs/research/**`, `docs/handoffs/**` | PM |
| `scripts/*.py`, existing `docs/*` PRDs, `renders/`, `dist/` | nobody: do not touch |

- A role that needs a new dependency, a root script or a config change asks the PM; the PM routes it to R4.
- **Only R4 runs `pnpm install` or `pnpm add`.**

## 10. Standing rules (in every handoff)

- **English everywhere:** identifiers, strings, docs, commit messages, replies.
- **No comments in code**, including JSDoc. The one exception is user-approved temporary scaffolding, marked `// TEMPORARY — <what>; delete with <what>`.
- **Strict TypeScript:** no `any`, no `@ts-ignore`, no non-null assertion used to silence a real nullable. Do not add new `as any` casts. Existing ones in `src/` are tolerated only when they are not touched.
- **No new dependency beyond contracts.md C9** without asking the PM.
- **Use the installed skills** (section 11) when a task matches one, before writing the code it covers.
- **Animations respect `prefers-reduced-motion`.**
- **Never read, write or echo `.env*` files, private keys or secrets.** Use env var *names* only, and use Foundry keystores (`cast wallet import`) for deploy keys.
- **No `git commit`, `git push`, destructive git, `git add -A` or `git add .`** unless the user asks.
- **Write only inside your owned paths.** Anything else is reported to the PM.
- **Report honestly.** A red build is reported as red.

## 11. Skills and MCP: candidates awaiting user approval (nothing installed)

Source: `docs/research/repo-audit-and-tooling.md` §C. Each install is project scope and is run only after the user approves.

| Candidate | Kind | For | Install (run only after approval) |
|---|---|---|---|
| OpenZeppelin `setup-solidity-contracts`, `develop-secure-contracts` | skill (vendor) | R1 | `npx skills add OpenZeppelin/openzeppelin-skills -s setup-solidity-contracts -a claude-code -y` ; `npx skills add OpenZeppelin/openzeppelin-skills -s develop-secure-contracts -a claude-code -y` |
| OpenZeppelin Contracts MCP (Solidity) | MCP, hosted, no key | R1 | `claude mcp add --scope project --transport http openzeppelin-solidity https://mcp.openzeppelin.com/contracts/solidity/mcp` |
| Trail of Bits `secure-workflow-guide`, `guidelines-advisor`, `property-based-testing` | skill (vendor) | R1 | `npx skills add trailofbits/skills --list`, then `npx skills add trailofbits/skills -s <name> -a claude-code -y` for each |
| Cyfrin `solidity` | skill (vendor) | R1 | `npx skills add Cyfrin/solskill -s solidity -a claude-code -y` |
| Colyseus `colyseus` | skill (vendor; 2★ but vendor-owned, docs only, no scripts) | R2, R3 | `npx skills add colyseus/skill -s colyseus -a claude-code -y` |
| Railway `use-railway` + `railway` MCP | skill + MCP | R4 | **Already installed at user scope.** Do not run the `curl \| sh` installer lines in its SKILL.md. |

- **Rejected:**
  - Blockscout MCP: mainnet only and now needs a paid key.
  - Etherscan MCP: mainnet only.
  - Alchemy MCP: testnet support unverified.
  - The community Foundry MCP and `evm-mcp-server`: they take private keys and silently fall back to mainnet.
  - Community "Robinhood Chain" MCPs: trading-oriented, key-signing.
  - `threejs-skills`: no licence.
  - Envio docs MCP: Envio is not chosen.
- **No-install docs for agents** (WebFetch): `https://viem.sh/llms.txt`, `https://getfoundry.sh/llms.txt`, `https://docs.arbitrum.io/llms.txt`, `https://docs.colyseus.io/llms.txt`, `https://ponder.sh/llms.txt`, and Blockscout `https://explorer.testnet.chain.robinhood.com/api/v2` for live chain data.
- **Fallback:** if a skill is not approved, the role works from these docs and the research files. Each handoff says so.

## 12. Awaiting user confirmation

These items are outside `docs/` or are product calls:

1. **`git init` plus `.gitignore`** (R4 Part A, first step). There is no git repo today.
2. **Funding:** the deployer, relayer and two demo wallets need testnet ETH from the faucet. Only the user can do this, and agents never handle keys. The user also runs `cast wallet import <name> --interactive` for the deployer keystore and puts the server keys into a local `.env` that agents never read.
3. **Approval of the skill and MCP installs** in section 11.
4. **Product calls with defaults already chosen; override if you disagree:**
   - D12 economy rules (uniform $100 start, redistribution on a void fall, no CASH RAIN, no bots in staked rooms);
   - D13 90 s rounds;
   - D4 a 0.0001 ETH stake;
   - D5 a 0 fee.
5. **Brand:** Robinhood's terms (§5.7–5.11) require written consent to use its marks in a product name and forbid the name "Hood Chain". This affects HOOD BULL and HOOD BEAR. R3 adds the non-affiliation disclaimer (P1); the names stay until the user decides.
6. **Deviation D14:** the client stays Vite, not Next.js.
7. **Optional:** an Alchemy (or QuickNode) API key, set as `RH_RPC_URL`, `RH_WSS_URL` and `PONDER_RPC_URL_46630`, for rate-limit headroom. Everything works on the public RPC for the demo.
8. **`docs/reskin/`** (the Tagei handoffs) could move out of this repo before `git init`. Its Lucky Games tokens are used by the HUD.

## 13. Unverified assumptions still standing

- The official testnet stock-token addresses are inferred. Unused in v1.
- Faucet eligibility rules.
- `eth_subscribe` on keyed providers.
- EIP-7702 on 46630.
- Foundry 1.8.3 knows the name `robinhood-testnet`. Use `--chain-id 46630`.
- Real per-room CPU with the full collision code is below 1 ms per tick (only bare Rapier was measured).
- The Colyseus 0.18 prediction APIs behave as documented. R2 verifies them against the docs before relying on them.
- Ponder backfills fine over the public RPC's `eth_getLogs`, since a 100k-block range was accepted in testing.
- Void pits may be unreachable today because of the flat full-arena ground collider (audit A3). The redistribution rule still covers them.
- typescript-eslint and TS 7 compatibility; Biome sidesteps it.
