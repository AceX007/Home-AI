---
id: feat-home-os-life
---
# Life pack

- **Works:** `notes_*` under `notes/`, `calendar_*` under `data/calendar/*.ics`, `web_extract` stripped HTML, `inbox_ocr` images under `data/inbox`, `inbox_stt` audio under inbox, `speak` wav under `data/tts/`. Missing PATH bins drop those tools from the forge list.
- **Made:** [`packages/runtime/src/life-files.mjs`](../../../packages/runtime/src/life-files.mjs) `ocr.mjs` `voice.mjs` `web-extract.mjs` `life-bins.mjs`
- **Recipe:** [life-pack](../../recipes/life-pack.md)
- **Tests:** T-66 T-77 T-81 T-82
- **Edges:** E-26 E-59 E-71 E-76
