---
status: ready
files: apps/renderer/src/panes/design, apps/renderer/src/panes/ChatPane.tsx, apps/renderer/src/layout/WorkbenchShell.tsx, packages/runtime/src/designir.mjs, apps/desktop/src/main/tools.ts
---

# All 27 screens as spec + prompt → live pages

Standing copy of the execute plan. Canonical todos live in the Cursor plan `prompt_to_screens`. Written spec: [claude-design-screen-audit.md](../library/discoveries/claude-design-screen-audit.md).

## Standing law

The 27 captures from the start of the Code/Design conversation are the visual bible. Open the audit (and `docs/screens/code-design/01.png`–`27.png` if copied) **before every write**. Do not drop a control that appears on a capture.

**01–13** = Code shell (ChatPane / Workbench / activity-groups).
**14–27** = Design studio. **10** is Design home (same as 14). **27** = Quokka sample shop, not the only canvas.

**14’s way of working:** prompt → generate **that** artifact → watch pages → navigate all screens.

## Execute order

1. Pin PNGs into `docs/screens/code-design/` if Cursor assets still exist.
2. Code chrome 01–13 (pills, effort, models, mode, kebab, background, transcript, running pill).
3. Design chrome 14–26 (home widget, inspector Border, tools, Present, export).
4. Shop 27 sample (PhoneCanvas, Hand vs Select, streetwear only).
5. Jailed `designCreate` / slug get-patch; generic IrCanvas; live reload after `design_patch`.

## Skip

GitHub `/design-sync`, Cassowary, html2canvas, shape-tool node create, PDF/PPTX compilers, fake 22-agent Opus fleet.

## Trust

Slug jail under `designs/`. No HTML in IR. No `innerHTML`. Overlay `sanitizeDraft`. Hunt+prevent + recipe `designir-patch` on every ship.
