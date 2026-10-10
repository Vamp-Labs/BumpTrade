#!/usr/bin/env node
// Records the real online flow (connect, faucet, lobby, one-signature join, match, settle, leaderboard) of browser A
// against a live client/server, plus a proof.json with the real settle transaction. Marks give video-time offsets.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Browser, KEYS } from "./cdp.mjs";
import { newKey, rpc, sleep } from "./lib.mjs";
import { startSigner } from "./signer.mjs";
import { walletScript } from "./wallet-inject.mjs";

const E = (k, d) => process.env[k] ?? d;
const CFG = {
  client: E("E2E_CLIENT", "https://client-production-90d9.up.railway.app/"),
  server: E("E2E_SERVER", "https://server-sol-production.up.railway.app"),
  rpc: E("E2E_RPC", "https://api.devnet.solana.com"),
  chromePort: Number(E("E2E_CHROME_PORT", "9333")),
  out: E("DEMO_OUT", "/tmp/bump-demo-capture"),
  width: Number(E("DEMO_W", "1600")),
  height: Number(E("DEMO_H", "900")),
  playMs: Number(E("DEMO_PLAY_MS", "100000")),
};
const frames = `${CFG.out}/frames`;
rmSync(CFG.out, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const marks = {};
let wall0 = 0;
const mark = (name) => { marks[name] = wall0 ? (Date.now() - wall0) / 1000 : 0; console.log(`MARK ${name} ${marks[name].toFixed(1)}s`); };
const panel = (p) => p.eval(`[...document.querySelectorAll('.on-backdrop.show')].map(e=>e.innerText).join('\\n---\\n')`);

async function startRecording(br, page) {
  const list = [];
  let n = 0;
  br.handlers.push((j) => {
    if (j.sessionId !== page.sid || j.method !== "Page.screencastFrame") return;
    const i = n++;
    const at = Date.now();
    if (!wall0) wall0 = at;
    writeFileSync(`${frames}/f${String(i).padStart(6, "0")}.jpg`, Buffer.from(j.params.data, "base64"));
    list.push({ i, at });
    page.send("Page.screencastFrameAck", { sessionId: j.params.sessionId }).catch(() => {});
  });
  await page.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: CFG.width, maxHeight: CFG.height, everyNthFrame: 1 });
  return { list, stop: () => page.send("Page.stopScreencast").catch(() => {}) };
}

