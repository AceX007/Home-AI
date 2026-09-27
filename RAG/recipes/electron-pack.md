---
id: rec-electron-pack
title: Packaged Electron roots, GGUF, sandbox
stack: electron
status: tried
---

# Packaged Electron roots, GGUF, sandbox

## Shape (do this)
- Mechanism: packaged app splits **app resources / profile / workspace**; GGUF downloads to profile `models/` via `.partial` + size + optional sha256; Chromium sandbox stays on except `npm run dev`.
- Good code shape: `takeAppRoots` → `modelDownloadPlan` → `takePartialDest` / `takeGgufReady` / `sha256File`; `releaseScriptsOk`; preload `takePreloadBridge`; `electron-builder` excludes `AI Resources`, secrets, `*.gguf`.
- Do not: write GGUF into the asar; `ELECTRON_DISABLE_SANDBOX` on `ide`/`pack`/`release`; `homeai:fs:stat`; ship Cursor `.deb` bits; Landlock claims.

## Ports (same idea, other systems)
- Web/API: object storage PUT to a staging key, checksum, then rename; never serve the staging object
- Desktop/IPC: this recipe (`homeai:model:download`, `homeai:diagnostics`)
- Mobile: OS download manager + content URI; no renderer path
- Worker/CLI: Eliza gpu-vision `ensureFile` shape (lockfile sha256, not Hex importing Eliza)

## Curiosity (open)
- Why not pin `GGUF_RELEASE.sha256` today? The file is still moving; empty pin skips hash (`checksumMatches`) but keeps the size floor.
- What if Hugging Face returns 200 for a Range resume? Overwrite the partial (`flags: 'w'`), do not append.
- Analog: Hermes `asarUnpack **/*.node` + `safeStorage` 0600 secrets.

## Weaknesses / bugs / holes
- Torn dest without `.partial` (AP-20260904-99).
- Operator `ide` script disabling sandbox (AP-20260904-100).
- Extra preload expose (AP-20260904-101).
- ESM preload under `sandbox: true` (AP-20260905-2).
- `sha256File` hashing `/etc/passwd` if the suffix jail is dropped.
- CI smoke often needs `--no-sandbox`; `scripts/electron-smoke.mjs` skips missing `smoke.json` when `CI=1`.
- Non-SUID `chrome-sandbox` is not a product bug; skip smoke instead of disabling sandbox on `ide`. AP-20260905-28

## Prevent / robust delivery
- Tests: T-106..T-110 T-132 `app-roots.test.mjs` `pack-chrome.test.mjs` `electron-pack.test.mjs`
- Deny-by-default: GGUF URL host `huggingface.co` + default filename; `takeStoreListing` Flathub/winget false
- Hunt layers: ipc, client, ci, file dest

## Refinement log
- 2026-09-05 — Do not port Eliza/Hermes UI. Worked: Hex workbench stays the chrome (Onboard overlay removed); GGUF `.partial` and sandbox stay behavior. Next: still no first-run product sheet.
- 2026-09-06 — Smoke skip. Worked: `takeChromeSandboxSkip` when chrome-sandbox is not SUID; ide script still sandboxed. Next: operator `ide` click-walk.
