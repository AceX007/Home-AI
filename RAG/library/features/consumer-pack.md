---
id: feat-consumer-pack
---
# Consumer pack + first-run

- **Works:** app resources vs profile vs workspace jail; Settings Download GGUF + hardware gate; About diagnostics/crash/update; Chromium sandbox on for `ide`/`pack`; llama vendor `HEX_LLAMA_ASSET` + `llama-server.exe`. No covering first-run overlay.
- **Made:** [`app-roots.mjs`](../../../packages/runtime/src/app-roots.mjs), [`pack-chrome.mjs`](../../../packages/runtime/src/pack-chrome.mjs), [`electron-builder.yml`](../../../electron-builder.yml), [`scripts/electron-smoke.mjs`](../../../scripts/electron-smoke.mjs).
- **Recipe:** [electron-pack](../../recipes/electron-pack.md) · [electron-dev](../../recipes/electron-dev.md) · [ipc-workspace-fs](../../recipes/ipc-workspace-fs.md) · AP-20260904-99 · AP-20260904-100 · AP-20260904-101 · AP-20260904-102 · AP-20260904-103 · AP-20260905-2
- **Tests:** T-106 T-107 T-108 T-109 T-110 T-112 T-132
- **Edges:** E-02 E-03 E-04 E-105 E-106 E-108
