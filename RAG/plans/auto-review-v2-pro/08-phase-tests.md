# Phase 7 — Tests (T-92, T-93)

Depends on: `02`–`04` symbols. Write tests **with** the runtime, not after a blind UI pass. Append the file to `package.json` by hand.

## Goal

Gate 0 prevent artifacts for Judge, combinator, proto-key JSON, block/allow instructions, clamp, extra-root. No exploit write-ups — commands are the same corpus as phase 02 tables.

## New file

`packages/runtime/src/auto-review.test.mjs`

```
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PERMISSIONS } from './approvals.ts'  // or .js emit — this repo imports .ts via the test runner? Check siblings.
```

Sibling tests import `./policy.mjs` and `./approvals.ts` is used from desktop; **prefer** testing `auto-review.mjs` + `decideTool` from `./approvals.ts` if `node --test` already loads it. If approvals is `.ts`, import `decideTool` the same way `index.ts` does — **look at how other tests import decideTool**. Today **nothing** imports `decideTool` in tests. Import:

```
import { decideTool, DEFAULT_PERMISSIONS } from './approvals.ts'
```

If that fails under `node --test`, duplicate a tiny perms object in the test:

```
const auto = { ...DEFAULT_PERMISSIONS, approvalMode: 'auto-review' }
```

`DEFAULT_PERMISSIONS` is in `approvals.ts`. Existing tests don't import it. Use:

```
import { judgeShell, runAutoReviewPipeline, combineAxes, parseReviewerAxes, publicAutoReviewLine, takeReviewerTranscript, instructionHit } from './auto-review.mjs'
import { clampApprovalMode, takePermissionsPatch } from './policy.mjs'
```

And for `decideTool`, add to `policy.test.mjs` **or** import approvals. Node test + TypeScript: this repo’s `package.json` test list is all `.mjs`. Keep `decideTool` tests in `auto-review.test.mjs` by duplicating the pipeline (it **is** `runAutoReviewPipeline`) plus one import:

Try: `import { decideTool, DEFAULT_PERMISSIONS } from './approvals.ts'` — electron-vite packages may not run. **Safe path:** do not import `.ts` from `node --test`. Export a thin `decideTool` re-test via pipeline only, and add clamp + `runAutoReviewPipeline` in the mjs test. Add **one** `decideTool` test inside `policy.test.mjs` only if you can import approvals without a loader.

**Required efficient path:** move nothing. Test `runAutoReviewPipeline` + `judgeShell` + `combineAxes` in `.mjs`. Add `clampApprovalMode('auto-review')` to **existing** `policy.test.mjs`. Optionally export `decideTool` from a tiny `approvals.mjs` — **do not** split approvals.ts in this ship. If `node --test packages/runtime/src/approvals.ts` is not in the list, skip direct `decideTool` import.

Honesty: `decideTool` auto-review branch is a one-liner to `runAutoReviewPipeline`. Pipeline tests **are** the prevent artifact. Still add a comment in `auto-review.test.mjs`: `decideTool auto-review delegates here`.

## T-92 — Judge (`auto-review.test.mjs` describe `judge`)

Must assert:

| command / opts | verdict | reason (approx) |
|---|---|---|
| `git status --short --branch` | allow | `safe-git` |
| `git status --short --branch && git diff --check` | allow | `safe-git` |
| `git diff --check main...HEAD` | allow | `safe-git` |
| `cat notes.txt` | allow | `safe-read` |
| `pwd` | allow | `safe-read` |
| `npm test` | allow | `safe-test` |
| `base=$(git merge-base HEAD main)` | ask | `unmodeled` |
| `FOO=bar git status` | ask | `env` |
| `git status; rm -rf /` | deny **or** ask then — `;` is unmodeled **but** raw also matches `rm -rf /` → **deny** `destructive` (destructive checked on raw first) |
| `rm -rf /` | deny | `destructive` |
| `cat /etc/passwd` | deny | `abs-path` |
| `` echo `id` `` | ask | `unmodeled` |
| `Get-ChildItem electron/src` | ask | `powershell` |
| `cat data/secrets/x` | deny | `secrets` |
| empty / 3000-char string | ask | `unmodeled` |

`runAutoReviewPipeline` extra-root:

```
runAutoReviewPipeline({
  perms: { approvalMode: 'auto-review', terminalAllowlist: [], mcpAllowlist: [], netAllowlist: [] },
  permission: 'write',
  tool: 'fs_write',
  detail: 'fs_write',
  extraRoot: true
}).verdict === 'ask'
```

`test_run` shortcut:

```
tool: 'test_run', permission: 'exec', detail: 'auto' → allow safe-test
```

`publicAutoReviewLine` never includes `<` even if reason were dirty (coerce reason). `lastAutoReviewLine([{ kind:'status', text:'auto-review · judge · allow · safe-git' }])` equals that line stripped.

## T-93 — Combinator + JSON + instructions + clamp

In `auto-review.test.mjs` describe `combine` **and** extend `policy.test.mjs` clamp.

Combinator:

- `{ risk:'too_destructive', authorization:'explicitly_yes', correctness:'ok' }` → deny
- `{ risk:'low', authorization:'neutral', correctness:'ok' }` → allow
- `{ risk:'low', authorization:'explicitly_no', correctness:'ok' }` → ask
- `{ risk:'high', authorization:'explicitly_yes', correctness:'ok' }` → allow
- `{ risk:'high', authorization:'neutral', correctness:'ok' }` → ask
- `{ risk:'low', authorization:'neutral', correctness:'quoting_error' }` → ask

`parseReviewerAxes`:

- happy JSON → three fields
- `{ "__proto__": { "risk": "low" }, "authorization": "neutral", "correctness": "ok" }` → null (missing own `risk`)
- `'not json'` → null
- `{ "risk": "allow" }` → null
- extra key `verdict: "allow"` ignored; if risk valid, still parse

`block_instructions`: pipeline exec `git status` with `autoReview: { block_instructions: ['git status'] }` → ask (`block-instruction`), **not** allow.

`allow_instructions` + `rm -rf /` → still **deny**. This is the headline prevent test.

`takePermissionsPatch({ approvalMode: 'auto-review' }).approvalMode === 'auto-review'` in `policy.test.mjs`.

`takeReviewerTranscript("user: go\nok explore\nassistant: running\n{ \"ok\": true }")` user includes `go`, does not include `{`.

## `package.json`

The `test` script is a **hand list**. Append:

```
packages/runtime/src/auto-review.test.mjs
```

Do not glob `**/*.test.mjs` (would pick `Repos/`).

## What not to test

- Electron click-walk (operator leftover).
- Reviewer accuracy / 82%.
- Playwright e2e.
- mvdan/sh corpus (11k tests) — out of scope.

## Done when

```
node --test packages/runtime/src/auto-review.test.mjs packages/runtime/src/policy.test.mjs
```

passes, then full `npm test` (needs `required_permissions: ["all"]` in this workspace for STATUS scripts later; tests themselves are local).
