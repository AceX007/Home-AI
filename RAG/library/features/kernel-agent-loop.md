---
id: feat-kernel-agent-loop
---
# Kernel agent loop

- **Works:** PERCEIVE (unified pack except Ask) → ROUTE → ACT (frozen tools) → VERIFY → REMEMBER (promote Ask). Trust/Hunt/Verify/Critic is a view of those steps. Think is local; Implement is cloud muscle.
- **Made:** [`packages/agent/src/index.ts`](../../../packages/agent/src/index.ts) `KERNEL_SYSTEM` + `promoteDiscovery`.
- **Recipe:** [kernel-loop](../../recipes/kernel-loop.md) · [compiler-os](../../recipes/compiler-os.md)
- **Tests:** T-06 T-12 T-68 T-75 T-78 T-86 T-116
- **Edges:** E-09 E-61 E-72 E-75 E-80 E-112 E-118
