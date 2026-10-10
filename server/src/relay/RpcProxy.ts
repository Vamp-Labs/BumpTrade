import { RateLimiter } from "./RateLimiter";

const ALLOWED = new Set([
  "getAccountInfo",
  "getMultipleAccounts",
  "getBalance",
  "getTokenAccountsByOwner",
  "getTokenAccountBalance",
  "getSignatureStatuses",
  "getLatestBlockhash",
  "getSlot",
  "getHealth",
]);

const MAX_BATCH = 8;
const MAX_BODY_CHARS = 16_384;

export interface RpcProxyOptions {
  url: string;
  now: () => number;
  perMinute?: number;
  cacheMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface RpcProxyResult {
  status: number;
  body: unknown;
}

const rpcError = (status: number, code: number, message: string): RpcProxyResult => ({
  status,
  body: { jsonrpc: "2.0", id: null, error: { code, message } },
});

export class RpcProxy {
  private readonly limiter: RateLimiter;
  private readonly cache = new Map<string, { at: number; value: RpcProxyResult }>();
  private readonly cacheMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: RpcProxyOptions) {
    this.limiter = new RateLimiter(options.perMinute ?? 600, 60_000, options.now);
    this.cacheMs = options.cacheMs ?? 1200;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async handle(body: unknown, ip: string): Promise<RpcProxyResult> {
    const calls = Array.isArray(body) ? body : [body];
    if (calls.length === 0 || calls.length > MAX_BATCH) {
      return rpcError(400, -32600, "invalid batch size");
    }
    for (const call of calls) {
      const method = (call as { method?: unknown } | null)?.method;
      if (typeof method !== "string" || !ALLOWED.has(method)) {
        return rpcError(403, -32601, "method not allowed");
      }
    }
    const raw = JSON.stringify(body);
    if (raw.length > MAX_BODY_CHARS) return rpcError(413, -32600, "request too large");

    const cached = this.cache.get(raw);
    if (cached && this.options.now() - cached.at < this.cacheMs) return cached.value;

    if (this.limiter.retryAfterS(ip) > 0) {
      return rpcError(429, -32005, "rate limited");
    }
    this.limiter.record(ip);

    let response: Response;
    try {
      response = await this.fetchImpl(this.options.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: raw,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      return rpcError(502, -32603, "upstream unavailable");
    }
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      return rpcError(502, -32603, "upstream returned invalid data");
    }
    const result: RpcProxyResult = { status: response.ok ? 200 : response.status, body: parsed };
    if (response.ok) {
      this.cache.set(raw, { at: this.options.now(), value: result });
      if (this.cache.size > 500) {
        const cutoff = this.options.now() - this.cacheMs;
        for (const [key, entry] of this.cache) if (entry.at < cutoff) this.cache.delete(key);
      }
    }
    return result;
  }
}
