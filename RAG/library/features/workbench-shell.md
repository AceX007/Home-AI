---
id: feat-workbench-shell
---
# Workbench shell

- **Works:** activity bar switches the matching sidebar and center (not a dead FileTree), Stage keeps page panes full-width, editor tabs, chat dock (sessions + grouped log + Background), `takeSlots` hides the Agents rail on list/page so Maps is not a four-surface pile, list/page/Browser hide the duplicate pane tab, terminal Debug shows Hunt/Verify/Critic, command palette, cloud job summaries, kernel pulse in chrome, layout restore, Hex AI chrome + About.
- **Made:** [`apps/renderer/src/layout/WorkbenchShell.tsx`](../../../apps/renderer/src/layout/WorkbenchShell.tsx), [`pane-route.mjs`](../../../packages/runtime/src/pane-route.mjs), zustand store, [`ChatPane.tsx`](../../../apps/renderer/src/panes/ChatPane.tsx).
- **Recipe:** [kernel-loop](../../recipes/kernel-loop.md) · [workbench-chrome](../../recipes/workbench-chrome.md) · [electron-dev](../../recipes/electron-dev.md) · [activity-groups](../../recipes/activity-groups.md) · AP-20260828-8 · AP-20260901-29 · AP-20260904-85 · AP-20260904-86 · AP-20260904-89 · AP-20260904-90 · AP-20260904-91 · AP-20260904-93 · AP-20260905-2 · AP-20260905-3 · AP-20260905-4 · AP-20260907-1
- **Tests:** T-07 T-08 T-10 T-13 T-38 T-96 T-97 T-98 T-99 T-100 T-101 T-106 T-112 T-113 T-114 T-125 T-133
- **Edges:** E-03 E-08 E-10 E-33 E-91 E-92 E-93 E-94 E-95 E-96 E-97 E-98 E-99 E-100 E-108 E-109 E-110 E-139
