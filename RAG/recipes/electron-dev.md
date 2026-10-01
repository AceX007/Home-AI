---
id: rec-electron-dev
title: ESM Electron boot, not Node __dirname
stack: electron
status: tried
---

# ESM Electron boot, not Node __dirname

## Shape (do this)
- Mechanism: `npm run dev` starts electron-vite; main is ESM so `createWindow` joins CJS preload from `fileURLToPath(import.meta.url)`, not `__dirname`. Sandboxed Chromium cannot parse ESM `import` in preload.
- Good code shape: renderer Vite on **5175** (`strictPort`); main/preload/renderer watch ignore `AI Resources`, `Repos`, `RAG`, `data`, `vendor`, `.git`, `out`.
- Do not: bind renderer on 5173 (other apps occupy it); watch the whole workspace; use `electron-vite preview` as the daily driver (it externalizes `node:path` for the renderer). When the session already holds the inotify instance cap (`max_user_instances`, often 128), use `npm run ide` (`electron-vite build` then Electron) instead of `npm run dev`.

## Ports (same idea, other systems)
- Web/API: static `dist/` + a process manager; do not point the SPA at a foreign Vite port
- Desktop/IPC: this recipe (`createWindow`, `electron.vite.config.ts`)
- Mobile: Mini App is a separate HTTP server; do not load it as the Electron renderer
- Worker/CLI: `HOMEAI_HEADLESS=1 npm run telegram` — no BrowserWindow

## Curiosity (open)
- Why did `__dirname` crash? electron-vite emits ESM; Node ESM has no `__dirname` unless a banner injects it.
- What breaks if `paths.ts` `here` is a separate chunk? `../preload` would resolve under `out/main/`, so keep `mainDir` on the **entry** module.
- Analog: Vite `import.meta.url` for worker file URLs.

## Weaknesses / bugs / holes
- `join(__dirname, '../preload')` in ESM main — window never opens (AP-20260904-85).
- Chokidar on `AI Resources` / `RAG` hits inotify EMFILE; Electron dies after spawn (AP-20260904-86).
- Runtime `rag.watch` on `mods` + RAG is a second inotify client; on this desktop `max_user_instances` is already full, so watch must `error` → close (AP-20260904-88). Ingest at boot still covers mods.
- Prefixing sandbox-disable env on the shell is a Trust decision; only `npm run dev` may set it. `ide` / `preview` / `telegram` / pack must keep Chromium sandbox (AP-20260904-100).
- A fresh clone told only `npm run ide` never opens on Linux when `chrome-sandbox` is not setuid (AP-20261001-1). `takeInstallPlan` / `npm run doctor` names `npm run dev` in that case.
- ESM `out/preload/index.mjs` under `sandbox: true` never attaches `window.homeai` (AP-20260905-2). Preload must be CJS `index.js`.
- Renderer panes must not import `auto-review.mjs` / `mcp-packs.mjs` / `@homeai/runtime` (those load `node:path`). Display helpers live in `auto-review-line.mjs` and `mcp-domain.mjs` (AP-20260904-87).
- Renderer must not value-import `@homeai/ts-intel` (AP-20260905-22).
- Renderer must not value-import `@homeai/debug` (AP-20260905-23).

## Prevent / robust delivery
- Tests: T-96 T-112 T-125 T-127 T-129 `packages/runtime/src/electron-dev-boot.test.mjs`; T-134 `pack-chrome.test.mjs`
- Deny-by-default: watch ignore list; renderer port 5175
- Hunt layers: ipc (preload path is compile-time, not renderer input)

## Refinement log
- 2026-09-04 — Window failed on `__dirname`; watch flooded inotify. Worked: `mainDir` from `import.meta.url`; shared `watchIgnore`; `npm run ide` when inotify instances are already capped. Next: operator click-walk still required; do not mark Electron UX done headless.
- 2026-09-04 — Product chrome is Hex AI Workbench (window title / productName). IPC stays `homeai:`. Next: operator click-walk.
- 2026-09-04 — `npm run ide` + remote debugging :9222. Worked: click-walk of all activity icons; inotify EMFILE only killed rag watch, window still usable. Next: `npm run dev` still EMFILE on this machine — keep `ide`.
- 2026-09-04 — Consumer pack. Worked: stripped `ELECTRON_DISABLE_SANDBOX` from `ide`/`preview`/`telegram`; T-109 `releaseScriptsOk`. Next: operator `ide` click-walk with sandbox on; CI smoke may skip.
- 2026-09-05 — Window opened but renderer crashed: sandboxed preload rejected `import`. Worked: electron-vite preload `cjs` → `out/preload/index.js`; T-112. Next: operator click-walk; this Linux box still needs spawn-only `ELECTRON_DISABLE_SANDBOX=1` when chrome-sandbox is not SUID.
- 2026-09-05 — TS intel. Worked: renderer alias `@homeai/ts-intel` → denied stub; T-125 type-only imports. Next: still no Node barrels in Chromium.
- 2026-09-05 — Inspector. Worked: renderer alias `@homeai/debug` → denied stub. Next: still no Node barrels in Chromium.
- 2026-09-05 — TS worker file. Worked: `copy-ts-intel-worker` writes `out/main/ts-intel/` so `worker_threads` can load after the main bundle. Next: still `npm run ide` when inotify is capped.
- 2026-09-06 — File TS IPC on the worker. Worked: `callIsolated` from main handlers. Next: still `npm run ide` when inotify is capped.
- 2026-10-01 — Install path. Worked: `takeInstallPlan` + `npm run doctor`; README says Node 22, `vendor:llama`, then `dev` or `ide`. Failed if we had put `ELECTRON_DISABLE_SANDBOX` on `ide`. Next: a stranger still downloads the GGUF from Settings. AP-20261001-1.
