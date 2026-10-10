# Robinhood Chain testnet

Research date: 2026-10-09 (all URLs read on this date). Robinhood's sites (`docs.robinhood.com`, `cdn.robinhood.com`, `faucet.testnet.chain.robinhood.com`) refuse direct TLS from this machine (`SSLV3_ALERT_HANDSHAKE_FAILURE`), so they were read through the `r.jina.ai` reader proxy. RPC and explorer endpoints were queried directly with `curl` or Node `WebSocket`. No transactions were sent.

## Summary

- Robinhood Chain is a dedicated Arbitrum Nitro chain in **Rollup mode**: Ethereum blobs for DA, `DataAvailabilityCommittee:false`. Mainnet (chain ID **4663**) settles to Ethereum and has been live since **2026-07-01**. The **testnet (chain ID 46630 / 0xb626)** settles to **Sepolia**, launched in February 2026, and is still live. It currently runs **ArbOS 61** on Nitro `v3.12.1-rc.2`.
- Gas token is ETH. The testnet base fee is a flat **0.01 gwei**. The L1 data fee is currently **0**. Priority fees do nothing because the sequencer orders transactions first come, first served. Measured block time is **about 0.16 s**. Soft confirmation is under a second.
- Tooling is first-class. viem has `robinhoodTestnet` (added in **viem 2.55.0**), and wagmi re-exports it. Foundry's alloy-chains knows the name `robinhood-testnet`. The explorer is Blockscout v10.2.6 with an Etherscan-compatible verification API. The EVM tested at **Osaka** level: PUSH0, TSTORE, MCOPY, CLZ and the BLS precompiles all work. BLOBBASEFEE does not.
- Account abstraction is verified on the testnet. **EntryPoint v0.6, v0.7, v0.8 and v0.9 all have code at 46630.** Pimlico lists testnet bundler and paymaster support, ZeroDev lists the testnet, and Alchemy lists Bundler and Gas Manager for the testnet. Robinhood's docs also say EIP-7702 is supported.
- Test stock tokens exist. The official faucet sends **0.01 ETH plus 5 each of TSLA, AMZN, PLTR, NFLX and AMD** every 24 h. They are ordinary ERC-20s (18 decimals, a blocklist and pause but no allowlist, ERC-8056 multiplier, EIP-2612 permit). **Chainlink has no testnet feeds.** Its feeds are mainnet only. **Pyth has a contract on the testnet** (pull model).
- The public RPC is **HTTP only**: no WSS, no filter methods, no archive state. For `eth_subscribe` you need Alchemy, QuickNode or dRPC (or another provider) WSS. For hosted indexing, Goldsky supports the testnet. The Graph and Envio HyperSync list mainnet only.

## Findings

### Network parameters (testnet)

| Field | Value | Source URL | Verified by curl |
|---|---|---|---|
| Chain name | "Robinhood Chain Testnet" (docs, viem). Node config calls it "Robinhood Chain Sepolia". | https://docs.robinhood.com/chain/connecting ; https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/chain-node-configs/robinhood-chain-testnet-config.json | n/a |
| Chain ID | 46630 / `0xb626` | https://docs.robinhood.com/chain/connecting | **yes**: `eth_chainId` → `0xb626`; `net_version` → `46630`; `ArbSys.arbChainID()` → `0xb626` |
| Mainnet chain ID (for contrast) | 4663 | https://docs.robinhood.com/chain/connecting | no |
| Public HTTPS RPC | `https://rpc.testnet.chain.robinhood.com` (rate-limited, "not recommended for production") | https://docs.robinhood.com/chain/connecting | **yes**: `eth_blockNumber` → `0x7d20bb2` (131,206,066) |
| Public WSS RPC | **None.** `wss://rpc.testnet.chain.robinhood.com` and `/ws` both fail the handshake (close 1006). | — | **yes** (fails) |
| Provider WSS | `wss://robinhood-testnet.g.alchemy.com/v2/{API_KEY}` | https://docs.robinhood.com/chain/connecting ; https://www.alchemy.com/rpc/robinhood-testnet.md | no (needs key) |
| Provider HTTPS | `https://robinhood-testnet.g.alchemy.com/v2/{API_KEY}` ; thirdweb `https://46630.rpc.thirdweb.com` | same ; https://thirdweb.com/46630 | no |
| Sequencer endpoint | `https://sequencer.testnet.chain.robinhood.com` | https://docs.robinhood.com/chain/connecting | no |
| Sequencer feed (not JSON-RPC) | `wss://feed.testnet.chain.robinhood.com`. Broadcasts Nitro feed messages and is RFC 7692-compressed since 2026-09-17. | https://docs.robinhood.com/chain/notices-and-upgrades | **yes**: opened, received `{"version":1,"messages":[{"sequenceNumber":131206896,...` |
| Client version | `nitro/v3.12.1-rc.2+70fa99a-20260929T140226Z/linux-arm64/go1.25.12` | — | **yes** (`web3_clientVersion`) |
| ArbOS version | 61. `ArbSys.arbOSVersion()` returns `0x74` = 116, and Nitro returns `55 + version`. Genesis was `InitialArbOSVersion: 51`. | https://github.com/OffchainLabs/nitro/blob/master/precompiles/ArbSys.go ; testnet config JSON | **yes** (`eth_call` to `0x…64`) |
| Parent / settlement | Sepolia (`parent-chain-id: 11155111`, `parent-chain-is-arbitrum: false`). Rollup mode, not AnyTrust (`DataAvailabilityCommittee: false`). Rollup contract `0xdc5F8E399DBd8a9F5F87AeC4C23Beb12431b386D` on Sepolia. | testnet config JSON ; https://docs.robinhood.com/chain/protocol-contracts | n/a |
| Block explorer | `https://explorer.testnet.chain.robinhood.com`: **Blockscout v10.2.6** | https://docs.robinhood.com/chain/connecting | **yes**: `/api/v2/config/backend-version` → `{"backend_version":"v10.2.6"}` |
| Verification API | `https://explorer.testnet.chain.robinhood.com/api/` (Etherscan-compatible). Foundry `--verifier blockscout`. Rust verifier enabled, solc up to 0.8.36. | https://docs.robinhood.com/chain/deploy-smart-contracts | **yes**: `getsourcecode` → `"message":"OK"`; `/api/v2/smart-contracts/verification/config` → 200 |
| Native gas token | ETH, 18 decimals (viem labels it "Sepolia Ether", symbol `ETH`) | https://docs.robinhood.com/chain/connecting ; viem `robinhoodTestnet.ts` | n/a |
| Block time | about 0.16 s measured (1,000 blocks in 169 s; 100,000 blocks in 16,049 s). Blockscout `average_block_time: 152` ms. | — | **yes** |
| Finality | Soft confirmation under 1 s. Posted to L1 within minutes. L1-final about 13 min after posting. Withdrawals take 7 days. | https://docs.robinhood.com/chain/transaction-finality | n/a |
| Gas price | `eth_gasPrice` = `0x989680` (0.01 gwei). `baseFeePerGas` is flat at 0.01 gwei across `eth_feeHistory`. `eth_maxPriorityFeePerGas` = `0x0`. `ArbGasInfo.getPricesInWei()` → L1 calldata price 0, L2 base 1e7 wei. `NodeInterface.gasEstimateL1Component` for 512 bytes → **0 L1 gas**. | https://docs.robinhood.com/chain/gas-and-fees | **yes** |
| Ordering | First come, first served. Priority fees do not reorder transactions. | https://docs.robinhood.com/chain/differences-from-ethereum | n/a |
| Testnet age / resets | Block 1 timestamp is 2026-02-06 16:01 UTC and the chain is continuous to block about 131.2M (2026-10-08). There is no evidence of a reset. | — | **yes** |

