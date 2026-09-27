---
id: rec-ipc-workspace-fs
title: Workspace-scoped filesystem over IPC
stack: electron
status: tried
---

# Workspace-scoped filesystem over IPC

## Shape (do this)
- Mechanism: renderer is untrusted; main process resolves paths under the workspace root.
- Good code shape: `ipcMain.handle('…:fs:…', (_, path) => readFileSafe(workspace, path))` and `gitPathspecs` for git — prefix check, reject `..` and extra-root absolutes.
- Do not: `readFile`/`exec` on renderer strings; expose a generic shell.

## Ports (same idea, other systems)
- Web/API: authenticated download/upload with allowlisted prefix; no `path` query into `../`
- Desktop/IPC: this recipe
- Mobile: share sheet / SAF; never raw filesystem from JS
- Worker/CLI: argv paths confined to `--root`

## Curiosity (open)
- Why IPC and not `nodeIntegration` in the renderer? Renderer XSS would become RCE.
- What breaks on symlinks, UNC paths, `file://`?
- Analog: HTTP static file server with root jail.

## Weaknesses / bugs / holes
- Extra-root `root` id that is a path (`../`, `/etc`) or a colliding basename. Link: AP-20260904-56.
- New `ipcMain.handle` that forgets `readFileSafe` (sibling hunt). AP-20260828-1, AP-SEED-04.
- `git add` / `git restore` with renderer pathspecs (AP-20260828-2). Same jail: `gitPathspecs`.
- `shell.openExternal` / `shell.openPath` with user URLs or extra-root paths.
- Preload exposing too many channels.
- Symlink inside the workspace pointing out — `assertInside` realpaths when the target exists.

## Prevent / robust delivery
- Tests: `../` and absolute-outside-workspace denied; symlink-out denied; git pathspec refuses workspace root. `packages/runtime/src/paths.test.mjs`.
- Deny-by-default: allowlist channels in preload; git argv array + `--`.
- Hunt layers: ipc, client

## Refinement log
- 2026-08-28 — fingerprint dry-run on Home AI (`apps/desktop/src/main/index.ts`). Next: assert every new `homeai:fs:*` handle uses the safe helper.
- 2026-08-28 — Wave D: moved jail to `packages/runtime/src/paths.mjs`; `gitAdd`/`gitUnstage`/`shell:open` use it. Worked: one helper, node:test without vitest (this Node has no TS strip). Next: `homeai:browser:navigate` is still UI-open (agent path uses `urlAllowed`); do not confuse the two.
- 2026-08-28 — Wave E: left UI navigate operator-open on purpose. Agent `browser_navigate` still `urlAllowed`.
- 2026-08-28 — Wave H: `designTokenRel` + `assertInside` for `designs/*.json` only. Next: comment-anchor files stay under `designs/` the same way.
- 2026-08-28 — Wave K: `gitPullArgv` is exactly `pull --ff-only`; IPC ignores extra args (AP-20260828-14). Next: do not add fetch --all.
- 2026-09-01 — Wave U. Worked: `gitPushArgv` dedicated IPC (not terminal allowlist); Search `workspaceGrep` + `publicGrepHits`. Next: do not add renderer remotes; keep Instant Grep out.
- 2026-09-01 — Extra-root `jailPath` / `fsExtraRoots`. Worked: absolute listed roots only; writes Ask. Next: do not add a generic `homeai:fs:stat` that echoes extra-root errors.
- 2026-09-04 — Extra-root `root` id is folder basename (`takeFsRootId`). Relative paths under the extra root work; `/` and `$HOME` still dropped on load. Writes still Ask. Next: do not add a generic `homeai:fs:stat`.
- 2026-09-04 — `web_search` uses `assertAgentUrl` + `WEB_SEARCH_ENDPOINT`. Preload `HomeAiApi` has fleet + `onPtyExit` + `browserConsole`. Next: do not add a generic `homeai:fs:stat`; keep UI navigate operator-open.
- 2026-09-04 — GGUF download is profile `models/` + `.partial`, not a new `fs:stat`. Worked: `takeGgufDest` / `takePartialDest` / `sha256File` suffix jail. Next: still no generic `homeai:fs:stat`.
- 2026-09-05 — TS intel IPC. Worked: `homeai:ts:*` uses `takeTsRequest` + `writeFileSafe` on rename, not a new `fs:stat`. Next: still no generic `homeai:fs:stat`.
- 2026-09-05 — Inspector + git lines. Worked: `homeai:debug:*` + `homeai:git:lines` use take/jail helpers, not `fs:stat`. Next: still no generic `homeai:fs:stat`.
