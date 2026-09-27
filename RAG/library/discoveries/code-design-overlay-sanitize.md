---
id: disc-code-design-overlay-sanitize
folder: discoveries
---

# Code/Design — overlay sanitize sibling + shop tabs

- **Task:** Stop re-applying raw inspector draft on the canvas after overlayDrafts; Orders/Profile tabs; export format label.
- **Files:** `design-draft.mjs` `sanitizeDraft`/`cloneOverlay`, `DesignStudio` onDraft/pick, `DesignEditor` (uses overlay-merged doc only), `PhoneCanvas` Nav, `studio.css` swatches/icons.
- **Commands:** `npm test`
- **Worked:** `sanitizeDraft` at write; cloneOverlay drops `url()`; last orderNo kept for Orders tab.
- **Recipes:** [designir-patch](../../recipes/designir-patch.md)
- **Anti-patterns:** AP-20260828-17
