---
id: rec-compound-os
title: Mesh, jailed scene, DNA compiler, outcome route
stack: electron
status: tried
---

# Mesh, jailed scene, DNA compiler, outcome route

## Shape (do this)
- Mechanism: DNA compiles recipe shapes into validated `capabilityir/0.1`, then deterministic web, CLI, loopback API, and sandboxed desktop emitters.
- Good code shape: `compileCapabilityIr` → emitters; desktop uses `preload.cjs` to expose a frozen `desktop-bridge/0.1`, never generic IPC.
- Do not: copy AI Resources UI; DNA `.think.md`; unjailed computer-use; AGPL link; persist VERIFY via evolve.

## Ports (same idea, other systems)
- Web/API: CapabilityIR → CSP static web + JSON-only loopback `/compose`
- Desktop/IPC: generated Electron main loads the static app; preload passes frozen data only
- Mobile: gatewayContinuity same thread id
- Worker/CLI: CapabilityIR → dependency-free `cli/run.mjs`

## Curiosity (open)
- Why an IR seam? Validation happens once before any platform-specific template sees recipe-derived data.
- Port: native/mobile/API emitters consume CapabilityIR; they do not parse recipes or choose paths.

## Weaknesses / bugs / holes
- Scene IR is a DTO, not AX/SoM capture yet. AP-20260905-9
- DNA output is a static capability composition, not yet a full product package.
- Recipe metadata is a data-to-code boundary. AP-20260905-18
- CapabilityIR is compiler-owned and has no model patch surface. AP-20260905-19
- Loopback does not imply trust: fixed bind, body cap, no CORS. AP-20260905-20
- Desktop HTML remains untrusted: no Node, IPC, remote navigation, permissions, windows, or webviews. AP-20260905-21
- Fidelity is a revision string, not visual diff. AP-20260905-17

## Prevent / robust delivery
- Tests: T-119 T-120 T-121 T-122 T-123 T-124
- Deny-by-default: exact artifact paths; API loopback/schema caps; desktop context isolation/sandbox/frozen preload DTO
- Hunt layers: ipc, data

## Refinement log
- 2026-09-05 — Desktop emitter. Worked: generated `.mjs` main + `.cjs` preload + manifest, local-file navigation only, all permissions denied, renderer consumes frozen CapabilityIR result without Node/IPC. Failed: not packaged or operator click-walked. Next: mobile-safe manifest/emitter without pretending to produce native binaries.
- 2026-09-05 — Loopback API emitter. Worked: real `/health` + `/compose`, OpenAPI schema, 413/415/400 handling, graceful signals, live ephemeral-port regression. Failed: no persistent state/auth because this API only returns compiled public capability summaries. Next: desktop emitter consuming the same IR without Node in the renderer.
- 2026-09-05 — CapabilityIR phase. Worked: own-key `capabilityir/0.1` validation feeds real web + CLI emitters and writes `ir.json`; generated CLI executes in-memory. Failed: no API/desktop/mobile emitter or product packaging. Next: add one real API emitter with request validation, not stubs.
- 2026-09-05 — Runnable DNA compile. Worked: recipe front matter + one mechanism line produce CSP static HTML/CSS/JS under the existing jail; tool schema exposes `kind=dna`. Failed: this is not a packaged Electron/mobile/API product. Next: compile a typed capability IR before adding platform emitters.
- 2026-09-05 — Outcome persist. Worked: harness `verifyOk`/`localOk`/`hasSidecar` own-key; DNA README scaffold; `designFidelityReport` on `design_patch`. Failed: no AX capture / ACP workers / DNA codegen of original apps. Next: AX behind Ask.
- 2026-09-05 — Wave D continue. Worked: host `pickForgeProvider` gets `verifyOk`/`localOk`/`hasSidecar`; HITL delay note; richer scene ax/som from extract; mesh status. Failed: no AX capture / ACP workers / DNA codegen. Next: AX behind Ask.
- 2026-09-05 — Wave D host. Worked: browser extract → scene file; `plan_write` dna-*; `acpWorktreeName` on git worktrees; outcome remint when `localOk`/`verifyOk` passed. Failed: no live AX/SoM computer-use. Next: AX capture behind Ask.
- 2026-09-05 — Wave D. Worked: mesh tag, scene jail, DNA plan, harvest port kinds. Failed: no live computer-use. Next: AX capture behind Ask.
