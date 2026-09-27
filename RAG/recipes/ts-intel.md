---
id: rec-ts-intel
title: Jailed TypeScript LanguageService in main
stack: electron
status: tried
---

# Jailed TypeScript LanguageService

## Shape (do this)
- Mechanism: main process owns `typescript.createLanguageService`; renderer asks through `homeai:ts:*` with dirty-buffer overlays.
- Good code shape: `takeTsRequest` own keys → `TsIntelligence.jail` → public DTOs; rename `commitTsEdits` + `changes.record`.
- Do not: Monaco `ts.worker` as project intel; `readFile` on renderer paths; apply cross-file rename in the renderer.

## Ports (same idea, other systems)
- Web/API: language-service worker with a repo root jail and a reviewable patch endpoint
- Desktop/IPC: this recipe
- Mobile: diagnostic summaries only
- Worker/CLI: `tsc --noEmit` under `--root`

## Curiosity (open)
- Why not vscode-languageclient? One jailed host is enough for TS/JS; keep `lspQuery` for other languages.
- What breaks at 10x files? Do not dump tsconfig `fileNames` into `getScriptFileNames`; overlay + open files, cap workspace-symbol walks.

## Weaknesses / bugs / holes
- Raw `payload` into LanguageService (paths, `__proto__`, oversized text). AP-20260905-22
- Rename that writes without Keep/Undo. Same AP.
- Renderer value-import of `@homeai/ts-intel` pulls `node:fs` into Chromium.
- Main-thread workspace symbol walks freeze IPC; renderer-owned cancel seq. AP-20260905-25
- File diagnostics/completions on Electron main. AP-20260905-28
- Inspector evaluate catch without `throwOnSideEffect`. AP-20260905-27

## Prevent / robust delivery
- Tests: T-126 T-127 T-131
- Deny-by-default: `takeTsRequest` null; skipped `node_modules`/`AI Resources` as roots; renderer alias denied
- Hunt layers: ipc, client

## Refinement log
- 2026-09-05 — Wave 2 host. Worked: overlays, definitions, rename edits, jail. Failed: IPC still trusted payloads; Monaco rename skipped checkpoints. Next: Node Inspector, not a second TS server.
- 2026-09-05 — Critic extras. Worked: VERIFY note can carry TS diagnostic counts without changing VERIFY_TOOLS. Next: still no vscode-languageclient.
- 2026-09-06 — File reads on the worker. Worked: `callIsolated` for diagnostics/hover/completions; GotoSymbol cancel does not drop in-flight diagnostics. Failed: rename still on main by design. Next: still no vscode-languageclient / utilityProcess.
