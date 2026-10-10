# 01 — Frozen interfaces (Solana + EVM adapters)

Status: DRAFT until Candra says yes; then FROZEN. Agents never edit this file. Change requests go to `STATUS.md`.

## C1. Identifiers

- `ChainId`: `"solana" | "evm"`. Default `"solana"`.
- `matchId`: 32 bytes, always carried as a `0x`-prefixed 64-hex string in shared code and messages. Solana uses the raw 32 bytes as PDA seed; EVM uses it as `bytes32`.
- `WalletId`: `string`. EVM = lowercase `0x` address. Solana = base58 public key (case-sensitive, never lowercased).
- Token amounts: `bigint` in base units. Decimals: EVM BUMP 18, Solana BUMP 9. Default stake = 100 BUMP, faucet = 1000 BUMP, start balance = 100.

## C2. Solana program `bump_arena` (Anchor, devnet)

Workspace: `solana/` (Anchor.toml at `solana/Anchor.toml`, program at `solana/programs/bump_arena`). Classic SPL Token program, BUMP mint with 9 decimals; mint authority is the server's mint-authority key (faucet mints off-program).

Accounts:

| Account | Seeds | Fields |
|---|---|---|
| `Config` | `["config"]` | `admin: Pubkey`, `operator: Pubkey`, `result_signer: Pubkey`, `mint: Pubkey`, `treasury: Pubkey` (token account), `stake: u64`, `start_balance: u32`, `settle_window_s: i64`, `paused: bool`, `bump: u8` |
| `Match` | `["match", match_id]` | `match_id: [u8;32]`, `status: u8` (0 None, 1 Open, 2 Started, 3 Settled, 4 Cancelled, 5 Refunding), `stake: u64`, `start_balance: u32`, `max_players: u8`, `player_count: u8`, `players: [Pubkey;8]`, `session_keys: [Pubkey;8]`, `vehicles: [u8;8]`, `refunded: u8` (bitmask), `join_deadline: i64`, `settle_deadline: i64`, `bump: u8`, `vault_bump: u8` |
| vault | `["vault", match_id]` | SPL token account for `mint`, authority = `Match` PDA |

Instructions (names are final; arg order is final):

| Instruction | Args | Required signers | Effect |
|---|---|---|---|
| `initialize` | `operator, result_signer, treasury, stake, start_balance, settle_window_s` | `admin` (payer) | create `Config` |
| `open_match` | `match_id: [u8;32], max_players: u8, join_deadline: i64` | `operator` (payer) | create `Match` + vault, status Open |
| `join_match` | `match_id, session_key: Pubkey, vehicle_id: u8` | `player` (token authority). Fee payer may be anyone (the relayer in practice) | transfer `stake` from player's ATA to vault; record seat; error if full, closed, past deadline or already joined |
| `start_match` | `match_id` | `operator` | Open → Started (requires >= 2 players) |
| `settle` | `match_id, final_balances: Vec<u32>, ranks: Vec<u8>, input_log_hash: [u8;32], replay_hash: [u8;32], ended_at: i64` | `operator` and `result_signer` | requires Started and before `settle_deadline`; `final_balances` length = player_count and sum = `start_balance * player_count`; payout_i = stake * balance_i / start_balance (floor), dust to treasury; transfers to player ATAs passed as `remaining_accounts` in seat order; status Settled |
| `cancel` | `match_id` | `operator` | Open (any time) or Started with < 2 players: refund every seat; status Cancelled |
| `claim_refund` | `match_id, player: Pubkey` | anyone | refund that seat once (bitmask), status Refunding, when either: Started/Refunding and now > `settle_deadline`; or still Open and now > `join_deadline + settle_window_s` (operator vanished) |
| `set_paused` | `paused: bool` | `admin` | pause new opens/joins |

Events (`emit!`): `MatchOpened{match_id, stake, max_players, join_deadline}`, `PlayerJoined{match_id, player, session_key, vehicle_id, seat}`, `MatchStarted{match_id, settle_deadline}`, `PlayerResult{match_id, player, final_balance, rank, payout}`, `MatchSettled{match_id, pot, dust, input_log_hash, replay_hash}`, `MatchCancelled{match_id}`, `Refunded{match_id, player, amount}`.

