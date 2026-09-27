---
id: rec-kernel-loop
title: Kernel agent loop
stack: any
status: refined
---

# Kernel agent loop

## Shape (do this)
- Mechanism: small context, tools first, surgical edits, close with verify+memory.
- Good code shape: PERCEIVE (explore, tiny reads) → ROUTE (local default) → ACT (`str_replace` / new files only) → VERIFY (`verifyUserPrompt` + `takeVerifyPatch` + `takeVerifyDiff` + `takeVerifyCalls` only) → REMEMBER (`rag_write` + recipe refine). Background view: Hunt = perceive/act tools, Verify = `test_run` during ACT (no `review` tool), Critic = VERIFY pass (`takeWorkflowLane`). Auto Review is pre-tool Trust, not a forge phase.
- Do not: dump grep into the parent; rewrite whole files; skip remember; spawn a 27-agent fleet; tag ACT `str_replace` as critic.

## Ports (same idea, other systems)
- Web/API: request → validate → mutate → persist → audit log
- Desktop/IPC: renderer intent → main handler → workspace check → result
- Mobile: UI event → repository → API → local cache invalidate
- Worker/CLI: job payload → idempotent handler → ack

## Curiosity (open)
- Why this and not a single “just code” shot? Context is the scarce resource (local 2B).
- What breaks at 10x files / vague tasks? Missing `ask_user`; missing explore.

## Weaknesses / bugs / holes
- Skipping VERIFY ships UI that was never clicked.
- Skipping REMEMBER makes the next model reinvent the wheel.
- Nested explore forge without `skipVerify` would double-critic on the sidecar (VRAM + loops). Link: AP-20260901-52.
- Sidecar `portOpen` attach would treat any leftover `/health` on 8766 as the coder. Link: AP-20260901-54.
- VERIFY prompt used to invite `test_run` in KERNEL_SYSTEM while `VERIFY_TOOLS` excluded it. `verifyUserPrompt` forbids test_run/terminal_run (AP-20260904-57).
- Usage arriving before the first `tool_call` left per-agent Tokens as `—` (AP-20260904-69).
- Critic used to see only 180-char toolTrace lines. `takeVerifyPatch` attaches workspace-relative before/after; `takeVerifyDiff` is a workspace-only `git diff --no-ext-diff -- .` with secrets excluded; extra-root is omitted; `<>` stripped; cloud tokens redacted (AP-20260904-61, AP-20260904-65, E-09).

## Prevent / robust delivery
- Tests: run the relevant command before “done”. T-68 T-75 T-78 (`takeVerifyPatch` + `takeVerifyDiff`).
- Deny-by-default: no product guesses; `ask_user`.
- Hunt layers: any layer the ACT touched.

## Refinement log
- 2026-08-28 — seeded from Home AI kernel. Next: every feature-build must append here or to a more specific recipe.
- 2026-08-28 — Think mode: local_tools forced; Implement is a separate run bound to `.think.md`. Next: shrink tool JSON schemas further in Think to save 2B context.
- 2026-08-28 — Wave J surfaces forge steps in the Background rail (perceive→remember). Next: emit a running tool row before the ok/err status chunk.
- 2026-08-28 — Wave K yields `publicToolCall` before `runTool`. Next: shrink tool JSON schemas further in Think to save 2B context.
- 2026-08-28 — Telegram + desktop share `formatChatLog` from the disk store. Next: emit a running tool row on the phone card before ok/err.
- 2026-09-01 — IDE chrome reads the same pulse jail as Telegram Manage. Next: breadcrumbs without a new unjailed fs channel.
- 2026-09-01 — Home OS: VERIFY is a second critic pass (`str_replace`/`debug_log`/`ask_user`); `takeVerifyCalls` drops Qwen extras. Packs shrink parent tools; MCP schemas are name-only. Next: nested subagent forge when a coder GGUF port exists.
- 2026-09-01 — Wave D: nested explore forge on the coder sidecar (`skipVerify`/`skipRemember`/`maxTurns` 2). 2B still orchestrates. Next: do not nested-LLM from Think; keep sidecar start failure off the 2B process.
- 2026-09-01 — Hunt after Wave D: sidecar no longer attaches to a foreign listener (`shouldAttachExistingListener`). Next: do not show 8766 in ports unless `ownedLlamaPort` is set.
- 2026-09-04 — `verifyUserPrompt` is the only critic user turn; KERNEL_SYSTEM no longer tells VERIFY to call `test_run`. Next: critic still does not receive a dedicated git diff blob (trace lines only).
- 2026-09-04 — `takeVerifyPatch` is the critic blob (last 3 writes, workspace-relative). Next: still not a git diff; extra-root content stays omitted on purpose.
- 2026-09-04 — `takeVerifyDiff` is the jailed workspace git diff after patches. Extra-root and `data/secrets` stay omitted. Next: staged-only critic is still WONT.
- 2026-09-04 — Forge tags `lane` on `tool_call`; KERNEL_SYSTEM names Hunt/Verify/Critic as a view of the same loop. Nested explore still skipVerify. Next: fill per-agent tokens only when SSE usage exists.
- 2026-09-04 — Gap fill. Worked: usage-before-tool_call fills the next Hunt/Verify/Critic row; `verify · no tools` is Critic skipped, not an empty table. Failed: Electron click-walk still outstanding. Next: confirm Critic only appears on the VERIFY pass in Stage.
- 2026-09-04 — Auto Review is pre-tool Judge/classifier (`auto-review.mjs`), not VERIFY. KERNEL_SYSTEM no longer names a `review` tool. Next: Electron click-walk Settings → auto-review.
- 2026-09-04 — Wave 8 hunt. Worked: Auto Review stays pre-tool (`runAutoReviewPipeline` before `runTool`); VERIFY still critic tools only. Failed: Electron click-walk still operator. Next: Settings → auto-review click-walk; do not fold Auto Review into VERIFY.
- 2026-09-05 — Compiler-OS. Worked: unified perceive pack + promote Ask + Trust lane (still not a forge phase). Failed: click-walk. Next: codebase-memory dist.
