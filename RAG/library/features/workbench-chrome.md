---
id: feat-workbench-chrome
---
# Workbench chrome

- **Works:** titlebar kernel pulse, status click-through (Enter/Space) with ellipsis, layout persist (incl. cowork), editor crumbs + split, overflow tabs, explorer CRUD, grouped palette with HxEmpty no-match, quieter Stage rail. Activity pages use HxPage / HxSideHead / HxEmpty. List/page/Browser hide the duplicate `.pane-tab`. Flex lists and bottom tabs scroll instead of clipping. PlanDoc empty + Hex type ramp. Overlay pops Hex amber; session/file-tree/browser empties; honest-disabled Design tools. Send/send-round/keep/studio save/export use `--amber`; plan/hunk/file-icon/ctx sys tokens; Terminal Checks/Kernel log/Workflow/Runtime as keyboard `term-tab`s; unused `.pane-head` CSS gone. Form pages `.hx-form` / `.hx-card`; Settings section rail; Design home Hex kinds; clickable jailed crumbs + Ctrl+Shift+O buffer outline. Status counts QA with compiler diagnostics.
- **Made:** [`workbench-chrome.mjs`](../../../packages/runtime/src/workbench-chrome.mjs), [`WorkbenchShell.tsx`](../../../apps/renderer/src/layout/WorkbenchShell.tsx), [`CommandPalette.tsx`](../../../apps/renderer/src/layout/CommandPalette.tsx), [`QuickOpen.tsx`](../../../apps/renderer/src/layout/QuickOpen.tsx), [`GotoSymbol.tsx`](../../../apps/renderer/src/layout/GotoSymbol.tsx), [`HxPage.tsx`](../../../apps/renderer/src/layout/HxPage.tsx).
- **Recipe:** [workbench-chrome](../../recipes/workbench-chrome.md) · [ipc-workspace-fs](../../recipes/ipc-workspace-fs.md) · AP-20260901-29 · AP-20260901-45 · AP-20260904-91 · AP-20260904-92 · AP-20260904-93 · AP-20260904-94 · AP-20260904-95 · AP-20260904-96 · AP-20260904-97 · AP-20260904-98 · AP-20260905-3 · AP-20260905-4 · AP-20260905-26 · AP-20260907-1 · AP-20261001-4
- **Tests:** T-38 T-39 T-54 T-99 T-100 T-101 T-102 T-103 T-104 T-105 T-111 T-113 T-114 T-133 T-136
- **Edges:** E-33 E-34 E-48 E-97 E-98 E-99 E-100 E-101 E-102 E-103 E-104 E-107 E-109 E-110 E-136 E-139
