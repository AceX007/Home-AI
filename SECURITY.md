# Security

Hex AI Workbench is a **local-first Electron kernel**. There is no hosted multi-tenant control plane.

## Report

Email security findings to the operator who ships this tree, or open a private advisory on the GitHub repo that publishes Releases. Do not file a public issue with a working exploit.

## In scope

- Renderer → main IPC jail (`homeai:*`, workspace prefix, no generic `fs:stat`)
- Preload allowlist (`contextBridge` `homeai` only)
- Telegram pairing (one bot token per install; unpaired users denied)
- Mini App HMAC + loopback listen
- Secrets in the profile store (OS `safeStorage` when available; chmod 600 fallback)
- Packaged Chromium `sandbox: true`

## Out of scope / honesty

- **No Landlock.** `compute_run` is a monkey-patch jail. ctypes / native code can bypass it. Do not report that as a new finding.
- Interactive PTY is a real shell the user opened.
- `unrestricted` Trust is an explicit extra-confirm. Default is Ask / allowlist.
- Telegram Bot API limits apply to **that user’s bot**, not a Hex cloud.
- Third-party GGUF weights, llama.cpp, and Electron/Chromium themselves.

## Threat model (short)

The renderer is untrusted. XSS must not become Node RCE (`contextIsolation`, no `nodeIntegration`, sandboxed window). Main still treats every IPC argument as hostile. Cloud keys leave the machine only when the user pastes a provider key and the agent uses that provider. Crash dumps default **off**; opt-in local dumps must not include secrets or workspace paths.
