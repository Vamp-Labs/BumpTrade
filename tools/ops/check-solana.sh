#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY="$ROOT/solana/deployments/devnet.json"

RPC="${SOL_RPC_URL:-https://api.devnet.solana.com}"
SERVER="${SERVER_URL:-${VITE_SOL_GAME_SERVER_URL:-http://localhost:2567}}"
SERVER="${SERVER/#wss:/https:}"
SERVER="${SERVER/#ws:/http:}"
SERVER="${SERVER%/}"
BOARD="${LEADERBOARD_URL:-${VITE_SOL_LEADERBOARD_URL:-$SERVER}}"
BOARD="${BOARD%/}"
RELAYER_KEYPAIR="${SOL_RELAYER_KEYPAIR:-$HOME/.config/solana/bump/relayer.json}"

for tool in curl jq; do
  command -v "$tool" >/dev/null 2>&1 || { echo "missing tool: $tool" >&2; exit 2; }
done

field() {
  [ -f "$DEPLOY" ] && jq -r --arg k "$1" '.[$k] // empty' "$DEPLOY" 2>/dev/null
}

PROGRAM_ID="${SOL_PROGRAM_ID:-$(field programId)}"
MINT="${SOL_MINT:-$(field mint)}"
CONFIG="${SOL_CONFIG_PDA:-$(field configPda)}"
RELAYER="${SOL_RELAYER_PUBKEY:-}"
if [ -z "$RELAYER" ] && [ -f "$RELAYER_KEYPAIR" ] && command -v solana-keygen >/dev/null 2>&1; then
  RELAYER="$(solana-keygen pubkey "$RELAYER_KEYPAIR" 2>/dev/null || true)"
fi

rpc() {
  curl -fsS --max-time 15 -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$1\",\"params\":$2}" "$RPC" 2>/dev/null
}

get() {
  curl -sS --max-time 15 -w '\nHTTP %{http_code}\n' "$1" 2>&1
}

echo "== cluster"
echo "rpc: $RPC"
SLOT="$(rpc getSlot '[]' | jq -r '.result // empty' 2>/dev/null)"
echo "slot: ${SLOT:-unreachable}"

echo "== program"
echo "id: ${PROGRAM_ID:-unset}"
if [ -n "$PROGRAM_ID" ]; then
  rpc getAccountInfo "[\"$PROGRAM_ID\",{\"encoding\":\"base64\",\"dataSlice\":{\"offset\":0,\"length\":0}}]" \
    | jq -r 'if .result.value == null then "deployed: no" else "deployed: yes (executable=\(.result.value.executable))" end' 2>/dev/null \
    || echo "deployed: unknown"
fi

echo "== config account"
echo "pda: ${CONFIG:-unset}"
if [ -n "$CONFIG" ]; then
  rpc getAccountInfo "[\"$CONFIG\",{\"encoding\":\"base64\",\"dataSlice\":{\"offset\":0,\"length\":0}}]" \
    | jq -r 'if .result.value == null then "initialized: no" else "initialized: yes (owner=\(.result.value.owner), lamports=\(.result.value.lamports))" end' 2>/dev/null \
    || echo "initialized: unknown"
fi

echo "== relayer"
if [ -n "$RELAYER" ]; then
  echo "address: $RELAYER"
  LAMPORTS="$(rpc getBalance "[\"$RELAYER\"]" | jq -r '.result.value // empty')"
  if [ -n "$LAMPORTS" ]; then
    echo "balance: $LAMPORTS lamports ($(awk -v l="$LAMPORTS" 'BEGIN{printf "%.4f", l/1e9}') SOL)"
    MIN="${RELAYER_MIN_BALANCE:-50000000}"
    [ "$LAMPORTS" -lt "$MIN" ] && echo "WARNING: below RELAYER_MIN_BALANCE ($MIN)"
  else
    echo "balance: unreachable"
  fi
else
  echo "address: unset (set SOL_RELAYER_PUBKEY or SOL_RELAYER_KEYPAIR)"
fi

echo "== mint"
echo "address: ${MINT:-unset}"
if [ -n "$MINT" ]; then
  rpc getTokenSupply "[\"$MINT\"]" \
    | jq -r 'if .result then "supply: \(.result.value.uiAmountString) (raw \(.result.value.amount), decimals \(.result.value.decimals))" else "supply: unavailable" end' 2>/dev/null \
    || echo "supply: unavailable"
fi

echo "== server"
echo "url: $SERVER"
echo "-- /metrics.json"
get "$SERVER/metrics.json"
echo "-- /health"
get "$SERVER/health"

echo "== leaderboard"
echo "url: $BOARD"
echo "-- /ready"
get "$BOARD/ready"
