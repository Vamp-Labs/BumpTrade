#!/usr/bin/env bash
# One-command two-browser Solana E2E.
#
#   Local (default): throwaway keys, solana-test-validator, deploy, server, client, headless Chrome, scenario a-f.
#     tools/e2e/solana-local/run.sh
#
#   Against an existing deployment (e.g. devnet): bring your own env file with the server env names from
#   docs/handoffs/solana/01-contracts.md C8 (SOL_PROGRAM_ID, SOL_MINT, SOL_TREASURY, SOL_RELAYER_SECRET,
#   SOL_RESULT_SIGNER_SECRET, SOL_MINT_AUTHORITY_SECRET, STAKE_AMOUNT, ...). The script still starts a LOCAL game
#   server and client pointed at that RPC, so no Railway is touched. Secrets are read from the file, never printed.
#     tools/e2e/solana-local/run.sh --rpc https://api.devnet.solana.com --env /path/to/devnet.env
#
# Options: --rpc URL  --env FILE  --skip-slow (skip the 62 s expiry test and negative match)  --keep-shots (copy shots/)
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
RPC="http://127.0.0.1:8899"; ENVFILE=""; SKIP_SLOW=""; SHOTS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --rpc) RPC="$2"; shift 2;;
    --env) ENVFILE="$2"; shift 2;;
    --skip-slow) SKIP_SLOW=1; shift;;
    --keep-shots) SHOTS="$HERE/shots"; shift;;
    *) echo "unknown arg $1" >&2; exit 2;;
  esac
done
LOCAL=1; [ -n "$ENVFILE" ] && LOCAL=""
if [ -z "$LOCAL" ] && [ "$RPC" = "http://127.0.0.1:8899" ]; then echo "--env needs --rpc" >&2; exit 2; fi
case "$RPC" in *mainnet*) echo "refusing mainnet" >&2; exit 2;; esac

WORK="${E2E_WORK:-$(mktemp -d /tmp/bump-e2e-XXXXXX)}"
mkdir -p "$WORK/run" "$WORK/keys" "$WORK/chrome"
SERVER_PORT="${E2E_SERVER_PORT:-2567}"; CLIENT_PORT="${E2E_CLIENT_PORT:-4173}"; CHROME_PORT="${E2E_CHROME_PORT:-9333}"
PIDS=()
cleanup() {
  for f in "${PIDS[@]}"; do [ -f "$f" ] && kill -TERM -"$(cat "$f")" 2>/dev/null; done
  sleep 1
  for f in "${PIDS[@]}"; do [ -f "$f" ] && kill -KILL -"$(cat "$f")" 2>/dev/null; done
  rm -rf "$WORK/run/ledger" "$WORK/chrome" "$WORK/dist"
  rm -f "$ROOT/solana/deployments/local.json"
}
trap cleanup EXIT
START_DIR="$ROOT"; START_ENV=""
start() { # name cmd...   (own process group, pid file; only these groups are ever killed)
  local name="$1"; shift
  ( cd "$START_DIR"; [ -n "$START_ENV" ] && { set -a; . "$START_ENV"; set +a; }; setsid "$@" > "$WORK/run/$name.log" 2>&1 & echo $! > "$WORK/run/$name.pid" )
  PIDS+=("$WORK/run/$name.pid")
}
waitfor() { local i; for i in $(seq 1 "${3:-60}"); do eval "$2" >/dev/null 2>&1 && return 0; sleep 1; done; echo "timeout: $1" >&2; return 1; }

if [ -n "$LOCAL" ]; then
  [ -f "$ROOT/solana/target/deploy/bump_arena.so" ] || (cd "$ROOT/solana" && flock /tmp/bump-build.lock env PATH="$HOME/.cargo/bin:$PATH" anchor build) || exit 1
  node -e '
    import("'"$HERE"'/lib.mjs").then((m) => { const fs = require("fs"); const o = {};
      for (const n of ["deployer","relayer","signer","mintauth"]) { const k = m.newKey(); m.saveKeypair(k, process.argv[1] + "/keys/" + n + ".json"); o[n] = { addr: k.address, sec: k.secretB58 }; }
      fs.writeFileSync(process.argv[1] + "/keys/all.json", JSON.stringify(o), { mode: 0o600 }); })' "$WORK"
  addr() { node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1]))[process.argv[2]].addr)' "$WORK/keys/all.json" "$1"; }
  sec() { node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1]))[process.argv[2]].sec)' "$WORK/keys/all.json" "$1"; }
  start validator solana-test-validator --reset --ledger "$WORK/run/ledger" --rpc-port 8899 --faucet-port 9900 --limit-ledger-size 50000 --mint "$(addr deployer)"
  waitfor validator "curl -s $RPC -H 'content-type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getHealth\"}' | grep -q ok" 60 || exit 1
  solana transfer -u "$RPC" --keypair "$WORK/keys/deployer.json" --allow-unfunded-recipient "$(addr relayer)" 10 >/dev/null || exit 1
  (cd "$ROOT/solana" && ANCHOR_WALLET="$WORK/keys/deployer.json" pnpm deploy:local -- --mint-authority "$(addr mintauth)" --operator "$(addr relayer)" --result-signer "$(addr signer)" --rpc "$RPC" > "$WORK/run/deploy.log" 2>&1) || { tail -20 "$WORK/run/deploy.log"; exit 1; }
  DEP="$ROOT/solana/deployments/local.json"
  cat > "$WORK/run/server.env" <<EOT
