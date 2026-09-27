---
id: disc-code-design-overlay-pins
folder: discoveries
---

# Code/Design — overlay drafts and canvas pins

- **Task:** Persist inspector drafts across node switches; numbered comment pins on the phone; Pro on/off for conditionals.
- **Files:** `packages/runtime/src/design-draft.mjs`, `design-style.mjs` `compileReactStyle`, `apps/renderer/src/panes/design/{DesignStudio,DesignEditor,Inspector,PhoneCanvas,studio.css}`.
- **Commands:** `node --test packages/runtime/src/design-draft.test.mjs packages/runtime/src/design-style.test.mjs`; `npm test`.
- **Worked:** Overlay map + `opsForDrafts` (cap 32); pins as React text; `visible` toggles geo/cart/pay in Edit; Hand still drives shop routes.
- **Failed / hole:** Overlay skipped IPC — `compileReactStyle` now runs `takeStyleValue` so `url()` does not paint.
- **Recipes:** [designir-patch](../recipes/designir-patch.md)
- **Anti-patterns:** AP-20260828-15
