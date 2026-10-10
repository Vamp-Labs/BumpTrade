# 01 — Smart contracts engineer (R1)

**Goal:** ship `BumpArena`, the escrow-and-settlement contract for BUMP.TRADE staked matches on **Robinhood Chain testnet (chain ID 46630)**.
- Write it, test it, deploy it, verify it on Blockscout.
- Publish its ABI and deployment address as the workspace package `@bump/contracts`, so the game server, client and indexer can build against it.

## Context — read first

1. `docs/handoffs/contracts.md`. It is **authoritative**: C1 (chain), C2 (stake and economy constants, payout rule), **C3 (the full contract spec: functions, rules, events, errors, EIP-712)**, C4 (vehicle IDs), C6 (lifecycle), C8 (env var names), C9 (versions, workspace).
2. `docs/research/robinhood-chain.md`:
   - Network parameters table;
   - §2 EVM behaviour (Osaka-level opcodes; `block.number` is an L1 estimate; `prevrandao` is constant; 96 KB code limit);
   - §5 Tooling (Foundry, Blockscout verifier);
   - §9 Terms;
   - §10 Deployment checklist;
   - Implications → Smart contracts engineer.
3. `docs/research/realtime-architecture.md`:
   - F4 (on chain versus off chain, F4.2 EIP-712, F4.7 anti-cheat);
   - R5 (lifecycle state machine), R6 (split), R7 (security model);
   - Implications → Smart contracts engineer.

   Where R6 says "server supplies payouts", **contracts.md C3 overrides it**: the contract computes payouts.
4. `docs/research/repo-audit-and-tooling.md` A3: the zero-sum audit, which explains why the contract enforces `Σ finalBalances == n × startBalance`.
5. `docs/handoffs/00-overview.md`, sections 3 (D3–D7), 9 and 10.

## Tools — skills and MCP

Use these only if the user has approved and installed them; check `.claude/skills/` and `.mcp.json` in the repo. Invoke each before writing the code it covers.
- **OpenZeppelin `setup-solidity-contracts`:** Foundry and OZ project setup (step D1).
- **OpenZeppelin `develop-secure-contracts`:** composing `EIP712`, `ECDSA`, `ReentrancyGuard`, `Ownable2Step` and `Pausable` (D2).
- **OpenZeppelin Contracts MCP** (`openzeppelin-solidity`): a Wizard baseline for the Ownable and Pausable skeleton.
- **Trail of Bits `secure-workflow-guide`, `guidelines-advisor`, `property-based-testing`:** the invariant suite (D3) and the pre-deploy review (D5).
- **Cyfrin `solidity`:** Foundry conventions and keystore-based deploys.

**If none are installed**, work from:
- https://getfoundry.sh/llms.txt
- https://docs.openzeppelin.com/contracts/5.x/
- https://eips.ethereum.org/EIPS/eip-712
- https://docs.arbitrum.io/llms.txt
- https://docs.robinhood.com/chain/deploy-smart-contracts. This site may fail TLS from this machine; if so, use the research file's §10, which already captures it.

Live chain data: `https://explorer.testnet.chain.robinhood.com/api/v2` (no key needed).

## Owned paths

You may write **only**:
- `contracts/**`: `foundry.toml`, `src/`, `test/`, `script/`, `lib/` (forge install), `abi/`, `deployments/`, `package.json`, `remappings.txt`, `README.md`.

Everything else is read-only for you. Notes:
- `contracts/package.json` declares the name `@bump/contracts`. It must have **no runtime dependencies**; `viem` is a peer only if needed for types.
- If you need a root script or a workspace change, ask the PM, who routes it to R4.

## Responsibilities

- Implement `BumpArena` exactly as contracts.md C3 specifies.
- Prove it with unit, fuzz and invariant tests on Foundry, using anvil locally.
- Produce the EIP-712 test vector that the server's signer must match.
- Deploy to testnet 46630 with a keystore account, verify on Blockscout, and record the deployment.
- Export a typed ABI module and the deployment JSON through `@bump/contracts`.

