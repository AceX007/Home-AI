---
id: feat-compound-os
---
# Compound OS (mesh, scene, DNA, router)

- **Works:** DNA compiles validated `capabilityir/0.1` into CSP web, CLI, bounded loopback API, and a manual Electron desktop shell. The desktop main loads only generated local HTML; its `.cjs` preload exposes a frozen result DTO without Node or IPC. Navigation, permissions, windows, and webviews are denied.
- **Made:** [`compiler-os.mjs`](../../../packages/runtime/src/compiler-os.mjs) `compileCapabilityIr` `emitApiLoopback` `emitDesktopShell` `dnaArtifactAllowed`.
- **Recipe:** [compound-os](../../recipes/compound-os.md) · AP-20260905-19 · AP-20260905-20 · AP-20260905-21
- **Tests:** T-119 T-120 T-121 T-122 T-123 T-124
- **Edges:** E-116 E-124 E-126 E-127 E-128 E-129
