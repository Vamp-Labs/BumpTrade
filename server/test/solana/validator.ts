import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  getInitializeInstructionAsync,
  PROGRAM_ID,
} from "@bump/sol-client";
import {
  AccountRole,
  type Address,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressEncoder,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  type Instruction,
  type KeyPairSigner,
  pipe,
  type ReadonlyUint8Array,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import {
  SYSTEM_PROGRAM,
  TOKEN_PROGRAM,
} from "../../src/chain/solana/token";

const SOLANA_BIN = `${process.env.HOME}/.local/share/solana/install/active_release/bin/solana-test-validator`;
export const PROGRAM_SO = resolve(
  __dirname,
  "../../../solana/target/deploy/bump_arena.so",
);
export const canRunValidator = existsSync(SOLANA_BIN) && existsSync(PROGRAM_SO);

export interface Validator {
  rpcUrl: string;
  rpc: ReturnType<typeof createSolanaRpc>;
  stop(): Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const startValidator = async (): Promise<Validator> => {
  const base = 21000 + (process.pid % 8000);
  const rpcPort = base;
  const ledger = mkdtempSync(join(tmpdir(), "bump-sol-ledger-"));
  const proc: ChildProcess = spawn(
    SOLANA_BIN,
    [
      "--reset",
      "--quiet",
      "--ledger",
      ledger,
      "--bind-address",
      "127.0.0.1",
      "--rpc-port",
      String(rpcPort),
      "--faucet-port",
      String(rpcPort + 10),
      "--gossip-port",
      String(rpcPort + 11),
      "--dynamic-port-range",
      `${rpcPort + 20}-${rpcPort + 80}`,
      "--bpf-program",
      PROGRAM_ID,
      PROGRAM_SO,
    ],
    { stdio: "ignore" },
  );
  const rpcUrl = `http://127.0.0.1:${rpcPort}`;
  const rpc = createSolanaRpc(rpcUrl);
  const end = Date.now() + 90_000;
  for (;;) {
    try {
      await rpc.getSlot({ commitment: "confirmed" }).send();
      const height = await rpc.getBlockHeight({ commitment: "confirmed" }).send();
      if (height > 5n) break;
    } catch {
      if (Date.now() > end) throw new Error("validator did not start");
    }
    await sleep(300);
  }
  return {
    rpcUrl,
    rpc,
    stop: async () => {
      const exited = new Promise<void>((resolveExit) =>
        proc.once("exit", () => resolveExit()),
      );
      proc.kill("SIGTERM");
      const timer = setTimeout(() => proc.kill("SIGKILL"), 10_000);
      await exited;
      clearTimeout(timer);
    },
  };
};

type AnyIx = Instruction<string, readonly never[]>;

export const sendTx = async (
  v: Validator,
  payer: KeyPairSigner,
  instructions: Instruction[],
): Promise<string> => {
  const { value: bh } = await v.rpc
    .getLatestBlockhash({ commitment: "confirmed" })
    .send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
    (m) => appendTransactionMessageInstructions(instructions as AnyIx[], m),
  );
  const signed = await signTransactionMessageWithSigners(message);
  const signature = getSignatureFromTransaction(signed);
  await v.rpc
    .sendTransaction(getBase64EncodedWireTransaction(signed), {
      encoding: "base64",
      preflightCommitment: "confirmed",
    })
    .send();
  for (let i = 0; i < 200; i++) {
    const { value } = await v.rpc.getSignatureStatuses([signature]).send();
    const status = value[0];
    if (status?.err) throw new Error(`tx failed ${JSON.stringify(status.err, (_k, x) => (typeof x === "bigint" ? x.toString() : x))}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return signature;
    await sleep(200);
  }
  throw new Error("tx not confirmed");
};

export const airdrop = async (v: Validator, to: Address, sol: bigint) => {
  const rpc = v.rpc as unknown as {
    requestAirdrop(
      to: Address,
      lamports: bigint,
    ): { send(): Promise<Parameters<typeof v.rpc.getSignatureStatuses>[0][number]> };
  };
  const signature = await rpc.requestAirdrop(to, sol * 1_000_000_000n).send();
  for (let i = 0; i < 200; i++) {
    const { value } = await v.rpc.getSignatureStatuses([signature]).send();
    const status = value[0];
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await sleep(200);
  }
  throw new Error("airdrop not confirmed");
};

const u32 = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
};
const u64 = (n: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
};
const concat = (...parts: ReadonlyUint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

export interface Deployed {
  mint: Address;
  treasury: Address;
  admin: KeyPairSigner;
}

export const deployLocal = async (
  v: Validator,
  opts: {
    payer: KeyPairSigner;
    mintAuthority: Address;
    operator: Address;
    resultSigner: Address;
    stake: bigint;
    startBalance: number;
  },
): Promise<Deployed> => {
  const { payer } = opts;
  const create = async (signer: KeyPairSigner, space: bigint, init: Instruction) => {
    const lamports = await v.rpc.getMinimumBalanceForRentExemption(space).send();
    return [
      {
        programAddress: SYSTEM_PROGRAM,
        accounts: [
          { address: payer.address, role: AccountRole.WRITABLE_SIGNER, signer: payer } as never,
          { address: signer.address, role: AccountRole.WRITABLE_SIGNER, signer } as never,
        ],
        data: concat(u32(0), u64(lamports), u64(space), getAddressEncoder().encode(TOKEN_PROGRAM)),
      } as Instruction,
      init,
    ];
  };
  const mint = await generateKeyPairSigner();
  await sendTx(
    v,
    payer,
    await create(mint, 82n, {
      programAddress: TOKEN_PROGRAM,
      accounts: [{ address: mint.address, role: AccountRole.WRITABLE }],
      data: concat(new Uint8Array([20, 9]), getAddressEncoder().encode(opts.mintAuthority), new Uint8Array([0])),
    }),
  );
  const treasury = await generateKeyPairSigner();
  await sendTx(
    v,
    payer,
    await create(treasury, 165n, {
      programAddress: TOKEN_PROGRAM,
      accounts: [
        { address: treasury.address, role: AccountRole.WRITABLE },
        { address: mint.address, role: AccountRole.READONLY },
      ],
      data: concat(new Uint8Array([18]), getAddressEncoder().encode(payer.address)),
    }),
  );
  const init = await getInitializeInstructionAsync({
    admin: payer,
    mint: mint.address,
    treasury: treasury.address,
    treasuryArg: treasury.address,
    operator: opts.operator,
    resultSigner: opts.resultSigner,
    stake: opts.stake,
    startBalance: opts.startBalance,
    settleWindowS: 600,
  });
  await sendTx(v, payer, [init]);
  return { mint: mint.address, treasury: treasury.address, admin: payer };
};
