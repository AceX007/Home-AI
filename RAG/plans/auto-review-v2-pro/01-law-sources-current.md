# Phase 0 — Law, sources, current screens (read-only)

Index: [00-INDEX.md](00-INDEX.md) · Screens: [SCREENS.md](SCREENS.md) · Next: [02-phase-judge.md](02-phase-judge.md)

Do not write product code in this phase. An implementer who skips this file will wire the wrong “review”.

## Standing law

- Hunt and prevent are one loop. Before the **first** product write: `data/bug-memory/anti-patterns.md`, `RAG/recipes/permissions-policy.md`, `RAG/recipes/kernel-loop.md`. Fingerprint already ran for this conversation.
- Hunt classes (cap 3–5): `hunt-xss`, `hunt-idor`, `hunt-llm-ai`. Repro is a test or exact code path, not an exploit write-up.
- Surgical `str_replace`. New files via `fs_write` / `Write` only.
- Stay inside the workspace. Do not vendor `mvdan/sh`, PowerShell AST, LLMStack, or copy Cursor/LM Studio UI.
- Do not raise `task` cap. Do not put Stage on the pill row. Do not use `dangerouslySetInnerHTML`. Do not mint tokens from `text.length`. Do not fake Opus / Hunt3 fleets. Do not claim 82% auto-allow.
- Extra-root writes **always Ask**, including unrestricted and auto-review.
- Unrestricted stays “Run Everything” for workspace tools. Auto-review does **not** replace unrestricted.

## Sources (what to steal)

### LM Studio Auto Review — pipeline only

Full post: https://lmstudio.ai/blog/how-auto-review-works

Must keep:

1. **Judge first, no LLM.** Unknown AST / unmodeled capability → cannot auto-allow (allowlist of understood shapes).
2. Env assign / `export` → reject from auto-allow (`GIT_EXTERNAL_DIFF` class).
3. Reviewer **classifies three axes**, does not output allow/deny, must not sympathize, must not be told the passing score.
4. Combinator: `too_destructive` never runs even if the user said yes. Low + not `explicitly_no` → run. High needs `explicitly_yes`. Else ask human.
5. Except too-destructive, do not teach the main agent a bypass — fall back to human (`ask`), not a chatty deny.
6. Reviewer transcript: user + assistant since last review; **exclude tool results** (prompt injection). Separate budgets for user vs other text.
7. Sandbox does not replace this. Home AI has no Landlock — Trust copy must stay honest.

Must **not** copy:

- mvdan/sh / PowerShell parser / 11,651 judge tests / finite-alternatives engine.
- Companion session DAG, rollback, fork, sync points.
- `readableFileOrStdin` GNU flag tables as a DSL — we encode a **tiny** argv subset.
- Anecdotal 82%.
- Their `git merge-base` → `commitHash` type lattice. Honest Home AI: `base=$(git merge-base)` is **unmodeled → ask**. The compound `git status --short --branch && git diff --check` **can** allow if both segments are modeled.

Their “safe looking but unsafe” teaching examples (document as tests, do not paste exploits):

- `target="notes.txt"; echo "done" > $target` vs `target="/etc/passwd"; echo "done" > $target` — we **unmodel all env/assign**, so both ask (or deny if too_destructive). We do **not** implement finite alternatives.
- `git diff $base` when `$base` could be `--output=/sensitive` — we unmodel `$` / command substitution.

### LLMStack — chain only

https://docs.trypromptly.com/llmstack/introduction

Keep: processors = named stages with jailed input / config / output; apps = saved pipeline config; variables = JSON passed between stages.

Do not: `pip install llmstack`, visual no-code builder, Discord/Slack deploy, their processors, datasources, connections.

Home AI chain names:

| Stage | Module | LLM? |
|---|---|---|
| Judge | `judgeShell` / `runAutoReviewPipeline` | no |
| Classify | `parseReviewerAxes` + optional `completeOnce` | optional 2B |
| Combine | `combineAxes` | no |

## Three surfaces that already exist (do not merge them)

| Surface | Wired? | Keep as |
|---|---|---|
| Kernel **VERIFY / Critic** | Yes | After writes. Tools only `str_replace` / `debug_log` / `ask_user`. Nested explore `skipVerify: true`. |
| **Agent Review** Quick/Deep | Partial | Manual local-2B git-diff in Chat. IPC `homeai:agentReview:quick`. Fix palette/Git wiring in phase 06. |
| `permissions.autoReview` | Store only | `takeInstructionPair` already sanitizes. `decideTool` **never reads it** today. Settings has no fields. |

KERNEL_SYSTEM today (`packages/agent/src/index.ts`):

- VERIFY paragraph is correct (no `test_run` in VERIFY).
- Background sentence still says `Verify = test_run / review during ACT` — **there is no `review` tool**. Fix in phase 07.

## Current screens (inspect these; change only what a later phase names)

### Settings Trust — `apps/renderer/src/panes/SettingsPane.tsx`

- Approval `<select>`: `allowlist` \| `manual` \| `unrestricted` only.
- Textareas: terminal / net / MCP / extra-root.
- Save calls `homeai.permissionsSet` → `savePermissions` → `takePermissionsPatch`.
- Copy: “writes Ask · no Landlock”. Keep that honesty.
- **Missing:** `auto-review` option, allow/block instruction editors, any mention of Judge/Reviewer.

