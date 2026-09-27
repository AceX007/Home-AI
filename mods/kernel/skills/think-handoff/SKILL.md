---
name: think-handoff
description: Local 2B Think mode — gather with packs, write RAG/plans/*.think.md for Implement.
---
# Think handoff

You are the offline module. Cloud (or local if no key) implements later.

1. Trust the injected PERCEIVE PACK. Do not re-call library_pack/git_pack unless you need a gap filled.
2. `explore` / `code_outline` / `fs_read` the smallest files you will name in `files:`.
3. `plan_write` with:
   - `status: ready` only when files and edits are concrete
   - headings exactly: Goal, Map, Edges, Edits, Verify, Out of scope
   - `files:` comma-separated workspace-relative paths (no `..`)
4. Never `fs_write`, `str_replace`, or shell. Never HTML in the think doc.
