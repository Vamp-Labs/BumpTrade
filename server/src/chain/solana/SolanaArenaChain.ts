import { createHash } from "node:crypto";
import {
  type ChainResult,
  type Hex32,
  type JoinErrorCode,
  type TxRef,
  type WalletId,
} from "@bump/shared";
import {
  BUMP_ARENA_PROGRAM_ADDRESS,
  fetchConfig,
  findMatchAccountPda,
  getCancelInstructionAsync,
  getClaimRefundInstructionAsync,
  getJoinMatchInstructionAsync,
  getOpenMatchInstructionAsync,
  getSettleInstructionAsync,
  getStartMatchInstructionAsync,
  matchIdBytes,
  type Match,
  getMatchDecoder,
  withRemainingAccounts,
} from "@bump/sol-client";
import {
  type Address,
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createKeyPairSignerFromBytes,
  createNoopSigner,
  createDefaultRpcTransport,
  createSolanaRpcFromTransport,
  createTransactionMessage,
  getBase64Encoder,
  getBase64EncodedWireTransaction,
  getBase58Decoder,
  getProgramDerivedAddress,
  getPublicKeyFromAddress,
  getSignatureFromTransaction,
  getTransactionDecoder,
  type Instruction,
  isAddress,
  type KeyPairSigner,
  pipe,
  type ReadonlyUint8Array,
  setTransactionMessageFeePayer,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  verifySignature,
} from "@solana/kit";
import type { SolanaChainConfig } from "../../config";
import type { ArenaChain, OnChainMatch, OpenMatchParams } from "../ArenaChain";
import { type FaucetCooldown, MemoryFaucetCooldown } from "./cooldown";
import { wrapSendError } from "./programErrors";
import { createAtaIdempotentIx, findAta, mintToIx } from "./token";

export const BUMP_DECIMALS = 9;
export const FAUCET_AMOUNT = 1000n * 10n ** 9n;
const COMMITMENT = "confirmed" as const;
const TOKEN_AMOUNT_OFFSET = 64;

type Rpc = ReturnType<typeof createSolanaRpcFromTransport>;

const isRateLimited = (error: unknown): boolean => {
  const e = error as { context?: { statusCode?: number }; message?: string } | null;
  return e?.context?.statusCode === 429 || /\b429\b|too many requests/i.test(e?.message ?? "");
};

export const createRetryingRpc = (url: string, maxAttempts = 7): Rpc => {
  const base = createDefaultRpcTransport({ url });
  const transport = (async (config: Parameters<typeof base>[0]) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await base(config);
      } catch (error) {
        if (attempt + 1 >= maxAttempts || !isRateLimited(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, Math.min(4000, 300 * 2 ** attempt) + Math.floor(Math.random() * 200)));
      }
    }
  }) as typeof base;
  return createSolanaRpcFromTransport(transport);
};

export class JoinTxError extends Error {
  constructor(
    readonly code: Extract<JoinErrorCode, "TX_EXPIRED" | "TX_TAMPERED" | "BAD_SIGNATURE">,
    message: string,
  ) {
    super(message);
  }
}

export interface PreparedJoin {
  id: string;
  player: WalletId;
  tx: string;
  messageBytes: ReadonlyUint8Array;
  lastValidBlockHeight: bigint;
}

export interface JoinParams {
  matchId: Hex32;
  player: WalletId;
  sessionKey: string;
  vehicleId: number;
}

export interface SolanaArenaChainOptions {
  cluster: string;
  rpcUrl: string;
  programId: string;
  mint: string;
  treasury: string;
  relayer: KeyPairSigner;
  resultSigner: KeyPairSigner;
  mintAuthority: KeyPairSigner;
  cooldown?: FaucetCooldown;
  expectedStake?: bigint;
  now?: () => number;
  pollMs?: number;
  confirmTimeoutMs?: number;
}

const bytesOf = (hex: string): Uint8Array => matchIdBytes(hex);

const matchIdOf = (matchId: Hex32): Uint8Array => matchIdBytes(matchId);

export class SolanaArenaChain implements ArenaChain {
  readonly id = "solana" as const;
  readonly decimals = BUMP_DECIMALS;
  private readonly rpc: Rpc;
  private readonly programAddress: Address;
  private readonly mint: Address;
  private readonly treasury: Address;
  private readonly relayer: KeyPairSigner;
  private readonly resultSigner: KeyPairSigner;
  private readonly mintAuthority: KeyPairSigner;
  private readonly cooldown: FaucetCooldown;
  private readonly now: () => number;
  private readonly pollMs: number;
  private readonly confirmTimeoutMs: number;