function encode(list, outFile) {
  if (list.length < 2) throw new Error("no frames recorded");
  const lines = ["ffconcat version 1.0"];
  for (let k = 0; k < list.length; k++) {
    const dur = k + 1 < list.length ? Math.max(0.01, (list[k + 1].at - list[k].at) / 1000) : 0.5;
    lines.push(`file 'frames/f${String(list[k].i).padStart(6, "0")}.jpg'`, `duration ${dur.toFixed(4)}`);
  }
  lines.push(`file 'frames/f${String(list.at(-1).i).padStart(6, "0")}.jpg'`);
  writeFileSync(`${CFG.out}/list.txt`, lines.join("\n"));
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", `${CFG.out}/list.txt`,
    "-vf", `fps=30,scale=${CFG.width}:${CFG.height}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-movflags", "+faststart", outFile], { stdio: "inherit" });
}

async function connectFlow(p, record) {
  await p.goto(CFG.client);
  await p.waitText("PLAY ONLINE", 30000);
  await sleep(record ? 3500 : 1500);
  if (record) mark("menu");
  await p.clickWait("PLAY ONLINE");
  await p.waitText("WALLET", 8000, ".on-backdrop.show");
  await sleep(record ? 1800 : 300);
  if (record) mark("walletPicker");
  await p.clickWait("E2E Mock Wallet");
  await p.waitText("Address", 10000, ".on-backdrop.show");
  await sleep(record ? 1500 : 300);
  if (record) mark("connected");
}

async function main() {
  const keys = [newKey(), newKey()];
  const sg = await startSigner(keys);
  const br = await Browser.connect(CFG.chromePort);
  const A = await br.newPage({ script: walletScript({ address: keys[0].address, signerUrl: sg.url, idx: 0 }), width: CFG.width, height: CFG.height, name: "A" });
  const B = await br.newPage({ script: walletScript({ address: keys[1].address, signerUrl: sg.url, idx: 1 }), width: 480, height: 270, name: "B" });
  const rec = await startRecording(br, A);
  try {
    await Promise.all([connectFlow(A, true), connectFlow(B, false)]);

    mark("claimStart");
    await Promise.all([A, B].map((p) => p.clickWait("CLAIM")));
    await Promise.all([A, B].map((p) => p.waitText("1[,. ]?000", 30000, ".on-backdrop.show")));
    await sleep(1800);
    mark("claimed");

    await Promise.all([A, B].map(async (p) => { await p.clickWait("CONTINUE"); await sleep(1500); }));
    await sleep(2500);
    mark("vehicleSelect");
    await Promise.all([A, B].map(async (p) => { await p.clickWait("ENTER LOBBY"); await p.waitText("LOBBY", 20000, ".on-backdrop.show"); }));
    await A.waitText("SIGN & JOIN", 20000, ".on-backdrop.show");
    await sleep(2000);
    mark("lobby");

    mark("signClick");
    await A.clickWait("SIGN & JOIN");
    await A.waitText("SEAT CONFIRMED", 60000, ".on-backdrop.show");
    mark("seatedA");
    await sleep(1500);
    await B.clickWait("SIGN & JOIN");
    await B.waitText("SEAT CONFIRMED", 60000, ".on-backdrop.show");
    await A.waitText("2/8 SEATS", 30000, ".on-backdrop.show");
    mark("twoSeats");

    for (let i = 0; i < 240; i++) {
      const open = await A.eval(`document.querySelectorAll('.on-backdrop.show').length`);
      if (!open) break;
      await sleep(500);
    }
    mark("matchStart");
    const t0 = Date.now();
    const driveA = (async () => { while (Date.now() - t0 < CFG.playMs) { await A.hold([KEYS.W], 3200); await A.hold([KEYS.W, KEYS.D], 600); await A.hold([KEYS.W], 1800); await A.hold([KEYS.W, KEYS.A], 500); } })();
    const driveB = (async () => { while (Date.now() - t0 < CFG.playMs + 20000) { await B.hold([KEYS.W], 4000); await B.hold([KEYS.W, KEYS.A], 700); } })();
    await A.waitText("MATCH RESULT", 220000, ".on-backdrop.show");
    mark("result");
    await sleep(2500);
    const settled = await A.waitText("SETTLED", 90000, ".on-backdrop.show").then(() => true, () => false);
    mark(settled ? "settled" : "settledTimeout");
    const link = await A.eval(`[...document.querySelectorAll('.on-backdrop.show a')].map(a=>a.href).find(h=>/explorer.solana.com\\/tx/.test(h)) || null`);
    await sleep(6000);
    mark("resultDwell");
    await Promise.allSettled([driveA, driveB]);

    await A.clickWait("BACK TO MENU");
    await sleep(2500);
    await A.clickWait("LEADERBOARD");
    await sleep(2500);
    await A.eval(`document.getElementById('lb-tab-online')?.click()`);
    await sleep(6000);
    mark("leaderboard");
    await sleep(1500);

    const matches = await (await fetch(`${CFG.server}/matches?wallet=${keys[0].address}&limit=1`)).json();
    const m = matches.rows?.[0] ?? null;
    const sig = m?.settleTx ?? (link ? new URL(link).pathname.split("/").pop() : null);
    let tx = null;
    if (sig) tx = await rpc(CFG.rpc, "getTransaction", [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
    const proof = {
      capturedAt: new Date().toISOString(),
      players: keys.map((k) => k.address),
      match: m,
      settleSignature: sig,
      explorerUrl: sig ? `https://explorer.solana.com/tx/${sig}?cluster=devnet` : null,
      slot: tx?.slot ?? null,
      blockTime: tx?.blockTime ?? null,
      feeLamports: tx?.meta?.fee ?? null,
      feePayer: tx?.transaction?.message?.accountKeys?.[0]?.pubkey ?? null,
      computeUnits: tx?.meta?.computeUnitsConsumed ?? null,
      logs: (tx?.meta?.logMessages ?? []).slice(0, 14),
    };
    writeFileSync(`${CFG.out}/proof.json`, JSON.stringify(proof, null, 2));
    console.log("PROOF", JSON.stringify({ sig, slot: proof.slot, cu: proof.computeUnits, payouts: m?.potAmount }));
  } finally {
    await rec.stop();
    await sleep(500);
    writeFileSync(`${CFG.out}/marks.json`, JSON.stringify(marks, null, 2));
    encode(rec.list, `${CFG.out}/online_flow.mp4`);
    console.log(`frames ${rec.list.length}, video ${CFG.out}/online_flow.mp4`);
    await A.close(); await B.close(); br.close(); sg.srv.close();
  }
}
main().then(() => process.exit(0), (e) => { console.error("CAPTURE FAILED", e); process.exit(2); });
