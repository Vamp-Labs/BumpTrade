import { bumpArenaAbi, mockBumpAbi } from "@bump/contracts";
import type { JoinIntentTyped } from "@bump/shared";
import {
  type Account,
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  fallback,
  type Hex,
  http,
  nonceManager,
  type PublicClient,
  type Transport,
  type WalletClient,
  webSocket,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "viem/chains";
import { PUBLIC_RPC_URL } from "../config";
import type {
  ChainGateway,
  OnChainMatch,
  OpenMatchParams,
  SettleResult,
} from "./ChainGateway";

export interface ViemGatewayOptions {
  rpcUrl: string;
  wssUrl: string | null;
  arenaAddress: Address;
  tokenAddress?: Address | null;
  relayerPrivateKey: Hex;
  receiptTimeoutMs?: number;
}

const isLocalUrl = (url: string): boolean =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(url);

export class ViemChainGateway implements ChainGateway {
  private readonly publicClient: PublicClient<Transport, Chain>;
  private readonly walletClient: WalletClient<Transport, Chain, Account>;
  private readonly account: Account;
  private readonly arena: Address;
  private readonly receiptTimeoutMs: number;
  private token: Address | null;
  private readonly sessionKeys = new Map<string, Address>();
  private readonly vehicles = new Map<string, number>();

  constructor(options: ViemGatewayOptions) {
    this.arena = options.arenaAddress;
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

  get relayerAddress(): Address {
    return this.account.address;
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

  startMatch(matchId: Hex): Promise<Hex> {
    return this.send(() =>
      this.walletClient.writeContract({
        address: this.arena,
        abi: bumpArenaAbi,
        functionName: "startMatch",
        args: [matchId],
      }),
    );
  }

  cancel(matchId: Hex): Promise<Hex> {
    return this.send(() =>
      this.walletClient.writeContract({
        address: this.arena,
        abi: bumpArenaAbi,
        functionName: "cancel",
        args: [matchId],
      }),
    );
  }

  settle(
    result: SettleResult,
    signature: Hex,
    onSubmitted?: (hash: Hex) => void,
  ): Promise<Hex> {
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

  async getMatch(matchId: Hex): Promise<OnChainMatch> {
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

  async getPlayers(matchId: Hex): Promise<Address[]> {
    const players = await this.publicClient.readContract({
      address: this.arena,
      abi: bumpArenaAbi,
      functionName: "getPlayers",
      args: [matchId],
      blockTag: "latest",
    });
    return [...players];
  }

  async sessionKeyOf(matchId: Hex, wallet: Address): Promise<Address> {
    const key = `${matchId}:${wallet.toLowerCase()}`;
    const cached = this.sessionKeys.get(key);
    if (cached) return cached;
    const sessionKey = await this.publicClient.readContract({
      address: this.arena,
      abi: bumpArenaAbi,
      functionName: "sessionKeyOf",
      args: [matchId, wallet],
      blockTag: "latest",
    });
    if (sessionKey !== "0x0000000000000000000000000000000000000000") {
      this.sessionKeys.set(key, sessionKey);
    }
    return sessionKey;
  }

  async vehicleOf(matchId: Hex, wallet: Address): Promise<number> {
    const key = `${matchId}:${wallet.toLowerCase()}`;
    const cached = this.vehicles.get(key);
    if (cached !== undefined) return cached;
    const vehicle = Number(
      await this.publicClient.readContract({
        address: this.arena,
        abi: bumpArenaAbi,
        functionName: "vehicleOf",
        args: [matchId, wallet],
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

  claimRefund(matchId: Hex, player: Address): Promise<Hex> {
    return this.send(() =>
      this.walletClient.writeContract({
        address: this.arena,
        abi: bumpArenaAbi,
        functionName: "claimRefund",
        args: [matchId, player],
      }),
    );
  }

  async faucetClaim(wallet: Address): Promise<Hex> {
    const address = await this.tokenAddress();
    return this.send(() =>
      this.walletClient.writeContract({
        address,
        abi: mockBumpAbi,
        functionName: "claim",
        args: [wallet],
      }),
    );
  }

  async tokenBalanceOf(wallet: Address): Promise<bigint> {
    const address = await this.tokenAddress();
    return this.publicClient.readContract({
      address,
      abi: mockBumpAbi,
      functionName: "balanceOf",
      args: [wallet],
      blockTag: "latest",
    });
  }

  async nextClaimAt(wallet: Address): Promise<bigint> {
    const address = await this.tokenAddress();
    return this.publicClient.readContract({
      address,
      abi: mockBumpAbi,
      functionName: "nextClaimAt",
      args: [wallet],
      blockTag: "latest",
    });
  }

  relayerBalance(): Promise<bigint> {
    return this.publicClient.getBalance({
      address: this.account.address,
      blockTag: "latest",
    });
  }

  hashResult(result: SettleResult): Promise<Hex> {
    return this.publicClient.readContract({
      address: this.arena,
      abi: bumpArenaAbi,
      functionName: "hashResult",
      args: [toContractResult(result)],
      blockTag: "latest",
    });
  }
}

const toContractResult = (result: SettleResult) => ({
  matchId: result.matchId,
  players: result.players,
  finalBalances: result.finalBalances,
  ranks: result.ranks,
  inputLogHash: result.inputLogHash,
  replayHash: result.replayHash,
  endedAt: result.endedAt,
});
