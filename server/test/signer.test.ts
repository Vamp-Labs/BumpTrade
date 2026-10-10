import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildDomain, RESULT_TYPES } from "@bump/shared";
import { type Address, type Hex, hashTypedData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

const ANVIL_KEY_ZERO: Hex =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

interface Vector {
  domain: { verifyingContract: Address; chainId: number };
  message: {
    matchId: Hex;
    players: Address[];
    finalBalances: number[];
    ranks: number[];
    inputLogHash: Hex;
    replayHash: Hex;
    endedAt: number;
  };
  digest: Hex;
  signerAddress: Address;
  signature: Hex;
}

const vector = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../contracts/test/fixtures/result-vector.json"),
    "utf8",
  ),
) as Vector;

describe("EIP-712 result signing", () => {
  it("reproduces the contract test vector digest and signature", async () => {
    const account = privateKeyToAccount(ANVIL_KEY_ZERO);
    expect(account.address).toBe(vector.signerAddress);

    const domain = buildDomain(
      vector.domain.verifyingContract,
      vector.domain.chainId,
    );
    const message = {
      ...vector.message,
      endedAt: BigInt(vector.message.endedAt),
    };

    const digest = hashTypedData({
      domain,
      types: RESULT_TYPES,
      primaryType: "Result",
      message,
    });
    expect(digest).toBe(vector.digest);

    const signature = await account.signTypedData({
      domain,
      types: RESULT_TYPES,
      primaryType: "Result",
      message,
    });
    expect(signature).toBe(vector.signature);
  });
});
