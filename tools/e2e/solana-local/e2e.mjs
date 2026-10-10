#!/usr/bin/env node
// Two-browser Solana E2E: mock Wallet Standard wallets, real client, real server, real program.
// Config comes from env (set by run.sh). Prints a JSON report and exits non-zero on any failed check.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { Browser, KEYS } from "./cdp.mjs";
import { newKey, rpc, tokenBal, solBal, b58enc, b58dec, sleep } from "./lib.mjs";
import { startSigner } from "./signer.mjs";
import { walletScript } from "./wallet-inject.mjs";

const E = (k, d) => process.env[k] ?? d;
const CFG = {
  rpc: E("E2E_RPC", "http://127.0.0.1:8899"),
  server: E("E2E_SERVER", "http://localhost:2567"),
  client: E("E2E_CLIENT", "http://localhost:4173/"),
  chromePort: Number(E("E2E_CHROME_PORT", "9333")),
  mint: E("E2E_MINT"),
  program: E("E2E_PROGRAM"),
  treasury: E("E2E_TREASURY"),
  relayer: E("E2E_RELAYER"),
  stake: BigInt(E("E2E_STAKE", "100000000000")),
  startBalance: Number(E("E2E_START_BALANCE", "100")),
  serverLog: E("E2E_SERVER_LOG"),
  out: E("E2E_OUT", "/tmp/e2e-out"),
  shots: E("E2E_SHOTS", ""),
  keep: E("E2E_SHOT_KEEP", "01,03,05,08,10,12,14,15,18").split(","),
  skipSlow: E("E2E_SKIP_SLOW", "") === "1",
  replayDir: E("E2E_REPLAY_DIR", ""),
  fillTimerS: Number(E("E2E_FILL_TIMER_S", "8")),
  joinWindowS: Number(E("E2E_JOIN_WINDOW_S", "120")),
  expireDelayMs: Number(E("E2E_EXPIRE_DELAY_MS", "62000")),
};
for (const k of ["mint", "program", "treasury", "relayer", ...(process.env.E2E_RAILWAY_SERVICE ? [] : ["serverLog"])]) if (!CFG[k]) throw new Error(`missing E2E_${k.toUpperCase()}`);
mkdirSync(CFG.out, { recursive: true });
if (CFG.shots) mkdirSync(CFG.shots, { recursive: true });