## Scope

### In scope
- `BumpArena.sol`, its deploy script, tests, fixtures, ABI export and deployment record.
- Gas measurement of `settle` with 2 and 8 players.

### Out of scope
- Anything off chain:
  - the game server and its signer or relayer code (R2);
  - client wallet code (R3);
  - the indexer (R4).
- ERC-20 or stock-token stakes, vehicle NFTs, upgradeability or proxies, account abstraction, fees above 0. All P2 or not planned.
- Funding any account or handling any private key. The user funds accounts and imports keystores.

## Objectives

1. A contract whose total payout can never exceed the pot, that settles at most once, and that always gives players a path to their money (claim, cancel or refund).
2. A frozen ABI and event set that the other three roles can rely on without asking.

## Requirements

- **P0 — Foundry project** in `contracts/`:
  - `solc 0.8.33`, `evm_version = "prague"`, optimizer on (200 runs), `via_ir = false` unless the stack is too deep.
  - OpenZeppelin `v5.6.1` installed with `forge install OpenZeppelin/openzeppelin-contracts@v5.6.1 --no-git` if the repo has no git yet; otherwise without `--no-git`.
  - Remapping `@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/`.
  - `foundry.toml` has `[rpc_endpoints] rh_testnet = "${RH_RPC_URL}"` and `[etherscan] rh_testnet = { key = "empty", chain = 46630, url = "https://explorer.testnet.chain.robinhood.com/api/" }`.
- **P0 — `src/BumpArena.sol`** implements every function, rule, event and custom error in contracts.md C3, with these names and signatures exactly. Specifically:
  - `openMatch` reverts `MatchExists()` if `status != None`. It stores `settleDeadline = joinDeadline + settleWindow`, emits `MatchOpened`, and requires `stake > 0`, `2 <= maxPlayers <= 8`, `startBalance > 0` and `joinDeadline > block.timestamp`.
  - `join` emits `PlayerJoined(matchId, player, sessionKey, vehicleId, seat)` with `seat = previous playerCount`, and adds `msg.value` to `pot`.
  - `startMatch` requires `playerCount >= 2` (else `NotEnoughPlayers()`) and `status == Open`. It sets `Started` and emits `MatchStarted`.
  - `settle`:
    - Check order: status, deadline, lengths and players match, balance sum, ranks permutation (bitmap over 1..n), then the signature via `ECDSA.recover(_hashTypedDataV4(structHash), signature) == signer`.
    - Payouts are `stake * finalBalance / startBalance` (floor).
    - Credit `claimable` and the dust to `treasury`, then emit `PlayerResult` for each i in player order, then `MatchSettled` with `winner = players[i where ranks[i] == 1]` and `resultHash` = the EIP-712 digest.
  - `cancel` and `claimRefund` follow C3. `claim()` is `nonReentrant`, zeroes before it transfers, uses `call`, reverts `NothingToClaim()` on 0, and emits `Claimed`.
  - The pausable functions are `openMatch`, `join`, `startMatch` and `settle`. `claim`, `cancel` and `claimRefund` work while paused.
  - The EIP-712 domain is `EIP712("BumpArena", "1")`. The `Result` typehash string must be exactly as in C3. Each array field is hashed as `keccak256(abi.encodePacked(array))`. `abi.encodePacked` pads every element of a dynamic array to 32 bytes, which is exactly EIP-712's encoding for `address[]`, `uint32[]` and `uint8[]`. Prove it with the test against viem (below).
  - Time uses `block.timestamp` only.
- **P0 — Tests** (`forge test`, anvil):
  - unit tests for every revert path and every event, with exact args via `vm.expectEmit`;
  - a happy path for 2 and for 8 players;
  - cancel before start; anyone-can-cancel after `joinDeadline` with fewer than 2 players;
  - refund after `settleDeadline`; settle blocked after a refund; refund blocked after settle;
  - `claim` reentrancy (attacker contract); `claim` while paused.
