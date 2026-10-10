# STATUS — Solana track

Each role appends under its own heading: done, published interfaces (with commit hash), needs from others, blockers. The PM owns the "Decisions" section. Newest entries on top within each section.

## Decisions (PM)

- 2026-10-10: plan drafted (00-overview, 01-contracts, S1–S4). Candra said yes 2026-10-10; S1 and S2 phase A dispatched. Branch `feat/solana` created from `main` @ 7299259.

- 2026-10-10 (PM): S2 phase A verified by PM (build, typecheck, shared 11, server 34, contracts 109 green). APPROVED: the port additions beyond C3 (`relayerId`, `signerId`, `signResult`, `selfCheck?`, `parseWallet`, `walletKey`; `sessionKeyOf` returns `null` when no key) are part of C3 from now on. APPROVED: `expiresAt` in `solJoinTx` is unix milliseconds. Railway `server` service now has `CHAIN=evm` (default is `solana`). Known flaky: server integration test port = pid % 20000 can collide with parallel agents; if it fails with EADDRINUSE, rerun alone.

- 2026-10-10 (PM) FROZEN: S2/S4 leaderboard hook. S4 owns `server/src/leaderboard/index.ts` and exports exactly:
  ```ts
  export interface SettlementRecord { matchId: Hex32; chain: ChainId; stake: bigint; startBalance: number; potAmount: bigint; settleTx: string; settledAt: number; players: { wallet: string; finalBalance: number; rank: number; payout: bigint }[] }
  export interface Leaderboard {
    recordSettled(rec: SettlementRecord): Promise<void>;
    recordCancelled(matchId: Hex32): Promise<void>;
    faucetNextClaimAt(wallet: string): Promise<number>;       // unix seconds, 0 = now
    faucetMarkClaimed(wallet: string, at: number): Promise<void>;
    handleRequest(req: Request): Promise<Response | null>;    // serves /leaderboard, /players/:wallet, /matches, /matches/:id, /ready; null = not a leaderboard route
    ready(): Promise<boolean>;
  }
  export function createLeaderboard(o: { databaseUrl?: string; schema: string; chain: ChainId; decimals: number; corsOrigins: string[] }): Promise<Leaderboard>;
  ```
  `databaseUrl` unset means in-memory/pglite (tests and local dev). S2 consumes it: wires it in `server/src/index.ts`/`app.ts` (calls `recordSettled` after settle is confirmed, `recordCancelled` on cancel, uses the faucet methods for the Solana cooldown, delegates unknown HTTP routes to `handleRequest`). Until S4 lands the module, S2 codes against a tiny in-memory stub of this interface in `server/test/` and does not create files under `server/src/leaderboard/`.
- 2026-10-10 (PM): devnet deploy is blocked on SOL for the deployer and relayer (balance 0). S2 phase B, S3 and S4 start now using the published program id, IDL and `@bump/sol-client`; live devnet verification happens after the PM deploys. S1 note accepted: no `close` instruction, about 0.007 SOL rent per match is paid by the operator on devnet; acceptable for the hackathon.

## S1 Program

- 2026-10-10 DONE (S1). Program id `3LDXSuMuzP33VZ31sar4ZN1YB13pta7NRuR6aDJmwVgz` (keypair `solana/target/deploy/bump_arena-keypair.json`, not committed; the PM deploys with it). IDL `solana/idl/bump_arena.json`. Anchor 1.0.1, anchor-spl 1.0.1, classic SPL Token. Details, layout and the exact PM deploy command in `solana/README.md`.
- Account order: `join_match` = player, config, match, vault, player_token, token_program. `settle` = operator, result_signer, config, match, vault, treasury, token_program, then one writable player token account per seat in seat order. `cancel` = operator, config, match, vault, token_program, then the same seat accounts. `claim_refund` = config, match, vault, player_token, token_program (no signer needed beyond the fee payer). `open_match` = operator, config, mint, match, vault, token_program, system_program. `initialize` = admin, config, mint, treasury, token_program, system_program.
- Deviations from C2: three errors appended after `Unauthorized` (`BadRanks`, `BadVehicle` for vehicle_id >= 7, `InvalidParams`), codes of C2 errors unchanged. `settle_deadline` is fixed at open (`join_deadline + settle_window_s`, as on EVM). `set_paused` blocks only open and join. `ended_at` is accepted but not stored. Client input for `initialize` names the treasury arg `treasuryArg`.
- `@bump/sol-client` (workspace, `@solana/kit` 8.4.0, Codama output in `src/generated`): all generated builders (`getJoinMatchInstructionAsync`, `getSettleInstructionAsync`, ...), decoders (`getMatchDecoder`, `getConfigDecoder`, `fetchMatch`...), event/error codes, `PROGRAM_ID`, `findConfigPda()`, `findMatchPda(matchId: Uint8Array | hex)`, `findVaultPda(matchId)`, `withRemainingAccounts(ix, addresses)` (use for settle and cancel), `deployments` (placeholder with `pending: true`, mint and treasury null until the PM deploys). `pnpm-workspace.yaml` got `- "solana"` (deploy script package `@bump/solana`); `pnpm-lock.yaml` changed accordingly.
- Needs from PM: run the deploy command from `solana/README.md` with the real pubkeys, commit the resulting `solana/deployments/devnet.json`.

## S2 Core + server

