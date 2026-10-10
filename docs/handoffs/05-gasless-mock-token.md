# 05 — Gasless play with a free mock token (supersedes the ETH stake in contracts.md C1–C4)

Decision (Candra, 2026-10-09): stakes are a free in-game ERC20 (`BUMP`), and a player never needs ETH. The player only signs a message; the relayer (the server's `operator` key) pays all gas. The chain is Robinhood Chain testnet (46630). The ETH-stake contract at `0xdF8A07e865a18904677db7137330464178195F40` is abandoned.

Everything in contracts.md that is not named here stays: the `Result` EIP-712 type and signing, `settle` payout maths (`stake × finalBalance / 100`), match lifecycle, events, deadlines, refund-after-`settleDeadline`.

## Design

### MockBUMP (new, `contracts/src/MockBUMP.sol`)
- ERC20 + ERC20Permit, 18 decimals, name "Bump Token", symbol `BUMP`. Plain OpenZeppelin v5.6.1 base.
- `claim(address to)`: anyone may call; mints `CLAIM_AMOUNT = 1000e18` to `to` at most once per `CLAIM_COOLDOWN = 24 hours` per `to`. Reverts `ClaimCooldown(nextClaimAt)`. Emits `Claimed(to, amount, nextClaimAt)`. View `nextClaimAt(address)`.
- `setArena(address)`: owner only, once. When `msg.sender == arena`, `transferFrom` skips the allowance check, so the arena can pull stakes with no approve and no permit. Document this as testnet-only in the README.
- No other mint path. Owner is the deployer.

### BumpArena (rewrite of the stake/payout currency)
- Constructor takes the token address (immutable). `stake` per match is in token units (default `100e18`). No ETH is accepted anywhere; remove `payable` and the ETH balance invariant, replace with a token-balance invariant (arena token balance == sum of open stakes).
- `joinWithSig(JoinIntent intent, bytes sig)`, callable by `operator` only, or by anyone if the signature is valid (R1 decides; operator-only is acceptable and simpler to reason about, but then nobody can self-submit; prefer anyone-with-valid-sig).
  - `JoinIntent { uint256 matchId; address player; address sessionKey; uint8 vehicleId; uint256 deadline; }` EIP-712, domain `BumpArena` / `1` / chain 46630 / the arena address. `sig` must recover to `player` (support EOA ECDSA; ERC-1271 optional, not required).
  - Replay is blocked because a player can join a given `matchId` only once; `deadline` bounds staleness.
  - Pulls `stake` tokens from `player` with `token.transferFrom(player, arena, stake)`.
  - Emits the existing `PlayerJoined(matchId, player, sessionKey, vehicleId, seat)` with the same fields as today.
- Keep a direct `join(matchId, sessionKey, vehicleId)` for a player who has gas (pulls the same way, no approve needed). Optional but cheap.
- `settle` pushes each payout straight to the player with `token.transfer`. No claim step. `PlayerResult`/`Settled` events keep their shape; `payout` is in token units.
- `cancel` and the post-deadline refund push the stake back to each player. The refund path stays callable by anyone for any player so the relayer or a keeper can trigger it. Events keep their shape.
- Remove `claim()`/ETH `claimRefund` entry points only if nothing needs them. Keep names stable where possible so the indexer ABI diff stays small.
- `treasury`/fee stay (fee 0).

### Rate limits and abuse (server side, R2)
- `POST /faucet {wallet}`: the server calls `claim(wallet)` with the relayer. Limits: one per wallet per 24h (the chain enforces it, check first with `nextClaimAt` to avoid wasting gas), plus at most 5 faucet calls per IP per hour and a global ceiling per hour. Return `{txHash, nextClaimAt}` or a structured error.
- Join via signature: the client sends `{intent, sig}` to the server over the Colyseus room; the server checks the signature, deadline, matchId, that the player's token balance covers the stake, then submits `joinWithSig`. At most 1 pending join per wallet and 20 per IP per hour.
- Relayer ETH is the only scarce resource. Add a `/metrics.json` field `relayerBalanceWei` and refuse faucet and join when it drops below `RELAYER_MIN_BALANCE_WEI` (default 0.002 ETH), returning a clear error.

### Client flow (R3)
- Wallet connect and chain add/switch stay (the EIP-712 domain needs chain 46630, and the wallet refuses to sign on another chain). No transaction popups at all.
- Panel shows the player's BUMP balance and a free "Claim 1000 BUMP" button (calls the server faucet). Disable with a countdown while on cooldown.
- Join = one `eth_signTypedData_v4` of `JoinIntent`. The player never sends a transaction. Remove the stake-ETH wording, the ETH balance gate, and the claim-winnings step (payouts arrive automatically). Show the token amount won and the explorer link for the settle tx.
- Keep the session-key seat claim exactly as in contracts.md C6; the `sessionKey` field in `JoinIntent` replaces the argument that used to be in the `join` transaction.

### Indexer (R4)
- Switch to the new ABI and address. Amounts are token units (18 decimals) instead of wei; rename `totalStakeWei` style fields to `...Amount` and keep the API shape otherwise. Wipe and re-sync the Postgres schema (new `DATABASE_SCHEMA=bump_v2`).
- `Claimed` events can be ignored in v1.

### Deployment
- New deployments file shape: `BumpArena` and `MockBUMP` with address, block and tx hash. `abi/index.ts` exports `bumpArenaAbi`, `mockBumpAbi`, and `deployments`.
- Deploy order: token, arena(token), `token.setArena(arena)`. All three in `Deploy.s.sol`. Env names unchanged (`OWNER_ADDRESS`, `SIGNER_ADDRESS`, `OPERATOR_ADDRESS`, `TREASURY_ADDRESS`, `SETTLE_WINDOW_S`). New: `STAKE_AMOUNT` (default `100000000000000000000`), `TOKEN_ADDRESS` in app env, `VITE_TOKEN_ADDRESS` in the client.

## Role ownership and order
1. R1 (contracts) first: MockBUMP, BumpArena rewrite, tests (unit, fuzz, invariants, EIP-712 vectors for `JoinIntent` and the unchanged `Result`), ABI package, deploy script, README. Updates contracts.md C1–C4 and STATUS.md. Stops before the testnet deploy (the PM deploys with the relayer key).
2. R2, R3 and R4 start after R1 publishes the ABI and the PM deploys. They run in parallel and read this file plus the updated contracts.md.

## Acceptance (R1)
- `forge test` green, including: join by signature with a valid signature, wrong signer, expired deadline, wrong matchId, double join; settle pays token balances exactly and the arena's token balance ends at 0 after all payouts; cancel and post-deadline refund return full stakes; the arena can pull without an allowance only because of `setArena`; `claim` cooldown.
- Invariants: arena token balance equals the sum of stakes of unsettled, uncancelled matches; no ETH ever held.
- A signing test vector for `JoinIntent` checked by both Solidity and `node` (viem), same pattern as `ResultVector.t.sol`.
- No file outside `contracts/` and the docs named above is changed.
