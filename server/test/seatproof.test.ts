import { generateKeyPairSync, sign } from "node:crypto";
import { seatMessage } from "@bump/shared";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import {
  base58Decode,
  sameSessionKey,
  verifySeatProof,
} from "../src/chain/seatProof";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const base58Encode = (bytes: Buffer): string => {
  let value = BigInt(`0x${bytes.toString("hex") || "0"}`);
  let out = "";
  while (value > 0n) {
    out = ALPHABET[Number(value % 58n)] + out;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = `1${out}`;
  }
  return out;
};

const message = seatMessage({
  matchId: `0x${"ab".repeat(32)}`,
  wallet: "Wallet1111111111111111111111111111111111111",
  roomId: "room",
  issuedAt: 1_790_000_000_000,
});

describe("seat proof", () => {
  it("round-trips base58", () => {
    const raw = Buffer.from([0, 0, 1, 2, 250, 255]);
    expect(base58Decode(base58Encode(raw))?.equals(raw)).toBe(true);
    expect(base58Decode("0OIl")).toBeNull();
  });

  it("verifies an evm session key signature", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const signature = await account.signMessage({ message });
    expect(
      await verifySeatProof("evm", {
        message,
        signature,
        sessionKey: account.address,
      }),
    ).toBe(true);
    expect(
      await verifySeatProof("evm", {
        message: `${message}x`,
        signature,
        sessionKey: account.address,
      }),
    ).toBe(false);
  });

  it("verifies an ed25519 session key signature in base58 and base64", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
    const sessionKey = base58Encode(Buffer.from(raw));
    const signature = sign(null, Buffer.from(message), privateKey);
    for (const encoded of [
      base58Encode(signature),
      signature.toString("base64"),
    ]) {
      expect(
        await verifySeatProof("ed25519", {
          message,
          signature: encoded,
          sessionKey,
        }),
      ).toBe(true);
    }
    expect(
      await verifySeatProof("ed25519", {
        message: `${message}x`,
        signature: base58Encode(signature),
        sessionKey,
      }),
    ).toBe(false);
    expect(
      await verifySeatProof("ed25519", {
        message,
        signature: "nonsense",
        sessionKey,
      }),
    ).toBe(false);
  });

  it("compares session keys by scheme", () => {
    expect(sameSessionKey("evm", "0xAB", "0xab")).toBe(true);
    expect(sameSessionKey("ed25519", "Ab", "ab")).toBe(false);
  });
});
