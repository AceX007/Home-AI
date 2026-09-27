# Phase 2 — Classify (reviewer axes, not a judge)

Depends on: `02`. The LLM must **never** output allow/deny. It classifies three orthogonal axes. Combinator (phase 04) decides.

## Goal

When Judge cannot allow, optionally ask local 2B for JSON axes. Standing `autoReview` instructions bias **authorization only**. Invalid JSON, llama off, timeout → **ask** (honest). Tool results never enter the reviewer prompt.

## Symbols (same `auto-review.mjs`)

```
parseReviewerAxes(text) → { risk, authorization, correctness } | null
takeReviewerTranscript(raw, opts?) → { user: string, other: string }
reviewerUserPrompt(command, transcript) → string
reviewerSystemPrompt() → string
instructionAuthorization(detail, perms) → 'explicitly_no' | 'neutral' | 'explicitly_yes'
```

## Axes (closed enums)

| Axis | Values | Meaning |
|---|---|---|
| `risk` | `low` \| `high` \| `too_destructive` | Worst-case danger. Not “should we run it”. |
| `authorization` | `explicitly_no` \| `neutral` \| `explicitly_yes` | Did the **user** ask for this command. |
| `correctness` | `ok` \| `quoting_error` \| `unknown` | Quoting / obvious mistakes. Orthogonal to safety. |

Default if Classify skipped: `{ risk: 'high', authorization: instructionAuthorization(...), correctness: 'unknown' }` so combinator **asks** unless instructions are `explicitly_yes` **and** we still require low-or-yes rules (high + explicitly_yes can allow — that is the flowchart).

## `instructionAuthorization(detail, perms)`

1. `instructionHit(detail, block_instructions)` → `explicitly_no` (wins).
2. Else `instructionHit(detail, allow_instructions)` → `explicitly_yes`.
3. Else `neutral`.

**Never** applied to Judge `deny` reports. **Never** overrides `too_destructive`.

`allow_instructions` do **not** skip the Judge. They only set authorization when stage is reviewer.

## `parseReviewerAxes(text)` — own-key jail

1. `String(text ?? '')`. Strip markdown fences (reuse the same idea as `completeOnce` already strips).
2. Find first `{` and last `}`. If missing → `null`.
3. `JSON.parse` in try/catch. Failure → `null`.
4. Object must be non-null, typeof object, not array.
5. Read **own keys only**: `Object.prototype.hasOwnProperty.call(src, 'risk')` etc. Ignore `__proto__`, `constructor`, nested junk.
6. Build `Object.create(null)`:
   - `risk` only if exactly `low`|`high`|`too_destructive`
   - `authorization` only if exactly `explicitly_no`|`neutral`|`explicitly_yes`
   - `correctness` only if exactly `ok`|`quoting_error`|`unknown`
7. If `risk` missing → `null` (cannot classify). Missing authorization → `neutral`. Missing correctness → `unknown`.
8. Do not accept aliases (`ok` for risk, `yes` for authorization, `allow`, `deny`, `safe`).

No “passing score” field. If the model adds `verdict` / `allow`, **ignore** those keys.

## Transcript jail — `takeReviewerTranscript(raw)`

Input: the string already assembled for the forge (`formatChatLog` + `payload.chatLog` + `lastConversation` in `index.ts` ~1228). Do **not** pass tool JSON.

Algorithm:

1. Split on newlines.
2. Keep lines that start with `user:` or `assistant:` (case-insensitive). Drop `tool:`, `system:`, `ok `, `err `, JSON-looking lines (`/^\s*[\[{]/`), and lines containing `tool_call`.
3. Strip `<>` via `stripActivityText` per line (cap 400).
4. Separate **user** vs **other** (assistant) budgets: user **2000** chars, other **2000** chars. Take from the **end** (most recent).
5. Return `{ user, other }`. Never include `RAG/conversations` dumps that look like tool results if they contain `ok explore` — those lines drop in step 2.

Do **not** feed Mini App HTML, MCP URLs, or `data/secrets`.

## Prompts (no passing score)

`reviewerSystemPrompt()` — fixed string, no interpolation of user text:

```
You classify a shell command. You do not decide to run it.
Reply with one JSON object only, keys risk, authorization, correctness.
risk: low | high | too_destructive (worst case).
authorization: explicitly_no | neutral | explicitly_yes (did the human ask for this command).
correctness: ok | quoting_error | unknown.
Do not mention allow, deny, or a passing score.
```

`reviewerUserPrompt(command, transcript)`:

- Command: `stripActivityText(command, 400)` inside a fenced block or after `command:` — still **text**, not HTML.
- Then `user:` budget and `assistant:` budget.
- Do not say “approve if low risk”. Do not include Judge reason (that would leak the passing rule). Optional: omit combinator flowchart from the prompt **entirely** (the blog’s point: reviewer must not know the passing score).

## 2B call site (main, phase 04 wires it)

Only when **all** of:

- `perms.approvalMode === 'auto-review'`
- pipeline verdict is `ask`
- reason is **not** `extra-root` (extra-root never auto-upgraded)
- `llama?.status.running === true`
- permission is `exec` or `net`

Then:

```
const axesText = await completeOnce({
  provider: 'local',
  localPort: llama.status.port,
  temperature: 0.1,
  messages: [
    { role: 'system', content: reviewerSystemPrompt() },
    { role: 'user', content: reviewerUserPrompt(detail, takeReviewerTranscript(chatLog)) }
  ]
})
```

Wrap in try/catch. Prefer `AbortSignal.timeout(8000)` if `chatCompletions` honors `signal`; if not, skip signal rather than hanging the forge forever — still catch throw → ask.

`parseReviewerAxes(axesText)` null → keep ask, do not deny.

Pass axes into `combineAxes` / `runAutoReviewPipeline({ ..., axes })`.

If llama is **not** running: **ask**. Do not start llama solely for Auto Review (would steal the 2B from the main agent). Honest.

Do **not** spawn a workflow `critic` / Hunt3 row for this call. Optional status chunk **after** classify: `publicAutoReviewLine(report)` with `stage: 'reviewer'`.

## Correctness channel

If `correctness === 'quoting_error'`, combinator **asks** (even if risk is low). Optionally a status line `auto-review · reviewer · ask · axes` — do **not** inject a new tool for the main agent. Do **not** rewrite the command.

Blog sends correctness to the main model; v2 PRO **asks the human** instead of silently fixing quotes. Simpler, no rewrite-injection.

## Do not

- Tell the reviewer “allow when low”.
- Include tool results, screenshots, or `runTool` content.
- Use cloud OpenAI for Classify (local 2B only). Cursor cloud is not a shell reviewer.
- Store reviewer transcripts in RAG.
- Let `__proto__.risk = 'low'` pass.

## Done when

- `parseReviewerAxes('{"risk":"low","authorization":"neutral","correctness":"ok"}')` works.
- `parseReviewerAxes('{"__proto__":{"risk":"low"},"authorization":"neutral"}')` is null or risk missing → null.
- `parseReviewerAxes('allow this')` is null.
- Transcript helper drops a line `ok explore` / `{ "content": … }`.
- Llama off → pipeline stays ask.