- **P0 — Fuzz and invariant tests:**
  - for any valid balances, `Σ payouts + dust == pot`, and every payout goes to a joined player;
  - a match settles at most once;
  - the contract's ETH balance always equals `Σ claimable + Σ pots of unsettled, uncancelled matches minus refunded`;
  - a forged or replayed signature (other `matchId`, other chain ID, other contract) reverts.
- **P0 — EIP-712 vector:**
  - `contracts/test/fixtures/result-vector.json` holds `{ domain, types, primaryType:"Result", message, digest, signerAddress, signature }`, signed with anvil key #0 (public test key; never fund it).
  - `test/ResultVector.t.sol` asserts that `hashResult(message) == digest` and that the signature recovers to `signerAddress`.
  - `script/check-vector.mjs` uses `viem` `hashTypedData` and `recoverTypedDataAddress` to compute the same digest from the JSON; run it with `node`.

    **Note:** this needs `viem` resolvable from `contracts/`. Ask R4 through the PM to add `viem@2.57.4` as a **devDependency** of `@bump/contracts`. If that is not yet available, report it and keep the Solidity side green.
- **P0 — `script/Deploy.s.sol`:**
  - It reads `OWNER_ADDRESS`, `SIGNER_ADDRESS`, `OPERATOR_ADDRESS`, `TREASURY_ADDRESS` and `SETTLE_WINDOW_S` (default 3600) from the environment and deploys.
  - Deploy command (the user supplies the keystore name; never a plaintext key):
    `forge script script/Deploy.s.sol --rpc-url rh_testnet --chain-id 46630 --account $DEPLOYER_ACCOUNT --broadcast --verify --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/`
  - Afterwards, write `deployments/46630.json` in the exact C3 shape (address, `blockNumber`, `txHash`, owner, signer, operator, treasury, `settleWindow`).
  - Confirm `eth_getCode` is non-empty and that Blockscout shows the verified source.
  - **If the deployer is not funded, or `DEPLOYER_ACCOUNT` is not set**, stop at a passing anvil deploy (`forge script ... --fork-url` or anvil) and report "awaiting user: fund deployer + import keystore". Never ask for or touch a private key.
- **P0 — `@bump/contracts` package:**
  - `abi/BumpArena.ts` exports `bumpArenaAbi` `as const`. It is generated by `script/export-abi.mjs`, which reads `out/BumpArena.sol/BumpArena.json`, so it is reproducible.
  - `abi/index.ts` re-exports `bumpArenaAbi` and `deployments`, importing the JSON.
  - `package.json` declares `"name": "@bump/contracts"` and `"exports": { ".": "./abi/index.ts" }`, with scripts `build` (`forge build && node script/export-abi.mjs`), `test` (`forge test`) and `typecheck` (`tsc --noEmit -p .` if a tsconfig is present).
- **P1 — Gas report:** `forge test --gas-report`. Record the `settle` gas for 2 and 8 players in `contracts/README.md` together with the cost at 0.01 gwei.
- **P1 — Pre-deploy review:** run the Trail of Bits guidelines-advisor checklist (if approved). Write a findings list in `contracts/README.md` and fix every High or Medium finding.
- **P2 — An ERC-20 stake variant** (`permit`-based join): design note only. Do not build it.

## Dependencies

- **Before starting:** R4 Part A, the workspace scaffold. R4 creates `contracts/` with an empty `package.json` placeholder, or you create `contracts/package.json` yourself if R4 left only the workspace entry; either is fine because the path is yours.
- **For the testnet deploy:** the user funds the deployer and imports the keystore (`cast wallet import <name> --interactive`), and provides the signer, operator and treasury addresses. The signer and operator addresses come from R2's keys, which the user generates.
- **Consumers:**
  - R2 uses `bumpArenaAbi`, `deployments` and the test vector;
  - R3 uses `bumpArenaAbi` and `deployments`;
  - R4 uses `bumpArenaAbi`, `deployments.BumpArena.address` and `blockNumber`.

  Tell the PM the moment the ABI is frozen; it must match C3.

