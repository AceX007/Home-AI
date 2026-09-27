---
id: disc-code-design-handles-export
folder: discoveries
---

# Code/Design — live handles, pages, selection export

- **Task:** Edit-mode Orders/Profile pages, selectable store/PDP nodes, live resize handles, Text T, sanitized selection export.
- **Files:** `design-export.mjs`, `design-handle.mjs`, `design-style.mjs` `offX`/`offY`, `default.design.json`, `PhoneCanvas`, `DesignStudio` exportMark.
- **Commands:** `npm test`
- **Worked:** `applyHandleDelta` + `takeLayout`; export is canvas 2d / SVG of `safeMarkText` (no html2canvas).
- **Recipes:** [designir-patch](../../recipes/designir-patch.md)
- **Anti-patterns:** AP-20260829-26
