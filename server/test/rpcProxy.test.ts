import { describe, expect, it } from "vitest";
import { RpcProxy } from "../src/relay/RpcProxy";

const okFetch = (calls: string[]) =>
  (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(String(init?.body));
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

const call = (method: string) => ({ jsonrpc: "2.0", id: 1, method, params: [] });

describe("RpcProxy", () => {
  it("forwards allowed read methods", async () => {
    const calls: string[] = [];
    const proxy = new RpcProxy({ url: "http://x", now: () => 0, fetchImpl: okFetch(calls) });
    const out = await proxy.handle(call("getAccountInfo"), "1.1.1.1");
    expect(out.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("blocks write and unknown methods", async () => {
    const calls: string[] = [];
    const proxy = new RpcProxy({ url: "http://x", now: () => 0, fetchImpl: okFetch(calls) });
    expect((await proxy.handle(call("sendTransaction"), "a")).status).toBe(403);
    expect((await proxy.handle([call("getBalance"), call("requestAirdrop")], "a")).status).toBe(403);
    expect((await proxy.handle({ nope: 1 }, "a")).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("caches identical reads briefly and expires the cache", async () => {
    const calls: string[] = [];
    let t = 0;
    const proxy = new RpcProxy({ url: "http://x", now: () => t, cacheMs: 1000, fetchImpl: okFetch(calls) });
    await proxy.handle(call("getBalance"), "a");
    await proxy.handle(call("getBalance"), "b");
    expect(calls).toHaveLength(1);
    t = 2000;
    await proxy.handle(call("getBalance"), "a");
    expect(calls).toHaveLength(2);
  });

  it("rate limits per ip and rejects oversized batches", async () => {
    const calls: string[] = [];
    let n = 0;
    const proxy = new RpcProxy({ url: "http://x", now: () => 0, perMinute: 3, cacheMs: 0, fetchImpl: okFetch(calls) });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await proxy.handle({ ...call("getSlot"), id: ++n }, "ip")).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
    expect((await proxy.handle(Array.from({ length: 9 }, () => call("getSlot")), "other")).status).toBe(400);
  });

  it("returns 502 when the upstream is down", async () => {
    const fail = (async () => {
      throw new Error("down");
    }) as typeof fetch;
    const proxy = new RpcProxy({ url: "http://x", now: () => 0, fetchImpl: fail });
    expect((await proxy.handle(call("getHealth"), "a")).status).toBe(502);
  });
});
