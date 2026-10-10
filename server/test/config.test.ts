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

  it("fails fast with a clear message for CHAIN=solana until phase B", () => {
    expect(() => loadConfig({ CHAIN: "solana" })).toThrow(
      /CHAIN=solana is not available yet/,
    );
    expect(() => loadConfig({ CHAIN: "other" })).toThrow(/CHAIN must be/);
  });
});
