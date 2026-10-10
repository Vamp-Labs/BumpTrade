// Returns JS source for a Wallet Standard mock wallet. Signing is delegated to the node signer over HTTP.
export function walletScript({ address, signerUrl, idx }) {
  return `(() => {
  const ADDR = ${JSON.stringify(address)};
  const SIGNER = ${JSON.stringify(signerUrl)};
  const IDX = ${idx};
  const b58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const dec = (s) => { let n = 0n; for (const c of s) n = n * 58n + BigInt(b58.indexOf(c)); const o = []; while (n > 0n) { o.unshift(Number(n & 255n)); n >>= 8n; } for (const c of s) { if (c === "1") o.unshift(0); else break; } return Uint8Array.from(o); };
  const account = Object.freeze({ address: ADDR, publicKey: dec(ADDR), chains: ["solana:devnet"], features: ["solana:signTransaction", "solana:signMessage"], label: "E2E " + IDX });
  const listeners = new Set();
  const AUTH = "e2e.mock.authorized";
  const authorized = () => { try { return localStorage.getItem(AUTH) === "1"; } catch { return false; } };
  let connected = authorized();
  const emit = (p) => { for (const l of listeners) { try { l(p); } catch {} } };
  async function call(path, body) {
    const r = await fetch(SIGNER + path + "?w=" + IDX, { method: "POST", body });
    if (!r.ok) throw new Error("signer " + r.status + " " + (await r.text()));
    return new Uint8Array(await r.arrayBuffer());
  }
  window.__mockWallet = { signCalls: 0, connectCalls: 0 };
  const wallet = {
    version: "1.0.0",
    name: "E2E Mock Wallet",
    icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjOTk0NWZmIi8+PC9zdmc+",
    chains: ["solana:devnet"],
    get accounts() { return connected ? [account] : []; },
    features: {
      "standard:connect": { version: "1.0.0", connect: async (opts) => {
        window.__mockWallet.connectCalls++;
        if (opts && opts.silent && !authorized()) return { accounts: [] };
        connected = true; try { localStorage.setItem(AUTH, "1"); } catch {}
        emit({ accounts: [account] });
        return { accounts: [account] };
      } },
      "standard:disconnect": { version: "1.0.0", disconnect: async () => { connected = false; try { localStorage.removeItem(AUTH); } catch {} emit({ accounts: [] }); } },
      "standard:events": { version: "1.0.0", on: (ev, l) => { if (ev !== "change") return () => {}; listeners.add(l); return () => listeners.delete(l); } },
      "solana:signTransaction": { version: "1.0.0", supportedTransactionVersions: ["legacy", 0], signTransaction: async (...inputs) => {
        const out = [];
        for (const i of inputs) {
          if (i.account.address !== ADDR) throw new Error("wrong account");
          window.__mockWallet.signCalls++;
          out.push({ signedTransaction: await call("/sign", i.transaction) });
        }
        return out;
      } },
      "solana:signMessage": { version: "1.0.0", signMessage: async (...inputs) => {
        const out = [];
        for (const i of inputs) { const sig = await call("/signMessage", i.message); out.push({ signedMessage: i.message, signature: sig }); }
        return out;
      } },
    },
  };
  const register = (api) => api.register(wallet);
  try { window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { bubbles: false, cancelable: false, detail: register })); } catch (e) {}
  try { window.addEventListener("wallet-standard:app-ready", (e) => register(e.detail)); } catch (e) {}
})();`;
}
