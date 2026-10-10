import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, getAddress, http, parseAbi } from "viem";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chainId = Number(process.env.CHAIN_ID ?? 46630);
const rpcUrl = process.env.RH_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com";

const run = JSON.parse(
  readFileSync(
    resolve(root, `broadcast/Deploy.s.sol/${chainId}/run-latest.json`),
    "utf8",
  ),
);
const created = (name) => {
  const create = run.transactions.find(
    (tx) => tx.contractName === name && tx.transactionType === "CREATE",
  );
  if (!create) throw new Error(`no ${name} CREATE transaction in broadcast file`);
  const receipt = run.receipts.find((r) => r.transactionHash === create.hash);
  if (!receipt) throw new Error(`no receipt for the ${name} deployment`);
  return {
    address: getAddress(create.contractAddress),
    blockNumber: Number(BigInt(receipt.blockNumber)),
    txHash: create.hash,
  };
};

const token = created("MockBUMP");
const arenaRecord = created("BumpArena");
const address = arenaRecord.address;
const client = createPublicClient({ transport: http(rpcUrl) });

for (const a of [token.address, address]) {
  const code = await client.getCode({ address: a });
  if (!code || code === "0x") throw new Error(`no code at ${a} on ${rpcUrl}`);
}

const abi = parseAbi([
  "function owner() view returns (address)",
  "function signer() view returns (address)",
  "function operator() view returns (address)",
  "function treasury() view returns (address)",
  "function settleWindow() view returns (uint64)",
  "function token() view returns (address)",
  "function arena() view returns (address)",
]);
const read = (functionName) =>
  client.readContract({ address, abi, functionName });

const wired = await client.readContract({
  address: token.address,
  abi,
  functionName: "arena",
});
if (wired.toLowerCase() !== address.toLowerCase()) {
  throw new Error(`MockBUMP.arena() is ${wired}, expected ${address}`);
}
const arenaToken = await read("token");
if (arenaToken.toLowerCase() !== token.address.toLowerCase()) {
  throw new Error(`BumpArena.token() is ${arenaToken}, expected ${token.address}`);
}

const deployment = {
  chainId,
  MockBUMP: token,
  BumpArena: arenaRecord,
  owner: await read("owner"),
  signer: await read("signer"),
  operator: await read("operator"),
  treasury: await read("treasury"),
  settleWindow: Number(await read("settleWindow")),
};

const target = process.env.OUT_FILE ?? resolve(root, `deployments/${chainId}.json`);
writeFileSync(target, `${JSON.stringify(deployment, null, 2)}\n`);
console.log(`wrote ${target}`);
console.log(JSON.stringify(deployment, null, 2));
