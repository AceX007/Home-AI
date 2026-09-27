---
id: rec-designir-patch
title: DesignIR is the canvas source of truth; patch, do not repaint
stack: electron
status: refined
---

# DesignIR is the canvas source of truth

## Shape (do this)
- Mechanism: one typed scene graph on disk; chat, sliders, and the 2B emit RFC 6902 envelopes.
- Good code shape: `applyDesignPatch(doc, { baseRevision, patch })` — clone, own-key pointer walk, bump revision, validate. Live preview: `overlayDrafts` + `compileReactStyle` (`takeStyleValue`). Array add `/pages/-` is `push`, not `pages['-']`.
- Do not: regenerate the whole JSON; `dangerouslySetInnerHTML`; `Object.assign` the IPC body; paint overlay CSS without the allowlist; start Design generate with explore.

## Ports (same idea, other systems)
- Web/API: PATCH `/artifacts/:id` with the same envelope + If-Match revision
- Desktop/IPC: `homeai:design:patch`
- Mobile: local IR + sync ops
- Worker/CLI: `designir apply --base rev_n`

## Curiosity (open)
- Why not HTML as source of truth? HTML is a target compiler, not the kernel (blueprint §5).
- What breaks if node ids contain `/`? JSON pointer must encode `~1`; Phase 0 ids are `[\w.-]+` only.
- Analog: Figma node ids + Code Connect, but we keep our IR and React preview.

## Weaknesses / bugs / holes
- Pointer `__proto__` / HTML text (AP-20260828-6, AP-SEED-03).
- Density slider must preview locally and commit on mouseup — per-input patches race stale revisions.
- No constraint solver yet; `order` is sort-only.
- Agent can still ask to rewrite the file via `fs_write` — Design generate now drops that tool (`toolsForDesign`); other modes still prefer `design_patch`.
- Cursor Cloud Agents never call `design_patch` (AP-20260901-37): `forgeForDesign` remints cursor→openai/openrouter/local; Design Home picker is Local 2B / OpenAI / OpenRouter.
- Local 2B used to skip tools (AP-20260901-43): explore-first hint, missed Qwen XML/✿, `/pages/-` no-op.
- Local 2B then called `design_patch` with truncated JSON or extra page fields so `irGrew` stayed false (AP-20260901-46): pretty 16k get, empty patch, `page field`.
- Live overlay drafts skip IPC until Save: `compileReactStyle` must still run `takeStyleValue` (AP-20260828-15).
- Comment pins are stored XSS: `takeComment` rejects `<>`; renderer paints React text after `canvasPins` strip (AP-20260828-15).
- Token ingest path from the renderer (AP-20260828-16): no path argument; main `designTokenRel` only.
- Overlay merge used to keep whole draft style maps (AP-20260828-17): `softStyle` at overlay + ops. Sibling: do not re-assign `nodes[sel] = draft` in the editor after `overlayDrafts`; `sanitizeDraft` on every `onDraft`.
- Selection export / handle drag (AP-20260829-26): hex-only fills, stripped text, known layout keys + `takeLayout`.

## Prevent / robust delivery
- Tests: `packages/runtime/src/designir.test.mjs`, `packages/runtime/src/design-style.test.mjs`, `packages/runtime/src/design-draft.test.mjs`, `packages/runtime/src/dtcg.test.mjs`, `packages/runtime/src/design-export.test.mjs`, `packages/runtime/src/design-path.test.mjs`, `packages/runtime/src/mind.test.mjs`, `packages/runtime/src/design-generate.test.mjs`
- Deny-by-default: three ops, four roots, no `<>`, locks on `text`; style keys from `STYLE_KEYS` only; Code tab parse in renderer is preview, IPC `takeStyleMap` is the gate; overlay uses own-key maps and known node ids only; ingest has no renderer path; overlay merge sanitizes style; editor never re-assigns raw `draft` onto the live node map; export fills are hex-only and text is stripped; Design generate remints off Cursor Cloud Agents; Design loop is get/patch/ingest; `parseQwenToolCalls` rejects `../` names; `publicDesignEnvelope` drops `_raw` on IPC; extra page fields stripped before `takePage`.
- Hunt layers: ipc, client

