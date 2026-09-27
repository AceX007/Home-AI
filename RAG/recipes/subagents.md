---
id: rec-subagents
title: Digest-returning workers, not grep dumps
stack: electron
status: refined
---

# Digest-returning workers, not grep dumps

## Shape (do this)
- Mechanism: parent tool `task` with `subagent_type` or `jobs[]`; child tools only; digest (bash last 80 lines). Research URL jobs call `web_extract`; HTML bodies run `extractHtml`. Explore rows start `Explore finished`.
- Good code shape: `parseTaskCall` + `runSubagentJobs`; `depth` denies nested `task`; Think explore-only; optional `nestedForge` (explore only, skipVerify).
- Do not: spawn a second `task` from a worker; do not return raw HTML/grep to the parent.

## Ports (same idea, other systems)
- Web/API: job queue with summary callback
- Desktop/IPC: this recipe
- Mobile: same `task` on `/do`
- Worker/CLI: `--jobs` JSON

## Curiosity (open)
- Why not nested LLM forge always? llama-server is single-flight; optional nested explore uses a second GGUF on :8766. Deterministic tools stay the default.
- What breaks at 10 workers? Cap 4.

## Weaknesses / bugs / holes
- Bash worker still goes through `terminal_run` approvals (good). Think bash was a hole — blocked.
- Nested LLM forge on Think would burn the 2B slot. Callback is skipped when `think` or missing. Link: AP-20260901-52.
- Nested `task` from a worker is still denied (`host.depth`).
- Nested forge must not fall back to `:8766` when the sidecar is not owned. Link: AP-20260901-54.
- Research used to `web_search` a URL and leave HTML in the digest. Link: AP-20260904-59.

## Prevent / robust delivery
- Tests: `packages/runtime/src/subagent.test.mjs`
- Deny-by-default: bad kind / empty query / `..` path
- Hunt layers: ipc

## Refinement log
- 2026-09-01 — Wave A `task`. Worked: explore digest. Next: optional nested `runForge` when a second GGUF port exists.
- 2026-09-01 — Wave D nestedForge callback, explore-only. Worked: skip when no callback; Think stays deterministic. Next: do not pass renderer ports; bash/browser stay digests.
- 2026-09-01 — Owned-port gate on nested forge (`ownedLlamaPort`). Worked: no DEFAULT_CODER_PORT fallback. Next: keep Think without nestedForge.
- 2026-09-04 — Digest strips HTML; research URLs use `web_extract`; Explore finished banner. Next: keep Think without nestedForge.
