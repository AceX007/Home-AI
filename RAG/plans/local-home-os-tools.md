# Local Home OS tool kit

Status: implemented Wave A–C in kernel (2026-09-01). Build runs Agent against this file.

Thesis: the local 2B stays the operator. Intelligence is digest-returning systems (packs, subagents, compute, verifier), then opt-in life/MCP packs. Cloud remains optional muscle.

## Wave A
- Tool packs: `detectToolPacks` + `toolsForMode(..., { packs })`. Default core; MCP only with `mcp-domain`. `/pack research` kept on the task string.
- Subagents: parent `task` tool → `parseTaskCall` / `runSubagentJobs` (Explore/Bash/Browser/Research). Nested `task` denied. Think: explore-only.
- `compute_run`: jailed python/node, timeout, no network preamble.
- VERIFY: second model pass, tools `str_replace` | `debug_log` | `ask_user` only.
- MCP starter: Settings Enable MCP starter writes `.homeai/mcp.json`; live HTTP handshake test.

## Wave B
- Life pack: `notes_*`, `calendar_*` (`data/calendar/*.ics`), `inbox_ocr` (`data/inbox` only).
- Research pack: `web_extract` (stripped HTML), DuckDuckGo origin on new installs.
- Optional coder GGUF name on governor when profile is `standard` (basename only).

## Wave C
- `fsExtraRoots` sanitized in permissions. Extra-root writes always Ask, including unrestricted. Unrestricted still cannot skip `assertInside`/`jailPath`.
- `fs_read` / `fs_list` / writes take `root` as the extra-root **folder basename**, never a path (`takeFsRootId`).
- Domain packs (HA origin, Blender stdio, extra messaging) documented in Settings; enable via MCP + net allowlist.
- MCP template: `.homeai/mcp.example.json` / `exampleMcpConfig`. Enable starter still asks until `mcpAllowlist`.
- Refine 2026-09-04: `keepFullSchema`, HTML extract on fetch/digest, image-only OCR, compute secrets/`Figure.savefig`, `verifyUserPrompt`, `AGENTS.md` stamp.
- Continue 2026-09-04: `Path.open`/`os.open`/node `fs` secrets jail; `takeVerifyPatch` for VERIFY; workspace `.cursor/.agents/.homeai` skill stamp (never `$HOME`).
- Continue 2026-09-04: compute writes jailed to runs/plots; node `--import` shim for named `readFileSync`.

## Do not
- Dump 80 MCP schemas into the 2B.
- Copy Cursor proprietary host.
- Fake Landlock.
