---
id: rec-auto-review
title: Pre-tool Judge then classify then human
stack: electron
status: tried
---

# Pre-tool Judge then classify then human

## Shape (do this)
- Mechanism: `approvalMode: auto-review` runs `judgeShell` (argv allowlist) then optional local 2B axes JSON then `combineAxes`. Main halts `deny` before `runTool`.
- Good code shape: `runAutoReviewPipeline` → `parseReviewerAxes` own keys → `combineAxes`; status `publicAutoReviewLine`; instructions via `takeInstructionPair`.
- Do not: vendor mvdan/sh; let the LLM output allow/deny; feed tool results to the reviewer; run after deny; claim Landlock.

## Ports (same idea, other systems)
- Web/API: policy engine before `exec`, same combinator DTO
- Desktop/IPC: `decideTool` + `homeai:permissions:set`
- Mobile: jailed Trust line only (`trustLine` on stage/help/menu when `approvalMode` is passed)
- Worker/CLI: same `auto-review.mjs` module

## Curiosity (open)
- Why not LLM-first? Cost and rubber-stamp sympathy. Why not sandbox-only? Orthogonal (git still needs global config). Weakness: no real AST, so `&&` is the only compound; `$()` always asks.

## Weaknesses / bugs / holes
- Prefix `commandAllowed` used to auto-allow `git status; rm` (allowlist mode still does). Auto-review Judge does not. AP-20260904-75, AP-20260904-79.
- `deny` used to fall through to `runTool`. AP-20260904-74.
- Reviewer JSON `__proto__` and tool-result injection. AP-20260904-76.
- `allow_instructions` must never skip `too_destructive`. AP-20260904-77.
- Classify used to `combineAxes` without `biasAxes`. AP-20260904-78.
- MCP allowlist used to auto-allow under `auto-review`. AP-20260904-82.
- Empty Trust textareas used to omit `autoReview` on disk so `~/.homeai` resurrected lines. AP-20260904-83.
- Health `stageCard` used to omit `autoReviewLine`. AP-20260904-84.

## Prevent / robust delivery
- Tests: T-92 T-93 T-95 `packages/runtime/src/auto-review.test.mjs` `policy.test.mjs`
- Deny-by-default: unmodeled → ask; extra-root write → ask; llama off → ask; MCP in auto-review → ask
- Hunt layers: ipc, jobs, client

## Refinement log
- 2026-09-04 — first ship. Worked: Judge argv + combinator + deny halt + Settings/store wiring. Failed: no Electron click-walk. Next: optional `node --version` rule; `helpCard` mode-aware Trust; do not vendor a shell parser. `autoRun` still unused.
- 2026-09-04 — Wave follow-up. Worked: `splitSafeAnd` rejects `;|` without `&&`; classify re-enters `runAutoReviewPipeline` with axes; npm extras max 4; tsBuildInfoFile jail. Failed: Electron click-walk still operator. Next: do not vendor a shell parser. `autoRun` still unused.
- 2026-09-04 — Gap hunt follow-up. Worked: MCP Ask in auto-review; persist `autoReview: null`; Health sheet pulse line. Failed: Electron click-walk still operator. Next: do not vendor a shell parser. `autoRun` still unused.
- 2026-09-05 — Compiler-OS. Worked: `autoRun` hints in `instructionAuthorization` (block wins); Trust lane in Background. Failed: click-walk. Next: still not Landlock.
