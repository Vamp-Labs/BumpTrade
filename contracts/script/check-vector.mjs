import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashTypedData, recoverTypedDataAddress } from "viem";

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");

const bigints = {
  "result-vector.json": ["endedAt"],
  "join-vector.json": ["deadline"],
};

let failed = false;
for (const [name, fields] of Object.entries(bigints)) {
  const vector = JSON.parse(readFileSync(resolve(dir, name), "utf8"));
  const message = { ...vector.message };
  for (const f of fields) message[f] = BigInt(message[f]);
  const typedData = {
    domain: vector.domain,
    types: vector.types,
    primaryType: vector.primaryType,
    message,
  };

  const digest = hashTypedData(typedData);
  const recovered = await recoverTypedDataAddress({
    ...typedData,
    signature: vector.signature,
  });

  console.log(`${name} ${digest}`);

  if (digest !== vector.digest) {
    console.error(`${name}: digest mismatch, expected ${vector.digest}`);
    failed = true;
  }
  if (recovered.toLowerCase() !== vector.signerAddress.toLowerCase()) {
    console.error(`${name}: signer mismatch, recovered ${recovered}`);
    failed = true;
  }
}
if (failed) process.exit(1);
