import { writeFileSync } from "node:fs";
import { sleep } from "./lib.mjs";

export class Browser {
  static async connect(port) {
    const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const b = new Browser(v.webSocketDebuggerUrl);
    await b.open();
    return b;
  }
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.handlers = []; }
  open() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => res();
      this.ws.onerror = (e) => rej(new Error("cdp ws error"));
      this.ws.onmessage = (m) => {
        const j = JSON.parse(m.data);
        if (j.id) { const p = this.pending.get(j.id); this.pending.delete(j.id); if (j.error) p.rej(new Error(`${p.method}: ${j.error.message}`)); else p.res(j.result); }
        else for (const h of this.handlers) h(j);
      };
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej, method });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  async newPage({ script, width = 1280, height = 720, name }) {
    const { browserContextId } = await this.send("Target.createBrowserContext", { disposeOnDetach: true });
    const { targetId } = await this.send("Target.createTarget", { url: "about:blank", browserContextId, width, height });
    const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(this, sessionId, targetId, browserContextId, name);
    await page.init(script, width, height);
    return page;
  }
  close() { try { this.ws.close(); } catch {} }
}

export class Page {
  constructor(b, sid, tid, ctx, name) { this.b = b; this.sid = sid; this.tid = tid; this.ctx = ctx; this.name = name; this.console = []; this.listeners = []; }
  send(m, p = {}) { return this.b.send(m, p, this.sid); }
  async init(script, width, height) {
    this.b.handlers.push((j) => {
      if (j.sessionId !== this.sid) return;
      if (j.method === "Runtime.consoleAPICalled") this.console.push(`[${j.params.type}] ${j.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`.slice(0, 400));
      if (j.method === "Runtime.exceptionThrown") this.console.push(`[exception] ${j.params.exceptionDetails.text} ${j.params.exceptionDetails.exception?.description ?? ""}`.slice(0, 600));
      if (j.method === "Network.webSocketFrameReceived" || j.method === "Network.webSocketFrameSent") for (const l of this.listeners) l(j);
    });
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Network.enable");
    await this.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    if (script) await this.send("Page.addScriptToEvaluateOnNewDocument", { source: script });
  }
  async goto(url) { await this.send("Page.navigate", { url }); await sleep(1500); }
  async reload() { await this.send("Page.reload", {}); await sleep(2000); }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  }
  async shot(path) {
    const r = await this.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(path, Buffer.from(r.data, "base64"));
    return path;
  }
  text() { return this.eval("document.body.innerText"); }
  async clickText(text, sel = "button") {
    const ok = await this.eval(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>e.offsetParent!==null||e.getClientRects().length).find(e=>e.textContent.trim().toUpperCase().includes(${JSON.stringify(text.toUpperCase())}) && !e.disabled);if(!b)return false;b.click();return true})()`);
    return ok;
  }
  async waitText(re, timeout = 30000, sel) {
    const t0 = Date.now();
    for (;;) {
      const t = await this.eval(sel ? `(document.querySelector(${JSON.stringify(sel)})||document.body).innerText` : "document.body.innerText");
      if (new RegExp(re, "i").test(t)) return Date.now() - t0;
      if (Date.now() - t0 > timeout) throw new Error(`[${this.name}] timeout waiting ${re}; text=${t.slice(0, 500).replace(/\n/g, " | ")}`);
      await sleep(250);
    }
  }
  async clickWait(text, timeout = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { if (await this.clickText(text)) return true; await sleep(250); }
    throw new Error(`[${this.name}] button not found: ${text}; text=${(await this.text()).slice(0, 400).replace(/\n/g, " | ")}`);
  }
  async key(code, key, vk, down) {
    await this.send("Input.dispatchKeyEvent", { type: down ? "rawKeyDown" : "keyUp", code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
  async hold(keys, ms) {
    for (const k of keys) await this.key(k.code, k.key, k.vk, true);
    await sleep(ms);
    for (const k of keys) await this.key(k.code, k.key, k.vk, false);
  }
  async close() { try { await this.b.send("Target.closeTarget", { targetId: this.tid }); await this.b.send("Target.disposeBrowserContext", { browserContextId: this.ctx }); } catch {} }
}
export const KEYS = {
  W: { code: "KeyW", key: "w", vk: 87 }, A: { code: "KeyA", key: "a", vk: 65 }, D: { code: "KeyD", key: "d", vk: 68 }, S: { code: "KeyS", key: "s", vk: 83 },
  UP: { code: "ArrowUp", key: "ArrowUp", vk: 38 }, SPACE: { code: "Space", key: " ", vk: 32 },
};
