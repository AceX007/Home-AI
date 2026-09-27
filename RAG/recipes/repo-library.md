---
id: rec-repo-library
title: Per-repo library (roadmap + tests + edges)
stack: any
status: tried
---

# Per-repo library

## Shape (do this)
- Mechanism: markdown brain in `RAG/library/`; STATUS meters; kanban stays `taskboards/`.
- Good code shape: missing ROADMAP → scaffold; every ship → count-status.sh + tick TESTS/EDGES.
- Do not: second kanban; mark tests `done` without a file; exploit write-ups in EDGES.

## Ports (same idea, other systems)
- Web/API: OpenAPI + coverage matrix in-repo
- Desktop/IPC: this pane + files
- Mobile: same markdown; no extra app
- Worker/CLI: count-status.sh in CI

## Curiosity (open)
- Why not only GitHub issues? Offline 2B + any model must read the same files.
- What breaks if STATUS drifts from tables? Always run count-status.sh.

## Weaknesses / bugs / holes
- E-03 no ROADMAP. T-07 T-08 now have files (`search-proof.test.mjs`); still run count-status on a tmp root so the script cannot mutate the live library during the test.

## Prevent / robust delivery
- Tests: T-07 counts; T-08 pane uses existing `homeai.read`.
- Deny-by-default: no ROADMAP → repo-library first.
- Hunt layers: ipc (read), client (pane)

## Refinement log
- 2026-08-28 — shipped library + LibraryPane. Next: T-01 IPC jail test file.
- 2026-09-01 — Wave U. Worked: T-02–T-08 + T-56–T-58 files; `parseLibraryStatus` shared; count-status.sh on tmp. Next: keep STATUS generated, never hand-edit meters.
- 2026-09-04 — `countTableStatus` / awk exact-cell (not `$5`) so prove text with pipes cannot steal the status column. T-11 tags profile. Next: still never hand-edit STATUS meters; run `count-status.sh`.
- 2026-09-04 — Feature refine. Worked: Library pane stays full-width in Stage. Open in editor still switches to Files. Next: still never hand-edit STATUS meters.
