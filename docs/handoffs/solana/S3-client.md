# S3 — Client chain port, Solana wallet and chain selector

Read first: `00-overview.md`, `01-contracts.md` (C1, C4, C5, C6, C7, C8), `src/chain/*`, `src/net/OnlineController.ts`, `src/net/NetClient.ts`, `src/ui/online/*`, `STATUS.md`. Load the `solana-dev` skill (Wallet Standard first, `@solana/kit`; the client is vanilla TypeScript, no React).

## Deliver

1. `src/chain/port.ts` with `ClientChain` (C6) and `getActiveChain()` / `setActiveChain()` persisted in `localStorage` `bump.chain`, default `solana`.
2. `src/chain/evm/`: move today's EVM modules behind the port without behaviour changes (EIP-6963 discovery, silent auto-connect, chain switch, EIP-712 join, faucet, balances).
3. `src/chain/solana/`:
   - Wallet Standard discovery (`@wallet-standard/app` `getWallets()`), connect/disconnect, silent auto-connect for the last wallet (same rules as EVM: explicit DISCONNECT forgets it), account change handling. Must work with Phantom, Backpack, Solflare; mobile = wallet in-app browser.
   - Join (C4): send `solJoinPrepare`, receive `solJoinTx`, `solana:signTransaction`, send `solJoinSubmit`. One popup, no SOL needed. Map errors (`TX_EXPIRED` → retry once automatically, `TX_TAMPERED`, rejected by user, insufficient BUMP).
   - ed25519 session key per match (`sessionStorage`), seat proof with `scheme: "ed25519"` (C5).
   - Reads with `@bump/sol-client` decoders: match snapshot, session key of a player, BUMP balance (9 decimals).
4. Online flow (`OnlineController`, `NetClient`, panels) calls only the port. The game server URL, leaderboard URL, explorer links and decimals come from the active chain.
5. Chain selector in the wallet panel and lobby (two pills: "Solana Devnet" default, "Robinhood Chain"). Switching disconnects the other chain's wallet and reconnects the net client to that chain's server. Copy: no money talk beyond the stake line; keep the Robinhood disclaimer only when Robinhood is selected.
6. Leaderboard tab: chain filter (default Solana) using `VITE_SOL_LEADERBOARD_URL` or the EVM indexer, formatted with the chain's decimals.
7. `src/config/env.ts` + `src/vite-env.d.ts`: C8 client names with safe defaults; `.env.example` client section (append only).

## Order inside your work

Start with the port + EVM move + selector (no dependency). Use a typed stub for the Solana adapter until S1 publishes `@bump/sol-client` and S2 publishes the C4 messages (check `STATUS.md`); then wire the real adapter.

## Constraints

- Own only the S3 paths in `00-overview.md`. Do not touch server, contracts, solana, indexer, Railway.
- Offline mode must stay untouched and working. EVM online flow must behave exactly as before.
- Gate: `pnpm exec tsc --noEmit -p .` and `pnpm build` (with `flock /tmp/bump-build.lock`). Do not leave a dev server running. No real transactions.

## Report

Files, build/typecheck, what still needs live verification on devnet (PM runs the two-browser E2E with mock Wallet Standard wallets in headless Chrome), deviations.
