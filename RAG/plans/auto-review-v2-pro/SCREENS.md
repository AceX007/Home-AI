# Screen map — what each surface is, what v2 changes

Read with `01-law-sources-current.md`. Implement UI only in the phase named here. If a row says **unchanged**, do not restyle it “to look like Auto Review”.

| Surface | File | What it is today | v2 change | Phase |
|---|---|---|---|---|
| Settings → Trust | `apps/renderer/src/panes/SettingsPane.tsx` | Mode allowlist/manual/unrestricted; four allowlist textareas; Landlock honesty | Add `auto-review` option; allow/block instruction textareas; helper paragraph; save `autoReview` | `05` |
| Stage Trust chip | `apps/renderer/src/panes/StageTrustRow.tsx` | `Local 2B · Ask · no Landlock` + Allow/Deny | Chip `Auto-review` when a jailed status line exists; show `lastAutoReviewLine`; still no Landlock | `06` |
| Stage Allow/Deny | same | Existing approval IPC | Unchanged. Unmodeled commands still land here | `04` wires ask; UI stays |
| Chat composer **Review** | `ChatPane.tsx` `reviewOpen` | Keep/Undo pending diffs | **Unchanged name and behavior** | — |
| Chat **Quick hunks / Deep** | `ChatPane.tsx` | Local `reviewText` → `parseReviewHunks` | `reviewText` moves to `useWorkbench`; same hunk UI | `06` |
| Chat pipeline line | `ChatPane.tsx` | Missing | Text node `auto-review · stage · verdict · reason` | `06` |
| Command palette “Agent review (quick)” | `CommandPalette.tsx` | IPC fired, `reviewText` discarded | `setState({ reviewText, chatOpen: true })` | `06` |
| Git “Agent review” | `GitPane.tsx` | `w.run(...)` forge | Same IPC as Quick hunks; **no** forge | `06` |
| Background tasks | `BackgroundTasks.tsx` | Hunt / Verify / Critic forge DTO | **Unchanged** — not Auto Review | — |
| Agents log | `useWorkbench` log | status / approval chunks | New status chunk from main | `04` |
| KERNEL_SYSTEM | `packages/agent/src/index.ts` | `Verify = test_run / review` | No `review` tool; Auto Review = pre-tool Trust | `07` |
| Telegram `/stage` trust | `telegram-chrome.mjs` `stageCard` | Always Ask · no Landlock | Auto-review line **iff** `approvalMode` passed | `07` |
| Telegram help/menu | `helpCard` `menuCard` | Ask · no Landlock | **Unchanged** (default honesty) | `07` |
| Mini Glance | `miniapp-hub.mjs` | Hunt/Verify/Critic | **Unchanged** | — |
| Preload / IPC permissions | `preload/index.ts` `homeai:permissions:set` | Already sanitizes | No new channel | `05` |
| IPC Agent Review | `homeai:agentReview:quick` | Local 2B git diff | **Unchanged** engine; consumers store `text` | `06` |
| Forge `runTool` gate | `apps/desktop/src/main/index.ts` | ask only; deny would run | deny → `'unavailable'`; optional 2B classify | `04` |

## Three “review” words — never collapse

1. **Auto Review** — pre-tool Judge/classifier (this ship).
2. **Agent Review** — manual git-diff 2B panel (wire store only).
3. **VERIFY / Critic** — post-write second pass (do not retag as Auto Review).

## Operator click-walk (after ship; do not mark done headless)

1. Settings → Trust → auto-review → Save.
2. Agent mode, `git status` via the kernel → no Allow chip; status line `auto-review · judge · allow · safe-git`.
3. Ask the agent for `echo $(date)` → Allow/Deny chip; deny still `'denied by human'`.
4. Palette “Agent review (quick)” with a dirty tree → hunks appear in Chat.
5. Git “Agent review” → same hunks, **no** new forge workflow card.
6. Telegram `/stage` on allowlist still says Ask; on auto-review (if mode passed) says Auto-review; never Landlock sandbox.