Errors (`#[error_code]`, names final): `Paused, MatchNotOpen, MatchFull, JoinClosed, AlreadyJoined, NotEnoughPlayers, BadStatus, SettleWindowOver, SettleWindowOpen, LengthMismatch, NotZeroSum, BadRemainingAccounts, AlreadyRefunded, NotAPlayer, Unauthorized`.

Client: Codama-generated TypeScript client for `@solana/kit` in `packages/sol-client` (package name `@bump/sol-client`), exporting instruction builders, account decoders, PDA helpers (`findConfigPda`, `findMatchPda(matchId)`, `findVaultPda(matchId)`), `PROGRAM_ID`, and `deployments` (`{ cluster, programId, mint, treasury, configPda, slot, txSig }` from `solana/deployments/devnet.json`).

## C3. Server port `ArenaChain` (replaces direct use of `ChainGateway`)

File: `server/src/chain/ArenaChain.ts`. The EVM adapter wraps today's `ViemChainGateway` with identical behaviour; the Solana adapter uses `@bump/sol-client` + `@solana/kit`.

```ts
export type ChainId = "solana" | "evm";
export interface ArenaChain {
  readonly id: ChainId;
  readonly decimals: number;
  openMatch(p: { matchId: Hex32; stake: bigint; maxPlayers: number; startBalance: number; joinDeadline: bigint }): Promise<TxRef>;
  startMatch(matchId: Hex32): Promise<TxRef>;
  cancel(matchId: Hex32): Promise<TxRef>;
  settle(result: ChainResult, onSubmitted?: (tx: TxRef) => void): Promise<TxRef>; // signing happens inside the adapter
  getMatch(matchId: Hex32): Promise<OnChainMatch>;
  getPlayers(matchId: Hex32): Promise<WalletId[]>;
  sessionKeyOf(matchId: Hex32, wallet: WalletId): Promise<string | null>; // EVM 0x address, Solana base58
  vehicleOf(matchId: Hex32, wallet: WalletId): Promise<number>;
  claimRefund(matchId: Hex32, player: WalletId): Promise<TxRef>;
  faucetClaim(wallet: WalletId): Promise<TxRef>;
  tokenBalanceOf(wallet: WalletId): Promise<bigint>;
  nextClaimAt(wallet: WalletId): Promise<number>; // unix seconds, 0 = now
  relayerBalance(): Promise<bigint>; // wei or lamports
  explorerTx(tx: TxRef): string;
}
export type Hex32 = `0x${string}`;
export type TxRef = string; // EVM tx hash or Solana signature
export interface ChainResult { matchId: Hex32; players: WalletId[]; finalBalances: number[]; ranks: number[]; inputLogHash: Hex32; replayHash: Hex32; endedAt: bigint }
```

`OnChainMatch` keeps today's fields (`stake, startBalance, maxPlayers, playerCount, status, joinDeadline, settleDeadline, pot`). Server picks the adapter from `CHAIN` env (default `solana`). `RelayerGuard` compares against `RELAYER_MIN_BALANCE` in the chain's native unit (EVM keeps `RELAYER_MIN_BALANCE_WEI` working).

## C4. Join protocol

EVM (unchanged): client → `joinIntent { intent, signature }` (EIP-712) → server relays `joinWithSig` → `ev joinResult`.

Solana (new, one wallet popup, player pays nothing):

1. client → `solJoinPrepare { matchId, player, sessionKey, vehicleId }` (sessionKey = base58 ed25519 public key generated in the browser).
2. server validates (rate limits, balance >= stake, match Open, seat free), builds a `join_match` transaction with fee payer = relayer, recent blockhash, the player as the only other signer; sends `ev solJoinTx { matchId, tx: base64 (unsigned wire tx), expiresAt }`.
3. client asks the wallet `solana:signTransaction` (Wallet Standard), sends `solJoinSubmit { matchId, signedTx: base64 }`.
4. server checks the message bytes are byte-identical to what it built (anti-tamper), adds the relayer signature, sends, confirms (`confirmed`), replies `ev joinResult { matchId, wallet, seat, txHash }` (txHash = signature). Errors reuse `JoinErrorCode` plus `TX_EXPIRED`, `TX_TAMPERED`.

Faucet is the same HTTP API on both servers: `POST /faucet {wallet}` → `{ txHash, nextClaimAt }`; Solana creates the player's ATA if missing (relayer pays rent) and mints 1000 BUMP; cooldown 24 h per wallet is enforced server-side (Postgres-backed on Solana).

