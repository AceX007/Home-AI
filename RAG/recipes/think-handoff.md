---
id: rec-think-handoff
title: Local Think writes a disk artifact; Implement follows only that file
stack: electron
status: tried
---

# Local Think writes a disk artifact

## Shape (do this)
- Mechanism: offline 2B researches with packs/tools and must `plan_write` `RAG/plans/<slug>.think.md`. Online (or local fallback) implements from that file only.
- Good code shape: `THINK_TOOLS` allowlist; `validateThinkMarkdown`; `loadThinkDoc` + `redactCloudText` on Implement.
- Do not: let Think `terminal_run`/`fs_write`; Implement from chat history; send secrets in mention blobs.

## Ports (same idea, other systems)
- Web/API: POST `/think` writes artifact; POST `/implement` with If-Match path
- Desktop/IPC: mode `think` + `homeai:think:list` + `runAgent({ thinkPath })`
- Mobile: same two-phase, local on-device then cloud
- Worker/CLI: `homeai think` then `homeai implement --path`

## Curiosity (open)
- Why not one mixed model? 4GB VRAM: 2B is the gatherer; cloud is muscle (AGENTS.md).
- What if no cloud key? Implement stays local with write tools, still bound to the think file.

## Weaknesses / bugs / holes
- Vague think docs (empty `files:`) — validator rejects (AP-20260828-10).
- Cloud seeing terminals/chats/keys — stripped + `redactCloudText` (AP-SEED-06).
- Plan vs Think confusion — Plan is human `.md` via `ragWriteRel('plans')`; Think is `.think.md` + Implement. AP-20260901-44.

## Prevent / robust delivery
- Tests: `packages/runtime/src/think.test.mjs`
- Deny-by-default: Think cannot exec or patch product files.
- Hunt layers: ipc, jobs, client

## Refinement log
- 2026-08-28 — Think mode + perceive pack + plan_write. Worked: slug jail turns `../secrets` into `secrets.think.md`. Next: show the think file in PlanDoc; optional status bump to implementing on Implement click.
- 2026-09-01 — Wave Q. Worked: main bumps `implementing` → `done` after a successful Implement forge; renderer still cannot write YAML. Next: skip bump when the forge errors.
- 2026-09-01 — Wave R. Worked: `shouldCloseThink(false)` only; error chunks leave status implementing; PlanDoc Built only when think status is done. Next: surface the stay-implementing reason on the wf-card.
- 2026-09-01 — Phone Stage card. Worked: `stageCard` shows implementing (not Built/done) when last forge chunk was error. Next: still no think-done bump from Telegram itself.
- 2026-09-01 — Wave S. Worked: `thinkPick` ignores draft/done and `../`; `forgeIsFault` + Trust row; `listThinkDocs` includes jailed files. Next: Telegram implement skip-done is the sibling agent.
- 2026-09-01 — Wave U. Worked: Plan `rag_write` folder `plans` → `RAG/plans/<base>.md` never `.think.md`; `plan_write` still owns Think. Next: still no think-done bump from Telegram itself.
- 2026-09-05 — Compiler-OS. Worked: Design create writes `designThinkMarkdown` handoff. Failed: click-walk. Next: Implement from that file.
