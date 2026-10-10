# @bump/contracts

`MockBUMP` (a free ERC20 stake token) and `BumpArena` (escrow and settlement for BUMP.TRADE staked matches) on Robinhood Chain testnet (chain ID 46630). Play is gasless: the player only signs a `JoinIntent`, the relayer pays gas. The interface is frozen in `docs/handoffs/contracts.md` C3 (revised by `docs/handoffs/05-gasless-mock-token.md`).

## Layout

- `src/MockBUMP.sol`: ERC20 + Permit, `claim(address)` (1000 BUMP per recipient per 24 h), `setArena` (one-time allowance bypass for the arena).
- `src/BumpArena.sol`: the arena. Token stakes, `joinWithSig`, direct `join`, pushed payouts and refunds.
- `test/`: unit (`BumpArena.t.sol`, `BumpArenaJoin.t.sol`, `MockBUMP.t.sol`), fuzz (`BumpArenaFuzz.t.sol`, plus fuzz in `MockBUMP.t.sol`), invariant (`BumpArenaInvariant.t.sol`) and EIP-712 vector tests (`ResultVector.t.sol`, `JoinIntentVector.t.sol`).
- `test/fixtures/result-vector.json` (anvil key #0) and `test/fixtures/join-vector.json` (anvil key #1): signing vectors for the server and client. Public test keys, never fund them. Regenerate with `node script/make-vector.mjs` and `node script/make-join-vector.mjs`.
- `script/Deploy.s.sol`: deploys the token, the arena, then `token.setArena(arena)`. `script/record-deployment.mjs` writes `deployments/46630.json` from the broadcast file and checks the wiring on chain. `script/export-abi.mjs` writes `abi/BumpArena.ts` and `abi/MockBUMP.ts`. `script/check-vector.mjs` re-derives both vector digests with viem.
- `abi/index.ts`: exports `bumpArenaAbi`, `mockBumpAbi` and `deployments`.
- `deployments/46630.json`: `"status": "pending"` with zero addresses until the testnet deploy is recorded. Consumers must not use an address while `status` is present.

## Commands

```
pnpm --filter @bump/contracts build
pnpm --filter @bump/contracts test
pnpm --filter @bump/contracts typecheck
pnpm --filter @bump/contracts check-vector
```

Wrap builds in `flock /tmp/bump-build.lock` on this machine.

## Deploy to testnet (run by the user, never by an agent)

The deployer must be the relayer account in the Foundry keystore (it becomes the `MockBUMP` owner so the script can call `setArena`, and it needs a little ETH). From `contracts/`:

```
export RH_RPC_URL=https://rpc.testnet.chain.robinhood.com
export DEPLOYER_ACCOUNT=<keystore name of the relayer key>
export OWNER_ADDRESS=0x...
export SIGNER_ADDRESS=0x...
export OPERATOR_ADDRESS=0x...
export TREASURY_ADDRESS=0x...
export SETTLE_WINDOW_S=3600

forge script script/Deploy.s.sol --rpc-url rh_testnet --chain-id 46630 --account $DEPLOYER_ACCOUNT --broadcast --verify --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/

node script/record-deployment.mjs
```

`SIGNER_ADDRESS` is the address of the server's `SIGNER_PRIVATE_KEY`, `OPERATOR_ADDRESS` is the address of `RELAYER_PRIVATE_KEY`. Check afterwards:

```
cast call <arena> "token()(address)" --rpc-url $RH_RPC_URL
cast call <token> "arena()(address)" --rpc-url $RH_RPC_URL
cast call <arena> "signer()(address)" --rpc-url $RH_RPC_URL
```

and open `https://explorer.testnet.chain.robinhood.com/address/<address>` to confirm the source is verified.

## Gas (measured in Foundry)

| Call | Gas | Cost at 0.01 gwei |
|---|---|---|
| `joinWithSig`, first player in a match | 199,194 | 0.000002 ETH |
| `joinWithSig`, second player | 167,811 | 0.0000017 ETH |
| `joinWithSig`, eighth player | 147,889 | 0.0000015 ETH |
| `settle`, 2 players | 105,932 | 0.0000011 ETH |
| `settle`, 8 players | 212,133 | 0.0000021 ETH |
| `MockBUMP.claim`, first claim for a wallet | about 92,000 | 0.0000009 ETH |
| `openMatch` | 74,685 | |
| `startMatch` | 35,071 | |

Join and settle figures include the token transfers. Runtime size: `BumpArena` 10.7 KB, `MockBUMP` 4.7 KB. Deployment of both plus `setArena` is estimated at 4.8M gas.

## Deviations from 05 (and additive changes to C3)

- `JoinIntent.matchId` is `bytes32`, not `uint256`, because the whole system (events, `Result`, server) already uses a `bytes32` match id.
- `claimRefund` keeps its name but now takes `(bytes32 matchId, address player)` and is callable by anyone, as 05 requires; it pushes the stake instead of crediting it.
- `BumpArena` constructor gains a trailing `token_` argument. `MockBUMP` takes `owner_` and the deploy script passes the broadcasting account.
- Removed: `claim()`, `claimable()`, the arena `Claimed` event, `WrongStake`, `NothingToClaim`, `TransferFailed`. Added: `IntentExpired`, `joinWithSig`, `hashJoin`, `JOIN_INTENT_TYPEHASH`, `token()`.
- `joinWithSig` accepts EOA ECDSA signatures only (no ERC-1271), callable by anyone with a valid signature.
- `cancel` still emits only `MatchCancelled`, not one `Refunded` per player. The indexer should treat cancelled-match players as refunded implicitly.
- `pot` in `getMatch` is the total staked and does not shrink on settle, cancel or refund.
- Extra errors `InvalidMatchParams`, `ZeroAddress`; extra constants `RESULT_TYPEHASH`, `JOIN_INTENT_TYPEHASH`, `VEHICLE_COUNT`, `MAX_PLAYERS_LIMIT`; OZ Ownable2Step and Pausable entries.
- Token reverts (`ERC20InsufficientBalance`, `ERC20InsufficientAllowance`) bubble up through the arena unchanged, so decode errors with both ABIs.
- The Foundry lint rule `arbitrary-send-erc20` is disabled: `transferFrom(player, ...)` is only reached with `player == msg.sender` (`join`) or a signature by `player` (`joinWithSig`).

## Testnet-only token trust (MockBUMP)

`setArena` makes `transferFrom` skip the allowance check when the caller is the arena. That lets the arena pull stakes with no approve and no permit, which is what makes play gasless. It also means the arena can move any holder's BUMP. The arena only pulls a stake from `msg.sender` (`join`) or from a player who signed the exact `JoinIntent` (`joinWithSig`), but this design must never be reused for a token with real value. `setArena` is owner-only and can be called once; the owner has no other power, and `claim` is the only mint path.

## Pre-deploy review (manual; the Trail of Bits skills were not installed)

No High or Medium findings. Notes:

- Trust: the signer can sign any distribution that sums to `n x startBalance`. Compromise of the signer key can redirect the pots of matches that are Started and unsettled. Funds of settled matches and other matches are not reachable. Mitigation: `setSigner` (owner) and `pause`.
- Liveness: if the signer or operator disappears, anyone can trigger `claimRefund(matchId, player)` for every player after `settleDeadline`. Pausing never blocks `cancel` or `claimRefund`.
- `joinWithSig` can be submitted by anyone, but the signed fields fix the player, session key and vehicle, so front-running it only pays the gas for the player. The intent cannot be replayed (`AlreadyJoined`), is bound to the arena address and chain id, and expires at `deadline`.
- Push payments: `settle`, `cancel` and `claimRefund` are `nonReentrant`, set state before transferring, and use `SafeERC20`. The token is the trusted `MockBUMP` with no transfer hooks, and every transfer is to a player or `treasury`. A token that could block a recipient would make `settle` revert for that match until the refund path opens, so the arena must only be deployed with this token.
- `startMatch` has no join deadline check (per C3). The operator may start an Open match with 2 or more players after `joinDeadline`.
- `settle` is permissionless by design. Front-running it is harmless because the payouts are fixed by the signed result.
- The ranks bitmap and balance sum are computed in `uint256`, so `uint32` balances cannot overflow.
- Time uses `block.timestamp` only. No `block.number`, no `prevrandao`.
- Rounding dust (at most `n - 1` base units per match) is transferred to `treasury` inside `settle`.
- The arena has no payable function and no `receive`; the invariant suite checks its ETH balance stays 0.
- The Foundry linter rules `unsafe-typecast` (player count bounded by 8), `block-timestamp`, `asm-keccak256`, `require-revert-in-loop`, `reentrancy-events` and `arbitrary-send-erc20` are disabled in `foundry.toml`; each is a deliberate pattern here.