- 2026-10-10 phase A, C4 wire types published in `303a808` (`packages/shared/src/chain/types.ts`, `protocol/messages.ts`): `SolJoinPrepareMessage { matchId, player, sessionKey, vehicleId }`, `SolJoinSubmitMessage { matchId, signedTx }`, `SolJoinTxEvent { t: "solJoinTx", matchId, tx, expiresAt }` (added to `ServerEvent`), constants `SOL_JOIN_PREPARE_MESSAGE = "solJoinPrepare"` and `SOL_JOIN_SUBMIT_MESSAGE = "solJoinSubmit"`, error codes `TX_EXPIRED` and `TX_TAMPERED` in `JoinErrorCode`. `expiresAt` is unix milliseconds (C4 left the unit open). `ClaimSeatMessage.scheme?: "evm" | "ed25519"` (absent = evm). Chain-agnostic `WalletId = string`, `Hex32`, `TxRef`, `ChainId`, `SeatScheme`, `ChainResult` are exported from `@bump/shared`; `JoinResultEvent.wallet`, `SeatEvent.wallet`, `FaucetStatus.wallet`, `txHash` fields and `MatchEndEvent.resultSignature` widened from `Address`/`Hex` to `string` (client typecheck still green).
- Phase A server refactor: `ArenaChain` port in `server/src/chain/ArenaChain.ts`, EVM adapter in `server/src/chain/evm/`, adapter chosen by `CHAIN` (default `solana` per C3, so the Railway EVM `server` service must now set `CHAIN=evm`). Additive port members beyond C3 (needed so Settler, JoinRelay, Faucet and ArenaRoom stay chain-agnostic): `relayerId`, `signerId`, `signResult`, `selfCheck?`, `parseWallet`, `walletKey`. `sessionKeyOf` returns `null` when no key is registered.

## S3 Client

- 2026-10-10 DONE (S3, wire-up against the C4 types; live devnet verification pending). `pnpm exec tsc --noEmit -p .` and `pnpm build` green.
- Port `src/chain/port.ts` (`ClientChain`, `getActiveChain`, `setActiveChain`, `onActiveChainChange`, selection in `localStorage` `bump.chain`, default from `VITE_CHAIN_DEFAULT`, else `solana`). Additive members beyond C6: `gameServerUrl`, `gameServerHttpUrl`, `leaderboardUrl`, `defaultStake`, `claimAmount`, `isConfigured`, `isTokenConfigured`, `clearSessionKey`, `describeError`, `formatAmount`, `nextClaimAtFallback`; `join` takes an extra `onSigned` callback and resolves when the server confirms (`joinResult`) on Solana, right after `joinIntent` is sent on EVM.
- EVM modules moved to `src/chain/evm/` unchanged; adapter in `src/chain/evm/index.ts`. Solana adapter in `src/chain/solana/` (Wallet Standard discovery, silent auto-connect via `bump.sol.wallet`, `solana:signTransaction`, ed25519 session key via `@noble/curves`, reads via `@bump/sol-client`).
- Client env: C8 names plus defaults in `src/config/env.ts`; Solana needs `VITE_SOL_MINT` (until `deployments.mint` is set) for `isConfigured()`.
- Root `package.json` gained `@bump/sol-client`, `@solana/kit` 8.4.0, `@wallet-standard/*`, `@solana/wallet-standard-features`, `@noble/curves` 1.9.1.
- Needs from S2: none open. Expected server behaviour: `solJoinTx.expiresAt` in ms, errors `TX_EXPIRED` / `TX_TAMPERED` sent as `error` events, `joinResult.wallet` = base58 as sent in `solJoinPrepare.player`, `/faucet` and `/faucet/status` on the Solana game server HTTP origin, `/leaderboard` and `/matches/:id` on `VITE_SOL_LEADERBOARD_URL` (default: the game server origin).

## S4 Ops + leaderboard

- 2026-10-10 module PUBLISHED in `dfe6344`: `server/src/leaderboard/index.ts` exports exactly `createLeaderboard`, `Leaderboard`, `SettlementRecord` as frozen above (S2 can drop its stub). Storage: `pg` (Postgres via `databaseUrl`) or `@electric-sql/pglite` (in memory when `databaseUrl` is unset); both added to `server/package.json`. Schema `bump_sol` is created idempotently on boot (tables `matches`, `match_players`, `player_stats`, `faucet_claims`).
- Behaviour: `recordSettled` is atomic and idempotent per matchId (a second call is a no-op, stats counted once, at settle time). `recordCancelled` only marks status (a settled match is never downgraded; stats never touched). Faucet cooldown is 24 h (`faucetNextClaimAt` = last claim + 86400, 0 if never). `handleRequest` serves GET `/leaderboard?window=all|7d&limit=`, `/players/:wallet`, `/matches?wallet=&limit=`, `/matches/:matchId`, `/ready` (503 when the DB is unreachable), answers OPTIONS with CORS, returns `null` for any other path. Every JSON body carries `chain` and `decimals`. Wallets are base58 (case kept), matchIds lowercase hex32.
- Limits of the frozen record: no vehicle or open/start times, so `vehicle_id` is 0, `openedAt` = `settledAt`, `startedAt` null, hashes null, `maxPlayers` = number of players.
- Needs from S2: call `createLeaderboard` in `index.ts` (decimals 9, schema from `DATABASE_SCHEMA`), call `handleRequest(request)` before returning 404 for unknown routes (the Colyseus router in `app.ts`), and `recordSettled`/`recordCancelled` hooks.
- `tools/ops/check-solana.sh` (read-only, never reads `*_SECRET`): program id, config PDA, relayer address and SOL balance (via `SOL_RELAYER_PUBKEY` or the keypair file pubkey only), mint supply, server `/metrics.json` and `/health`, leaderboard `/ready`. Env: `SOL_RPC_URL`, `SERVER_URL`, `LEADERBOARD_URL`, `SOL_PROGRAM_ID`, `SOL_MINT`.
- `docs/handoffs/solana/RAILWAY.md` lists the exact `server-sol` settings for the PM. No Railway command was run.

## PM integration log
