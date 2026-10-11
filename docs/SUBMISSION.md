# BUMP.TRADE: Colosseum Crypto World's Fair submission draft

Fields marked **[FILL]** need Candra's input. Nothing below claims users, revenue or traction that does not exist.

## Product name and one-line description

**BUMP.TRADE**: HIT THEIR CAR. TAKE THEIR CASH. TRY NOT TO GET LIQUIDATED. A real-time 3D bumper-car wager arena where every hit moves balance and the pot pays out on Solana in one transaction. Free to try, no SOL needed, free test tokens only.

## Short description (for the form)

HIT THEIR CAR. TAKE THEIR CASH. TRY NOT TO GET LIQUIDATED.

BUMP.TRADE is a real-time multiplayer wager arena built for people who have never owned crypto. A player opens a link, connects any Solana wallet, claims free BUMP tokens and joins a match with **one signature and no SOL**: the game server pays all network fees and builds the transaction, the player only signs. Every player stakes 100 BUMP and starts with a balance; every hit moves balance from the car you hit to you, and zero balance means liquidated. Each match escrows stakes in an Anchor program on Solana, the authoritative server plays the match (60 Hz physics, 30 Hz snapshots), and the result is settled on-chain with each player paid `stake x final balance / start balance`. If the server ever fails to settle, any player's stake is refundable after a deadline.

It is also a small, working template for a hard problem in crypto gaming: fast, fair real-time play with on-chain settlement and a zero-friction first session. Everything runs on free devnet test tokens; there is no real money.

## Blockchains and tools integrated

- **Solana (devnet, default)**: Anchor program `bump_arena` (escrow, gasless join, settle, refund), SPL token, Wallet Standard (Phantom, Backpack, Solflare), `@solana/kit`, Codama-generated client, LiteSVM tests.
- **Robinhood Chain testnet (second chain, adapter kept)**: Foundry contracts, EIP-712 gasless join, Ponder indexer. Not hosted for this submission; code and deployment record are in the repo.
- Game stack: three.js, Rapier physics, Colyseus (authoritative multiplayer), Vite, TypeScript.
- Infrastructure: Railway (Singapore) for client, game server and Postgres; Helius RPC behind a server-side proxy.

## Links

- GitHub: https://github.com/Vamp-Labs/BumpTrade (private; access for hackathon@colosseum.com must be granted before submitting, or make the repository public)
- Live demo: https://client-production-90d9.up.railway.app
- Program on devnet: `3LDXSuMuzP33VZ31sar4ZN1YB13pta7NRuR6aDJmwVgz` (explorer: https://explorer.solana.com/address/3LDXSuMuzP33VZ31sar4ZN1YB13pta7NRuR6aDJmwVgz?cluster=devnet)
- Presentation video (2-3 min): same video as the demo below (1:20, music-video format synced to the song, with step captions): https://youtu.be/JhCH1LgYiXM
- Product demo video (max 3 min): https://youtu.be/JhCH1LgYiXM (file: `assets/bump-video/bump_trade_demo_colosseum_zero_balance.mp4`, outside this repo)

## Team **[FILL]**

- Candra (Kurniawan Candra Mahardika), lead. Background, location, roles of other teammates: **[FILL]**
- Logo / graphic: **[FILL]** (renders are in `docs/screenshots/` and `renders/`)

## Disclosure of past development work

- Development of BUMP.TRADE started on 2026-10-06, inside the contest period (2026-09-14 to 2026-10-12). All game, server, contract, program, client and tooling code in the repository was written during the contest period. No code from earlier products was reused. Third-party open source is used as dependencies (listed in the lockfiles; OpenZeppelin Contracts is a pinned git submodule).
- The project was developed with AI coding agents (Claude Code) under the team's direction; roles, interfaces and acceptance tests were specified up front (`docs/handoffs/`), and all code was reviewed and verified by running tests and end-to-end checks.
- The Robinhood Chain version was built first (tag `v0.1-robinhood-testnet`) and the Solana version was built on top of it (tag `v0.2-solana-devnet`). **[FILL: confirm any earlier art/asset sources, e.g. 3D models generated in Blender during the contest period.]**

## What works today (verified)

- Full two-player match on Solana devnet, end to end, with two real browsers (mock Wallet Standard wallets): faucet, join with one signature (relayer is fee payer, player SOL balance unchanged), lobby fill timer, match, on-chain settle with payouts matching `stake x final / start`, empty vault, leaderboard.
- 34 program tests (LiteSVM), 50 server tests, 109 EVM contract tests, 11 shared tests, plus a two-browser E2E harness (`tools/e2e/solana-local`).
- Compute: `join_match` about 19k CU, `settle` about 29k CU (2 players) and 70k CU (8 players).

## Honest limits

- Devnet only; the program is unaudited.
- The server is authoritative and signs match results; the on-chain program cannot verify gameplay. Mitigation today: refund path after the settle deadline. Next step: settlement with verifiable replays and multi-signer results.
- Only tested with mock wallets in automation; manual checks with real wallets are tracked as the first item in the roadmap below. **[FILL: update after manual Phantom test]**
- Fees: each match costs the operator roughly 0.007 SOL of rent that is not reclaimed (no close instruction yet).

## Go-to-market **[FILL / review]**

**Who:** two audiences. (1) Players who want a short competitive game and never touched a wallet. (2) Games and consumer apps that want a drop-in "sign once, no SOL" real-time match layer on Solana.

**Wedge:** zero-friction first match. The usual funnel (install wallet, buy SOL, approve, wait) is replaced by: open link, connect, claim, sign once.

**Distribution plan (to execute, not yet done):**
- Short gameplay clips on X and TikTok (a 60-second promo already exists in `bump-trade-video`, hook: "Last car standing wins").
- Solana and wallet communities (Phantom/Backpack ecosystems), hackathon demo days, and tournament-style weekend lobbies.
- Creator-friendly format: shareable match links and a public leaderboard.

**Revenue hypotheses (none validated yet):** match rake once real-value tokens are introduced (with legal review), cosmetic vehicle skins, sponsored tournaments, and a licensable matchmaking + gasless-join SDK for other games.

## Demand validation **[FILL]**

No demand data exists yet. Planned experiments for the next 30 days, each with a pass/fail threshold to be set by the team: (1) landing-page and demo-link conversion from the promo clip (visit to first signed join), (2) day-1 and day-7 return rate of the same wallet, (3) number of matches started without any SOL in the wallet, (4) interviews with 10 Solana game builders about the gasless-join layer.

## Roadmap

1. Manual test with Phantom, Backpack and Solflare on devnet; fix wallet-specific issues.
2. Client-side prediction for lower perceived latency; regional servers.
3. Close instruction to reclaim rent; multiple operators; audit.
4. Verifiable replays for settlement; tournament mode.
5. Mainnet launch with real-value stakes only after legal review and audit.
