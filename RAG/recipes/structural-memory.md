---
id: rec-structural-memory
title: Freeze tools, impact before edit, mint harness
stack: electron
status: tried
---

# Freeze tools, impact before edit, mint harness

## Shape (do this)
- Mechanism: snapshot tool names at forge start; parse symbols/imports; import-based callers in a jailed `.homeai/graph.json`; warn when fan-in ≥ 3; curator drafts skills after two verified discoveries; harness JSON own-key, evolve only in auto-review; VERIFY flags persist as own keys.
- Good code shape: `freezeToolList` → `filterFrozenTools`; `buildStructuralGraph` → `queryGraph` / `impactBeforeEdit`; `mintHarness` + `takeHarness` own keys including `verifyOk`.
- Do not: rebuild tool JSON mid-turn; `__proto__` evolve or `__proto__` verifyOk; write SKILL.md without Ask; walk `AI Resources` for the graph.

## Ports (same idea, other systems)
- Web/API: capability freeze per request id
- Desktop/IPC: this recipe
- Mobile: same frozen list on `/do`
- Worker/CLI: `--tools-hash`

## Curiosity (open)
- Why freeze instead of MCP hot-add? Prompt-cache + 2B tool selection.
- What is the graph without codebase-memory dist? Local `parseStructuralIndex` + import callers. Still not Cypher.

## Weaknesses / bugs / holes
- Import match is suffix/`endsWith`, not a real module resolver. AP-20260905-14
- Fan-in used to be same-file symbols. Now callers from the analog graph. AP-20260905-8
- Harness evolve gated; VERIFY persist is not evolve. AP-20260905-7 AP-20260905-15

## Prevent / robust delivery
- Tests: T-117
- Deny-by-default: evolve false unless auto-review; proto keys dropped; graph walk only `packages`/`apps`
- Hunt layers: ipc, data

## Refinement log
- 2026-09-05 — Analog graph. Worked: boot `refreshWorkspaceGraph`; perceive/`rag_search`/`str_replace`/`git_diff` use import callers; harness `verifyOk` own-key persist. Failed: no tree-sitter / codebase-memory dist. Next: Cypher backend when dist exists.
- 2026-09-05 — Wave B continue. Worked: `filterFrozenTools` on every tool call; skip MCP reload while kernel runs; boot curator Ask drafts; sessionText from the live thread (not `data/conversations` ingest). Failed: no tree-sitter MCP dist. Next: Cypher backend when dist exists.
- 2026-09-05 — Wave B host. Worked: curator after Critic; session section in perceive; harness `assertInside`. Failed: no live tree-sitter graph. Next: merge codebase-memory hits into `rag_search`.
- 2026-09-05 — Wave B. Worked: freeze + curator ask + harness own-key. Failed: no live tree-sitter graph. Next: merge codebase-memory hits into `rag_search`.
