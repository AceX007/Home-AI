---
id: rec-compiler-os
title: Unify PERCEIVE, promote remember, one Stop
stack: electron
status: tried
---

# Unify PERCEIVE, promote remember, one Stop

## Shape (do this)
- Mechanism: one `composePerceivePack` for think/agent/debug/plan; FTS + maps + QA + bug-memory kind; REMEMBER drafts `.promote.md` with `apply: ask`; Trust lane is Auto Review; `registerKernelRun` owns Stop.
- Good code shape: `needsPerceivePack` → `perceivePack`; `promoteDiscovery` never writes recipes; `starterTrustRules` only `MCP_STARTER_IDS`.
- Do not: ingest `data/secrets`; auto-apply promotions; Trust DesktopCommander; split Stop maps per surface.

## Ports (same idea, other systems)
- Web/API: request context pack + audit promote queue
- Desktop/IPC: this recipe
- Mobile: same pack on Telegram `/do`
- Worker/CLI: `--perceive` then `--promote-ask`

## Curiosity (open)
- Why not dump MCP into perceive? 2B context. Graph hits stay names.
- What if Maps is empty? Pack still says `(none)`.

## Weaknesses / bugs / holes
- Promote files can accumulate. Operator must apply. AP-20260905-6
- `autoRun` used to be dead. Now hints only; too-destructive still deny. AP-20260905-7

## Prevent / robust delivery
- Tests: T-116 T-120 `compiler-os.test.mjs`
- Deny-by-default: `ragIngestAllowed` false on secrets; promote `apply: false`
- Hunt layers: ipc, data, jobs

## Refinement log
- 2026-09-05 — Analog graph in PERCEIVE. Worked: `queryGraph` names in the Graph section (still not MCP dist). Failed: codebase-memory `dist/index.js` still missing. Next: merge live MCP graph hits when dist exists.
- 2026-09-05 — Wave A continue. Worked: Mini App `surface: miniapp`; fleet receipts in `takeWorkflow` + Background. Failed: codebase-memory dist still missing. Next: merge live MCP graph hits when `dist/index.js` exists.
- 2026-09-05 — Wave A host. Worked: session+fleet sections, `join(root, name, bug-memory)` walk, fleet receipts on kernel jobs. Failed: no Electron click-walk. Next: graph MCP live when dist exists.
- 2026-09-05 — Wave A. Worked: pack + promote + Trust chip + design think + kernel Stop. Failed: no Electron click-walk. Next: graph MCP live when dist exists.
- 2026-10-01 — RAG unlink. Worked: `takeRagRemoveSpec` deletes one path and `#chunk:` rows. Failed if the old `LIKE path%` stayed. Next: doctor probes one watch instead of every fd. AP-20261001-2.
- 2026-10-01 — Globs and search LIKE. Worked: `matchGlob` is anchored; `takeLikeContains` escapes `%` and `_`. Failed if `*.md` still matched `file.md.bak`. AP-20261001-3.