## C5. Seat proof (claimSeat)

`ClaimSeatMessage` gains `scheme: "evm" | "ed25519"` (default `"evm"` when absent, so the EVM client keeps working). The signed text is `seatMessage({ matchId, wallet, roomId, issuedAt })` unchanged. `"ed25519"`: signature = base58 or base64 of a detached ed25519 signature over the UTF-8 bytes, verified against `sessionKeyOf` from chain.

## C6. Client port `ClientChain`

File: `src/chain/port.ts`. EVM adapter wraps today's modules (`wallet.ts`, `intent.ts`, `arena.ts`, `token.ts`, `sessionKey.ts`) with identical behaviour.

```ts
export interface ClientChain {
  readonly id: "solana" | "evm";
  readonly label: string;          // "Solana Devnet" | "Robinhood Chain Testnet"
  readonly decimals: number;
  wallet: ChainWallet;             // discover(), list(), connect(id, silent?), disconnect(forget?), subscribe(), getState()
  join(ctx: { net: NetClient; matchId: string; vehicleId: number; joinDeadline: number }): Promise<void>; // runs the chain's join protocol (C4) and resolves when submitted
  readMatch(matchId: string): Promise<MatchSnapshot>;
  readSessionKeyOf(matchId: string, wallet: string): Promise<string | null>;
  tokenBalance(wallet: string): Promise<bigint>;
  createSessionKey(matchId: string): SessionKeyHandle;   // EVM secp256k1, Solana ed25519; persisted per match in sessionStorage
  loadSessionKey(matchId: string): SessionKeyHandle | null;
  explorerTx(tx: string): string;
  explorerAddress(addr: string): string;
}
```

`SessionKeyHandle` = `{ publicId: string; scheme: "evm" | "ed25519"; signSeat(text: string): Promise<string> }`. `getActiveChain()` returns the selected chain; the selection persists in `localStorage` key `bump.chain`, default `solana`.

## C7. Leaderboard API

Same JSON shape as today's indexer for both chains (`/leaderboard?window=all|7d&limit=`, `/players/:wallet`, `/matches/:matchId`, `/ready`; fields `stakeAmount`, `potAmount`, `payoutAmount`, `totalPayoutAmount`, `totalStakeAmount`, `netPnlAmount`, decimal strings in base units). Solana: served by `server-sol` from Postgres schema `bump_sol` (written by S4's leaderboard writer after `settle` is confirmed, with `settleTx` = signature). EVM: unchanged Ponder indexer. Response adds `"chain": "solana" | "evm"` and `"decimals"`.

## C8. Environment names

Server (Solana): `CHAIN=solana`, `SOL_CLUSTER=devnet`, `SOL_RPC_URL`, `SOL_WS_URL` (optional), `SOL_PROGRAM_ID`, `SOL_MINT`, `SOL_TREASURY`, `SOL_RELAYER_SECRET`, `SOL_RESULT_SIGNER_SECRET`, `SOL_MINT_AUTHORITY_SECRET` (base58 64-byte secret keys), `RELAYER_MIN_BALANCE` (lamports, default 50000000), `DATABASE_URL`, `DATABASE_SCHEMA=bump_sol`, plus the existing game env (`STAKE_AMOUNT` in base units, `START_BALANCE`, `MATCH_DURATION_S`, `JOIN_WINDOW_S`, `FILL_TIMER_S`, `MIN_PLAYERS`, `MAX_PLAYERS`, `CORS_ORIGINS`, limits).

Server (EVM): unchanged, plus `CHAIN=evm`.

Client: `VITE_CHAIN_DEFAULT=solana`, `VITE_SOL_CLUSTER`, `VITE_SOL_RPC_URL`, `VITE_SOL_PROGRAM_ID`, `VITE_SOL_MINT`, `VITE_SOL_GAME_SERVER_URL`, `VITE_SOL_LEADERBOARD_URL`, `VITE_SOL_EXPLORER_URL`; existing `VITE_*` names stay for EVM.

Deploy keys (PM only, never in the repo): keypair files under `~/.config/solana/bump/` (`deployer.json` = program upgrade authority and config admin, `relayer.json`, `result-signer.json`, `mint-authority.json`).
