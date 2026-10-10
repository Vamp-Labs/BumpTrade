import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createRetryingRpc } from "../src/chain/solana/SolanaArenaChain";

let server: Server | null = null;

const serve = async (failures: number): Promise<{ url: string; hits: () => number }> => {
  let hits = 0;
  server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      hits += 1;
      if (hits <= failures) {
        res.statusCode = 429;
        res.end("rate limited");
        return;
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "ok" }));
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, hits: () => hits };
};

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
});

describe("createRetryingRpc", () => {
  it("retries HTTP 429 and then succeeds", async () => {
    const s = await serve(2);
    const rpc = createRetryingRpc(s.url);
    await expect(rpc.getHealth().send()).resolves.toBe("ok");
    expect(s.hits()).toBe(3);
  });

  it("gives up after the attempt budget", async () => {
    const s = await serve(100);
    const rpc = createRetryingRpc(s.url, 2);
    await expect(rpc.getHealth().send()).rejects.toBeTruthy();
    expect(s.hits()).toBe(2);
  });
});
