---
id: rec-hunt-prevent-delivery
title: Hunt and prevent as one delivery loop
stack: any
status: tried
---

# Hunt and prevent as one delivery loop

## Shape (do this)
- Mechanism: audit hunts then prevents; build prevents then hunts the diff. Memory lives in `data/bug-memory/anti-patterns.md`.
- Good code shape: fingerprint → mine → sibling search → Gate 0 → regression test + AP record + recipe refine.
- Do not: hunt without a prevention artifact; ship an edit that skipped the anti-pattern checklist; write exploit PoCs.

## Ports (same idea, other systems)
- Web/API: threat model the handler, then add the test that would have caught IDOR/XSS
- Desktop/IPC: trust renderer as attacker; jail paths
- Mobile: authZ on the API, not the screen
- Worker/CLI: idempotency + re-authZ in the job

## Curiosity (open)
- Why not only Semgrep? History + sibling copies miss grep; recipes catch intent.
- What if there is no git log? Seed anti-patterns still hunt day one.

## Weaknesses / bugs / holes
- Loading 56 `hunt-*` payload skills blows context — cap 3–5 by name.
- Findings without tests come back as regressions.

## Prevent / robust delivery
- Tests: every Gate-0 finding gets a regression.
- Deny-by-default: incomplete report = not done.
- Hunt layers: all that fingerprint listed

## Refinement log
- 2026-08-28 — shipped `full-stack-hunt-prevent`. Next: every feature-build step 3+5 must cite an AP or a recipe.
- 2026-08-28 — added `recipe-refine` + `RAG/recipes/` (kernel-loop, ipc-workspace-fs, skill-cards, hunt-prevent-delivery). Next: append this log on every ship.
- 2026-08-28 — shipped `repo-library` + Library pane. Next: T-01 workspace jail test.
- 2026-09-01 — Wave U gap-fix. Worked: hunt-idor (push argv), hunt-xss (grep hits), hunt-llm-ai (plan vs think path). Next: still cap hunt-* at 3–5 per ship.
- 2026-09-04 — Gap close. Worked: hunt-xss (Glance `phases` text nodes), hunt-idor (Mini `mode`/`fleet-restart` allowlist), hunt-llm-ai (Ask cannot speak/STT/OCR/browser-read; web_search URL jail). Next: still cap hunt-* at 3–5; Electron click-walk is operator-only.
- 2026-09-04 — Consumer pack. Worked: hunt-xss (Onboard/About text), hunt-nodejs/ipc (preload `takePreloadBridge`, GGUF dest jail), hunt-cicd (SHA-pinned actions + `takeHuntPreventDiff`), hunt-file-upload (`sha256File` suffix). Next: pin GGUF sha256; still cap hunt-* at 3–5.
- 2026-09-05 — TS intel. Worked: hunt-nodejs/ipc (`takeTsRequest` + rename checkpoint), hunt-xss (Checks/symbols/hover text), hunt-lfi (LanguageService jail). Next: still cap hunt-* at 3–5.
- 2026-09-05 — TS worker + Checks a11y. Worked: hunt-nodejs (`workspaceSymbolsIsolated` + internal seq), hunt-xss (status/QA text), hunt-lfi (worker root = constructor jail). Next: still cap hunt-* at 3–5.
- 2026-09-06 — TS file IPC + inspect eval. Worked: hunt-nodejs (`callIsolated` allowlist), hunt-exceptional-conditions (no eval fallback), hunt-nodejs/ipc (smoke skip not ide sandbox off). Next: still cap hunt-* at 3–5.
