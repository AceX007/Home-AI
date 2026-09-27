---
id: disc-code-design-undo-ingest
folder: discoveries
---

# Code/Design — undo, handles, token ingest

- **Task:** Selection handles, undo/redo, Present fullscreen, Design systems ingest, home star/list/grid.
- **Files:** `design-draft.mjs` `pushUndo`/`stepUndo`, `PhoneCanvas` `SelFrame`, `DesignStudio` ingest with no path, `DesignHome` tabs, `DesignEditor` chrome.
- **Commands:** `npm test`
- **Worked:** Own-key overlay snapshots; `designIngestTokens()` no renderer path; handles via `data-nid` + ResizeObserver.
- **Recipes:** [designir-patch](../recipes/designir-patch.md)
- **Anti-patterns:** AP-20260828-16
