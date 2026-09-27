# Phase 3 — Combinator + decideTool + deny halt

Depends on: `02`, `03`. This is the phase that makes Auto Review **real**. UI without this is chrome-only.

## Goal

Deterministic flowchart (no LLM). `auto-review` survives persist. `deny` never reaches `runTool`. Main agent sees `'unavailable'` on deny, not a cookbook.

## `combineAxes(axes, baseReport)` 

Pure function in `auto-review.mjs`.

Input axes already jailed. `baseReport.reason` / judge deny still win.

Order (must match this list, not a vibes reading of the blog):

1. If `baseReport.verdict === 'deny'` **or** `axes.risk === 'too_destructive'` **or** `baseReport.risk === 'too_destructive'` → `{ ...base, stage: base.stage or 'reviewer', verdict: 'deny', reason: 'destructive' if too_destructive else keep reason, risk: 'too_destructive' if that path }`.
   - Judge `abs-path` / `secrets` stay deny with those reasons (not rewritten to destructive).
2. If `axes.correctness === 'quoting_error'` → ask, reason `axes`.
3. If `axes.risk === 'low'` and `axes.authorization !== 'explicitly_no'` → allow, reason `axes` (or keep `allow-instruction` if that was why).
4. If `axes.risk === 'high'` and `axes.authorization === 'explicitly_yes'` → allow, reason `allow-instruction` if instructions hit else `axes`.
5. Else → ask, reason `axes` or `block-instruction` if authorization is `explicitly_no`.

Judge **allow** never needs combinator (already returned). Combinator is for review-stage only.

`too_destructive` **never allow**, even if `authorization === 'explicitly_yes'` and `allow_instructions` matched `rm`.

## `clampApprovalMode` — `packages/runtime/src/policy.mjs`

Today:

```
return raw === 'unrestricted' || raw === 'manual' ? raw : 'allowlist'
```

Required:

```
return raw === 'unrestricted' || raw === 'manual' || raw === 'auto-review' ? raw : 'allowlist'
```

Update `packages/runtime/src/policy.d.ts` `ApprovalModeName`.
Update `packages/core/src/index.ts`:

```
export type ApprovalMode = 'allowlist' | 'unrestricted' | 'manual' | 'auto-review'
```

Update `policy.test.mjs` clamp test:

- `clampApprovalMode('auto-review') === 'auto-review'`
- still `nope` → `allowlist`
- proto object still → `allowlist`

`takePermissionsPatch` already calls `clampApprovalMode` — once clamp knows the mode, save/load keep it.

## `decideTool` — `packages/runtime/src/approvals.ts`

Insert **after** extra-root write ask, **before** unrestricted:

```
if (opts.perms.approvalMode === 'auto-review') {
  return runAutoReviewPipeline({
    perms: opts.perms,
    permission: opts.permission,
    tool: opts.tool,
    detail: opts.detail,
    extraRoot: opts.extraRoot
  }).verdict
}
```

Unrestricted still skip Auto Review (Run Everything), except extra-root already returned ask.

Manual unchanged.

Allowlist unchanged (`commandAllowed` prefixes). Do not replace allowlist with Judge globally — only the new mode.

Sync `decideTool` has **no** 2B. That is correct. Classify upgrade happens in main.

Optional: export a helper `decideToolWithAxes(opts, axes)` for tests of combinator-through-pipeline. Not required if tests call `runAutoReviewPipeline` + `combineAxes` directly.

## Main halt — `apps/desktop/src/main/index.ts`

Around 1296, replace the ask-only gate with:

```
const pipe = perms.approvalMode === 'auto-review'
  ? runAutoReviewPipeline({ perms, permission: perm, tool: call.name, detail, extraRoot })
  : null

let decision = pipe ? pipe.verdict : decideTool({ perms, permission: perm, tool: call.name, detail, extraRoot })

if (pipe && pipe.verdict === 'ask' && perm !== 'write' && llama?.status.running) {
  try {
    const axes = parseReviewerAxes(await completeOnce({ ... reviewer ... }))
    if (axes) {
      const combined = combineAxes(axes, pipe)
      decision = combined.verdict
      pipe = combined
    }
  } catch { /* keep ask */ }
}

if (pipe) {
  sendChunk(payload.id, { type: 'status', text: publicAutoReviewLine(pipe) })
}

if (decision === 'deny') {
  return { ok: false, name: call.name, content: 'unavailable' }
}

if (decision === 'ask') {
  sendChunk approval ...
  const ok = await wait(approvals, false)
  if (!ok) return { ok: false, name: call.name, content: 'denied by human' }
}

const result = await runTool(...)
```

Rules:

- Import `runAutoReviewPipeline`, `combineAxes`, `parseReviewerAxes`, `publicAutoReviewLine`, `reviewerSystemPrompt`, `reviewerUserPrompt`, `takeReviewerTranscript` from `@homeai/runtime`.
- Status text goes through `publicAutoReviewLine` only (already stripped).
- Deny content **exactly** `'unavailable'`. No command, no reason, no “try without rm”. Blog: except too-destructive they fall back to human; we deny only hard cases, so a generic unavailable is enough. Do not say `too_destructive` in the **tool result**.
- Human deny stays `'denied by human'` (existing).
- Do not skip hooks (`runHooks` still runs before decide).
- MCP block above this: unchanged (no Judge).
- `unrestricted` flag passed to `runTool` stays `perms.approvalMode === 'unrestricted'` (auto-review is **not** unrestricted).

Chat log for transcript: the same string already built for the forge (`chatLog` / `formatChatLog`). Pass that into `takeReviewerTranscript`. If missing, empty transcript is OK (authorization stays neutral/instructions).

## Dual call caution

If main calls `runAutoReviewPipeline` **and** `decideTool` (which also calls it), you double-judge. Prefer:

- `decideTool` always uses the pipeline when mode is auto-review (so other callers stay safe).
- Main: `let decision = decideTool(...)` then **only if** auto-review && ask && llama, classify and `combineAxes` using a **second** `runAutoReviewPipeline({ ..., axes })` **or** keep the first report.

Cleanest:

```
const report = runAutoReviewPipeline({...}) // if auto-review else null
let decision = report ? report.verdict : decideTool(...)
```

When not auto-review, only `decideTool`. When auto-review, **do not** also call `decideTool` (would duplicate). Tests still unit-test `decideTool` in auto-review mode.

## Status chunk vs agent bypass

The main model may see `auto-review · judge · deny · destructive` in the stream. That is weaker than a tool result explaining how to bypass. Acceptable. Do not add a sentence “the reviewer rejected you”.

## Do not

- Return deny and then `runTool`.
- Map deny → ask except via combinator rules.
- Persist reviewer JSON to `permissions.json`.
- Change extra-root to allow in auto-review.
- Auto-allow MCP via Judge.

## Done when

- `decideTool({ perms: { ...DEFAULT, approvalMode: 'auto-review' }, permission: 'exec', tool: 'terminal_run', detail: 'git status --short --branch' }) === 'allow'`
- same with `rm -rf /` → `'deny'`
- same with `echo $(whoami)` → `'ask'`
- extra-root write still `'ask'`
- `clampApprovalMode('auto-review') === 'auto-review'`
- Reading the main `runTool` function shows deny `return` **before** `runTool`
