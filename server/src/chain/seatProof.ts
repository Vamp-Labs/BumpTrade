import { createPublicKey, verify } from "node:crypto";
import type { SeatScheme } from "@bump/shared";
import { recoverMessageAddress } from "viem";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export const base58Decode = (text: string): Buffer | null => {
  let value = 0n;
  for (const char of text) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) return null;
    value = value * 58n + BigInt(digit);
  }
  const hex = value === 0n ? "" : value.toString(16);
  const body = Buffer.from(hex.length % 2 === 0 ? hex : `0${hex}`, "hex");
  let zeros = 0;
  while (zeros < text.length && text[zeros] === "1") zeros += 1;
  return Buffer.concat([Buffer.alloc(zeros), body]);
};

const decodeSignature = (text: string): Buffer[] => {
  const options: Buffer[] = [];
  const b58 = base58Decode(text);
  if (b58?.length === 64) options.push(b58);
  const b64 = Buffer.from(text, "base64");
  if (b64.length === 64) options.push(b64);
  return options;
};

export const sameSessionKey = (
  scheme: SeatScheme,
  a: string,
  b: string,
): boolean => (scheme === "evm" ? a.toLowerCase() === b.toLowerCase() : a === b);

export const verifySeatProof = async (
  scheme: SeatScheme,
  input: { message: string; signature: string; sessionKey: string },
): Promise<boolean> => {
  if (scheme === "evm") {
    const recovered = await recoverMessageAddress({
      message: input.message,
      signature: input.signature as `0x${string}`,
    });
    return recovered.toLowerCase() === input.sessionKey.toLowerCase();
  }
  const raw = base58Decode(input.sessionKey);
  if (raw?.length !== 32) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_PREFIX, raw]),
      format: "der",
      type: "spki",
    });
    const message = Buffer.from(input.message, "utf8");
    return decodeSignature(input.signature).some((signature) =>
      verify(null, message, key, signature),
    );
  } catch {
    return false;
  }
};