### 1. What it is
- It is "built on Arbitrum Dedicated Blockchains". It is EVM-compatible, permissionless, and uses ETH for gas (https://docs.robinhood.com/chain). It is "an Arbitrum Layer-2 Chain built on Ethereum, using Ethereum blobs for data availability" (https://docs.robinhood.com/chain/connecting).
- Mainnet went live on 2026-07-01 and settles to Ethereum (https://forum.arbitrum.foundation/t/arbitrumdao-factsheet-robinhood-chain-mainnet-launch/31041). The testnet was announced on 2026-02-11 (https://blog.arbitrum.io/robinhood-chain-testnet/).
- Sources disagree on the parent chain. The Arbitrum blog says "layer 2 on Arbitrum". The official docs, the node config and the L1 contract addresses (etherscan.io / sepolia.etherscan.io) show that it settles **directly to Ethereum / Sepolia**. The second view is authoritative.
- The operator is Offchain Labs: the status page is `http://status.robinhoodchain.offchain.io/` and the faucet says "Supported by Offchain" (https://docs.robinhood.com/chain).
- Recent ops notices (https://docs.robinhood.com/chain/notices-and-upgrades):
  - Nitro v3.11.4 was released 2026-09-14.
  - The feed became compressed-only on 2026-09-17, on testnet and mainnet.
  - A delayed backup feed exists on mainnet only (2026-09-22).

### 2. EVM behaviour (probed with `eth_call` on 46630)

| Feature | Result | Probe |
|---|---|---|
| PUSH0 (Shanghai) | supported | `0x5f5ff3` → `0x` |
| TSTORE/TLOAD, MCOPY (Cancun) | supported | ok |
| BLOBBASEFEE | **not supported**: `"BLOBBASEFEE is not supported on Arbitrum"` | `0x4a00` |
| BLS12-381 precompile `0x0b` (Prague) | supported (returns 128 bytes) | G1ADD of infinity points |
| CLZ `0x1e` (Osaka) | supported | `0x60011e00` → `0x` |

- The Robinhood test stock token implementation itself is compiled with `v0.8.33` and `evm_version: osaka` (Blockscout `/api/v2/smart-contracts/0xBd14156E05c6AF28ad39aA53a2AB8eB9CDf657DA`).
- Arbitrum differences that matter here (https://docs.robinhood.com/chain/differences-from-ethereum):
  - `block.number` returns an **L1 block estimate**. Use `ArbSys(0x64).arbBlockNumber()`.
  - `block.prevrandao` is **constant**, so it is not a source of randomness.
  - `block.coinbase` is the fee account.
  - Max code size is 96 KB and max init code is 192 KB (config: `MaxCodeSize 98304`).
  - L1-to-L2 senders are address-aliased.
  - **The sequencer screens out sanctioned addresses.** A blocked transaction simply never appears.
- Precompiles are at the standard Arbitrum addresses: ArbSys `0x…64`, ArbInfo `0x…65`, ArbAddressTable `0x…66`, ArbGasInfo `0x…6C`, ArbRetryableTx `0x…6E`, ArbStatistics `0x…6F`, ArbWasm `0x…71`, NodeInterface `0x…C8` (https://docs.robinhood.com/chain/protocol-contracts).
- Testnet utility contracts (code verified with `eth_getCode`):

| Contract | Address | Code size |
|---|---|---|
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | 3,808 B |
| L2 Multicall (docs) | `0xa432504b6F04Cafe775b09D8AA92e8dbe41Ec7a8` | 3,339 B |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | 9,152 B |
| CREATE2 deployer | `0x4e59b44847b379578588920cA78FbF26c0B4956C` | 69 B |
| L2 WETH | `0x7943e237c7F95DA44E0301572D358911207852Fa` | 2,202 B |

### 3. Faucets

| Faucet | Amount / cooldown | Requirements | Source |
|---|---|---|---|
| Official: `https://faucet.testnet.chain.robinhood.com/` | **0.01 ETH + 5 each of TSLA, AMZN, PLTR, NFLX, AMD**. "Claim once every 24 hours." | Connect a wallet or paste an address/ENS. Behind a Vercel security checkpoint. **Eligibility FAQ text UNVERIFIED**: only the question titles were readable. A third-party guide says Cloudflare check plus Google login (not confirmed). | page via reader, 2026-10-09 ; https://blog.arbitrum.io/robinhood-chain-testnet/ |
| Alchemy: `https://www.alchemy.com/faucets/robinhood-testnet` | 0.1 ETH / 24 h per address | No account needed. **Needs ≥0.001 ETH on Ethereum mainnet** plus "sufficient activity". Wallets already holding a lot of testnet ETH are refused. | https://www.alchemy.com/faucets/robinhood-testnet |
| thirdweb | "0.01 ETH/day" | not stated | https://thirdweb.com/46630 |

Chainstack's MCP `request_testnet_funds network="robinhood"` was reported in search results but **not verified**.

### 4. Bridging
- The canonical bridge is the Arbitrum portal (https://portal.arbitrum.io/bridge?destinationChain=robinhood-chain&sourceChain=ethereum). Deposits take about 10 min. Withdrawals take about 7 days plus an L1 claim. That is the mainnet route (https://docs.robinhood.com/chain/bridging).
- For the testnet the parent chain is **Sepolia**:
  - Delayed Inbox `0xF2939afA86F6f933A3CE17fCAB007907B6b0B7a4`
  - Bridge `0x96295BDad104eaD97cC08797b3dC68efF59CcF30`
  - L1 Gateway Router `0xF6F11aAEE80875776C264d93B37B34cE437382D1`
  - L2 Gateway Router `0x77bF00A6A90c600f214b34BAFBB7918c0cF113A8`
  - Source: https://docs.robinhood.com/chain/protocol-contracts
- **UNVERIFIED:** the exact portal URL parameters for Sepolia → testnet. The docs only give the mainnet link. Third-party routes (LayerZero/Stargate, CCIP/Transporter, Relay, Across, LiFi) are documented for mainnet. LayerZero publishes a `robinhood-testnet` deployment page (https://docs.layerzero.network/v2/deployments/chains/robinhood-testnet; not opened).
- For a game, bridging is unnecessary: faucets plus a sponsor wallet are enough.

### 5. Tooling

| Tool | Status | Source |
|---|---|---|
| viem | `import { robinhoodTestnet } from 'viem/chains'` (id 46630, Blockscout `apiUrl`, multicall3). Added in PR #4818, released in **viem 2.55.0**. Mainnet export is **`robinhood`**, not `robinhoodMainnet`. Latest viem is 2.57.4 (`npm view`). | https://github.com/wevm/viem/blob/main/src/chains/definitions/robinhoodTestnet.ts ; https://github.com/wevm/viem/blob/main/src/CHANGELOG.md |
| Conflict | The Robinhood AA docs' ZeroDev snippet does `import { robinhoodMainnet } from "viem/chains"`. viem has no such export. `robinhoodMainnet` comes from `@alchemy/common/chains` in the Alchemy snippet. | https://docs.robinhood.com/chain/account-abstraction |
| wagmi | `wagmi/chains` and `@wagmi/core/chains` do `export * from 'viem/chains'`, so `robinhoodTestnet` is available. wagmi 3.7.7 is current. | https://github.com/wevm/wagmi/blob/main/packages/core/src/exports/chains.ts |
| Foundry | Standard `forge create` / `forge verify-contract --verifier blockscout`. No `--legacy` and no special EVM flag in the docs. EIP-1559 works because the base fee is flat. alloy-chains has the named chain `robinhood-testnet` (46630), added in **alloy-chains 0.2.31** (2026-03-08). Whether a given Foundry build includes it is **UNVERIFIED**; use `--chain-id 46630` to be safe. | https://docs.robinhood.com/chain/deploy-smart-contracts ; https://github.com/alloy-rs/chains/blob/main/registry/manual.json |
| Hardhat / ethers | The docs give a Hardhat config with `etherscan.customChains` pointing at Blockscout `/api`. Ethers works through any JSON-RPC. | https://docs.robinhood.com/chain/deploy-smart-contracts |
| Public RPC method support | `eth_getLogs` over a 100k-block range: ok. `eth_newBlockFilter`: **-32601 not available**. `eth_syncing`: not available. Historical state at block 0x100000: **"historical state … is not available"**, so the node is not archive. 60 requests at 20-way concurrency: all 200, and no rate-limit headers were returned (Cloudflare-fronted). | curl, 2026-10-09 |

### 6. Tokenized stocks and oracles

**Mainnet Stock Tokens** (https://docs.robinhood.com/chain/stock-tokens):
- They are debt securities issued by Robinhood Assets (Jersey), implemented as ERC-20s with 18 decimals and an ERC-8056 `uiMultiplier()`.
- Only Authorised Participants can mint, and onboarding requires KYB.
- They are **not offered to US persons**, and the UK, Canada and Switzerland are restricted.
- 194 tokens are listed on the mainnet contracts page (https://docs.robinhood.com/chain/contracts), including:

| Ticker | Mainnet token address |
|---|---|
| TSLA | `0x322F0929c4625eD5bAd873c95208D54E1c003b2d` |
| NVDA | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` |
| GME | `0x1b0E319c6A659F002271B69dB8A7df2F911c153E` |
| GLD | `0xC9a981FEE1F9DEc688bb123ccDeCc63D0deBFC4e` |

  **There is no HOOD token in that list.**

**Testnet stock tokens** come from the faucet: 5 each of TSLA, AMZN, PLTR, NFLX, AMD (https://blog.arbitrum.io/robinhood-chain-testnet/). The docs publish **no testnet addresses**. Candidates were identified from Blockscout `/api/v2/search` and `/api/v2/tokens/<addr>`, so they are **inferred, not official**:

| Symbol | Address (46630) | Holders | Supply |
|---|---|---|---|
| TSLA ("Tesla") | `0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E` | 230,842 | 6,311,145 |
| AMZN ("Amazon") | `0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02` | 294,126 | 6,311,145 |
| PLTR ("Palantir Technologies") | `0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0` | 227,774 | 6,311,145 |
| NFLX ("Netflix") | `0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93` | 226,111 | 6,311,145 |
| AMD ("AMD") | `0x71178BAc73cBeb415514eB542a8995b82669778d` | 230,179 | 6,311,145 |

- All five tokens share:
  - the creator `0x2DD5b0Ea7c29006bA9450B9a4f3ADc234409e5Da`
  - the verified implementation `Stock` at `0xBd14156E05c6AF28ad39aA53a2AB8eB9CDf657DA`
- Lookalike "Test Stock" tokens with about 890 holders also exist. Do not use them.
- What the implementation source enforces:
  - `transfer` and `transferFrom` are gated by `onlyNotPaused` and `onlyNotBlocked(from/to/sender)`. Both check an `ACCESS_CONTROLLED_REGISTRY`. This is a **blocklist, not an allowlist**: any address can receive tokens.
  - Roles control mint, burn, `adminBurn` and multiplier updates.
  - EIP-2612 `permit` is included.

**Oracles:**

| Provider | Testnet status | Detail | Source |
|---|---|---|---|
| Chainlink | **mainnet only** | Chainlink's docs config lists only "Robinhood Chain Mainnet". `feeds-robinhood-mainnet.json` → 200 and `feeds-robinhood-testnet.json` → **404**. 58 mainnet feeds, all 8 decimals with a 86,400 s heartbeat; stock feeds update 24/5. Data Streams verifier proxy (mainnet) `0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7`. | https://github.com/smartcontractkit/documentation/blob/main/src/features/data/chains.ts ; https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json ; https://docs.robinhood.com/chain/oracles-and-price-feeds ; https://docs.robinhood.com/chain/data-streams |
| Pyth | **on testnet** | Price feed contract `0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a` (`version()` → "1.4.5-alpha.1"). Lazer contract `0xACeA761c27A909d4D3895128EBe6370FDE2dF481`. Same addresses on mainnet. Deployment type "pro-compatible-production". `getPriceUnsafe(ETH/USD)` returned 2,581.35 USD, published 2026-10-07. It is pull-based: somebody must post updates. | https://github.com/pyth-network/pyth-crosschain/blob/main/contract_manager/src/store/contracts/EvmPriceFeedContracts.json ; curl verified |
| RedStone, Chronicle | not found | — | — |

Mainnet Chainlink feed proxies for the cars (from the mainnet feed JSON):

| Pair | Feed proxy |
|---|---|
| Robinhood TSLA/USD | `0x4A1166a659A55625345e9515b32adECea5547C38` |
| Robinhood NVDA/USD | `0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15` |
| Robinhood GME/USD | `0x27C71df6A64fB476468EdF256CF72c038baB5B67` |
| GLD/USD | `0x470A51258068043bd43dC0a56245625C9fE86eB0` |
| ETH/USD | `0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9` |

How the cars map onto tokens:
- TSLA RACER maps to **TSLA**, which exists on the testnet.
- NVDA AI, GME APE and GOLD WHALE (GLD) map to tokens that exist **on mainnet only**.
- HOOD BULL/BEAR has **no HOOD token** on either network.
- DOGE KART is a crypto asset, not a stock token.

### 7. Account abstraction and wallets

**ERC-4337 EntryPoints on 46630** (all checked with `eth_getCode`):

| Version | Address | Code size |
|---|---|---|
| v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | 23,689 B |
| v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | 16,035 B |
| v0.8 | `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108` | 21,738 B |
| v0.9 | `0x433709009B8330FDa32311DF1C2AFA402eD8D009` | 22,425 B |

The Robinhood docs list addresses v0.6 to v0.8 for mainnet only (https://docs.robinhood.com/chain/account-abstraction).

**Provider support:**

| Provider | Testnet 46630 | Source |
|---|---|---|
| Pimlico | **Listed**, slug `robinhood-testnet`. Bundler v0.6–v0.9, paymaster v0.6–v0.8. | https://docs.pimlico.io/guides/supported-chains |
| Alchemy | **Listed**: Bundler API, Gas Manager, Websockets, Webhooks. Debug, Trace and UserOp simulation are *not* supported. | https://www.alchemy.com/rpc/robinhood-testnet.md |
| ZeroDev | **Listed** as "Robinhood Testnet \| 46630". RPC pattern `https://rpc.zerodev.app/api/v3/<PROJECT_ID>/chain/<id>` per the Robinhood docs. | https://docs.zerodev.app/sdk/faqs/chains |
| thirdweb | Chain page exists (RPC, faucet, "EIP-7702" tag). Bundler/paymaster support **UNVERIFIED**. | https://thirdweb.com/46630 |
| Biconomy | **UNVERIFIED**: no primary source found. | — |
| Privy | Supports any EVM chain through a viem chain object (`supportedChains`). Robinhood docs list Privy for AA. Smart-wallet/paymaster on 46630 **UNVERIFIED**. | https://docs.privy.io/basics/react/advanced/configuring-evm-networks ; https://docs.robinhood.com/chain/account-abstraction |
| Dynamic | Listed by the Robinhood AA docs. Testnet specifics **UNVERIFIED**. | https://docs.robinhood.com/chain/account-abstraction |

- **EIP-7702:** "also supports EIP-7702" (https://docs.robinhood.com/chain/account-abstraction). Not exercised; it would need a transaction.
- **Robinhood Wallet** supports Robinhood Chain on iOS and Android. Testnet and WalletConnect support are **UNVERIFIED**.
- **MetaMask:** add the network manually with chain ID 46630, RPC `https://rpc.testnet.chain.robinhood.com`, symbol ETH, and explorer URL (https://docs.robinhood.com/chain/add-network-to-wallet).
- **Popup-free options verified for 46630:** Pimlico or Alchemy (bundler plus paymaster), and ZeroDev Kernel (session keys are a ZeroDev feature).

### 8. Infrastructure

**RPC providers** named by the official docs (https://docs.robinhood.com/chain/connecting): Alchemy (recommended), Chainstack, QuickNode, Blockdaemon, dRPC (the link points to the testnet page), Validation Cloud, GlobalStake.
- QuickNode advertises testnet HTTPS and WSS plus `eth_subscribe` (https://www.quicknode.com/chains/robinhood).
- dRPC's testnet page shows chain ID 46630 and HTTPS and WSS endpoint slots (https://drpc.org/chainlist/robinhood-testnet-rpc).
- Infura, Ankr and Conduit are **not listed** in the docs and were not checked further.

**Public RPC limits:** the Terms say it is "subject to rate limits … not intended for production-grade, high-throughput, or latency-sensitive applications" (https://docs.robinhood.com/chain/terms-of-service). The numeric limit is **UNVERIFIED**: 60 burst requests were not throttled.

**WebSocket:** the public endpoint has no WSS (tested). `eth_subscribe` on Alchemy, QuickNode or dRPC is **doc-claimed only and UNVERIFIED** because it needs an API key.

**Indexers:**

| Indexer | Testnet support | Source |
|---|---|---|
| Goldsky | **4663 / 46630 M+T** for Turbo, Edge RPC, Compose and Subgraphs | https://docs.goldsky.com/chains/supported-networks |
| The Graph | **mainnet only** (`robinhood`, eip155:4663, Substreams) | https://thegraph.com/docs/en/supported-networks/robinhood/ |
| Envio HyperSync | **mainnet only** (`https://robinhood.hypersync.xyz`); testnet NOT LISTED | https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks |
| Ponder / self-hosted | Works with any RPC (assumption, see below). Needs a non-public RPC for backfill rate and archive state. | — |
| Allium | Has a `robinhood_testnet` page (search result, not opened) | https://docs.allium.so/historical-data/supported-blockchains/evm/robinhood_testnet |

### 9. Caveats, terms and programs

**Terms of Service** (https://docs.robinhood.com/chain/terms-of-service):
- The testnet may be used "only to test and improve … applications built on it".
- "Testnet tokens have no monetary value and will not be converted into any rewards".
- Robinhood may "change, discontinue, or terminate" the testnet "at any time and without notice".
- Users must be 18 or older, must not be sanctioned, and must not use a VPN to evade geo-restrictions.
- Prohibited Use includes "use of automated tools (such as bots…)" when they "interfere… or circumvent intended operation". A game server that relays transactions should stay well inside rate limits.
- **No clause mentions games, wagering or gambling.** Real-money stakes on mainnet would raise gambling-law questions outside this document.

**Trademark** (Terms §5.5–5.11):
- The name "Hood Chain" is **prohibited** (§5.8(d)).
- Using the Robinhood Chain marks as part of a primary product name, or implying endorsement, needs written consent (§5.11).
- Community projects must show the disclaimer "not affiliated with, endorsed by, or officially connected with Robinhood Markets, Inc." (§5.7(b)).
- The marks must not appear in AI-generated media that implies endorsement (§5.7(i)).
- This affects the **HOOD BULL / HOOD BEAR** car names and any Robinhood logo usage.

**Other caveats:**
- **Stock token restrictions:** they are not for US persons, and the UK, Canada and Switzerland are restricted (https://docs.robinhood.com/chain/stock-tokens). On the testnet the faucet hands them to anyone, and transfers are blocklist-only.
- **Sequencer screening:** transactions involving sanctioned addresses are dropped (https://docs.robinhood.com/chain/differences-from-ethereum).
- **Resets:** no documented reset policy. The chain has been continuous since 2026-02-06.

**Programs:**
- Robinhood committed $1M to the **2026 Arbitrum Open House** (four online Buildathons in NYC, Dubai, London and Singapore; Founder Houses in NYC and London) (https://blog.arbitrum.io/robinhood-chain-testnet/).
- The Singapore online Buildathon ran 3 weeks from **2026-09-14**, so it has closed. The **Founder House Singapore is 2026-10-23** (application-only; https://luma.com/openhouse-singapore), with $415k in prizes and grants (https://blog.arbitrum.foundation/builders-block-025-arbitrums-buildathon-starts-next-week-heres-how-to-stand-out-in-open-house.md).
- A reserved Robinhood Chain podium slot is reported by a third party only (egamers.io), so it is **UNVERIFIED**. Dubai dates are **UNVERIFIED**.

### 10. Deployment checklist (testnet)

1. **Compiler:** solc 0.8.x. Robinhood's own token uses 0.8.33 with `evm_version = "osaka"`. Prague or Cancun also work. Do not use `block.blobbasefee`.
2. **`foundry.toml` profile:**

   ```toml
   [rpc_endpoints]
   rh_testnet = "${RH_TESTNET_RPC}"   # Alchemy/QuickNode URL; fall back to https://rpc.testnet.chain.robinhood.com

   [etherscan]
   rh_testnet = { key = "empty", chain = 46630, url = "https://explorer.testnet.chain.robinhood.com/api/" }
   ```

3. **Fund the deployer:** use the official faucet (0.01 ETH/day) or Alchemy (0.1 ETH/day, needs mainnet activity). At 0.01 gwei with 0 L1 fee, a 3M-gas deploy costs about 0.00003 ETH (arithmetic from the measured base fee).
4. **Deploy and verify with Foundry** (pattern from https://docs.robinhood.com/chain/deploy-smart-contracts, switched to the testnet values):

   ```bash
   forge script script/Deploy.s.sol --rpc-url rh_testnet --chain-id 46630 \
     --private-key $DEPLOYER_PK --broadcast \
     --verify --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/
   # or post-hoc:
   forge verify-contract <addr> src/BumpArena.sol:BumpArena --chain-id 46630 \
     --rpc-url $RH_TESTNET_RPC --verifier blockscout \
     --verifier-url https://explorer.testnet.chain.robinhood.com/api/
   ```

5. **Deploy with viem:**

   ```ts
   import { createWalletClient, createPublicClient, http } from 'viem'
   import { robinhoodTestnet } from 'viem/chains'          // viem >= 2.55.0
   import { privateKeyToAccount } from 'viem/accounts'
   const transport = http(process.env.RH_TESTNET_RPC)        // provider URL, not the public one, for production
   const wallet = createWalletClient({ account: privateKeyToAccount(process.env.DEPLOYER_PK as `0x${string}`), chain: robinhoodTestnet, transport })
   const hash = await wallet.deployContract({ abi, bytecode, args: [] })
   const receipt = await createPublicClient({ chain: robinhoodTestnet, transport }).waitForTransactionReceipt({ hash })
   ```

6. **Contract rules:**
   - Use `ArbSys(0x64).arbBlockNumber()` or `block.timestamp` for deadlines, never `block.number`.
   - Never use `prevrandao` for randomness (use Chainlink VRF on mainnet, or commit-reveal).
   - Do not assume a priority fee buys ordering.
7. **Post-deploy:** confirm `eth_getCode` and the verified source on Blockscout. Record addresses in a single `deployments/46630.json`.

## Recommendations

1. **Settle per match, not per bump.** The bump economy (zero-sum transfers, `stealAmount = min(calculatedDamage, target.balance)`, docs/update/prd.md:720; constant total, docs/mechanics/prd.md:633-640) stays in the authoritative realtime server. The chain only holds:
   - an **escrow contract**: `joinMatch` locks a stake;
   - a server-signed **`settleMatch(matchId, finalBalances[8])`** that pays out the pot pro-rata to final balances, so the on-chain total equals the sum of stakes. This mirrors the PRD invariant;
   - events for the leaderboard.

   One settlement transaction for 8 players (docs/designgame/prd.md:58) every 2:40–3:00 (docs/update/prd.md:696) is trivially cheap: about 200k gas × 0.01 gwei ≈ 0.000002 ETH.
2. **Make signing popup-free:**
   - Have players sign one EIP-712 "entry ticket" or ERC-2612 `permit` when they join.
   - The game server submits and pays gas from a sponsor key. Faucet ETH is plenty at 0.01 gwei.
   - If players must own the transaction, use ERC-4337 smart accounts with **Pimlico** or **Alchemy Gas Manager** (both verified on 46630), and add **ZeroDev session keys** for in-match actions.
   - Never ask for a wallet popup during the 3-minute round.
3. **Use a keyed provider and keep stock prices off-chain for gameplay:**
   - Use Alchemy or QuickNode (HTTPS + WSS) for the server and indexer. The public RPC has no WSS, no filters and no archive state.
   - Index with **Goldsky** (testnet supported) or Ponder against the keyed RPC.
   - Drive in-game "market events" (BULL RUSH etc., docs/mechanics/prd.md:662-686) from **mainnet Chainlink feeds read off-chain** (TSLA, NVDA, GME, GLD proxies above). The testnet has no Chainlink feeds, and Pyth on the testnet requires pushing updates.
   - Optionally use the **testnet TSLA, AMZN, PLTR, NFLX, AMD** faucet tokens as cosmetic or entry assets.
4. **Brand hygiene:** rename or clear "HOOD BULL / HOOD BEAR" with Robinhood before any public launch. Never write "Hood Chain". Add the non-affiliation disclaimer (Terms §5.7–5.11).

## Implications per role

**Smart contracts engineer (Solidity/Foundry)**
- Target chain ID 46630, solc 0.8.33 or newer, `evm_version` prague or osaka. Max contract size is 96 KB.
- Contracts:
  - `BumpArena`: escrow, `joinMatch`, `settleMatch` with an EIP-712 operator signature, pull-payment withdraw, emergency refund after a timeout.
  - `Leaderboard` events: `MatchSettled(matchId, players[], finalBalances[], winner)`.
- Gameplay arithmetic: enforce `sum(payouts) == pot` on-chain to mirror docs/mechanics/prd.md:633.
- Arbitrum rules:
  - Timeouts use `block.timestamp` or `ArbSys.arbBlockNumber()`.
  - There is no randomness from `prevrandao`.
  - There is no front-running protection from fees under FCFS, so use signatures with nonces and deadlines.
- If stock tokens are accepted as stake:
  - Treat them as ERC-20s that can **revert on pause or blocklist**.
  - Use `permit` for single-signature entry.
  - The faucet token addresses are inferred, not official. Make them configurable.
- Verify on Blockscout with `--verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/`.

**Realtime game server engineer (Node/TypeScript, settles matches on chain)**
- viem ≥2.55.0 with `robinhoodTestnet`, and a provider HTTPS URL for writes.
- Soft confirmation in under 1 s is enough to show "settled". Show "final" after the batch posts to L1 (minutes).
- Keep a **hot sponsor/operator key** with a nonce manager. 0.01 ETH covers about 5,000 settlements at about 200k gas (computed from the measured fee).
- A transaction from a sanctioned address will silently never land, so add receipt timeouts and retries.
- Pull live stock prices from mainnet Chainlink with a read-only mainnet RPC to schedule market events. Never rely on the testnet for prices.
- Stay within provider rate limits. The Terms prohibit bot traffic that disrupts the service.

**Client chain and network integration engineer (Vite/TS browser client)**
- wagmi with `robinhoodTestnet` from `wagmi/chains`. Connectors: injected (MetaMask; add the network with the parameters above) plus an embedded wallet. Privy, Dynamic and ZeroDev are listed by Robinhood. Their testnet smart-wallet support needs a spike.
- Only two moments need a signature:
  - join: an EIP-712 or permit signature;
  - claim: optional, can be sponsored.
- Read state (escrow balance, leaderboard) through the indexer API, not raw RPC. Use `multicall3` at `0xca11…ca11` for wallet balances of the testnet TSLA, AMZN, PLTR, NFLX and AMD tokens.
- Do not ship the public RPC as the dapp's only transport. Use a fallback transport: provider first, public second.
- Show the faucet link `https://faucet.testnet.chain.robinhood.com/`. Mind its 24 h cooldown.

**Indexer and ops engineer (event indexing, leaderboard, deploy/infra)**
- Use Goldsky subgraph or Turbo on 46630, or Ponder with an Alchemy or QuickNode archive or WSS endpoint. The Graph and Envio do not list the testnet.
- Index `MatchSettled` and `Joined` from the deploy block, and handle a reorg depth that is effectively 0 before L1 posting.
- Monitor `http://status.robinhoodchain.offchain.io/` and `https://docs.robinhood.com/chain/notices-and-upgrades` (ArbOS and Nitro upgrades).
- Keep `deployments/46630.json` plus the Blockscout verification in CI.
- Secrets: the deployer and operator keys live only in env or KMS. Rotate the operator key without redeploying by using an `operator` setter.
- Budget for testnet changes. Robinhood may terminate the testnet without notice (Terms).

## Assumptions and open questions

- **Assumption:** Ponder, viem and any standard EVM indexer work against 46630 because it is plain JSON-RPC. This was not exercised end to end.
- **Assumption:** settlement gas is about 200k for 8 players. Measure it once the contract exists.
- **UNVERIFIED:**
  - The official faucet's eligibility rules. FAQ answers were not rendered, and the page sits behind a Vercel checkpoint.
  - Official testnet stock token addresses. Above they are inferred from Blockscout (shared creator and implementation, about 230k holders each).
  - Sepolia → testnet bridge UI URL.
  - Numeric public RPC rate limits.
  - `eth_subscribe` on Alchemy, QuickNode or dRPC WSS (needs a key).
  - Whether the installed Foundry includes alloy-chains ≥0.2.31.
  - thirdweb and Biconomy AA on 46630.
  - Privy and Dynamic smart-wallet support on 46630.
  - Robinhood Wallet on the testnet and over WalletConnect.
  - EIP-7702 on 46630 (doc claim only).
- **Open:**
  - Can a game hold real-value stakes on mainnet without gambling licensing? This is legal, not technical.
  - Will Robinhood allow HOOD-branded car names?
  - Should entry be in ETH, a game ERC-20 "chip", or test stock tokens? Stock tokens add pause and blocklist revert paths, and on mainnet the jurisdiction restrictions.
- The repo PRDs that banned blockchain (docs/update prd.md:1269, docs/Car Texture.md:25) are superseded by the user's new direction, as stated in the brief. They still need an explicit PRD update.

## Sources

All read 2026-10-09.
- https://docs.robinhood.com/chain
- https://docs.robinhood.com/chain/connecting
- https://docs.robinhood.com/chain/add-network-to-wallet
- https://docs.robinhood.com/chain/deploy-smart-contracts
- https://docs.robinhood.com/chain/differences-from-ethereum
- https://docs.robinhood.com/chain/gas-and-fees
- https://docs.robinhood.com/chain/transaction-finality
- https://docs.robinhood.com/chain/notices-and-upgrades
- https://docs.robinhood.com/chain/protocol-contracts
- https://docs.robinhood.com/chain/bridging
- https://docs.robinhood.com/chain/account-abstraction
- https://docs.robinhood.com/chain/stock-tokens
- https://docs.robinhood.com/chain/building-with-stock-tokens
- https://docs.robinhood.com/chain/contracts
- https://docs.robinhood.com/chain/oracles-and-price-feeds
- https://docs.robinhood.com/chain/data-streams
- https://docs.robinhood.com/chain/run-a-full-node
- https://docs.robinhood.com/chain/terms-of-service
- https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/chain-node-configs/robinhood-chain-testnet-config.json
- https://faucet.testnet.chain.robinhood.com/
- https://explorer.testnet.chain.robinhood.com/api/v2/ (`config/backend-version`, `stats`, `search`, `tokens`, `smart-contracts`)
- https://rpc.testnet.chain.robinhood.com (curl: `eth_chainId`, `net_version`, `eth_blockNumber`, `eth_gasPrice`, `eth_feeHistory`, `eth_maxPriorityFeePerGas`, `web3_clientVersion`, `eth_getCode`, `eth_call`, `eth_getLogs`, `eth_newBlockFilter`, `eth_getBalance`@old block)
- wss://feed.testnet.chain.robinhood.com (Node WebSocket)
- https://blog.arbitrum.io/robinhood-chain-testnet/
- https://forum.arbitrum.foundation/t/arbitrumdao-factsheet-robinhood-chain-mainnet-launch/31041
- https://blog.arbitrum.foundation/builders-block-025-arbitrums-buildathon-starts-next-week-heres-how-to-stand-out-in-open-house.md
- https://github.com/OffchainLabs/nitro/blob/master/precompiles/ArbSys.go
- https://github.com/wevm/viem/blob/main/src/chains/definitions/robinhoodTestnet.ts
- https://github.com/wevm/viem/blob/main/src/chains/definitions/robinhood.ts
- https://github.com/wevm/viem/blob/main/src/CHANGELOG.md
- https://github.com/wevm/wagmi/blob/main/packages/core/src/exports/chains.ts
- https://github.com/alloy-rs/chains/blob/main/registry/manual.json
- https://github.com/alloy-rs/chains/blob/main/CHANGELOG.md
- https://github.com/smartcontractkit/documentation/blob/main/src/features/data/chains.ts
- https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json
- https://reference-data-directory.vercel.app/feeds-robinhood-testnet.json (404)
- https://github.com/pyth-network/pyth-crosschain/tree/main/contract_manager/src/store (EvmChains.json, EvmPriceFeedContracts.json, EvmLazerContracts.json)
- https://www.alchemy.com/rpc/robinhood-testnet.md
- https://www.alchemy.com/faucets/robinhood-testnet
- https://docs.pimlico.io/guides/supported-chains
- https://docs.zerodev.app/sdk/faqs/chains
- https://thirdweb.com/46630
- https://docs.privy.io/basics/react/advanced/configuring-evm-networks
- https://www.quicknode.com/chains/robinhood
- https://drpc.org/chainlist/robinhood-testnet-rpc
- https://docs.goldsky.com/chains/supported-networks
- https://thegraph.com/docs/en/supported-networks/
- https://thegraph.com/docs/en/supported-networks/robinhood/
- https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks
- Repo:
  - docs/designgame/prd.md:58
  - docs/mechanics/prd.md:106-113, 633-640, 662-686
  - docs/update/prd.md:696, 720
  - docs/update prd.md:1269
  - docs/Car Texture.md:25, 81
