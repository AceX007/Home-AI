---
name: surgical-edit
description: How to change code without rewriting the world. Use when implementing or fixing.
---
# Surgical edit

- Prefer `str_replace` with a unique `old_string`.
- `fs_write` only for new files.
- Do not drive-by refactor, do not add markdown the human did not ask for.
- After the patch: `grep` or `fs_read` the changed region.
- If tests exist, `test_run`.
