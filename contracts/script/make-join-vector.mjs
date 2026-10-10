import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashTypedData } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const publicAnvilKey1 =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const account = privateKeyToAccount(publicAnvilKey1);

const domain = {
  name: "BumpArena",
  version: "1",
  chainId: 46630,
  verifyingContract: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
};

const types = {
  JoinIntent: [
    { name: "matchId", type: "bytes32" },
    { name: "player", type: "address" },
    { name: "sessionKey", type: "address" },
    { name: "vehicleId", type: "uint8" },
    { name: "deadline", type: "uint256" },
  ],
};

const message = {
  matchId:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  player: account.address,
  sessionKey: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  vehicleId: 3,
  deadline: "1790003600",
};

const typedData = {
  domain,
  types,
  primaryType: "JoinIntent",
  message: { ...message, deadline: BigInt(message.deadline) },
};

const digest = hashTypedData(typedData);
const signature = await account.signTypedData(typedData);

const vector = {
  domain,
  types,
  primaryType: "JoinIntent",
  message,
  digest,
  signerAddress: account.address,
  signature,
};

const out = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../test/fixtures/join-vector.json",
);
writeFileSync(out, `${JSON.stringify(vector, null, 2)}\n`);
console.log(digest);
