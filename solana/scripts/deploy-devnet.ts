import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findConfigPda, getInitializeInstructionAsync, PROGRAM_ID } from "@bump/sol-client";
import {
  address,
  appendTransactionMessageInstructions,
  type Address,
  type ClusterUrl,
  type ReadonlyUint8Array,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressEncoder,
  getSignatureFromTransaction,
  type Instruction,
  AccountRole,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const SYSTEM_PROGRAM = address("11111111111111111111111111111111");

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : fallback;
}

function need(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`missing --${name}`);
    process.exit(1);
  }
  return value;
}

const cluster = arg("cluster", "devnet") as "devnet" | "local";
if (cluster !== "devnet" && cluster !== "local") throw new Error("--cluster must be devnet or local");
const rpcUrl = arg("rpc", cluster === "local" ? "http://127.0.0.1:8899" : "https://api.devnet.solana.com") as string;
if (cluster === "devnet" && !rpcUrl.includes("devnet")) throw new Error("refusing: devnet deploys need a devnet RPC url");
if (cluster === "local" && !/127\.0\.0\.1|localhost/.test(rpcUrl)) throw new Error("refusing: local deploys need a localhost RPC url");
const wsUrl = arg("ws", rpcUrl.replace(/^http/, "ws").replace(":8899", ":8900"));

const walletPath = (arg("provider.wallet") ?? process.env.ANCHOR_WALLET ?? "").replace(/^~/, homedir());
if (!walletPath) throw new Error("set ANCHOR_WALLET or pass --provider.wallet <deployer keypair file>");
const mintAuthority = address(need("mint-authority", arg("mint-authority")));
const operator = address(need("operator", arg("operator")));
const resultSigner = address(need("result-signer", arg("result-signer")));
const stake = BigInt(arg("stake", "100000000000") as string);
const startBalance = Number(arg("start-balance", "100"));
const settleWindowS = BigInt(arg("settle-window", "600") as string);

const soPath = join(root, "target/deploy/bump_arena.so");
const programKeypair = join(root, "target/deploy/bump_arena-keypair.json");
if (!existsSync(soPath)) throw new Error("run `anchor build` first");

const deployer = await createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(readFileSync(walletPath, "utf8"))));
const treasuryOwner = address(arg("treasury-owner", deployer.address) as string);

const rpc = createSolanaRpc(rpcUrl as ClusterUrl);
const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl as ClusterUrl);
const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions } as unknown as Parameters<typeof sendAndConfirmTransactionFactory>[0]);

async function send(instructions: Instruction[], extraSigners: Awaited<ReturnType<typeof generateKeyPairSigner>>[] = []) {
  void extraSigners;
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(deployer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const signed = await signTransactionMessageWithSigners(message);
  assertIsTransactionWithBlockhashLifetime(signed);
  await sendAndConfirm(signed, { commitment: "confirmed" });
  return getSignatureFromTransaction(signed);
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function u64(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
}

function concat(...parts: ReadonlyUint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function createTokenAccountInstructions(
  signer: Awaited<ReturnType<typeof generateKeyPairSigner>>,
  space: bigint,
  init: Instruction,
): Promise<Instruction[]> {
  const lamports = await rpc.getMinimumBalanceForRentExemption(space).send();
  const createAccount: Instruction = {
    programAddress: SYSTEM_PROGRAM,
    accounts: [
      { address: deployer.address, role: AccountRole.WRITABLE_SIGNER, signer: deployer } as never,
      { address: signer.address, role: AccountRole.WRITABLE_SIGNER, signer } as never,
    ],
    data: concat(u32(0), u64(lamports), u64(space), getAddressEncoder().encode(TOKEN_PROGRAM)),
  };
  return [createAccount, init];
}

console.log(`cluster ${cluster}  rpc ${rpcUrl}`);
console.log(`program ${PROGRAM_ID}  deployer ${deployer.address}`);

const deploy = spawnSync(
  "solana",
  [
    "program",
    "deploy",
    soPath,
    "--program-id",
    programKeypair,
    "--keypair",
    walletPath,
    "--url",
    rpcUrl,
    "--upgrade-authority",
    walletPath,
  ],
  { stdio: "inherit" },
);
if (deploy.status !== 0) throw new Error("solana program deploy failed");

const mint = await generateKeyPairSigner();
const mintInstructions = await createTokenAccountInstructions(mint, 82n, {
  programAddress: TOKEN_PROGRAM,
  accounts: [{ address: mint.address, role: AccountRole.WRITABLE }],
  data: concat(new Uint8Array([20, 9]), getAddressEncoder().encode(mintAuthority), new Uint8Array([0])),
});
const mintSig = await send(mintInstructions, [mint]);
console.log(`mint ${mint.address}  tx ${mintSig}`);

const treasury = await generateKeyPairSigner();
const treasuryInstructions = await createTokenAccountInstructions(treasury, 165n, {
  programAddress: TOKEN_PROGRAM,
  accounts: [
    { address: treasury.address, role: AccountRole.WRITABLE },
    { address: mint.address, role: AccountRole.READONLY },
  ],
  data: concat(new Uint8Array([18]), getAddressEncoder().encode(treasuryOwner)),
});
const treasurySig = await send(treasuryInstructions, [treasury]);
console.log(`treasury ${treasury.address}  tx ${treasurySig}`);

const init = await getInitializeInstructionAsync({
  admin: deployer,
  mint: mint.address,
  treasury: treasury.address,
  treasuryArg: treasury.address,
  operator,
  resultSigner,
  stake,
  startBalance,
  settleWindowS,
});
const initSig = await send([init]);
const slot = Number(await rpc.getSlot({ commitment: "confirmed" }).send());
const [configPda] = await findConfigPda();
console.log(`initialize tx ${initSig}  config ${configPda}`);

const out = {
  cluster: cluster === "local" ? "localnet" : "devnet",
  programId: PROGRAM_ID as Address,
  mint: mint.address,
  treasury: treasury.address,
  configPda,
  slot,
  txSig: initSig,
  pending: false,
};
const outDir = join(root, "deployments");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, cluster === "local" ? "local.json" : "devnet.json");
writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${outPath}`);
