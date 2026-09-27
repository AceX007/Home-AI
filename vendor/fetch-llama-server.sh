#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/vendor/bin"
mkdir -p "$DEST"

# Allowlisted llama.cpp asset token. Hex never interpolates this into a URL itself.
export HEX_LLAMA_ASSET="${HEX_LLAMA_ASSET:-ubuntu-vulkan-x64}"

if [[ -x "$DEST/llama-server" || -x "$DEST/llama-server.exe" ]]; then
  echo "llama-server already at $DEST"
  "$DEST/llama-server" --version 2>/dev/null || "$DEST/llama-server.exe" --version 2>/dev/null || true
  exit 0
fi

if command -v llama-server >/dev/null 2>&1; then
  echo "llama-server is on PATH: $(command -v llama-server)"
  ln -sfn "$(command -v llama-server)" "$DEST/llama-server"
  exit 0
fi
if command -v llama-server.exe >/dev/null 2>&1; then
  echo "llama-server.exe is on PATH: $(command -v llama-server.exe)"
  ln -sfn "$(command -v llama-server.exe)" "$DEST/llama-server.exe"
  exit 0
fi

echo "Fetching llama.cpp asset ${HEX_LLAMA_ASSET} (ggml-org releases)…"
# /releases/latest is a stub tag (v0.3.0) with no binaries — walk b* releases.
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
curl -fsSL "https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=8" -o "$TMP"

python3 - "$TMP" "$DEST" << 'PY'
import json, os, re, sys, urllib.request, zipfile, tarfile, io, stat

with open(sys.argv[1], encoding="utf-8") as f:
    rels = json.load(f)
dest = sys.argv[2]
allowed = {"ubuntu-vulkan-x64", "win-cpu-x64", "macos-arm64", "macos-x64"}
want_asset = os.environ.get("HEX_LLAMA_ASSET", "ubuntu-vulkan-x64").lower().strip()
if want_asset not in allowed:
    want_asset = "ubuntu-vulkan-x64"

def rank(name: str):
    n = name.lower()
    if not (n.endswith(".zip") or n.endswith(".tar.gz")):
        return None
    if want_asset and want_asset in n:
        return 0
    if "ubuntu-vulkan-x64" in n:
        return 1
    if "linux" in n and "vulkan" in n and "x64" in n:
        return 2
    if n.endswith("ubuntu-x64.tar.gz") or n.endswith("ubuntu-x64.zip"):
        return 3
    return None

picked = None
for rel in rels:
    tag = rel.get("tag_name") or ""
    if tag.startswith("v"):
        continue
    scored = []
    for a in rel.get("assets") or []:
        r = rank(a["name"])
        if r is None:
            continue
        scored.append((r, a["browser_download_url"], a["name"], tag))
    if scored:
        scored.sort()
        picked = scored[0]
        break

if not picked:
    raise SystemExit(f"No {want_asset} (or ubuntu-x64) llama.cpp asset found.")

_, url, name, tag = picked
print(f"Downloading {name} ({tag})")
req = urllib.request.Request(url, headers={"User-Agent": "HomeAI-vendor-fetch"})
data = urllib.request.urlopen(req, timeout=180).read()
os.makedirs(dest, exist_ok=True)
found = None

def want(base: str) -> bool:
    if base in ("llama-server", "llama-server.exe"):
        return True
    return ".so" in base or base.endswith(".dll") or ".dylib" in base

if name.endswith(".zip"):
    z = zipfile.ZipFile(io.BytesIO(data))
    for info in z.infolist():
        if info.is_dir():
            continue
        base = os.path.basename(info.filename)
        if not want(base):
            continue
        target = os.path.join(dest, base)
        with z.open(info) as src, open(target, "wb") as out:
            out.write(src.read())
        if base.startswith("llama-server"):
            found = target
else:
    t = tarfile.open(fileobj=io.BytesIO(data), mode="r:gz")
    for m in t.getmembers():
        base = os.path.basename(m.name)
        if not want(base):
            continue
        target = os.path.join(dest, base)
        if m.issym() or m.islnk():
            link = os.path.basename(m.linkname)
            if os.path.lexists(target):
                os.remove(target)
            os.symlink(link, target)
            if base.startswith("llama-server"):
                found = target
            continue
        if not m.isfile():
            continue
        srcf = t.extractfile(m)
        if srcf is None:
            continue
        with open(target, "wb") as out:
            out.write(srcf.read())
        if base.startswith("llama-server"):
            found = target

for fn in os.listdir(dest):
    m = re.fullmatch(r"(lib.+\.so)\.(\d+)\..+", fn)
    if not m:
        continue
    for link in (f"{m.group(1)}.{m.group(2)}", m.group(1)):
        path = os.path.join(dest, link)
        if os.path.lexists(path):
            continue
        os.symlink(fn, path)

if not found:
    raise SystemExit("Archive had no llama-server binary")
os.chmod(found, os.stat(found).st_mode | stat.S_IEXEC)
print("Installed", found)
PY