## Interfaces (from contracts.md; C3 is authoritative)

- **Functions:** `openMatch`, `join`, `startMatch`, `settle(Result, bytes)`, `cancel`, `claimRefund`, `claim`, setters, `pause`/`unpause`, and the views `getMatch`, `getPlayers`, `sessionKeyOf`, `vehicleOf`, `claimable`, `hashResult`, `signer`, `operator`, `treasury`, `settleWindow`, `eip712Domain`.
- **Events:** `MatchOpened`, `PlayerJoined` (including `seat`), `MatchStarted`, `PlayerResult`, `MatchSettled`, `MatchCancelled`, `Refunded`, `Claimed`, `SignerUpdated`, `OperatorUpdated`, `TreasuryUpdated`.
- **EIP-712 type:** `Result(bytes32 matchId,address[] players,uint32[] finalBalances,uint8[] ranks,bytes32 inputLogHash,bytes32 replayHash,uint64 endedAt)`, with domain `BumpArena`/`1`/`46630`/`<address>`.

## Constraints

- Chain rules:
  - no `block.number` for time;
  - no `prevrandao`;
  - no reliance on ordering;
  - max code size 96 KB;
  - the sequencer silently drops transactions from sanctioned addresses (relevant to retries, not to code).
- Pull payments only; never push ETH inside a loop.
- No upgradeability or proxies in v1.
- **Never read, write or echo `.env*` files or private keys.** Deploy only with `--account <keystore>`. Do not paste the anvil test key anywhere except the fixture's documented test signer.
- **Standing rules:**
  - English everywhere.
  - **No comments in code**, NatSpec included. Make names self-explanatory.
  - No new dependency without asking the PM.
  - Invoke the approved skills before writing the code they cover.
  - No git commit, push, `add -A` or `add .`.
  - Write only inside `contracts/**`.
  - Report a red test as red.
- Memory: do not run `forge build` while another role runs `vite build` or `ponder build` (14 GB machine). Ask the PM if unsure.

## Deliverables

- **P0:**
  - `contracts/src/BumpArena.sol`
  - `contracts/test/*.t.sol`, including the invariant and fuzz tests and `ResultVector.t.sol`
  - `contracts/test/fixtures/result-vector.json`
  - `contracts/script/Deploy.s.sol`, `contracts/script/export-abi.mjs`, `contracts/script/check-vector.mjs`
  - `contracts/abi/BumpArena.ts`, `contracts/abi/index.ts`, `contracts/package.json`
  - `contracts/deployments/46630.json`. If the user has not funded the deployer, deliver it as "pending" with the anvil deploy proven.
- **P1:** the gas report and the review findings in `contracts/README.md`.

## Acceptance criteria

1. `cd contracts && forge build` exits 0 with no warnings in `src/`.
2. `forge test` exits 0, with at least one test per custom error and per event. The invariant run uses at least 256 runs × depth 64 and shows no failures.
3. `forge test --match-contract ResultVector` passes, and `node contracts/script/check-vector.mjs` prints the same digest as the JSON and exits 0.
4. The ABI in `contracts/abi/BumpArena.ts` matches contracts.md C3 for every function, event and error name and type. The PM diffs it.
5. `contracts/deployments/46630.json` exists in the C3 shape:
   - `cast code <address> --rpc-url https://rpc.testnet.chain.robinhood.com` is non-empty;
   - `https://explorer.testnet.chain.robinhood.com/address/<address>` shows "verified";
   - `cast call <address> "signer()(address)"` returns `SIGNER_ADDRESS`.

   Alternatively, the report says exactly what the user must do to unblock the deploy.
6. `grep -rnE "//|/\*" contracts/src contracts/script/*.sol` finds no comments. The SPDX licence line is the only allowed exception.
7. No file outside `contracts/**` was created or modified.
