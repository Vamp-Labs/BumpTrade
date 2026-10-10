import { getBase58Decoder } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const KEY = `0x${"ab".repeat(32)}`;

describe("loadConfig", () => {
  it("fails fast on missing chain variables without echoing values", () => {
    expect(() => loadConfig({ CHAIN: "evm" })).toThrow(
      /ARENA_ADDRESS, SIGNER_PRIVATE_KEY, RELAYER_PRIVATE_KEY/,
    );
  });

  it("rejects a malformed key without printing it", () => {
    const env = {
      CHAIN: "evm",
      ARENA_ADDRESS: `0x${"11".repeat(20)}`,
      SIGNER_PRIVATE_KEY: "not-a-key",
      RELAYER_PRIVATE_KEY: KEY,
    };
    let message = "";
    try {
      loadConfig(env);
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain("SIGNER_PRIVATE_KEY");
    expect(message).not.toContain("not-a-key");
  });

  it("applies defaults from the economy constants", () => {
    const config = loadConfig({
      CHAIN: "evm",
      ARENA_ADDRESS: `0x${"11".repeat(20)}`,
      SIGNER_PRIVATE_KEY: KEY,
      RELAYER_PRIVATE_KEY: KEY,
    });
    expect(config.stakeAmount).toBe(100000000000000000000n);
    expect(config.relayerMinBalance).toBe(2000000000000000n);
    expect(config.corsOrigins).toEqual(["http://localhost:5173"]);
    expect(config.limits.faucetPerIpPerHour).toBe(5);
    expect(config.limits.joinPerIpPerHour).toBe(20);
    expect(config.startBalance).toBe(100);
    expect(config.matchDurationS).toBe(90);
    expect(config.joinWindowS).toBe(120);
    expect(config.fillTimerS).toBe(30);
    expect(config.port).toBe(2567);
    expect(config.maxPlayers).toBe(8);
    expect(config.chain).toBe("evm");
  });

  it("rejects an unknown CHAIN and requires the Solana secrets", () => {
    expect(() => loadConfig({ CHAIN: "other" })).toThrow(/CHAIN must be/);
    expect(() => loadConfig({ CHAIN: "solana" })).toThrow(
      /SOL_RELAYER_SECRET, SOL_RESULT_SIGNER_SECRET, SOL_MINT_AUTHORITY_SECRET/,
    );
  });

  it("loads the Solana config with C8 defaults without echoing secrets", () => {
    const secret = getBase58Decoder().decode(new Uint8Array(64).fill(7));
    const mint = "So11111111111111111111111111111111111111112";
    const config = loadConfig({
      CHAIN: "solana",
      SOL_RELAYER_SECRET: secret,
      SOL_RESULT_SIGNER_SECRET: secret,
      SOL_MINT_AUTHORITY_SECRET: secret,
      SOL_MINT: mint,
      SOL_TREASURY: mint,
    });
    expect(config.chain).toBe("solana");
    expect(config.evm).toBeNull();
    expect(config.solana?.cluster).toBe("devnet");
    expect(config.solana?.relayerSecret).toHaveLength(64);
    expect(config.stakeAmount).toBe(100000000000n);
    expect(config.relayerMinBalance).toBe(50000000n);
    expect(config.databaseSchema).toBe("bump_sol");
    let message = "";
    try {
      loadConfig({
        CHAIN: "solana",
        SOL_RELAYER_SECRET: "bad-secret",
        SOL_RESULT_SIGNER_SECRET: secret,
        SOL_MINT_AUTHORITY_SECRET: secret,
        SOL_MINT: mint,
        SOL_TREASURY: mint,
      });
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain("SOL_RELAYER_SECRET");
    expect(message).not.toContain("bad-secret");
  });
});
