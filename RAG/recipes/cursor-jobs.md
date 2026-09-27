---
id: rec-cursor-jobs
title: Cloud job status is a summary, not a dump
stack: electron
status: tried
---

# Cloud job status is a summary, not a dump

## Shape (do this)
- Mechanism: Cloud Agents API stays in main; the renderer only sees `{ id, status, name, summary }`.
- Good code shape: `cursorAgentId` then `encodeURIComponent`; `cursorJobList` / `cursorJobSummary`; poll while the list is open. Design generate uses Chat Completions + tools (`forgeForDesign` remint, then `toolsForDesign`); Cursor jobs stay summaries-only.
- Do not: interpolate `id` into a URL; `JSON.stringify` the API body into the chat log; send a DesignIR task through `runCursorCloudJob`.

## Ports (same idea, other systems)
- Web/API: job GET by opaque id, scoped to the caller; never return provider raw.
- Desktop/IPC: `homeai:cursor:list` / `get`
- Mobile: status cards from the same summary DTO
- Worker/CLI: `agents get --id` after the same allowlist

## Curiosity (open)
- Why not stream the full Cursor payload? It can hold repo URLs, prompts, and error bodies (AP-SEED-06).
- What breaks if ids are UUIDs with no dots? `[\w.-]` still matches.

## Weaknesses / bugs / holes
- Renderer-supplied id in the path (AP-20260828-8, AP-SEED-02).
- Polling with a missing key shows a hard error — expected empty until Settings.
- Design create with a Cursor mind used to short-circuit to Cloud Agents and never patch IR (AP-20260901-37).

## Prevent / robust delivery
- Tests: `packages/runtime/src/cursor-jobs.test.mjs`, `packages/runtime/src/mind.test.mjs`
- Deny-by-default: reject ids that encode differently from themselves.
- Hunt layers: ipc, jobs, client

## Refinement log
- 2026-08-28 — Wave J. Worked: list returns `{ jobs }`. Jobs live in the Background rail as the same DTO. Next: launch-from-composer UI if a Cursor key is present; do not add status polling in unrestricted mode without a cap.
- 2026-09-01 — Ports: Design = Chat Completions + tools; Cursor jobs = summaries. Worked: `forgeForDesign` remint before `runCursorCloudJob`. Next: do not invent a Cursor Chat Completions client.
- 2026-09-01 — Prove generate. Worked: remint toast still `DesignIR needs tools — not Cursor Cloud Agents`; Design loop never reaches Cursor. Failed: this agent did not hold cloud keys in-process. Next: operator OpenAI then OpenRouter in the app after keys in Settings.
- 2026-09-01 — Headless prove reads env then `data/secrets/*.key` without printing values. Worked: missing keys stay `remint: local`. Next: operator Settings keys then click OpenAI / OpenRouter in Design Home.
