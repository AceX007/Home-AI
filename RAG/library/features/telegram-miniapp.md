---
id: feat-telegram-miniapp
---
# Telegram Mini App glass

- **Works:** HOME sheet on `127.0.0.1:18766`; HMAC + pairing; same `startKernelJob`; Pulse / Stack / Skills / Board / Stage (Glance) / Mind / Think / Threads; Glance JSON has jailed `phases` plus `card`; Telegram `tg_*` jobs are remembered so Glance sees the same pulse; mode chips persist `defaultMode`; Health / Cursor / Llama / fleet restart on the allowlist; Local / Cloud / Cursor chips; llama + key flags on session/Stage; Ship / Halt / Steer / questions; implement from a ready think doc; jailed Drop → `data/inbox` (audio STT when whisper exists); menu button + `/app`.
- **Made:** [`apps/miniapp/`](../../../apps/miniapp/), [`miniapp-server.ts`](../../../apps/desktop/src/main/miniapp-server.ts), [`inbox.mjs`](../../../packages/runtime/src/inbox.mjs), [`mind.mjs`](../../../packages/runtime/src/mind.mjs).
- **Recipe:** [telegram-bridge](../../recipes/telegram-bridge.md) · AP-20260828-24–25 · AP-20260829-27 · AP-20260901-40 · AP-20260901-41 · AP-20260904-72
- **Tests:** T-28 T-29 T-30 T-31 T-35 T-51 T-54
- **Edges:** E-25 E-26 E-27 E-29 E-30 E-31 E-46 E-48
