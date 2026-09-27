#!/usr/bin/env bash
# Fingerprint a git/workspace tree for full-stack-hunt-prevent. Compact stdout for small context.
set -euo pipefail
ROOT="${1:-.}"
cd "$ROOT"
ROOT="$(pwd)"
echo "=== fingerprint $ROOT ==="

emit() { printf '%s\n' "$1"; }

if [[ -f package.json ]]; then
  emit "manifest: package.json"
  # name + key deps/devDeps (no versions dump)
  python3 - "$ROOT" <<'PY' 2>/dev/null || true
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
pkg = json.loads((root / "package.json").read_text(encoding="utf-8"))
print(f"name: {pkg.get('name','')} product: {pkg.get('productName','')} version: {pkg.get('version','')}")
keys = []
for field in ("dependencies", "devDependencies"):
    keys.extend((pkg.get(field) or {}).keys())
needles = (
    "electron", "electron-vite", "vite", "react", "next", "express", "fastify",
    "graphql", "socket.io", "better-sqlite3", "prisma", "mongoose", "typeorm",
    "tailwindcss", "expo", "react-native", "vue", "svelte", "nestjs"
)
hit = [n for n in needles if n in keys]
print("stack_hits: " + (", ".join(hit) if hit else "(none of curated list)"))
if pkg.get("main"):
    print(f"main: {pkg['main']}")
PY
fi

for f in pnpm-lock.yaml yarn.lock bun.lockb package-lock.json Cargo.lock go.sum poetry.lock uv.lock; do
  [[ -f "$f" ]] && emit "lock: $f"
done

for f in go.mod Cargo.toml pyproject.toml requirements.txt composer.json Gemfile build.gradle pom.xml; do
  [[ -f "$f" ]] && emit "backend_manifest: $f"
done

for f in openapi.yaml openapi.json swagger.json; do
  [[ -f "$f" ]] && emit "api_spec: $f"
done
if [[ -d .github/workflows ]]; then
  emit "ci: .github/workflows"
  find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) | sed 's|^|  |'
fi

# Top-level layout (not node_modules)
emit "top:"
ls -1 | head -n 40 | sed 's/^/  /'

for d in apps packages src renderer main preload ios android mobile; do
  [[ -d "$d" ]] && emit "dir: $d"
done

# Electron-ish paths
for p in \
  apps/desktop/src/main/index.ts \
  apps/desktop/src/preload/index.ts \
  apps/renderer/src \
  electron.vite.config.ts \
  src/main \
  src/preload
 do
  [[ -e "$p" ]] && emit "electron_path: $p"
done

# Route-ish files (names only, cap). Prune vendor trees (incl. extracted Cursor debs).
emit "route_like:"
find . \( \
    -name node_modules -o -name out -o -name dist -o -name vendor -o -name .git \
    -o -name 'cursor_*' -o -name 'AI Resources' \
  \) -prune -o -type f \( -name '*route*' -o -name '*router*' -o -name '*ipc*' \) -print \
  2>/dev/null | head -n 30 | sed 's/^/  /'

# Entrypoints by symbol (source trees only)
emit "ipc_or_http:"
grep -rlE 'ipcMain\.(handle|on)|app\.(get|post|put|delete)\(' \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.py' \
  apps packages mods src 2>/dev/null | head -n 20 | sed 's/^/  /' || true

emit "=== end fingerprint ==="