const report = { startedAt: new Date().toISOString(), checks: [], bugs: [], timings: {}, notes: [] };
let shotN = 0;
function check(id, ok, detail = "") {
  report.checks.push({ id, ok: !!ok, detail: String(detail) });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${detail}`);
  return ok;
}
const bug = (id, repro, file) => { report.bugs.push({ id, repro, file }); console.log(`BUG ${id}: ${repro}`); };
const unit = (n) => `${Number(n) / 1e9}`;

async function shot(p, name) {
  shotN++;
  const nn = String(shotN).padStart(2, "0");
  const f = `${CFG.out}/${nn}-${name}.png`;
  await p.shot(f);
  if (CFG.shots && CFG.keep.includes(nn)) copyFileSync(f, `${CFG.shots}/${nn}-${name}.png`);
}
const panel = (p) => p.eval(`[...document.querySelectorAll('.on-backdrop.show')].map(e=>e.innerText).join('\\n---\\n')`);
const jget = async (path) => { const r = await fetch(CFG.server + path); return { status: r.status, body: await r.json().catch(() => null) }; };

const RAILWAY_SERVICE = process.env.E2E_RAILWAY_SERVICE ?? "";
function railwayEvents(since) {
  let out = "";
  try { out = execFileSync("railway", ["logs", "--service", RAILWAY_SERVICE, "--lines", "500"], { encoding: "utf8", timeout: 30000, env: { ...process.env, RAILWAY_CALLER: "skill:use-railway@1.6.1" } }); } catch { return []; }
  const events = [];
  for (const line of out.split("\n")) {
    const evt = /evt="([^"]+)"/.exec(line);
    const ts = /\bts=(\d+)/.exec(line);
    if (!evt || !ts) continue;
    const e = { evt: evt[1], ts: Number(ts[1]) };
    for (const m of line.matchAll(/\b(matchId|wallet|txHash|code|error|roomId)="([^"]*)"/g)) e[m[1]] = m[2];
    if (e.ts >= since) events.push(e);
  }
  return events;
}
function logEvents(since = 0) {
  if (RAILWAY_SERVICE) return railwayEvents(since);
  return readFileSync(CFG.serverLog, "utf8").split("\n").filter((l) => l.startsWith("{")).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((e) => e && e.ts >= since);
}
async function waitLog(pred, timeout, since) {
  const t0 = Date.now();
  for (;;) {
    const hit = logEvents(since).find(pred);
    if (hit) return hit;
    if (Date.now() - t0 > timeout) return null;
    await sleep(RAILWAY_SERVICE ? 3000 : 300);
  }
}

// ---- chain helpers
async function matchAccounts() {
  const r = await rpc(CFG.rpc, "getProgramAccounts", [CFG.program, { encoding: "base64", commitment: "confirmed" }]);
  return r.filter((a) => Buffer.from(a.account.data[0], "base64").length > 400).map((a) => {
    const d = Buffer.from(a.account.data[0], "base64");
    const players = [];
    for (let i = 0; i < d[54]; i++) players.push(b58enc(d.subarray(55 + i * 32, 55 + i * 32 + 32)));
    return { pda: a.pubkey, matchId: "0x" + d.subarray(8, 40).toString("hex"), status: d[40], stake: d.readBigUInt64LE(41), startBalance: d.readUInt32LE(49), maxPlayers: d[53], playerCount: d[54], players, d };
  });
}
async function matchById(id) { return (await matchAccounts()).find((m) => m.matchId === id.toLowerCase()); }
async function vaultBal(pda) {
  const r = await rpc(CFG.rpc, "getTokenAccountsByOwner", [pda, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed", commitment: "confirmed" }]);
  return r.value.reduce((s, a) => s + BigInt(a.account.data.parsed.info.tokenAmount.amount), 0n);
}
const tb = (w) => tokenBal(CFG.rpc, w, CFG.mint);
const tsBal = async () => BigInt((await rpc(CFG.rpc, "getTokenAccountBalance", [CFG.treasury, { commitment: "confirmed" }])).value.amount);

// ---- UI helpers
async function openWalletPanel(p) {
  await p.goto(CFG.client);
  await p.waitText("PLAY ONLINE", 30000);
  await sleep(2000);
  await p.clickWait("PLAY ONLINE");
  await p.waitText("WALLET", 8000, ".on-backdrop.show");
}
async function connect(p) {
  await p.clickWait("E2E Mock Wallet");
  await p.waitText("Address", 10000, ".on-backdrop.show");
}
async function toLobby(p) {
  await p.clickWait("CONTINUE");
  await sleep(1500);
  await p.clickWait("ENTER LOBBY");
  await p.waitText("LOBBY", 20000, ".on-backdrop.show");
}

function spectate() {
  try { return execFileSync("pnpm", ["--dir", new URL("../../../server", import.meta.url).pathname, "exec", "tsx", new URL("./spectator.ts", import.meta.url).pathname, CFG.server.replace(/^http/, "ws")], { timeout: 40000, encoding: "utf8" }).split("\n").slice(-3).join(" ").slice(0, 600); } catch (e) { return "spectator failed: " + String(e.message).slice(0, 200); }
}

async function main() {
  const keys = [newKey(), newKey(), newKey()];
  const names = ["A", "B", "C"];
  const sg = await startSigner(keys);
  const br = await Browser.connect(CFG.chromePort);
  const mk = (i, name) => br.newPage({ script: walletScript({ address: keys[i].address, signerUrl: sg.url, idx: i }), name: name ?? names[i] });
  report.wallets = keys.map((k) => k.address);

  const relayerSol0 = await solBal(CFG.rpc, CFG.relayer);
  const treasury0 = await tsBal();

  // ============ (a) open, chain selector, connect
  const A = await mk(0), B = await mk(1);
  globalThis.__pages = { A, B };
  await Promise.all([openWalletPanel(A), openWalletPanel(B)]);
  let t = await panel(A);
  const hasPills = (await A.eval(`document.querySelectorAll('.on-chains button').length`)) > 1;
  if (hasPills) {
    check("a.default-chain-solana", /Solana Devnet/.test(t) && (await A.eval(`document.querySelector('.on-chains .active')?.textContent`)) === "Solana Devnet", (await A.eval(`document.querySelector('.on-chains .active')?.textContent`)));
    await shot(A, "wallet-panel-solana");
    await A.clickText("Robinhood Chain", ".on-chains button");
    await sleep(700);
    t = await panel(A);
    const evmActive = await A.eval(`document.querySelector('.on-chains .active')?.textContent`);
    const lsChain = await A.eval(`localStorage.getItem('bump.chain')`);
    check("a.evm-switch", /Robinhood/.test(evmActive) && lsChain === "evm", `active=${evmActive} bump.chain=${lsChain} text=${t.slice(0, 160).replace(/\n/g, " | ")}`);
    await shot(A, "chain-evm");
    await A.clickText("Solana Devnet", ".on-chains button");
    await sleep(700);
    check("a.switch-back-solana", (await A.eval(`document.querySelector('.on-chains .active')?.textContent`)) === "Solana Devnet" && (await A.eval(`localStorage.getItem('bump.chain')`)) === "solana");
  } else {
    check("a.single-chain-solana-only", /Solana Devnet/.test(t) && !/Robinhood/.test(t), "chain selector hidden (EVM disabled)");
  }
  await Promise.all([connect(A), connect(B)]);
  t = await panel(A);
  check("a.connected", /Solana Devnet/i.test(t) && /Address/i.test(t), t.slice(0, 200).replace(/\n/g, " | "));

  // ============ (b) faucet
  const s0 = await jget(`/faucet/status?wallet=${keys[0].address}`);
  check("b.faucet-status-initial", s0.status === 200 && s0.body.canClaimNow === true && s0.body.balance === "0", JSON.stringify(s0.body));
  const tf0 = Date.now();
  await Promise.all([A, B].map((p) => p.clickWait("CLAIM")));
  await Promise.all([A, B].map((p) => p.waitText("1[,. ]?000", 20000, ".on-backdrop.show")));
  report.timings.faucetClaimUiMs = Date.now() - tf0;
  await sleep(1500);
  for (const i of [0, 1]) {
    const bal = await tb(keys[i].address);
    check(`b.faucet-onchain-${names[i]}`, bal === 1000_000_000_000n, `${unit(bal)} BUMP`);
  }
  t = await panel(A);
  check("b.faucet-ui-cooldown", /NEXT CLAIM IN/i.test(t), t.replace(/\n/g, " | ").slice(0, 300));
  await shot(A, "faucet-claimed");
  const second = await fetch(`${CFG.server}/faucet`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: keys[0].address }) });
  const sj = await second.json().catch(() => ({}));
  check("b.second-claim-refused", second.status === 429 && sj.code === "COOLDOWN", `${second.status} ${JSON.stringify(sj)}`);
  const s1 = await jget(`/faucet/status?wallet=${keys[0].address}`);
  check("b.faucet-status-after", s1.body.balance === "1000000000000" && s1.body.canClaimNow === false, JSON.stringify(s1.body));
  const solPlayer0 = [await solBal(CFG.rpc, keys[0].address), await solBal(CFG.rpc, keys[1].address)];
  report.notes.push(`player SOL after faucet: ${solPlayer0.join(",")}`);

  // ============ (c) lobby + join
  const tMatch0 = Date.now();
  await Promise.all([toLobby(A), toLobby(B)]);
  await shot(A, "lobby");
  await A.waitText("SIGN & JOIN", 15000, ".on-backdrop.show");
  const lobbyText = await panel(A);
  check("c.lobby-open", /0\/8 SEATS/.test(lobbyText), lobbyText.replace(/\n/g, " | ").slice(0, 300));
  const mid = (await A.eval(`(()=>{const rows=[...document.querySelectorAll('.on-row')];return rows.map(r=>r.innerText).join('|')})()`));
  const callsBefore = sg.state.calls.length;
  const tj0 = Date.now();
  await A.clickWait("SIGN & JOIN");
  await A.waitText("SEAT CONFIRMED", 45000, ".on-backdrop.show");
  report.timings.joinLatencyAms = Date.now() - tj0;
  await shot(A, "joined-A");
  check("c.join-one-signature-A", sg.state.calls.length - callsBefore === 1 && (await A.eval(`window.__mockWallet.signCalls`)) === 1, `signer calls=${sg.state.calls.length - callsBefore}`);
  const tj1 = Date.now();
  await B.clickWait("SIGN & JOIN");
  await B.waitText("SEAT CONFIRMED", 45000, ".on-backdrop.show");
  report.timings.joinLatencyBms = Date.now() - tj1;
  check("c.join-one-signature-B", sg.state.calls.length - callsBefore === 2 && (await B.eval(`window.__mockWallet.signCalls`)) === 1);
  const signedBy = sg.state.calls.map((c) => c.parsed?.keys.join(","));
  check("c.tx-fee-payer-is-relayer", sg.state.calls.every((c) => c.parsed && c.parsed.keys[0] === CFG.relayer && c.parsed.sigCount === 2), JSON.stringify(signedBy));
  await sleep(500);
  t = await panel(A);
  check("c.seats-2of8", /2\/8 SEATS/.test(t), t.replace(/\n/g, " | ").slice(0, 120));
  const joinEvt = logEvents().filter((e) => e.evt === "join_relayed");
  const joinedMatchId = joinEvt.at(-1)?.matchId;
  check("c.server-join-relayed", joinEvt.length >= 2, `${joinEvt.length} join_relayed`);
  const solPlayer1 = [await solBal(CFG.rpc, keys[0].address), await solBal(CFG.rpc, keys[1].address)];
  check("c.player-pays-zero-sol", solPlayer1.every((v, i) => v === solPlayer0[i]) , `before=${solPlayer0} after=${solPlayer1}`);
  const m1 = await matchById(joinedMatchId);
  check("c.chain-match-open-2-players", m1 && m1.status === 1 && m1.playerCount === 2 && m1.players.includes(keys[0].address) && m1.players.includes(keys[1].address), m1 ? `status=${m1.status} count=${m1.playerCount}` : "no match account");
  const vault1 = await vaultBal(m1.pda);
  check("c.vault-holds-2-stakes", vault1 === CFG.stake * 2n, unit(vault1));
  const bal1 = [await tb(keys[0].address), await tb(keys[1].address)];
  check("c.player-token-debited", bal1.every((v) => v === 900_000_000_000n), bal1.map(unit).join(","));
  report.notes.push(`spectator after both seated: ${spectate()}`);
  const relayerSol1 = await solBal(CFG.rpc, CFG.relayer);
  report.notes.push(`relayer SOL delta so far: ${unit(relayerSol1 - relayerSol0)} (faucet ATAs + joins + open)`);

  // ============ (d) play + settle
  const tSecondClaim = tj1 + report.timings.joinLatencyBms;
  const tStart = await waitLog((e) => e.evt === "match_start" && e.matchId === joinedMatchId, 160000, tMatch0);
  const fillMs = tStart ? tStart.ts - tSecondClaim : null;
  report.timings.secondSeatToMatchStartMs = fillMs;
  // FILL_TIMER_S (8 s by default in this harness) must start the match shortly after the 2nd seat is claimed.
  check("d.fill-timer-starts-match", fillMs !== null && fillMs < (CFG.fillTimerS + 6) * 1000, `second seat -> match_start = ${fillMs}ms (FILL_TIMER_S=${CFG.fillTimerS}, JOIN_WINDOW_S=${CFG.joinWindowS})`);
  check("d.match-start", !!tStart, tStart ? "started" : "never");
  const onChainStart = await matchById(joinedMatchId);
  check("d.chain-status-started", onChainStart?.status === 2, `status=${onChainStart?.status}`);
  await sleep(2500);
  await shot(A, "match-live-A-before-input");
  await shot(B, "match-live-B");
  // drive: A forward with steering, B forward
  const playMs = 19000;
  const driveA = (async () => { const t0 = Date.now(); while (Date.now() - t0 < playMs) { await A.hold([KEYS.W], 4500); await A.hold([KEYS.W, KEYS.D], 500); } })();
  const driveB = (async () => { const t0 = Date.now(); while (Date.now() - t0 < playMs) { await B.hold([KEYS.W], 4500); await B.hold([KEYS.W, KEYS.A], 500); } })();
  await sleep(6000);
  await shot(A, "match-live-A-driving");
  await shot(B, "match-live-B-driving");
  const endEvt = await waitLog((e) => e.evt === "match_end" && e.matchId === joinedMatchId, 60000, tMatch0);
  await Promise.all([driveA, driveB]);
  check("d.match-end", !!endEvt, endEvt ? `reason=${endEvt.reason}` : "never");
  const tEnd = endEvt?.ts ?? Date.now();
  await A.waitText("SETTLED|PAID", 60000, ".on-backdrop.show").catch(async (e) => { console.log(String(e.message)); });
  report.timings.endToSettledUiMs = Date.now() - tEnd;
  await sleep(1500);
  await shot(A, "result-A");
  await shot(B, "result-B");
  const resA = await panel(A);
  check("d.result-panel-settled", /SETTLED/.test(resA) && /PAID/.test(resA), resA.replace(/\n/g, " | ").slice(0, 300));
  const settleHref = await A.eval(`[...document.querySelectorAll('.on-backdrop.show a')].map(a=>a.href).join(' ')`);
  const settleSig = (settleHref.match(/\/tx\/([1-9A-HJ-NP-Za-km-z]{60,})/) || [])[1];
  check("d.result-settle-link", !!settleSig && /explorer\.solana\.com/.test(settleHref), settleHref);
  if (settleSig) {
    const st = await rpc(CFG.rpc, "getSignatureStatuses", [[settleSig]]);
    check("d.settle-sig-confirmed", st.value[0] && !st.value[0].err, JSON.stringify(st.value[0]));
  }
  const mj = await jget(`/matches/${joinedMatchId}`);
  report.matchJson = mj.body;
  const mrows = mj.body?.players ?? mj.body?.rows ?? [];
  // on-chain payout check
  const after = [await tb(keys[0].address), await tb(keys[1].address)];
  const payouts = after.map((v, i) => v - 900_000_000_000n);
  const finalBal = mrows.length ? keys.slice(0, 2).map((k) => Number((mrows.find((r) => r.wallet === k.address) ?? {}).finalBalance)) : [];
  report.notes.push(`finalBalances=${finalBal} payouts=${payouts.map(unit)}`);
  const expPayouts = finalBal.map((f) => (CFG.stake * BigInt(f)) / BigInt(CFG.startBalance));
  check("d.payouts-match-formula", finalBal.length === 2 && payouts.every((v, i) => v === expPayouts[i]), `final=${finalBal} onchain=${payouts.map(unit)} expected=${expPayouts.map(unit)}`);
  check("d.final-balances-zero-sum", finalBal.length === 2 && finalBal[0] + finalBal[1] === CFG.startBalance * 2, `sum=${finalBal[0] + finalBal[1]}`);
  report.notes.push(`bump between cars changed balances: ${finalBal[0] !== CFG.startBalance}`);
  const rf = `${CFG.replayDir}/replays/${joinedMatchId}.json`;
  if (CFG.replayDir && existsSync(rf)) {
    const buf = Buffer.from(JSON.parse(readFileSync(rf, "utf8")).inputLogBase64, "base64");
    const thr = [0, 0];
    for (let o = 0; o + 8 <= buf.length; o += 8) if (buf.readInt8(o + 5) !== 0 && buf[o + 4] < 2) thr[buf[o + 4]]++;
    check("d.input-reached-server-both-seats", thr[0] > 60 && thr[1] > 60, `ticks with throttle: seat0=${thr[0]} seat1=${thr[1]} of ${buf.length / 16}`);
  }
  const m1e = await matchById(joinedMatchId);
  const vaultEnd = await vaultBal(m1e.pda);
  const tsDelta = (await tsBal()) - treasury0;
  const dust = CFG.stake * 2n - payouts[0] - payouts[1];
  check("d.chain-status-settled", m1e.status === 3, `status=${m1e.status}`);
  check("d.vault-empty", vaultEnd === 0n, unit(vaultEnd));
  check("d.treasury-dust", tsDelta === dust, `treasury delta=${tsDelta} expected dust=${dust}`);
  const metrics = (await jget("/metrics.json")).body;
  report.timings.settlementLagMs = metrics?.settlementLagMs;
  report.timings.pnlResultUiRows = resA.replace(/\n/g, " | ").slice(0, 400);

  // ============ (e) leaderboard
  await A.clickWait("BACK TO MENU");
  await sleep(1500);
  await A.clickWait("LEADERBOARD");
  await sleep(800);
  await A.eval(`document.getElementById('lb-tab-online').click()`);
  await sleep(2500);
  let lbText = await A.eval(`document.getElementById('lb-online-host').innerText`);
  await shot(A, "leaderboard-online");
  const lb = (await jget("/leaderboard?window=all&limit=50")).body;
  report.leaderboardJson = lb;
  const lbW = (lb?.rows ?? []).map((r) => r.wallet);
  check("e.leaderboard-json-has-both", lbW.includes(keys[0].address) && lbW.includes(keys[1].address), lbW.join(","));
  check("e.leaderboard-json-fields", lb?.chain === "solana" && lb?.decimals === 9, `chain=${lb?.chain} decimals=${lb?.decimals} rowKeys=${Object.keys(lb?.rows?.[0] ?? {}).join(",")}`);
  const rowsInDom = await A.eval(`document.querySelectorAll('#lb-online-host tbody tr, #lb-online-host .on-lb-row').length`);
  check("e.leaderboard-ui-rows", rowsInDom >= 2 || /\b2\b/.test(lbText), `rows=${rowsInDom} text=${lbText.replace(/\n/g, " | ").slice(0, 300)}`);
  const pj = (await jget(`/players/${keys[0].address}`)).body;
  check("e.player-json", pj && JSON.stringify(pj).includes(keys[0].address), JSON.stringify(pj).slice(0, 200));
  const ready = await jget("/ready");
  check("e.ready", ready.status === 200, JSON.stringify(ready.body));
  await A.close(); await B.close();

  if (CFG.skipSlow) return finish(keys, sg, br);

  // ============ (f) negative paths on a second match
  // f.1 insufficient BUMP (wallet C never claimed)
  const C = await mk(2);
  await openWalletPanel(C);
  await connect(C);
  await C.clickWait("CONTINUE"); await sleep(1200); await C.clickWait("ENTER LOBBY");
  await C.waitText("LOBBY", 20000, ".on-backdrop.show");
  await C.waitText("SIGN & JOIN", 15000, ".on-backdrop.show");
  await sleep(1500);
  const lowText = await panel(C);
  await shot(C, "insufficient-lobby");
  const callsC0 = sg.state.calls.length;
  await C.clickText("SIGN & JOIN");
  await sleep(4000);
  const lowText2 = await panel(C);
  await shot(C, "insufficient-after-click");
  check("f.insufficient-bump-ui-hint", /Not enough BUMP/i.test(lowText2), lowText.replace(/\n/g, " | ").slice(0, 300));
  check("f.insufficient-bump-refused", /INSUFFICIENT|not enough|balance/i.test(lowText2) && sg.state.calls.length === callsC0, `signer calls=${sg.state.calls.length - callsC0} text=${lowText2.replace(/\n/g, " | ").slice(0, 300)}`);
  const cMatch = await matchAccounts();
  report.notes.push(`C balance=${await tb(keys[2].address)}`);
  await C.close();

  // f.2 tampered transaction by B (the wallet signs a tx whose bytes differ from what the server built)
  const tr0 = Date.now();
  const B2 = await mk(1);
  await openWalletPanel(B2);
  await B2.waitText("Address|E2E Mock Wallet", 15000, ".on-backdrop.show");
  if (!/address/i.test(await panel(B2))) await connect(B2);
  await toLobby(B2);
  await B2.waitText("SIGN & JOIN", 15000, ".on-backdrop.show");
  sg.state.mode[1] = { tamper: true, once: true };
  const bBefore = await tb(keys[1].address);
  await B2.clickWait("SIGN & JOIN");
  await sleep(6000);
  const tamperText = await panel(B2);
  await shot(B2, "tampered");
  const tlogs = logEvents(tr0).filter((e) => /join_/.test(e.evt)).map((e) => `${e.evt}:${e.code ?? e.error ?? ""}`);
  report.notes.push(`tamper server log: ${tlogs.join(" ")} | ui: ${tamperText.replace(/\n/g, " | ").slice(0, 300)}`);
  check("f.tampered-rejected", !/SEAT CONFIRMED/.test(tamperText) && /did not match|tamper|TX_TAMPERED|unexpected|changed|rejected|invalid|signature|went wrong|failed/i.test(tamperText), tamperText.replace(/\n/g, " | ").slice(0, 400));
  const bAfter = await tb(keys[1].address);
  const mT = (await matchAccounts()).filter((m) => m.status === 1);
  check("f.tampered-no-stake-moved", bAfter === bBefore && !mT.some((m) => m.players.includes(keys[1].address)), `B bump ${unit(bBefore)} -> ${unit(bAfter)}`);
  await B2.clickWait("RETRY");
  await B2.waitText("SEAT CONFIRMED", 45000, ".on-backdrop.show");
  check("f.tampered-retry-ok", true, "retry after tamper seated");

  // f.3 expired transaction: wallet signs after the 60 s ttl. Client must notice, re-prepare and succeed.
  const A2 = await mk(0);
  await openWalletPanel(A2);
  await A2.waitText("Address|E2E Mock Wallet", 15000, ".on-backdrop.show");
  if (!/address/i.test(await panel(A2))) await connect(A2);
  await toLobby(A2);
  await A2.waitText("SIGN & JOIN", 15000, ".on-backdrop.show");
  sg.state.mode[0] = { delayMs: CFG.expireDelayMs, once: true };
  const te0 = Date.now();
  const c0 = sg.state.calls.length;
  let rawOut = "";
  const raw = spawn("node", [new URL("./rawjoin.mjs", import.meta.url).pathname, CFG.server], { env: { ...process.env, RAW_EXPIRE_WAIT_MS: "62000" } });
  raw.stdout.on("data", (d) => { rawOut += d; });
  const rawDone = new Promise((r) => raw.on("close", r));
  await A2.clickWait("SIGN & JOIN");
  const outcome = await A2.waitText("SEAT CONFIRMED|expired|EXPIRED", CFG.expireDelayMs + 60000, ".on-backdrop.show").then(async () => (await panel(A2))).catch((e) => String(e.message));
  report.timings.expiredJoinTotalMs = Date.now() - te0;
  await shot(A2, "after-expiry");
  check("f.expired-tx-recovers", /SEAT CONFIRMED/.test(outcome) && sg.state.calls.length - c0 === 2, `calls=${sg.state.calls.length - c0} outcome=${outcome.replace(/\n/g, " | ").slice(0, 300)}`);
  report.notes.push(`expiry server log: ${logEvents(te0).filter((e) => /join/.test(e.evt)).map((e) => `${e.evt}:${e.code ?? e.error ?? ""}`).join(" ")}`);

  await Promise.race([rawDone, sleep(30000)]);
  const rawCases = Object.fromEntries(rawOut.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l)).map((o) => [o.case, o]));
  report.rawCases = rawCases;
  check("f.raw-insufficient-bump", rawCases["insufficient-bump"]?.event?.code === "INSUFFICIENT_BALANCE", JSON.stringify(rawCases["insufficient-bump"]?.event));
  check("f.raw-junk-submit-tampered", rawCases["junk-submit"]?.event?.code === "TX_TAMPERED", JSON.stringify(rawCases["junk-submit"]?.event));
  check("f.raw-expired-submit-rejected", rawCases["expired-submit"]?.event?.code === "TX_EXPIRED", JSON.stringify(rawCases["expired-submit"]));
  check("f.raw-replay-not-double-joined", rawCases["replayed-submit"]?.event?.t === "error", JSON.stringify(rawCases["replayed-submit"]?.event));

  // f.4 reload mid-lobby after signing: session key reuse + seat reclaim
  const skOf = () => A2.eval(`(()=>{const k=Object.keys(sessionStorage).find(k=>k.startsWith('bump.session'));return k?k+'='+sessionStorage.getItem(k):null})()`);
  const skVal = await skOf();
  const m2id = logEvents(tr0).filter((e) => e.evt === "join_relayed").at(-1)?.matchId;
  await A2.reload();
  await sleep(3000);
  await shot(A2, "after-reload");
  report.notes.push(`reload landing: ${(await A2.eval("document.body.innerText.slice(0,120)")).replace(/\n/g, " | ")}`);
  await A2.clickWait("PLAY ONLINE");
  await sleep(1500);
  const wp = await panel(A2);
  if (!/address/i.test(wp)) await connect(A2);
  const skAfterReload = await skOf();
  await toLobby(A2);
  await sleep(5000);
  const lobbyAfter = await panel(A2);
  await shot(A2, "lobby-after-reload");
  check("f.reload-session-key-kept", !!skVal && skVal === skAfterReload, `before=${skVal?.slice(0, 40)} after=${skAfterReload?.slice(0, 40)}`);
  const sameMatch = /Match\s*\n?\s*(0x[0-9a-f]{4})/i.exec(lobbyAfter);
  check("f.reload-seat-reclaimed", /SEAT CONFIRMED|SEATED/i.test(lobbyAfter), lobbyAfter.replace(/\n/g, " | ").slice(0, 400));
  const calls4 = sg.state.calls.length;
  report.notes.push(`reload: signer calls total=${calls4}; matchId before reload=${m2id?.slice(0, 10)} lobby shows ${lobbyAfter.replace(/\n/g, " ").match(/0x[0-9a-f]{4}…[0-9a-f]{4}/)?.[0]}`);

  // match 2 plays out with no input; must settle and empty the vault
  const m2start = await waitLog((e) => e.evt === "match_start" && e.matchId === m2id, 200000, tr0);
  check("f.match2-starts", !!m2start, `matchId=${m2id?.slice(0, 10)}`);
  await waitLog((e) => e.evt === "match_end" && e.matchId === m2id, 70000, tr0);
  await B2.waitText("SETTLED|PAID", 60000, ".on-backdrop.show").catch(() => {});
  await sleep(1500);
  await shot(B2, "match2-result");
  const m2c = await matchById(m2id);
  check("f.match2-settled-onchain", m2c?.status === 3, `status=${m2c?.status}`);
  const m2v = m2c ? await vaultBal(m2c.pda) : -1n;
  check("f.match2-vault-empty", m2v === 0n, unit(m2v));
  await A2.close(); await B2.close();
  return finish(keys, sg, br);
}

function finish(keys, sg, br) {
  report.signerCalls = sg.state.calls.map((c) => ({ idx: c.idx, parsed: c.parsed, tampered: c.tampered }));
  report.finishedAt = new Date().toISOString();
  writeFileSync(`${CFG.out}/report.json`, JSON.stringify(report, null, 2));
  const failed = report.checks.filter((c) => !c.ok);
  console.log(`\n${report.checks.length - failed.length}/${report.checks.length} checks passed; report ${CFG.out}/report.json`);
  sg.srv.close(); br.close();
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => { console.error("E2E crashed:", e); for (const [n, p] of Object.entries(globalThis.__pages ?? {})) console.error(`--- console ${n} (last 25)\n` + (p.console ?? []).slice(-25).join("\n")); report.crash = String(e.stack ?? e); try { writeFileSync(`${CFG.out}/report.json`, JSON.stringify(report, null, 2)); } catch {} process.exit(2); });