## Refinement log
- 2026-08-28 — Wave F Phase 0 from Design-Modular-Blueprint §19–20. Worked: density drag is local; persist on mouseup. Next: token file ingest (DTCG) and comment anchors.
- 2026-08-28 — Wave H: DTCG ingest maps allowlisted keys only; hex colors in `validateDesignIR`; no `fetch($value)`. Worked: alias `{color.bg}` resolves locally. Next: comment anchors on node ids; skip Cassowary.
- 2026-08-28 — Code/Design studio: nested `style`/`layout`/`attrs` on nodes; `parseCssDeclarations` for Code tab. Worked: storefront JSON validates; `url()` and `__proto__` rejected. Next: persist draft when switching nodes; comment pins on canvas.
- 2026-08-28 — Overlay map + pins. Worked: `opsForDrafts` covers every dirty node; Pro on/off writes `visible`; pins are numbered React text. Failed: `compileReactStyle` used `Object.entries` and skipped `takeStyleValue`, so overlay could paint `url()`. Next: design-system import still chrome-only; constraint solver still skipped.
- 2026-08-28 — Undo stack + selection handles + token ingest from Design systems tab. Worked: `pushUndo` own-key clone; ingest with no path. Next: GitHub `/design-sync` still out of scope; skip Cassowary.
- 2026-08-28 — Overlay sibling: editor had re-applied raw `draft` on top of `overlayDrafts`. Worked: `sanitizeDraft` at onDraft/pick; `cloneOverlay` strips `url()`. Next: GitHub `/design-sync`; shape tools stay chrome.
- 2026-08-29 — Edit-mode shop pages, live handles, selection export. Worked: `offX`/`offY` through `takeLayout`; export is canvas 2d of sanitized node text (no html2canvas). Next: GitHub `/design-sync`; shape tools stay chrome.
- 2026-09-01 — Prompt → `designCreate` slug → agent `design_patch` → IrCanvas live reload. Worked: slug jail sibling of token ingest (AP-20260901-30); PhoneCanvas only for `quokka-shop-storefront`. Failed: none yet. Next: GitHub `/design-sync`; shape-tool node create still chrome.
- 2026-09-01 — Live reload must keep page/sel (`keepCanvasFocus`) and sanitize `/pages` (`takePage`). Worked: HTML page names rejected; overlay prunes ghost ids (AP-20260901-34). Next: GitHub `/design-sync` still out of scope.
- 2026-09-01 — Title dropdown opens listed slugs; Layout hides inspector; Search filters Pro tree; shape tools honest-disabled; Share uses `designSlug` (AP-20260901-36). Next: shape-tool node create still chrome.
- 2026-09-01 — Design generate is Chat Completions + tools. Worked: `forgeForDesign` remints Cursor jobs; `kickDesign` forces agent; dead pins keep `needs-re-anchor`; ↑ blocked when local llama is off. Failed: Electron click-through of the 27-row matrix was not run in this agent. Next: GitHub `/design-sync` still out of scope.
- 2026-09-01 — Prove generate. Worked: `toolsForDesign` + `forgeActHint` so 2B cannot start with explore; `parseQwenToolCalls` XML/✿/bare JSON; `/pages/-` appends; `designTask` shared with the studio. Failed: llama was not listening on 8765 in this agent (GGUF on disk). Next: operator click Local 2B then OpenAI then OpenRouter in Electron; do not invent a Cursor Chat Completions client.
- 2026-09-01 — Live 2B `irGrew`. Worked: compact `designGetContent`; recover truncated `arguments`; coerce loose nodes and extra page fields; IPC `publicDesignEnvelope` drops `_raw`. Live: pages 2→6, nodes 5→17, `rev_2`. Failed: OpenAI/OpenRouter keys not in env or `data/secrets/*.key` this agent (honest remint local). Next: operator paste keys in Settings then ↑ OpenAI and OpenRouter on a non-shop brief.
- 2026-09-04 — `DESIGN_LOOP` includes `design_ingest_tokens`. Next: operator click-walk still required; GitHub `/design-sync` still out of scope.
- 2026-09-04 — Feature refine. Worked: Hex AI Design; dropped dead +/Access/GitHub chrome; starred copy is honest (not stored). Next: GitHub `/design-sync` still out of scope.
- 2026-09-05 — Compiler-OS. Worked: `designMeshRoute` on patch; Design create Think handoff. Failed: click-walk. Next: 0-token canvas still chrome.
