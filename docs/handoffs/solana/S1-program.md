# S1 — Solana program `bump_arena` (Anchor)

Read first: `00-overview.md`, `01-contracts.md` (C1, C2 are your spec), `contracts/src/BumpArena.sol` and `contracts/test/` (the EVM version you are porting; same lifecycle, same payout maths), `STATUS.md`. Load the `solana-dev` skill.

## Deliver

1. Anchor workspace in `solana/` (`Anchor.toml`, `programs/bump_arena`, tests). Use the installed toolchain (anchor-cli 1.0.1, solana-cli 3.1.14, rust 1.96); confirm the matching `anchor-lang` / `anchor-spl` versions from current docs before writing code.
2. Every account, instruction, event and error exactly as in C2. Classic SPL Token, mint with 9 decimals. PDAs: `["config"]`, `["match", match_id]`, `["vault", match_id]`.
3. Tests (LiteSVM or Mollusk preferred, otherwise `anchor test` on a local validator), at least:
   - initialize; open; 2- and 8-player joins; join errors (full, closed, past deadline, double join, paused, wrong mint);
   - start requires >= 2 players; settle happy path with exact token balances, dust to treasury, vault empty afterwards;
   - settle rejects: missing result_signer, missing operator, length mismatch, non zero-sum, wrong/misordered remaining accounts, after settle window;
   - cancel refunds everyone; claim_refund after settle window (once per seat) and for an abandoned Open match;
   - authority checks on every operator/admin instruction.
4. Invariant style property test (can be a loop of random scenarios): vault balance = stake x unsettled seats; total supply conserved except faucet mints.
5. Deploy script `solana/scripts/deploy-devnet.ts` (or a shell script) that: deploys the program with the deployer keypair path from `ANCHOR_WALLET`/`--provider.wallet`, creates the BUMP mint (mint authority = `SOL_MINT_AUTHORITY` pubkey given as an argument), creates the treasury token account, calls `initialize`, and writes `solana/deployments/devnet.json` (`cluster, programId, mint, treasury, configPda, slot, txSig`). DO NOT run it against devnet: the PM runs it. Prove it works against a local validator (`solana-test-validator`) and delete that local output afterwards.
6. Codama client: generate a `@solana/kit` TypeScript client from the IDL into `packages/sol-client` (`@bump/sol-client`, workspace package with `package.json`, `tsconfig.json`, `src/index.ts` re-exporting the generated code, PDA helpers `findConfigPda`, `findMatchPda(matchId: Uint8Array | hex string)`, `findVaultPda`, `PROGRAM_ID`, and `deployments` loaded from `solana/deployments/devnet.json` with a clearly pending placeholder until the PM deploys). Add it to `pnpm-workspace.yaml` packages (that one-line edit is allowed).
7. `solana/README.md`: build, test, deploy commands, account layout, and the exact command the PM must run.

## Constraints

- Own only `solana/`, `packages/sol-client/` and the single line in `pnpm-workspace.yaml`.
- No devnet/mainnet transactions, no real keys; tests generate throwaway keys.
- `flock /tmp/bump-build.lock` around `anchor build`/`cargo` and tests; Rust builds are heavy on 14 GB RAM, so build one crate at a time.
- Publish the program id (the keypair under `solana/target/deploy/` is fine for devnet; do not commit `target/`) and the client exports in `STATUS.md` as soon as the IDL compiles, because S2 and S3 depend on it.

## Report

Files, test results (counts), compute units of `join_match` and `settle` (2 and 8 players), account sizes and rent, deviations from C2 with reasons, the deploy command for the PM.
