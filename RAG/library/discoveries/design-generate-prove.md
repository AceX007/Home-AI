---
id: disc-design-generate-prove
date: 2026-09-01
---
# Design generate live prove

- **What:** Design ↑ is Chat Completions + `design_get`/`design_patch`. Local 2B / OpenAI / OpenRouter; Cursor remints. Compact get + recover truncated arguments + coerce extra page fields so `irGrew` can become true.
- **Files:** `designGetContent`, `parseToolArguments`, `coerceDesignOps`, `publicDesignEnvelope`, `design-generate.prove.mjs`, `StagePills.tsx`, `ChatPane.tsx` Effort/Customize.
- **Prove (this agent):** llama on `:8765`. Local 2B: `irGrew true`, pages 2→6, nodes 5→17, `rev_2`, wrote `designs/prove-pitch.design.json` (no HTML). OpenAI/OpenRouter: keys missing in env and `data/secrets/*.key` → `remint: local` (no key material printed). Electron was not clicked.
- **Do not:** Cursor as a Design Chat Completions mind; Stage as a fourth pill; `innerHTML`; slug as a path; IPC `_raw` recover; overlay without `sanitizeDraft`.