### Stage Trust — `apps/renderer/src/panes/StageTrustRow.tsx`

- Allow/Deny on `w.approval`.
- Chip: `Local 2B · Ask · no Landlock · allow N · deny N`.
- **Missing:** last Auto Review verdict. Do not put Stage on the pill row.

### Chat — `apps/renderer/src/panes/ChatPane.tsx`

- Local `reviewText` / `reviewBusy` (not in the store).
- `.agent-review` hunk list via `parseReviewHunks` (T-42 jail).
- Composer **Review** button = pending-diffs Keep/Undo (`reviewOpen`), **not** Auto Review.
- Quick hunks / Deep call `agentReview`.
- **Missing:** pipeline status card; palette cannot set `reviewText`.

### Command palette — `apps/renderer/src/layout/CommandPalette.tsx`

- “Agent review (quick)” opens chat and invokes IPC **without** storing `res.text`.

### Git — `apps/renderer/src/panes/GitPane.tsx`

- “Agent review” calls `w.run(...)` — starts a **forge**, not the 2B diff panel. Wrong.

### Background tasks — `apps/renderer/src/panes/BackgroundTasks.tsx`

- Hunt / Verify / Critic of the **forge** loop. Do **not** add a fake Auto-review fleet row.

### Telegram — `packages/runtime/src/telegram-chrome.mjs`

- Hardcoded `Local 2B · Ask · no Landlock` in `helpCard`, `menuCard`, `stageCard`.
- Tests in `telegram-chrome.test.mjs` assert `/Ask/` and `/no Landlock/` and no `Hunt3`.
- Mini Glance is forge phases only.

## Current decision path (must fix in phase 04)

`packages/runtime/src/approvals.ts` `decideTool`:

1. `read` → allow
2. extra-root write → ask (`extraRootWriteDecision`)
3. `unrestricted` → allow
4. `manual` → workspace `fs_write`/`str_replace` allow, else ask
5. `exec` → `commandAllowed` prefix match else ask
6. `net` → `urlAllowed` else ask
7. else allow

Never returns a deny that main honors. `ApprovalMode` type is only three values. `clampApprovalMode` maps unknown → `allowlist` (so `'auto-review'` would be **destroyed on save** until phase 04).

`apps/desktop/src/main/index.ts` ~1296:

```
const decision = decideTool(...)
if (decision === 'ask') { /* IPC wait */ }
const result = await runTool(...)
```

If `decision === 'deny'`, the tool **still runs**. That is the halt bug. Phase 04 must insert deny before `runTool`.

MCP block is separate: unrestricted allow, else allowlist else ask. Auto-review does **not** auto-allow MCP.

`toolApprovalDetail` (`policy.mjs`):

- `terminal_run` → `args.command`
- `test_run` → `args.command ?? args.kind ?? name` (usually `auto` / `npm` / `pytest`)
- net tools → real URL (`web_search` is DDG origin + query)
- `compute_run` → `compute_run node|python`
- `inbox_stt` / `speak` → literal tool name
- `git_worktree` → `git worktree list` or `git worktree add <name>`

Judge must special-case non-argv details (phase 02).

## Existing sanitizers to reuse (do not rewrite)

- `takeInstructionPair` / `instructionList` — own-key, strip `<>`/newlines, cap 32×200.
- `stripActivityText` — all public Auto Review strings.
- `urlAllowed` / `parseHttpUrl` — origin+path, no credentials.
- `extraRootWriteAsks` — extra-root writes stay ask.
- `parseReviewHunks` — Agent Review paths; do not bypass.
- `completeOnce` — local 2B, strips fences. Reviewer uses this; no tools.

## Default permissions

`DEFAULT_PERMISSIONS.approvalMode` stays `'allowlist'`. Do not silently migrate users to auto-review.

`autoReview` / `autoRun` already persist if present. `autoRun` stays unused for allow/deny (recipe Next). v2 consumes **`autoReview` only**.

## Product copy (exact-ish)

Settings helper (plain text, no HTML):

> Auto-review: a deterministic Judge allows known-safe git/test/read argv. Unknown commands go to a classifier (risk / authorization / correctness) or Ask. Too-destructive never runs. Not a sandbox and not Landlock.

Mode option label:

> auto-review (judge, then reviewer, then you)

Status chunk / Trust chip fragment:

> `auto-review · {judge|reviewer} · {allow|ask|deny} · {reason}`

Reason tokens are a closed set (phase 02). Never dump the raw command, env, or `/etc/passwd` into the chip.

## Honesty checklist (fail the ship if any is true)

- [ ] Claimed AST parse or mvdan/sh.
- [ ] Claimed Landlock / sandbox because Auto Review exists.
- [ ] Claimed 82% or reviewer accuracy.
- [ ] `allow_instructions` auto-ran a too-destructive command.
- [ ] `deny` still executed `runTool`.
- [ ] Reviewer prompt contains tool results or “allow if score ≥”.
- [ ] Verify / Critic lane used as Auto Review.
- [ ] Git “Agent review” starts a forge.
- [ ] Palette Quick review discards `res.text`.
- [ ] `dangerouslySetInnerHTML` for the pipeline card.
- [ ] New Hunt3 / Critic fleet row for this feature.