  constructor(private readonly options: SolanaArenaChainOptions) {
    this.rpc = createRetryingRpc(options.rpcUrl);
    this.programAddress = address(options.programId);
    this.mint = address(options.mint);
    this.treasury = address(options.treasury);
    this.relayer = options.relayer;
    this.resultSigner = options.resultSigner;
    this.mintAuthority = options.mintAuthority;
    this.cooldown = options.cooldown ?? new MemoryFaucetCooldown();
    this.now = options.now ?? Date.now;
    this.pollMs = options.pollMs ?? 600;
    this.confirmTimeoutMs = options.confirmTimeoutMs ?? 60_000;
  }

  static async create(
    config: SolanaChainConfig,
    extra: Partial<SolanaArenaChainOptions> = {},
  ): Promise<SolanaArenaChain> {
    return new SolanaArenaChain({
      cluster: config.cluster,
      rpcUrl: config.rpcUrl,
      programId: config.programId,
      mint: config.mint,
      treasury: config.treasury,
      relayer: await createKeyPairSignerFromBytes(config.relayerSecret),
      resultSigner: await createKeyPairSignerFromBytes(
        config.resultSignerSecret,
      ),
      mintAuthority: await createKeyPairSignerFromBytes(
        config.mintAuthoritySecret,
      ),
      ...extra,
    });
  }

  get relayerId(): string {
    return this.relayer.address;
  }

  get signerId(): string {
    return this.resultSigner.address;
  }

  get programConfig() {
    return { programAddress: this.programAddress };
  }

  explorerTx(tx: TxRef): string {
    const { cluster, rpcUrl } = this.options;
    if (cluster === "mainnet-beta") return `https://explorer.solana.com/tx/${tx}`;
    if (cluster === "devnet" || cluster === "testnet") {
      return `https://explorer.solana.com/tx/${tx}?cluster=${cluster}`;
    }
    return `https://explorer.solana.com/tx/${tx}?cluster=custom&customUrl=${encodeURIComponent(rpcUrl)}`;
  }

  parseWallet(raw: unknown): WalletId | null {
    return typeof raw === "string" && isAddress(raw) ? raw : null;
  }

  walletKey(wallet: WalletId): string {
    return wallet;
  }

  async signResult(_result: ChainResult): Promise<string> {
    return "";
  }

  async selfCheck(_sample: ChainResult): Promise<void> {
    const [configAddress] = await getProgramDerivedAddress({
      programAddress: this.programAddress,
      seeds: [new TextEncoder().encode("config")],
    });
    const account = await fetchConfig(this.rpc, configAddress, {
      commitment: COMMITMENT,
    });
    const data = account.data;
    const problems: string[] = [];
    if (data.operator !== this.relayer.address) problems.push("operator");
    if (data.resultSigner !== this.resultSigner.address) {
      problems.push("result signer");
    }
    if (data.mint !== this.mint) problems.push("mint");
    if (data.treasury !== this.treasury) problems.push("treasury");
    if (
      this.options.expectedStake !== undefined &&
      data.stake !== this.options.expectedStake
    ) {
      problems.push("stake");
    }
    if (problems.length > 0) {
      throw new Error(
        `on-chain config mismatch with server settings: ${problems.join(", ")}`,
      );
    }
  }

  private async matchAddress(matchId: Hex32): Promise<Address> {
    const [pda] = await findMatchAccountPda(
      { matchId: matchIdOf(matchId) },
      { programAddress: this.programAddress },
    );
    return pda;
  }

  private async readMatch(matchId: Hex32): Promise<Match | null> {
    const pda = await this.matchAddress(matchId);
    const { value } = await this.rpc
      .getAccountInfo(pda, { encoding: "base64", commitment: COMMITMENT })
      .send();
    if (!value) return null;
    const raw = getBase64Encoder().encode(value.data[0]);
    return getMatchDecoder().decode(raw);
  }

  private async seatAccounts(matchId: Hex32): Promise<Address[]> {
    const match = await this.readMatch(matchId);
    if (!match) return [];
    return Promise.all(
      match.players
        .slice(0, match.playerCount)
        .map((player) => findAta(player, this.mint)),
    );
  }

  private async blockhash() {
    const { value } = await this.rpc
      .getLatestBlockhash({ commitment: COMMITMENT })
      .send();
    return value;
  }

  private async sendInstructions(
    instructions: Instruction[],
    onSubmitted?: (tx: TxRef) => void,
  ): Promise<TxRef> {
    try {
      const bh = await this.blockhash();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(this.relayer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
        (m) => appendTransactionMessageInstructions(instructions, m),
      );
      const signed = await signTransactionMessageWithSigners(message);
      const signature = getSignatureFromTransaction(signed);
      await this.rpc
        .sendTransaction(getBase64EncodedWireTransaction(signed), {
          encoding: "base64",
          preflightCommitment: COMMITMENT,
        })
        .send();
      onSubmitted?.(signature);
      await this.confirm(signature, bh.lastValidBlockHeight);
      return signature;
    } catch (error) {
      throw wrapSendError(error);
    }
  }

