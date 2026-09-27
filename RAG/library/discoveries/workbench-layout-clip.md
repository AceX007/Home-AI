---
id: disc-workbench-layout-clip
date: 2026-09-07
---
# Workbench chrome scrolls instead of clipping

- **What:** `body { overflow: hidden }` plus CSS grid `1fr` (`minmax(auto, 1fr)`) and `flex: 1` without `min-height: 0` clipped bottom tabs, status, sidebar lists, and the composer. Page/list/Browser also stacked a `.pane-tab` on HxPage / HxSideHead. Page `display: none` on sidebar with a 6-column `0px 0px` template auto-placed HxPage into a 0px track (Board/Settings looked like chat + a black void).
- **Files:** `apps/renderer/src/styles/global.css`, `WorkbenchShell.tsx` (`data-activity`), `NotesPane.tsx` (`side-input`), `BrowserPane.tsx` (`minHeight: 0`), T-133.
- **Do not:** invent a debugger for Workflow; retint xterm/Monaco; `dangerouslySetInnerHTML`; VS Code blues; `homeai:fs:stat`; keep a nowrap 35px Checks/Runtime row; keep a 6-col page grid after hiding sidebar; mark operator click-walk done headless.
- **Files:** `apps/renderer/src/styles/global.css`, `WorkbenchShell.tsx` (`data-activity`), `NotesPane.tsx` (`side-input`), `BrowserPane.tsx` (`minHeight: 0`), T-133.
- **Do not:** invent a debugger for Workflow; retint xterm/Monaco; `dangerouslySetInnerHTML`; VS Code blues; `homeai:fs:stat`; keep a nowrap 35px Checks/Runtime row; mark operator click-walk done headless.
