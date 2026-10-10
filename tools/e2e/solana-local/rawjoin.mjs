#!/usr/bin/env node
// Protocol-level negative tests against the game server (no browser): server-side expiry, junk submit, insufficient BUMP.
// usage: node rawjoin.mjs <serverHttpUrl> ; prints one JSON line per case.
import { Client } from "@colyseus/sdk";
import { newKey, signWire, sleep } from "./lib.mjs";

const server = process.argv[2] ?? "http://localhost:2567";
const wait = Number(process.env.RAW_EXPIRE_WAIT_MS ?? 62000);
const out = (o) => console.log(JSON.stringify(o));

async function faucet(wallet) {
  const r = await fetch(`${server}/faucet`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet }) });
  return r.status;
}
function open() {
  return new Client(server.replace(/^http/, "ws")).joinOrCreate("arena", { vehicleId: 0 }).then((room) => {
    const events = [];
    const waiters = [];
    room.onMessage("ev", (e) => { events.push(e); for (const w of [...waiters]) w(e); });
    const next = (pred, ms = 15000) => new Promise((res) => {
      const hit = events.find(pred); if (hit) return res(hit);
      const t = setTimeout(() => res(null), ms);
      const w = (e) => { if (pred(e)) { clearTimeout(t); waiters.splice(waiters.indexOf(w), 1); res(e); } };
      waiters.push(w);
    });
    return { room, events, next };
  });
}
const matchIdOf = (room) => new Promise((res) => { const t = setInterval(() => { const id = room.state?.matchId; if (id) { clearInterval(t); res(id); } }, 100); });

const funded = newKey(), broke = newKey(), session = newKey();
const st = await faucet(funded.address);
out({ case: "setup", faucetStatus: st });
await sleep(3000);
const { room, next, events } = await open();
const matchId = await matchIdOf(room);

events.length = 0;
// 1. insufficient BUMP at prepare
room.send("solJoinPrepare", { matchId, player: broke.address, sessionKey: session.address, vehicleId: 0 });
const e1 = await next((e) => e.t === "error" || e.t === "solJoinTx");
out({ case: "insufficient-bump", event: e1 });

events.length = 0;
// 2. junk submit without a prepared tx
room.send("solJoinSubmit", { matchId, signedTx: Buffer.from("not a transaction at all").toString("base64") });
const e2 = await next((e) => e.t === "error" || e.t === "joinResult");
out({ case: "junk-submit", event: e2 });

events.length = 0;
// 3. valid prepare, sign correctly, submit after the 60 s ttl
room.send("solJoinPrepare", { matchId, player: funded.address, sessionKey: session.address, vehicleId: 0 });
const prep = await next((e) => e.t === "solJoinTx" || e.t === "error", 20000);
if (prep?.t !== "solJoinTx") { out({ case: "expired-submit", error: "no prepare reply", event: prep }); process.exit(0); }
const { signed } = signWire(Buffer.from(prep.tx, "base64"), funded);
const ttl = prep.expiresAt - Date.now();
out({ case: "prepared", ttlMs: ttl });
await sleep(Math.max(ttl + 1500, wait));
room.send("solJoinSubmit", { matchId, signedTx: signed.toString("base64") });
const e3 = await next((e) => e.t === "error" || e.t === "joinResult", 20000);
out({ case: "expired-submit", event: e3 });

events.length = 0;
// 4. replay the same signed tx a second time (must not double-join)
room.send("solJoinSubmit", { matchId, signedTx: signed.toString("base64") });
const e4 = await next((e) => e.t === "error" || e.t === "joinResult", 8000);
out({ case: "replayed-submit", event: e4 });
await room.leave();
process.exit(0);