  private async confirm(
    signature: string,
    lastValidBlockHeight: bigint,
  ): Promise<void> {
    const deadline = this.now() + this.confirmTimeoutMs;
    for (;;) {
      const { value } = await this.rpc
        .getSignatureStatuses([signature as never])
        .send();
      const status = value[0];
      if (status) {
        if (status.err) {
          throw new Error(`transaction failed: ${JSON.stringify(status.err, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`);
        }
        if (
          status.confirmationStatus === "confirmed" ||
          status.confirmationStatus === "finalized"
        ) {
          return;
        }
      }
      const height = await this.rpc
        .getBlockHeight({ commitment: COMMITMENT })
        .send();
      if (!status && height > lastValidBlockHeight) {
        throw new Error(`transaction expired: ${signature}`);
      }
      if (this.now() > deadline) {
        throw new Error(`confirmation timeout: ${signature}`);
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollMs));
    }
  }

  async openMatch(params: OpenMatchParams): Promise<TxRef> {
    const ix = await getOpenMatchInstructionAsync(
      {
        operator: this.relayer,
        mint: this.mint,
        matchId: matchIdOf(params.matchId),
        maxPlayers: params.maxPlayers,
        joinDeadline: params.joinDeadline,
      },
      this.programConfig,
    );
    return this.sendInstructions([ix]);
  }

  async startMatch(matchId: Hex32): Promise<TxRef> {
    const ix = await getStartMatchInstructionAsync(
      { operator: this.relayer, matchId: matchIdOf(matchId) },
      this.programConfig,
    );
    return this.sendInstructions([ix]);
  }

  async cancel(matchId: Hex32): Promise<TxRef> {
    const ix = await getCancelInstructionAsync(
      { operator: this.relayer, matchId: matchIdOf(matchId) },
      this.programConfig,
    );
    return this.sendInstructions([
      withRemainingAccounts(ix, await this.seatAccounts(matchId)),
    ]);
  }

  async settle(
    result: ChainResult,
    onSubmitted?: (tx: TxRef) => void,
  ): Promise<TxRef> {
    const ix = await getSettleInstructionAsync(
      {
        operator: this.relayer,
        resultSigner: this.resultSigner,
        treasury: this.treasury,
        matchId: matchIdOf(result.matchId),
        finalBalances: result.finalBalances,
        ranks: Uint8Array.from(result.ranks),
        inputLogHash: bytesOf(result.inputLogHash),
        replayHash: bytesOf(result.replayHash),
        endedAt: result.endedAt,
      },
      this.programConfig,
    );
    const seats = await Promise.all(
      result.players.map((player) => findAta(address(player), this.mint)),
    );
    return this.sendInstructions([withRemainingAccounts(ix, seats)], onSubmitted);
  }

  async getMatch(matchId: Hex32): Promise<OnChainMatch> {
    const match = await this.readMatch(matchId);
    if (!match) {
      return {
        stake: 0n,
        startBalance: 0,
        maxPlayers: 0,
        playerCount: 0,
        status: 0,
        joinDeadline: 0n,
        settleDeadline: 0n,
        pot: 0n,
      };
    }
    return {
      stake: match.stake,
      startBalance: match.startBalance,
      maxPlayers: match.maxPlayers,
      playerCount: match.playerCount,
      status: match.status,
      joinDeadline: match.joinDeadline,
      settleDeadline: match.settleDeadline,
      pot: match.stake * BigInt(match.playerCount),
    };
  }

  async getPlayers(matchId: Hex32): Promise<WalletId[]> {
    const match = await this.readMatch(matchId);
    return match ? match.players.slice(0, match.playerCount) : [];
  }

  async sessionKeyOf(matchId: Hex32, wallet: WalletId): Promise<string | null> {
    const match = await this.readMatch(matchId);
    if (!match) return null;
    const seat = match.players
      .slice(0, match.playerCount)
      .findIndex((player) => player === wallet);
    return seat < 0 ? null : (match.sessionKeys[seat] ?? null);
  }

  async vehicleOf(matchId: Hex32, wallet: WalletId): Promise<number> {
    const match = await this.readMatch(matchId);
    if (!match) return 0;
    const seat = match.players
      .slice(0, match.playerCount)
      .findIndex((player) => player === wallet);
    return seat < 0 ? 0 : (match.vehicles[seat] ?? 0);
  }

  async claimRefund(matchId: Hex32, player: WalletId): Promise<TxRef> {
    const ix = await getClaimRefundInstructionAsync(
      {
        playerToken: await findAta(address(player), this.mint),
        matchId: matchIdOf(matchId),
        player: address(player),
      },
      this.programConfig,
    );
    return this.sendInstructions([ix]);
  }

  async faucetClaim(wallet: WalletId): Promise<TxRef> {
    const owner = address(wallet);
    const ata = await findAta(owner, this.mint);
    const signature = await this.sendInstructions([
      createAtaIdempotentIx(this.relayer, ata, owner, this.mint),
      mintToIx(this.mint, ata, this.mintAuthority, FAUCET_AMOUNT),
    ]);
    await this.cooldown.markClaimed(wallet, Math.floor(this.now() / 1000));
    return signature;
  }

  async tokenBalanceOf(wallet: WalletId): Promise<bigint> {
    const ata = await findAta(address(wallet), this.mint);
    const { value } = await this.rpc
      .getAccountInfo(ata, { encoding: "base64", commitment: COMMITMENT })
      .send();
    if (!value) return 0n;
    const raw = getBase64Encoder().encode(value.data[0]);
    return new DataView(
      raw.buffer,
      raw.byteOffset,
      raw.byteLength,
    ).getBigUint64(TOKEN_AMOUNT_OFFSET, true);
  }

  nextClaimAt(wallet: WalletId): Promise<number> {
    return this.cooldown.nextClaimAt(wallet);
  }

  async relayerBalance(): Promise<bigint> {
    const { value } = await this.rpc
      .getBalance(this.relayer.address, { commitment: COMMITMENT })
      .send();
    return value;
  }

  async prepareJoin(params: JoinParams): Promise<PreparedJoin> {
    const player = address(params.player);
    const ix = await getJoinMatchInstructionAsync(
      {
        player: createNoopSigner(player),
        playerToken: await findAta(player, this.mint),
        matchId: matchIdOf(params.matchId),
        sessionKey: address(params.sessionKey),
        vehicleId: params.vehicleId,
      },
      this.programConfig,
    );
    const bh = await this.blockhash();
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayer(this.relayer.address, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
      (m) => appendTransactionMessageInstructions([ix], m),
    );
    const tx = compileTransaction(message);
    return {
      id: messageId(tx.messageBytes),
      player: params.player,
      tx: getBase64EncodedWireTransaction(tx),
      messageBytes: tx.messageBytes,
      lastValidBlockHeight: bh.lastValidBlockHeight,
    };
  }

  messageIdOf(signedTx: string): string | null {
    try {
      const tx = getTransactionDecoder().decode(
        getBase64Encoder().encode(signedTx),
      );
      return messageId(tx.messageBytes);
    } catch {
      return null;
    }
  }

  async submitJoin(prepared: PreparedJoin, signedTx: string): Promise<TxRef> {
    let tx: ReturnType<ReturnType<typeof getTransactionDecoder>["decode"]>;
    try {
      tx = getTransactionDecoder().decode(getBase64Encoder().encode(signedTx));
    } catch {
      throw new JoinTxError("TX_TAMPERED", "transaction is malformed");
    }
    if (Buffer.compare(Buffer.from(tx.messageBytes), Buffer.from(prepared.messageBytes)) !== 0) {
      throw new JoinTxError("TX_TAMPERED", "transaction was modified");
    }
    const playerAddress = address(prepared.player);
    const playerSignature = tx.signatures[playerAddress];
    if (
      !playerSignature ||
      !(await verifySignature(
        await getPublicKeyFromAddress(playerAddress),
        playerSignature,
        tx.messageBytes,
      ))
    ) {
      throw new JoinTxError("BAD_SIGNATURE", "player signature is missing or invalid");
    }
    const [relayerSignatures] = await this.relayer.signTransactions([
      tx as Parameters<KeyPairSigner["signTransactions"]>[0][number],
    ]);
    const full = {
      ...tx,
      signatures: { ...tx.signatures, ...relayerSignatures },
    };
    try {
      const feePayerSignature = full.signatures[this.relayer.address];
      if (!feePayerSignature) throw new Error("relayer signature missing");
      const signature = getBase58Decoder().decode(feePayerSignature);
      await this.rpc
        .sendTransaction(getBase64EncodedWireTransaction(
            full as Parameters<typeof getBase64EncodedWireTransaction>[0],
          ), {
          encoding: "base64",
          preflightCommitment: COMMITMENT,
        })
        .send();
      await this.confirm(signature, prepared.lastValidBlockHeight);
      return signature;
    } catch (error) {
      throw wrapSendError(error);
    }
  }
}

const messageId = (bytes: ReadonlyUint8Array): string =>
  createHash("sha256").update(Uint8Array.from(bytes)).digest("hex");

export const programAddressOf = (): Address => BUMP_ARENA_PROGRAM_ADDRESS;
