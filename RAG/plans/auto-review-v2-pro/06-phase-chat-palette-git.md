# Phase 5 — Chat, palette, Git, Stage Trust (all review screens)

Depends on: `04` (status chunks exist), `05` (mode is selectable). This phase fixes **half-wired Agent Review** and surfaces Auto Review **text**, not HTML.

## Goal

One `reviewText` in the workbench store. Palette and Git fill it. Chat shows hunks + last pipeline line. Stage chip shows last verdict. Composer “Review” stays Keep/Undo for pending diffs (do not rename it).

## Store — `apps/renderer/src/store/useWorkbench.ts`

Add to `State` + initial state:

```
reviewText: string
```

Initial `''`. No setter required — callers use `useWorkbench.setState({ reviewText, chatOpen: true })`.

Do **not** put Agent Review output through `dangerouslySetInnerHTML`. Chat already uses `parseReviewHunks` → button text.

Optional: `reviewBusy` can stay local to ChatPane (palette can fire without a spinner).

## ChatPane — `apps/renderer/src/panes/ChatPane.tsx`

1. Remove `const [reviewText, setReviewText] = useState('')`.
2. Use `w.reviewText` (from `useWorkbench()`).
3. Quick hunks / Deep:

```
const res = await window.homeai.agentReview('quick'|'deep')
useWorkbench.setState({ reviewText: res.text })
```

4. Close button: `useWorkbench.setState({ reviewText: '' })`.

5. **Pipeline card** above `.agent-review` (or inside StageTrustRow — pick **one** home; prefer both Chat strip + Stage chip from the same helper):

```
import { lastAutoReviewLine } from '../../../../packages/runtime/src/auto-review.mjs'
const ar = lastAutoReviewLine(w.log)
```

Render as a `<p className="auto-review-line">` **text node** `{ar}`. If empty, render nothing.

If you also show it inside `.agent-review`, still text nodes. Hunks stay `parseReviewHunks(w.reviewText)`.

6. Do not parse Auto Review JSON in the renderer. Only the status line.

## Command palette — `apps/renderer/src/layout/CommandPalette.tsx`

Replace the `review` command `run`:

```
run: async () => {
  useWorkbench.setState({ chatOpen: true })
  try {
    const res = await window.homeai.agentReview('quick')
    useWorkbench.setState({ reviewText: res.text || '', chatOpen: true })
  } catch (err) {
    useWorkbench.setState({
      reviewText: err instanceof Error ? err.message : String(err),
      chatOpen: true
    })
  }
}
```

Keep section `Trust`. Do not start `w.run`.

## GitPane — `apps/renderer/src/panes/GitPane.tsx`

Replace the `w.run('Review the current git diff…')` button with:

```
onClick={async () => {
  useWorkbench.setState({ chatOpen: true, activity: /* do not steal git pane */ })
  try {
    const res = await window.homeai.agentReview('quick')
    useWorkbench.setState({ reviewText: res.text || '', chatOpen: true })
  } catch (e) {
    setErr(e instanceof Error ? e.message : String(e))
  }
}
```

Do **not** call `w.run` for this label. Forge review of the diff is a different product; this button must open the 2B hunk panel.

Keep Pull ff-only / Push as they are.

## StageTrustRow — `apps/renderer/src/panes/StageTrustRow.tsx`

Keep Allow/Deny + wait banner + forge error.

Chip today:

```
Local 2B · Ask · no Landlock · allow {n} · deny {n}
```

Required:

```
const ar = lastAutoReviewLine(w.log)
const trust = ar
  ? `Local 2B · Auto-review · no Landlock`
  : `Local 2B · Ask · no Landlock`
```

Then `· allow N · deny N`.

If `ar` is non-empty, a second muted line **or** title tooltip is OK; prefer a line under the chip:

```
{ar ? <span className="auto-review-line">{ar}</span> : null}
```

Still **no Landlock** claim. If the last line was `deny`, do not say “sandboxed”.

Click still `w.setActivity('settings')`.

When `w.approval` is showing, keep the existing pre (`stripActivityText(detail, 400)`). Do not HTML the command.

## CSS — `apps/renderer/src/styles/global.css`

Add a small class if needed:

```
.auto-review-line {
  color: var(--muted);
  font-size: 12px;
  padding: 4px 10px;
}
```

No `user-select` tricks. No `innerHTML`. Reuse `.agent-review` / `.review-hunk` as they are (T-42).

## IPC Agent Review (do not change behavior)

`homeai:agentReview:quick` already: git diff, local 2B, returns `{ text, diff }`. Palette/Git only needed to **store** `text`. Do not send `diff` to innerHTML. Do not open extra-root files from hunk paths (`parseReviewHunks` + `openFile` jail).

## Screen checklist (operator)

| Screen | After this phase |
|---|---|
| Settings Trust | mode + instructions (phase 05) |
| Stage chip | Auto-review + last line when a status exists |
| Chat `.agent-review` | palette/Git/Quick/Deep share `reviewText` |
| Chat composer Review | still Keep/Undo pending diffs |
| Palette Trust | fills `reviewText`, opens chat |
| Git Agent review | fills `reviewText`, **no** forge |
| Background tasks | unchanged Hunt/Verify/Critic |

## Do not

- Put Stage on the pill row.
- Add an Auto Review lane to `BackgroundTasks`.
- `w.run` from Git for this button.
- Render hunk `line` as HTML.

## Done when

- Palette Quick review shows hunks in Chat without clicking Quick hunks again.
- Git “Agent review” does not create a new forge `runId` by itself.
- Closing the hunk panel clears store `reviewText`.
- Stage chip never contains `<` from a status payload (`stripActivityText` / `lastAutoReviewLine`).