CHAIN=solana
SOL_CLUSTER=devnet
SOL_RPC_URL=$RPC
SOL_PROGRAM_ID=$(jq -r .programId "$DEP")
SOL_MINT=$(jq -r .mint "$DEP")
SOL_TREASURY=$(jq -r .treasury "$DEP")
SOL_RELAYER_SECRET=$(sec relayer)
SOL_RESULT_SIGNER_SECRET=$(sec signer)
SOL_MINT_AUTHORITY_SECRET=$(sec mintauth)
STAKE_AMOUNT=100000000000
START_BALANCE=100
EOT
  RELAYER_PUB="$(addr relayer)"
else
  cp "$ENVFILE" "$WORK/run/server.env"
  RELAYER_PUB="$(node -e '
    const fs = require("fs"); const line = fs.readFileSync(process.argv[1], "utf8").split("\n").find((l) => l.startsWith("SOL_RELAYER_SECRET="));
    import(process.argv[2] + "/lib.mjs").then((m) => { const b = m.b58dec(line.split("=")[1].trim().replace(/^["]|["]$/g, "")); console.log(m.b58enc(b.subarray(32))); })' "$ENVFILE" "$HERE")"
fi
chmod 600 "$WORK/run/server.env"
JOINWIN="${E2E_JOIN_WINDOW_S:-$([ -n "$SKIP_SLOW" ] && echo 40 || echo 160)}"
# test-only overrides appended last so they win (short rounds, relaxed per-IP limits)
cat >> "$WORK/run/server.env" <<EOT
SOL_RPC_URL=$RPC
MATCH_DURATION_S=25
JOIN_WINDOW_S=$JOINWIN
FILL_TIMER_S=8
MIN_PLAYERS=2
MAX_PLAYERS=8
PORT=$SERVER_PORT
CORS_ORIGINS=http://localhost:$CLIENT_PORT,http://127.0.0.1:$CLIENT_PORT
REPLAY_DIR=$WORK/run/replays
FAUCET_PER_IP_PER_HOUR=1000
JOIN_PER_IP_PER_HOUR=1000
FAUCET_GLOBAL_PER_HOUR=10000
EOT
unset DATABASE_URL
envval() { grep "^$1=" "$WORK/run/server.env" | tail -1 | cut -d= -f2- | tr -d '"'; }
MINT="$(envval SOL_MINT)"; PROGRAM="$(envval SOL_PROGRAM_ID)"; TREASURY="$(envval SOL_TREASURY)"; STAKE="$(envval STAKE_AMOUNT)"
[ -n "$MINT" ] && [ -n "$PROGRAM" ] && [ -n "$TREASURY" ] || { echo "env needs SOL_MINT, SOL_PROGRAM_ID, SOL_TREASURY" >&2; exit 2; }

START_DIR="$ROOT/server" START_ENV="$WORK/run/server.env" start server pnpm --filter @bump/server start
waitfor server "curl -sf http://localhost:$SERVER_PORT/health" 60 || { tail -20 "$WORK/run/server.log"; exit 1; }

(cd "$ROOT" && VITE_CHAIN_DEFAULT=solana VITE_SOL_CLUSTER=devnet VITE_SOL_RPC_URL="$RPC" VITE_SOL_PROGRAM_ID="$PROGRAM" VITE_SOL_MINT="$MINT" \
  VITE_SOL_GAME_SERVER_URL="ws://localhost:$SERVER_PORT" VITE_SOL_LEADERBOARD_URL="http://localhost:$SERVER_PORT" \
  flock /tmp/bump-build.lock pnpm exec vite build --outDir "$WORK/dist" --emptyOutDir > "$WORK/run/build.log" 2>&1) || { tail -20 "$WORK/run/build.log"; exit 1; }
start preview pnpm exec vite preview --outDir "$WORK/dist" --port "$CLIENT_PORT" --strictPort --host 127.0.0.1
waitfor preview "curl -sf http://localhost:$CLIENT_PORT/" 30 || exit 1
start chrome google-chrome-stable --headless=new --remote-debugging-port="$CHROME_PORT" --user-data-dir="$WORK/chrome" --no-sandbox --window-size=1600,900 --ignore-gpu-blocklist --enable-gpu-rasterization --use-gl=angle --use-angle=gl about:blank
waitfor chrome "curl -sf http://127.0.0.1:$CHROME_PORT/json/version" 30 || exit 1

E2E_RPC="$RPC" E2E_SERVER="http://localhost:$SERVER_PORT" E2E_CLIENT="http://localhost:$CLIENT_PORT/" E2E_CHROME_PORT="$CHROME_PORT" \
E2E_MINT="$MINT" E2E_PROGRAM="$PROGRAM" E2E_TREASURY="$TREASURY" E2E_RELAYER="$RELAYER_PUB" E2E_STAKE="$STAKE" \
E2E_JOIN_WINDOW_S="$JOINWIN" E2E_REPLAY_DIR="$WORK/run/replays" E2E_SERVER_LOG="$WORK/run/server.log" E2E_OUT="$WORK/out" E2E_SHOTS="$SHOTS" E2E_SKIP_SLOW="$SKIP_SLOW" \
  node "$HERE/e2e.mjs"
RC=$?
echo "artifacts: $WORK/out (report.json, screenshots), logs: $WORK/run"
exit $RC
