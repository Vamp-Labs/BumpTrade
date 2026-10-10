# STATUS — Solana track

Each role appends under its own heading: done, published interfaces (with commit hash), needs from others, blockers. The PM owns the "Decisions" section. Newest entries on top within each section.

## Decisions (PM)

- 2026-10-10: plan drafted (00-overview, 01-contracts, S1–S4). Candra said yes 2026-10-10; S1 and S2 phase A dispatched. Branch `feat/solana` created from `main` @ 7299259.

## S1 Program

- 2026-10-10 (IDL compiles, uncommitted client still in progress): program id `3LDXSuMuzP33VZ31sar4ZN1YB13pta7NRuR6aDJmwVgz` (keypair `solana/target/deploy/bump_arena-keypair.json`, not committed; PM deploys with it). IDL: `solana/idl/bump_arena.json`. Anchor 1.0.1, anchor-spl 1.0.1, classic SPL Token.
- Instructions and args exactly as C2. `settle` and `cancel` take player token accounts as `remaining_accounts` in seat order (writable). Account order: `settle` = operator, result_signer, config, match, vault, treasury, token_program, then ATAs. `join_match` = player, config, match, vault, player_token, token_program. `claim_refund` = config, match, vault, player_token, token_program (no signer needed). `open_match` = operator, config, mint, match, vault, token_program, system_program. `initialize` = admin, config, mint, treasury, token_program, system_program.
- Three errors appended after the C2 list (codes after Unauthorized): `BadRanks`, `BadVehicle` (vehicle_id >= 7), `InvalidParams`. All C2 names keep their position.
- `@bump/sol-client` exports (in progress): generated instruction builders and account decoders, `PROGRAM_ID`, `findConfigPda()`, `findMatchPda(matchId)`, `findVaultPda(matchId)`, `deployments`.

## S2 Core + server

- 2026-10-10 phase A, C4 wire types published in `303a808` (`packages/shared/src/chain/types.ts`, `protocol/messages.ts`): `SolJoinPrepareMessage { matchId, player, sessionKey, vehicleId }`, `SolJoinSubmitMessage { matchId, signedTx }`, `SolJoinTxEvent { t: "solJoinTx", matchId, tx, expiresAt }` (added to `ServerEvent`), constants `SOL_JOIN_PREPARE_MESSAGE = "solJoinPrepare"` and `SOL_JOIN_SUBMIT_MESSAGE = "solJoinSubmit"`, error codes `TX_EXPIRED` and `TX_TAMPERED` in `JoinErrorCode`. `expiresAt` is unix milliseconds (C4 left the unit open). `ClaimSeatMessage.scheme?: "evm" | "ed25519"` (absent = evm). Chain-agnostic `WalletId = string`, `Hex32`, `TxRef`, `ChainId`, `SeatScheme`, `ChainResult` are exported from `@bump/shared`; `JoinResultEvent.wallet`, `SeatEvent.wallet`, `FaucetStatus.wallet`, `txHash` fields and `MatchEndEvent.resultSignature` widened from `Address`/`Hex` to `string` (client typecheck still green).
- Phase A server refactor: `ArenaChain` port in `server/src/chain/ArenaChain.ts`, EVM adapter in `server/src/chain/evm/`, adapter chosen by `CHAIN` (default `solana` per C3, so the Railway EVM `server` service must now set `CHAIN=evm`). Additive port members beyond C3 (needed so Settler, JoinRelay, Faucet and ArenaRoom stay chain-agnostic): `relayerId`, `signerId`, `signResult`, `selfCheck?`, `parseWallet`, `walletKey`. `sessionKeyOf` returns `null` when no key is registered.

## S3 Client

## S4 Ops + leaderboard

## PM integration log
