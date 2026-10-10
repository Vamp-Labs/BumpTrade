import { bumpArenaAbi, mockBumpAbi } from "@bump/contracts";
import {
  buildDomain,
  type ChainResult,
  type Hex32,
  type JoinIntentTyped,
  RESULT_TYPES,
  type WalletId,
} from "@bump/shared";
import {
  type Account,
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  fallback,
  getAddress,
  type Hex,
  hashTypedData,
  http,
  isAddress,
  type LocalAccount,
  nonceManager,
  type PublicClient,
  type Transport,
  type WalletClient,
  webSocket,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "viem/chains";
import { PUBLIC_RPC_URL } from "../../config";
import type {
  ArenaChain,
  OnChainMatch,
  OpenMatchParams,
} from "../ArenaChain";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EXPLORER_URL = "https://explorer.testnet.chain.robinhood.com";

export interface EvmArenaChainOptions {
  rpcUrl: string;
  wssUrl: string | null;
  arenaAddress: Address;
  tokenAddress?: Address | null;
  relayerPrivateKey: Hex;
  signerPrivateKey: Hex;
  chainId?: number;
  receiptTimeoutMs?: number;
}

const isLocalUrl = (url: string): boolean =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(url);

export class EvmArenaChain implements ArenaChain {
  readonly id = "evm" as const;
  readonly decimals = 18;
  private readonly publicClient: PublicClient<Transport, Chain>;
  private readonly walletClient: WalletClient<Transport, Chain, Account>;
  private readonly account: Account;
  private readonly signer: LocalAccount;
  private readonly arena: Address;
  private readonly chainId: number;
  private readonly receiptTimeoutMs: number;
  private token: Address | null;
  private readonly sessionKeys = new Map<string, Address>();
  private readonly vehicles = new Map<string, number>();

  constructor(options: EvmArenaChainOptions) {
    this.arena = options.arenaAddress;
    this.chainId = options.chainId ?? robinhoodTestnet.id;
    this.signer = privateKeyToAccount(options.signerPrivateKey);
    this.token = options.tokenAddress ?? null;
    this.receiptTimeoutMs = options.receiptTimeoutMs ?? 15_000;
    this.account = privateKeyToAccount(options.relayerPrivateKey, {
      nonceManager,
    });

    const transports: Transport[] = [];
    if (options.wssUrl) transports.push(webSocket(options.wssUrl));
    transports.push(http(options.rpcUrl));
    if (options.rpcUrl !== PUBLIC_RPC_URL && !isLocalUrl(options.rpcUrl)) {
      transports.push(http(PUBLIC_RPC_URL));
    }
    const transport =
      transports.length > 1
        ? fallback(transports)
        : (transports[0] as Transport);

    this.publicClient = createPublicClient({
      chain: robinhoodTestnet,
      transport,
    });
    this.walletClient = createWalletClient({
      account: this.account,
      chain: robinhoodTestnet,
      transport,
    });
  }

  get relayerId(): string {
    return this.account.address;
  }

  get signerId(): string {
    return this.signer.address;
  }

  get arenaAddress(): Address {
    return this.arena;
  }

  get evmChainId(): number {
    return this.chainId;
  }

  explorerTx(tx: string): string {
    return `${EXPLORER_URL}/tx/${tx}`;
  }

  parseWallet(raw: unknown): WalletId | null {
    return typeof raw === "string" && isAddress(raw) ? getAddress(raw) : null;
  }

  walletKey(wallet: WalletId): string {
    return wallet.toLowerCase();
  }

  private async send(
    request: () => Promise<Hex>,
    onSubmitted?: (hash: Hex) => void,
  ): Promise<Hex> {
    let hash: Hex;
    try {
      hash = await request();
    } catch (error) {
      this.resetNonce();
      throw error;
    }
    onSubmitted?.(hash);
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        timeout: this.receiptTimeoutMs,
      });
      if (receipt.status !== "success") {
        throw new Error(`transaction reverted: ${hash}`);
      }
    } catch (error) {
      this.resetNonce();
      throw error;
    }
    return hash;
  }

  private resetNonce(): void {
    nonceManager.reset({
      address: this.account.address,
      chainId: robinhoodTestnet.id,
    });
  }

  openMatch(params: OpenMatchParams): Promise<Hex> {
    return this.send(() =>
      this.walletClient.writeContract({
        address: this.arena,
        abi: bumpArenaAbi,
        functionName: "openMatch",
        args: [
          params.matchId,
          params.stake,
          params.maxPlayers,
          params.startBalance,
          params.joinDeadline,
        ],
      }),
    );
  }

  startMatch(matchId: Hex32): Promise<Hex> {
    return this.send(() =>
      this.walletClient.writeContract({
        address: this.arena,
        abi: bumpArenaAbi,
        functionName: "startMatch",
        args: [matchId],
      }),
    );
  }

  cancel(matchId: Hex32): Promise<Hex> {
    return this.send(() =>
      this.walletClient.writeContract({
        address: this.arena,
        abi: bumpArenaAbi,
        functionName: "cancel",
        args: [matchId],
      }),
    );
  }

  async settle(
    result: ChainResult,
    onSubmitted?: (hash: Hex) => void,
  ): Promise<Hex> {
    const signature = await this.signResult(result);
    return this.send(
      () =>
        this.walletClient.writeContract({
          address: this.arena,
          abi: bumpArenaAbi,
          functionName: "settle",
          args: [toContractResult(result), signature],
        }),
      onSubmitted,
    );
  }

  private typedData(result: ChainResult) {
    return {
      domain: buildDomain(this.arena, this.chainId),
      types: RESULT_TYPES,
      primaryType: "Result",
      message: toContractResult(result),
    } as const;
  }

  localDigest(result: ChainResult): Hex {
    return hashTypedData(this.typedData(result));
  }

  signResult(result: ChainResult): Promise<Hex> {
    return this.signer.signTypedData(this.typedData(result));
  }

  async selfCheck(sample: ChainResult): Promise<void> {
    const onChain = await this.hashResult(sample);
    const local = this.localDigest(sample);
    if (onChain.toLowerCase() !== local.toLowerCase()) {
      throw new Error("EIP-712 digest mismatch between server and contract");
    }
  }

  async getMatch(matchId: Hex32): Promise<OnChainMatch> {
    const view = await this.publicClient.readContract({
      address: this.arena,
      abi: bumpArenaAbi,
      functionName: "getMatch",
      args: [matchId],
      blockTag: "latest",
    });
    return {
      stake: view.stake,
      startBalance: Number(view.startBalance),
      maxPlayers: Number(view.maxPlayers),
      playerCount: Number(view.playerCount),
      status: Number(view.status),
      joinDeadline: BigInt(view.joinDeadline),
      settleDeadline: BigInt(view.settleDeadline),
      pot: view.pot,
    };
  }

  async getPlayers(matchId: Hex32): Promise<Address[]> {
    const players = await this.publicClient.readContract({
      address: this.arena,
      abi: bumpArenaAbi,
      functionName: "getPlayers",
      args: [matchId],
      blockTag: "latest",
    });
    return [...players];
  }

  async sessionKeyOf(matchId: Hex32, wallet: WalletId): Promise<Address | null> {
    const key = `${matchId}:${wallet.toLowerCase()}`;
    const cached = this.sessionKeys.get(key);
    if (cached) return cached;
    const sessionKey = await this.publicClient.readContract({
      address: this.arena,
      abi: bumpArenaAbi,
      functionName: "sessionKeyOf",
      args: [matchId, wallet as Address],
      blockTag: "latest",
    });
    if (sessionKey === ZERO_ADDRESS) return null;
    this.sessionKeys.set(key, sessionKey);
    return sessionKey;
  }

  async vehicleOf(matchId: Hex32, wallet: WalletId): Promise<number> {
    const key = `${matchId}:${wallet.toLowerCase()}`;
    const cached = this.vehicles.get(key);
    if (cached !== undefined) return cached;
    const vehicle = Number(
      await this.publicClient.readContract({
        address: this.arena,
        abi: bumpArenaAbi,
        functionName: "vehicleOf",
        args: [matchId, wallet as Address],
        blockTag: "latest",
      }),
    );
    this.vehicles.set(key, vehicle);
    return vehicle;
  }

  async tokenAddress(): Promise<Address> {
    if (this.token) return this.token;
    const token = await this.publicClient.readContract({
      address: this.arena,
      abi: bumpArenaAbi,
      functionName: "token",
      blockTag: "latest",
    });
    this.token = token;
    return token;
  }

  joinWithSig(intent: JoinIntentTyped, signature: Hex): Promise<Hex> {
    return this.send(() =>
      this.walletClient.writeContract({
        address: this.arena,
        abi: bumpArenaAbi,
        functionName: "joinWithSig",
        args: [intent, signature],
      }),
    );
  }

  claimRefund(matchId: Hex32, player: WalletId): Promise<Hex> {
    return this.send(() =>
      this.walletClient.writeContract({
        address: this.arena,
        abi: bumpArenaAbi,
        functionName: "claimRefund",
        args: [matchId, player as Address],
      }),
    );
  }

  async faucetClaim(wallet: WalletId): Promise<Hex> {
    const address = await this.tokenAddress();
    return this.send(() =>
      this.walletClient.writeContract({
        address,
        abi: mockBumpAbi,
        functionName: "claim",
        args: [wallet as Address],
      }),
    );
  }

  async tokenBalanceOf(wallet: WalletId): Promise<bigint> {
    const address = await this.tokenAddress();
    return this.publicClient.readContract({
      address,
      abi: mockBumpAbi,
      functionName: "balanceOf",
      args: [wallet as Address],
      blockTag: "latest",
    });
  }

  async nextClaimAt(wallet: WalletId): Promise<number> {
    const address = await this.tokenAddress();
    const next = await this.publicClient.readContract({
      address,
      abi: mockBumpAbi,
      functionName: "nextClaimAt",
      args: [wallet as Address],
      blockTag: "latest",
    });
    return Number(next);
  }

  relayerBalance(): Promise<bigint> {
    return this.publicClient.getBalance({
      address: this.account.address,
      blockTag: "latest",
    });
  }

  hashResult(result: ChainResult): Promise<Hex> {
    return this.publicClient.readContract({
      address: this.arena,
      abi: bumpArenaAbi,
      functionName: "hashResult",
      args: [toContractResult(result)],
      blockTag: "latest",
    });
  }
}

const toContractResult = (result: ChainResult) => ({
  matchId: result.matchId,
  players: result.players.map((player) => getAddress(player)),
  finalBalances: result.finalBalances,
  ranks: result.ranks,
  inputLogHash: result.inputLogHash,
  replayHash: result.replayHash,
  endedAt: result.endedAt,
});
