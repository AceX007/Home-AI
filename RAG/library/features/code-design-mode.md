---
id: feat-code-design-mode
---
# Code / Design mode (Claude Design studio)

- **Works:** Design activity is a Claude Design–matching studio (Hex AI Design): home prompt creates a **new** DesignIR slug, the agent patches pages while you watch, filmstrip navigates every screen, inspector edits nodes. Access stays local (no GitHub sync chrome). Quokka Shop is one sample (`PhoneCanvas`); every other brief uses `IrCanvas`. Generate is Chat Completions + `design_get`/`design_patch`/`design_ingest_tokens` (Local 2B / OpenAI / OpenRouter); Cursor remints. Live local 2B `irGrew` on a pitch brief (pages 2→6).
- **Made:** `apps/renderer/src/panes/design/*` (IrCanvas, DesignStudio create loop), `packages/runtime/src/design-path.mjs`, `qwen-tools.mjs`, `designs/*.design.json`.
- **Recipe:** [designir-patch](../../recipes/designir-patch.md) · [cursor-jobs](../../recipes/cursor-jobs.md) · AP-20260828-6 · AP-20260828-12 · AP-20260828-15 · AP-20260828-16 · AP-20260828-17 · AP-20260829-26 · AP-20260901-30 · AP-20260901-34 · AP-20260901-36 · AP-20260901-37 · AP-20260901-42 · AP-20260901-43 · AP-20260901-46
- **Tests:** T-09, T-14, T-17, T-18, T-19, T-21, T-32, T-40, T-44, T-47, T-48, T-55, T-61
- **Edges:** E-07, E-11, E-14, E-15, E-16, E-18, E-28, E-35, E-39, E-42, E-43, E-49, E-55

## Feature / sub-feature matrix

| Feature | Sub-feature | How it must work | Edge cases |
|---|---|---|---|
| Home | Prompt + submit | ↑ `designCreate` (jailed slug) then agent `design_get`/`design_patch`; editor opens that artifact | Empty prompt still seeds two screens; 2k cap; slug not a path |
| Home | Templates | 12 tiles set `artifact.profile` only | Unknown template → `ui.web` |
| Home | Projects | Rows from `designList` (`designs/*.design.json`) | Search filters name/slug; empty → prompt CTA |
| Canvas | Generic vs sample | `IrCanvas` for new IR; `PhoneCanvas` only if `artifact.id === quokka-shop-storefront` | Missing page nodes show empty hint; filmstrip = `pages` cap 16 |
| Home | Tabs | Projects / Design systems / Templates | Systems import is local DTCG only; Templates filters; Star empty |
| Editor chrome | Palette / title / Share | Share copies `homeai://design/…`; no fake V avatar | Clipboard missing → toast still; title ellipsis |
| Tools | Select V, Hand H, Comment, Text T, Edit | H click-through; V selects node; T inline-edits text; Edit shows inspector; 32px amber-on tools | Keys ignored in inputs; undo/redo dim when empty; unlabeled glyphs have aria-label |
| Canvas | Pages | landing / store / product / orders / profile; empty page is HxEmpty | Edit uses page; Hand uses shop route; tab bar drives page in Edit |
| Canvas | Selection | Blue frame + 8 live handles on `data-nid` | Hidden in Hand / Present; size clamp 8–4000; offset only if Absolute |
| Shop | Orders / Profile | Full screens + IR nodes; last order card or empty; guest + lang | Edit page sel includes both |
| Export | PNG / SVG | Format + scale; canvas 2d of selected node text | Blob fail silent; `url()`/`<>` stripped; filename fixed |
| Present | In window / Fullscreen | Hides inspector; Esc exits; Fullscreen uses element FS | New window stays in-app |
| Inspector | Discard / Save | Overlay drafts per node; Save = `design_patch` for all dirty; Discard restores snap; no selection is HxEmpty | Switch node keeps sibling drafts |
| Simple | Appearance | Background, radius, overflow, opacity | `none` vs `#000`; opacity 0–1 |
| Pro | Tree | Nested by `parent`, on/off, tag | Cycles capped; proto keys skipped |
| Pro | Sizing / flex / pad / margin | Hug Fixed Fill; X&Y / All / Individual | >4000px clamped |
| Code | CSS editor | One declaration per line; `@class name` | `url()`, `<>`, unknown prop error; textarea keeps invalid text |
| Tweaks | Prompt | Sends design_patch-only agent task | Empty → token tweaks prompt |
| Comments | Pin | `cmt_*` under `/comments`; numbered pins on phone | HTML in text denied; missing node → needs-re-anchor |
| Shop | Geo | Country → City → Hood + search EN/RU | No matches; back stack |
| Shop | Catalog | Chips, 2-col, low/out badges | Search case-insensitive; stock 0 |
| Shop | PDP | Size radio, Added! flash, Add / Buy | Buy opens cart sheet |
| Shop | Cart | Qty, remove, subtotal | Qty 1 − removes line |
| Shop | Checkout | Crypto copy demo addr; card digits only | No network pay; demo wallets only |
| Shop | Confirm | Order id + back to store | Resets cart; keeps lang + last orderNo |
| Trust | Style/IR | Allowlist + React text nodes | `__proto__`, `url()`, `<>`; no raw draft on canvas |
