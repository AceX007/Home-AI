# Phase 6 — Telegram Trust copy + KERNEL_SYSTEM honesty

Depends on: `04` (mode exists). Phone glass stays text. Do not claim Landlock. Do not invent a phone Auto Review control plane.

## Goal

1. KERNEL_SYSTEM stops promising a `review` tool.
2. Telegram Trust line mentions Auto-review **only** when the mode is actually auto-review; otherwise keep `Ask`.
3. Mini App / Glance stay forge Hunt/Verify/Critic — no fake reviewer agent.

## KERNEL_SYSTEM — `packages/agent/src/index.ts`

Today (load-bearing paragraph):

```
VERIFY: A second pass may call only str_replace, debug_log, or ask_user. ...
Background phases (every surface): Hunt = perceive/act tools (explore, task, fs_*). Verify = test_run / review during ACT. Critic = the VERIFY second pass only (str_replace|debug_log|ask_user). task() stays at most 4 workers — no fleets.
```

Change the Background sentence to **exactly** this idea (wording may be tight, keep one paragraph):

```
Background phases (every surface): Hunt = perceive/act tools (explore, task, fs_*). Verify = test_run during ACT (there is no review tool). Critic = the VERIFY second pass only (str_replace|debug_log|ask_user). Auto Review is pre-tool Trust (Judge then classifier then human), not a forge phase. task() stays at most 4 workers — no fleets.
```

Keep the VERIFY paragraph (no `test_run` in VERIFY). Keep Think “Do not use the shell”.

Do **not** add a `review` tool to `packages/mods`.

Nested explore `skipVerify: true` stays.

## Telegram chrome — `packages/runtime/src/telegram-chrome.mjs`

Hardcoded strings today:

- `helpCard`: `TRUST   Manage / Trust  Local 2B · Ask · no Landlock`
- `menuCard`: `Trust is Local 2B · Ask · no Landlock.`
- `stageCard`: `trust   Local 2B · Ask · no Landlock`

### `stageCard`

`stageCard(info)` already takes a loose `info` object. Add optional `info.trust` **or** `info.approvalMode`.

Helper in the same file (or import from auto-review):

```
export function trustLine(mode) {
  const ar = mode === 'auto-review'
  return ar ? 'Local 2B · Auto-review · no Landlock' : 'Local 2B · Ask · no Landlock'
}
```

`stageCard` line:

```
`trust   ${plainLine(trustLine(info.approvalMode), 80)}`
```

If `info.autoReviewLine` is a string starting with `auto-review ·`, append one line `plainLine(info.autoReviewLine, 80)`. Do not append raw commands.

### `helpCard` / `menuCard`

These have **no** perms object today. Keep `Ask · no Landlock` (honest default). Do **not** hardcode Auto-review on help (users on allowlist would see a lie).

If a caller later passes mode into `helpCard`, only then switch. v2: **stageCard only** is enough.

### Callers of `stageCard`

Grep `stageCard(` and pass `approvalMode` from `loadPermissions` **only if** that caller already has `perms` in scope. If the Telegram host does not have it cheaply, skip — remaining `Ask` on Stage is OK (honest for allowlist default). Prefer passing mode from the same place that builds `/stage` (search `stageCard` in `telegram-bridge` / router).

If wiring is more than ~15 lines, **leave Ask** and document leftover in recipe Next. Do not thread permissions through Mini App JSON unsanitized.

## Tests — `packages/runtime/src/telegram-chrome.test.mjs`

Existing:

```
assert.match(stage, /Ask/)
assert.match(stage, /no Landlock/)
assert.equal(/Landlock sandbox/i.test(stage), false)
assert.equal(stage.includes('Hunt3'), false)
```

Keep all of that for **default** `stageCard({})`.

Add one case:

```
const ar = stageCard({ approvalMode: 'auto-review' })
assert.match(ar, /Auto-review/)
assert.match(ar, /no Landlock/)
assert.equal(/Landlock sandbox/i.test(ar), false)
assert.equal(ar.includes('<'), false)
```

Default card must still match `/Ask/` so allowlist users are not labeled Auto-review.

## Mini App

Do **not** add an Auto Review settings page on the phone. Glance `phases` stay Hunt/Verify/Critic.

## Do not

- `parse_mode` HTML on Trust lines (`stripParseMode` stays).
- Claim “Landlock sandbox”.
- Add `/autoreview` Telegram command in this ship.
- Show allow/block instruction text on the phone (could leak standing policy into a group).

## Done when

- KERNEL_SYSTEM has no `test_run / review` pairing that implies a `review` tool.
- `stageCard({})` still Ask · no Landlock.
- `stageCard({ approvalMode: 'auto-review' })` says Auto-review · no Landlock.
- No Hunt3, no `<`, no `sk-` regressions in existing tests.
