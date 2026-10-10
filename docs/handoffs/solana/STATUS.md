# STATUS — Solana track

Each role appends under its own heading: done, published interfaces (with commit hash), needs from others, blockers. The PM owns the "Decisions" section. Newest entries on top within each section.

## Decisions (PM)

- 2026-10-10: plan drafted (00-overview, 01-contracts, S1–S4). Candra said yes 2026-10-10; S1 and S2 phase A dispatched. Branch `feat/solana` created from `main` @ 7299259.

## S1 Program

## S2 Core + server

- 2026-10-10 phase A, C4 wire types published in `303a808` (`packages/shared/src/chain/types.ts`, `protocol/messages.ts`): `SolJoinPrepareMessage { matchId, player, sessionKey, vehicleId }`, `SolJoinSubmitMessage { matchId, signedTx }`, `SolJoinTxEvent { t: "solJoinTx", matchId, tx, expiresAt }` (added to `ServerEvent`), constants `SOL_JOIN_PREPARE_MESSAGE = "solJoinPrepare"` and `SOL_JOIN_SUBMIT_MESSAGE = "solJoinSubmit"`, error codes `TX_EXPIRED` and `TX_TAMPERED` in `JoinErrorCode`. `expiresAt` is unix milliseconds (C4 left the unit open). `ClaimSeatMessage.scheme?: "evm" | "ed25519"` (absent = evm). Chain-agnostic `WalletId = string`, `Hex32`, `TxRef`, `ChainId`, `SeatScheme`, `ChainResult` are exported from `@bump/shared`; `JoinResultEvent.wallet`, `SeatEvent.wallet`, `FaucetStatus.wallet`, `txHash` fields and `MatchEndEvent.resultSignature` widened from `Address`/`Hex` to `string` (client typecheck still green).
- Phase A server refactor: `ArenaChain` port in `server/src/chain/ArenaChain.ts`, EVM adapter in `server/src/chain/evm/`, adapter chosen by `CHAIN` (default `solana` per C3, so the Railway EVM `server` service must now set `CHAIN=evm`). Additive port members beyond C3 (needed so Settler, JoinRelay, Faucet and ArenaRoom stay chain-agnostic): `relayerId`, `signerId`, `signResult`, `selfCheck?`, `parseWallet`, `walletKey`. `sessionKeyOf` returns `null` when no key is registered.

## S3 Client

## S4 Ops + leaderboard

## PM integration log
