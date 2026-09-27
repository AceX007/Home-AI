---
id: feat-fs-extra-roots
---
# Extra FS roots

- **Works:** Opt-in `fsExtraRoots` on permissions. `jailPath` / `assertInside`. Extra-root writes always Ask (`extraRootWriteDecision`), including unrestricted. Sanitizer on **load and save**. Unrestricted does not skip the jail. `fs_read` / `fs_list` / writes take `root` as the extra folder **basename**, never a path.
- **Made:** [`packages/runtime/src/paths.mjs`](../../../packages/runtime/src/paths.mjs) `takeFsRootId` + `sanitizeExtraRoot`
- **Recipe:** [permissions-policy](../../recipes/permissions-policy.md) · [ipc-workspace-fs](../../recipes/ipc-workspace-fs.md)
- **Tests:** T-01 T-67 T-74
- **Edges:** E-01 E-60 E-68
