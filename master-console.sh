#!/usr/bin/env bash
################################################################################
# Home AI Workbench — launcher (kernel v2)
#
#   ./master-console.sh              interactive
#   ./master-console.sh ide          Electron workbench (dev)
#   ./master-console.sh start        alias for ide
#   ./master-console.sh llm-start    load Qwen 2B via llama-server
#   ./master-console.sh llm-stop
#   ./master-console.sh ask "task"   one-shot against local server
#   ./master-console.sh providers
#   ./master-console.sh llm-key openai|openrouter|cursor
#   ./master-console.sh doctor
#   ./master-console.sh vendor       fetch llama-server
################################################################################
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
SECRETS="$ROOT/data/secrets"
MODEL="$ROOT/Qwen3.5-2B-Q8_0.gguf"
PORT="${HOMEAI_PORT:-8765}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'; BOLD='\033[1m'

ok() { echo -e "${GREEN}[✓]${RESET} $*"; }
err() { echo -e "${RED}[✗]${RESET} $*"; }
info() { echo -e "${CYAN}[i]${RESET} $*"; }

ensure_node() {
  command -v npm >/dev/null || { err "Node/npm required"; exit 1; }
  if [[ ! -d node_modules ]]; then
    info "Installing npm dependencies…"
    npm install
  fi
}

save_key() {
  local name="$1"
  mkdir -p "$SECRETS"
  chmod 700 "$SECRETS"
  echo "Paste ${name} key, then Enter:"
  local key
  read -r key
  printf '%s' "$key" > "$SECRETS/${name}.key"
  chmod 600 "$SECRETS/${name}.key"
  ok "saved $SECRETS/${name}.key"
}

llama_bin() {
  if [[ -x "$ROOT/vendor/bin/llama-server" ]]; then
    echo "$ROOT/vendor/bin/llama-server"
  elif command -v llama-server >/dev/null; then
    command -v llama-server
  else
    echo ""
  fi
}

cmd_doctor() {
  echo -e "${BOLD}Home AI doctor${RESET}"
  [[ -f "$MODEL" ]] && ok "model $MODEL" || err "missing $MODEL"
  local bin
  bin="$(llama_bin)"
  [[ -n "$bin" ]] && ok "llama-server $bin" || err "llama-server missing — run: $0 vendor"
  command -v vulkaninfo >/dev/null && ok "vulkaninfo present" || info "no vulkaninfo (CPU profile will be used)"
  python3 - << 'PY'
import os, shutil
try:
    import subprocess, re
    out = subprocess.check_output(["glxinfo","-B"], text=True, stderr=subprocess.DEVNULL)
    m = re.search(r"Video memory:\s*(\d+)\s*MB", out)
    name = re.search(r"Device:\s*(.+)", out)
    print("GPU:", (name.group(1).strip() if name else "?"), "VRAM", m.group(1) if m else "?", "MB")
except Exception as e:
    print("GPU probe skipped:", e)
mem = shutil.disk_usage(".")
print("workspace", os.getcwd())
PY
  free -h | head -2
  for k in openai openrouter cursor; do
    if [[ -f "$SECRETS/$k.key" ]]; then ok "key $k configured"; else info "key $k empty"; fi
  done
}

cmd_llm_start() {
  local bin
  bin="$(llama_bin)"
  [[ -n "$bin" ]] || { err "no llama-server"; exit 1; }
  [[ -f "$MODEL" ]] || { err "no GGUF"; exit 1; }
  info "starting $bin on :$PORT"
  # 99 layers = full offload; governor inside the IDE may use a different ngl
  nohup "$bin" -m "$MODEL" --host 127.0.0.1 --port "$PORT" -c 4096 -ngl 99 --jinja \
    > "$ROOT/data/llama-server.log" 2>&1 &
  echo $! > "$ROOT/data/llama-server.pid"
  ok "pid $(cat "$ROOT/data/llama-server.pid")  log data/llama-server.log"
}

cmd_llm_stop() {
  if [[ -f "$ROOT/data/llama-server.pid" ]]; then
    kill "$(cat "$ROOT/data/llama-server.pid")" 2>/dev/null || true
    rm -f "$ROOT/data/llama-server.pid"
    ok "stopped"
  else
    pkill -f "llama-server.*${PORT}" 2>/dev/null || true
    info "no pid file; sent pkill"
  fi
}

cmd_ask() {
  local prompt="$*"
  [[ -n "$prompt" ]] || { err "usage: $0 ask \"task\""; exit 2; }
  curl -sS "http://127.0.0.1:${PORT}/v1/chat/completions" \
    -H 'Content-Type: application/json' \
    -d "$(python3 - "$prompt" << 'PY'
import json,sys
print(json.dumps({
  "model": "local",
  "temperature": 0.2,
  "messages": [
    {"role":"system","content":"You are Hex AI Kernel v2. Be terse. Tools live in the IDE; here you only answer."},
    {"role":"user","content": sys.argv[1]}
  ]
}))
PY
)" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('choices',[{}])[0].get('message',{}).get('content') or d)"
}

cmd_providers() {
  echo "local     always (GGUF + llama-server)"
  echo "openai    $SECRETS/openai.key   or OPENAI_API_KEY"
  echo "openrouter $SECRETS/openrouter.key or OPENROUTER_API_KEY"
  echo "cursor    $SECRETS/cursor.key   or CURSOR_API_KEY  (Cloud Agents API, not chat)"
}

cmd_ide() {
  ensure_node
  export HOME_AI_ROOT="$ROOT"
  export ELECTRON_DISABLE_SANDBOX=1
  npm run dev
}

usage() {
  sed -n '3,16p' "$0" | sed 's/^# \?//'
}

main_menu() {
  echo ""
  echo "╔══════════════════════════════════════════╗"
  echo "║         HOME AI WORKBENCH  kernel v2     ║"
  echo "╚══════════════════════════════════════════╝"
  echo "  [1] IDE          [2] Doctor"
  echo "  [3] Load 2B      [4] Unload 2B"
  echo "  [5] Providers    [6] Save API key"
  echo "  [7] Fetch llama-server"
  echo "  [0] Exit"
  printf "  Select: "
}

if [[ $# -gt 0 ]]; then
  case "$1" in
    ide|start) shift; cmd_ide ;;
    llm-start) cmd_llm_start ;;
    llm-stop) cmd_llm_stop ;;
    ask) shift; cmd_ask "$*" ;;
    providers) cmd_providers ;;
    llm-key) shift; save_key "${1:?name}" ;;
    doctor) cmd_doctor ;;
    vendor) bash "$ROOT/vendor/fetch-llama-server.sh" ;;
    help|-h|--help) usage ;;
    *) err "unknown $1"; usage; exit 2 ;;
  esac
  exit 0
fi

while true; do
  main_menu
  read -r opt || exit 0
  case "$opt" in
    1) cmd_ide ;;
    2) cmd_doctor; read -r -p "Enter…" _ ;;
    3) cmd_llm_start; read -r -p "Enter…" _ ;;
    4) cmd_llm_stop; read -r -p "Enter…" _ ;;
    5) cmd_providers; read -r -p "Enter…" _ ;;
    6)
      echo "  name: openai | openrouter | cursor"
      read -r n
      save_key "$n"
      read -r -p "Enter…" _
      ;;
    7) bash "$ROOT/vendor/fetch-llama-server.sh"; read -r -p "Enter…" _ ;;
    0) exit 0 ;;
  esac
done
