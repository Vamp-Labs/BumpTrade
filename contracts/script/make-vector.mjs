import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashTypedData } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const publicAnvilKey0 =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const account = privateKeyToAccount(publicAnvilKey0);

const domain = {
  name: "BumpArena",
  version: "1",
  chainId: 46630,
  verifyingContract: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
};

const types = {
  Result: [
    { name: "matchId", type: "bytes32" },
    { name: "players", type: "address[]" },
    { name: "finalBalances", type: "uint32[]" },
    { name: "ranks", type: "uint8[]" },
    { name: "inputLogHash", type: "bytes32" },
    { name: "replayHash", type: "bytes32" },
    { name: "endedAt", type: "uint64" },
  ],
};

const message = {
  matchId:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  players: [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  ],
  finalBalances: [30, 205, 65],
  ranks: [3, 1, 2],
  inputLogHash:
    "0x2222222222222222222222222222222222222222222222222222222222222222",
  replayHash:
    "0x3333333333333333333333333333333333333333333333333333333333333333",
  endedAt: 1790000000,
};

const typedData = {
  domain,
  types,
  primaryType: "Result",
  message: { ...message, endedAt: BigInt(message.endedAt) },
};

const digest = hashTypedData(typedData);
const signature = await account.signTypedData(typedData);

const vector = {
  domain,
  types,
  primaryType: "Result",
  message,
  result: message,
  digest,
  signerAddress: account.address,
  signature,
};

const out = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../test/fixtures/result-vector.json",
);
writeFileSync(out, `${JSON.stringify(vector, null, 2)}\n`);
console.log(digest);
