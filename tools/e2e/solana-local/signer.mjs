import { createServer } from "node:http";
import { sign as edSign } from "node:crypto";
import { signWire, parseTx } from "./lib.mjs";

// HTTP signer standing in for the wallet's secure enclave. keys[idx] = key object from newKey().
export function startSigner(keys, port = 0) {
  const state = { calls: [], mode: {}, log: [] };
  const srv = createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-private-network", "true");
    if (req.method === "OPTIONS") { res.setHeader("access-control-allow-headers", "*"); res.writeHead(204); return res.end(); }
    const url = new URL(req.url, "http://x");
    const idx = Number(url.searchParams.get("w"));
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const key = keys[idx];
    try {
      if (url.pathname === "/sign") {
        const mode = state.mode[idx] ?? {};
        const t0 = Date.now();
        const call = { idx, at: t0, len: body.length, parsed: null };
        state.calls.push(call);
        if (mode.delayMs) { const d = mode.delayMs; if (mode.once) delete state.mode[idx]; await new Promise((r) => setTimeout(r, d)); }
        let wire = body;
        if (mode.tamper) { wire = Buffer.from(body); const p = parseTx(wire); wire[wire.length - 1] ^= 0x01; call.tampered = true; if (mode.once) delete state.mode[idx]; }
        const { signed, parsed } = signWire(wire, key);
        call.parsed = { sigCount: parsed.sigCount, keys: parsed.keys.slice(0, parsed.numSigners), signedAt: Date.now() };
        res.writeHead(200, { "content-type": "application/octet-stream" });
        return res.end(signed);
      }
      if (url.pathname === "/signMessage") {
        res.writeHead(200); return res.end(edSign(null, body, key.priv));
      }
      res.writeHead(404); res.end("nope");
    } catch (e) { res.writeHead(500); res.end(String(e.message)); }
  });
  return new Promise((r) => srv.listen(port, "127.0.0.1", () => r({ srv, state, url: `http://127.0.0.1:${srv.address().port}` })));
}
