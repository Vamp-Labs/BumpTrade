import { generateKeyPairSync, createPrivateKey, sign as edSign, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function b58enc(buf) {
  let n = 0n;
  for (const b of buf) n = (n << 8n) | BigInt(b);
  let s = "";
  while (n > 0n) { s = ALPHA[Number(n % 58n)] + s; n /= 58n; }
  for (const b of buf) { if (b === 0) s = "1" + s; else break; }
  return s;
}
export function b58dec(s) {
  let n = 0n;
  for (const c of s) { const i = ALPHA.indexOf(c); if (i < 0) throw new Error("bad b58"); n = n * 58n + BigInt(i); }
  const out = [];
  while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
  for (const c of s) { if (c === "1") out.unshift(0); else break; }
  return Uint8Array.from(out);
}

const PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex");
export function newKey() {
  const seed = randomBytes(32);
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8, seed]), format: "der", type: "pkcs8" });
  const pubDer = require_pub(priv);
  const secret = Buffer.concat([seed, pubDer]);
  return { seed, pub: pubDer, address: b58enc(pubDer), secretB58: b58enc(secret), secretArray: [...secret], priv };
}
import { createPublicKey } from "node:crypto";
function require_pub(priv) {
  const der = createPublicKey(priv).export({ format: "der", type: "spki" });
  return der.subarray(der.length - 32);
}
export function saveKeypair(k, path) { writeFileSync(path, JSON.stringify(k.secretArray), { mode: 0o600 }); }

// parse a wire transaction: returns { sigCount, msgStart, numSigners, keys }
export function parseTx(wire) {
  let o = 0;
  const cu = () => { let v = 0, sh = 0; for (;;) { const b = wire[o++]; v |= (b & 0x7f) << sh; if (!(b & 0x80)) break; sh += 7; } return v; };
  const sigCount = cu();
  const sigStart = o;
  o += sigCount * 64;
  const msgStart = o;
  if (wire[o] & 0x80) o += 1;
  const numSigners = wire[o];
  o += 3;
  const nKeys = cu();
  const keys = [];
  for (let i = 0; i < nKeys; i++) { keys.push(b58enc(wire.subarray(o, o + 32))); o += 32; }
  return { sigCount, sigStart, msgStart, numSigners, keys };
}
export function signWire(wire, key) {
  const p = parseTx(wire);
  const idx = p.keys.indexOf(key.address);
  if (idx < 0 || idx >= p.numSigners) throw new Error("wallet is not a signer of this tx");
  const sig = edSign(null, wire.subarray(p.msgStart), key.priv);
  const out = Buffer.from(wire);
  sig.copy(out, p.sigStart + idx * 64);
  return { signed: out, parsed: p, idx };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function rpc(url, method, params = []) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}
export async function tokenBal(url, owner, mint) {
  const r = await rpc(url, "getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }]);
  return r.value.reduce((s, a) => s + BigInt(a.account.data.parsed.info.tokenAmount.amount), 0n);
}
export async function solBal(url, addr) { return BigInt((await rpc(url, "getBalance", [addr, { commitment: "confirmed" }])).value); }
