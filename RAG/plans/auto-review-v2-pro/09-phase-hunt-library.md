# Phase 8 — Hunt the diff, recipe, library, STATUS

Depends on: product + tests green. Incomplete if code changed and this phase is skipped (`repo-library` + `recipe-refine` + `full-stack-hunt-prevent`).

## Hunt order (build: prevent already in tests → hunt the diff)

1. Re-read `data/bug-memory/anti-patterns.md` siblings: AP-SEED-03 XSS, AP-SEED-04 command injection, AP-SEED-08 proto merge, AP-20260828 IPC, AP-20260904-57 VERIFY vs shell.
2. Classes (max 5): `hunt-xss` (Chat/Stage/Telegram text), `hunt-idor` (not really ids — runId already jailed; still check stop/approve ids unchanged), `hunt-llm-ai` (reviewer prompt injection via tool results).
3. Grep the **diff** for: `dangerouslySetInnerHTML`, `innerHTML`, `runTool` after deny, `mvdan`, `82%`, `Landlock sandbox`, `allow_instructions` used before Judge deny, reviewer prompt containing `tool`.
4. Confirm `git status --short --branch && git diff --check` allow; `$()` ask; `rm -rf /` deny with allow_instructions present.

No exploit write-ups in AP records or recipes.

## Anti-pattern records

Append to `data/bug-memory/anti-patterns.md` (next ids after **AP-20260904-73**):

### AP-20260904-74 — Auto Review deny must halt before runTool

- Root cause: `decideTool` deny was ignored; main only waited on `ask`.
- Bad shape: `if (decision === 'ask') wait; runTool()`
- Good shape: `if (decision === 'deny') return { ok:false, content:'unavailable' }` then ask then runTool
- Grep / symbols: `decideTool`, `runTool`, `unavailable`, `auto-review`
- Regression: T-92/T-93 + main path comment; `rm -rf /` never reaches `runTool`
- Source: Auto Review v2 PRO

### AP-20260904-75 — Unknown shell shape must not auto-allow

- Root cause: prefix `commandAllowed` / unmodeled `$()` / env
- Bad shape: `c.startsWith('git status')` allows `git status; rm`
- Good shape: Judge tokenize + closed argv tables; `; | $() env` → ask or deny
- Grep: `judgeShell`, `splitSafeAnd`
- Regression: T-92
- Source: LM Studio Judge analog (allowlist of understood shapes)

### AP-20260904-76 — Reviewer JSON own-key; no tool results in prompt

- Root cause: prototype keys / tool-result injection into classifier
- Bad shape: `JSON.parse` then `obj.risk`; transcript includes `ok explore` / tool JSON
- Good shape: `parseReviewerAxes` own keys; `takeReviewerTranscript` drops tool lines
- Grep: `parseReviewerAxes`, `takeReviewerTranscript`
- Regression: T-93
- Source: LM Studio reviewer + AP-SEED-08

### AP-20260904-77 — allow_instructions never skip too_destructive

- Root cause: standing allow list treated as Run Everything
- Bad shape: if instruction hit → allow
- Good shape: combinator deny on `too_destructive` first; instructions only set authorization
- Grep: `combineAxes`, `allow_instructions`
- Regression: T-93 `rm -rf /` + allow list
- Source: LM Studio flowchart

If a record already exists with that number, increment. Do not rewrite old APs.

## Recipe card — `RAG/recipes/auto-review.md`

Follow `recipe-refine/reference/recipe-schema.md` (<80 lines). Slug `auto-review`.

```
---
id: rec-auto-review
title: Pre-tool Judge then classify then human
stack: electron
status: tried
---
```

**Shape:** Judge argv allowlist → optional 2B axes JSON → `combineAxes`. `decideTool` + main deny halt. `autoReview` instructions via `takeInstructionPair`.

**Do not:** mvdan/sh; LLM allow/deny; tool results in reviewer; deny that still runs; Landlock claim.

**Ports:** Web/API = policy engine before `exec`; CLI = same module; Mobile = jailed trust line only; Worker = same combinator.

**Curiosity:** Why not LLM-first? Cost + rubber-stamp. Why not sandbox-only? Orthogonal (blog). Weakness: no real AST, so `&&` is the only compound; `$()` always asks.

**Prevent:** T-92 T-93. Deny-by-default unmodeled. Hunt layers: ipc, jobs, client.

**Log:** 2026-09-04 first ship. Next: optional `node --version` rule; pass `approvalMode` into Telegram `helpCard`; do not vendor a shell parser.

Refine **existing**:

- `RAG/recipes/permissions-policy.md` — Next is stale (“nothing consumes autoReview”). Append log: Auto Review consumes `autoReview` + `approvalMode: auto-review`. `autoRun` still unused.
- `RAG/recipes/kernel-loop.md` — Auto Review is **pre-tool**, not VERIFY. VERIFY still critic tools only. Background sentence matches KERNEL_SYSTEM.
- `RAG/recipes/INDEX.md` — add row `auto-review`.

## Library (`repo-library` upgrade)

### Feature card `RAG/library/features/auto-review.md` (<60 lines)

Works: Judge / classify / combinator; Settings mode; Stage line; Agent Review store share.

Made: `packages/runtime/src/auto-review.mjs`, `decideTool`, main halt.

Recipe: `auto-review` + `permissions-policy`.

Tests: T-92 T-93. Edges: E-84 E-85.

### `FEATURES.md`

Add row. Documented count becomes **25** after `count-status.sh` (it counts `features/*.md` files, not the table — **must add the file**).

### `TESTS.md`

| id | case | feature | status | path |
| T-92 | Judge allow git status compound; ask `$()`/env; deny `rm -rf /` and `cat /etc/passwd` | auto-review | done | `packages/runtime/src/auto-review.test.mjs` |
| T-93 | Combinator flowchart; proto-key JSON dropped; block_instructions ask; allow_instructions cannot save too_destructive; clamp `auto-review` | auto-review | done | `auto-review.test.mjs`, `policy.test.mjs` |

Set `done` only when the test file exists.

### `EDGES.md`

| E-84 | Unmodeled shell (`$()`, env assign, `;`, PowerShell) auto-allows | auto-review | tested |
| E-85 | too_destructive runs because allow_instructions or human said yes | auto-review | tested |

### `ROADMAP.md`

Tick a Next bullet: Auto Review v2 PRO (Judge → classify → human). Leftover Next: Electron click-walk Settings → auto-review → run `git status`; confirm no prompt; run unmodeled command; confirm Ask chip.

Do not mark click-walk done from a headless agent.

### `STATUS.md`

**Do not hand-edit counts.** Run:

```
bash "/home/x/Home AI/.cursor/skills/repo-library/scripts/count-status.sh" "/home/x/Home AI"
```

with `required_permissions: ["all"]` (STATUS rewrite). Expect Features 25, Tests 93/93, Edges tested 81 / tracked 85 (79+2 tested, 83+2 tracked) if both new edges are `tested`.

## `package.json`

Already listed in phase 07. Confirm `npm test`  includes the new file.

## Leftovers (do not fake)

- Electron operator click-walk.
- Think-done-from-phone.
- Playwright e2e.
- Telegram `helpCard` mode-aware Trust (optional Next).
- `autoRun` still unused.
- Full bash AST.

## Done when

- AP-74–77 exist.
- Recipe INDEX lists `auto-review`.
- Feature file exists; STATUS rewritten by script.
- `npm test` all pass.
- Implementer message to the user: what shipped, how to turn it on (Settings → auto-review), what it will not do (no Landlock, no 82%, `$()` still asks).
