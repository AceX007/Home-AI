---
id: disc-wave-f-designir
folder: discoveries
---

# Wave F — Design Fabric Phase 0

- **Task:** After Wave E, implement the Design-Modular-Blueprint Phase 0 spike in the workbench (not a Claude Design clone).
- **Files:** `packages/runtime/src/designir.mjs`, `designs/default.design.json`, `DesignPane.tsx`, IPC `homeai:design:*`, tools `design_get` / `design_patch`.
- **Commands:** `npm test`; `npm run build`; relaunch Electron by PID.
- **Worked:** Density slider previews locally; patch commits on mouseup so revisions do not race. Canvas uses React text nodes.
- **Recipes:** [designir-patch](../recipes/designir-patch.md)
- **Anti-patterns:** AP-20260828-6
