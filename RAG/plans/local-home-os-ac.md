# Local Home OS — requirements and acceptance criteria

Must AC has a test id. WONT is explicit. Do not fake Landlock. Do not vendor Whisper/Piper binaries.

## Passing

- **Tool packs** — Default agent `core` only; MCP only with `mcp-domain`; `/pack` + word-boundary keywords; Think shrinks; extra packs full JSON. T-62 T-75.
- **Subagents** — Explore/Bash/Browser/Research, cap 4, nested `task` denied, Think explore-only, HTML digest, research URL → `web_extract`, `Explore finished`. T-63 T-77.
- **VERIFY allowlist** — `str_replace` | `debug_log` | `ask_user`; prompt forbids `test_run`. T-68 T-75.
- **VERIFY patch blob** — workspace-relative before/after; extra-root omitted; `data/secrets` dropped; `<>` / tokens stripped. T-78.
- **VERIFY git diff** — `takeVerifyDiff` empty if no git; capped; `<>`/tokens stripped; no extra-root; no `data/secrets`. T-78.
- **MCP starter** — writes `.homeai/mcp.json` + example; empty allowlist still Ask. T-65.
- **Life notes/calendar/OCR/HTML** — slugs jailed; OCR images only under `data/inbox`; HTML second strip. T-66 T-77.
- **Life STT/TTS** — `inbox_stt` inbox audio only; `speak` → `data/tts/<id>.wav`; missing binary generic. T-81 T-82.
- **Inbox audio + Telegram voice** — ogg/wav/mp3/webm/m4a magic; php/svg/mismatch rejected; `voice.ogg` / `audio.mp3`; 2MB; video notes out. inbox + telegram-router tests.
- **Extra-roots** — `root` id is folder basename; writes Ask including unrestricted. T-67 T-74.
- **Compute timeout/no-net/plots/secrets/named fs/writes in runs|plots** — T-64 T-70 T-76 T-79.
- **Compute rename/shutil/promises** — `os.rename`/`replace` and `shutil.copy`/`move` cannot write `packages/`; named `node:fs/promises` cannot read secrets. T-80.
- **Skill stamp** — workspace `.cursor/.agents/.homeai` + `AGENTS.md`; never `$HOME`. T-71.

## WONT

- ctypes / Landlock / seccomp
- Vendoring whisper.cpp, Piper, or models
- Electron speaker playback; Telegram outbound voice
- Email, Activepieces, GitHub `/design-sync`
- Auto-allowlisting MCP
