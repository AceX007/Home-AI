---
id: rec-workbench-chrome
title: IDE chrome is a jailed kernel DTO
stack: electron
status: tried
---

# IDE chrome is a jailed kernel DTO

## Shape (do this)
- Mechanism: titlebar/status/palette/layout persist show one kernel (llama, mind, jobs, ports) without reading secrets or extra-root paths.
- Good code shape: `takeChromePulse` / `takeLayout` / `takePortList` / `takeWorkspaceRel`; layout file is always `data/workbench.json`; explorer mkdir/rename/remove go through `editablePath`. Composer: mode + attach + send; Effort `follow-ctrl`; mind `follow-select`; one Review menu over `homeai.agentReview`. Pages: `HxPage` + `HxSideHead` + `HxEmpty`; titles are React text nodes. Forms: `.hx-form` / `.hx-card` / `.hx-hint` (not inline color dumps). Settings `hx-rail` Trust/Keys/Hardware/Telegram/Visual. Overlays: palette/quick-open/goto-symbol `palette-head` + HxEmpty no-match copy; PlanDoc parse/`rich()` text nodes; StageGo 32px amber-on chips (not Stage pills). Clicks: `takeCrumbPrefix` + `treeFocus` via `list()`, never `homeai:fs:stat`. Pops: About/llama/Mode/mention/sess/Effort/`menu-drop` use `--radius` / `--focus` / amber, not VS Code blue. Disabled Design tools are `cd-tool-off` plus a text hint. Status idle is `Agent idle`, not `0/0`. Primary `.send` / `.send-round` / `.keep-btn` / `.cd-save` / `.cd-export` use `--amber` / `--focus` / `--radius`; potato skips extra motion. Plan chips / hunk / file-icon / ctx `sys` use tokens, not leftover blues. Terminal tabs are Checks / Kernel log / Workflow (not VS Code Problems/Output/Debug Console). Workbench rows `minmax(0, 1fr)`; `.term-tabs` `overflow-x: auto`; `.tree` / `.side-list` / `.notes-list` `min-height: 0`; `.agents-foot` `flex-shrink: 0`; hide `.tabs` on `[data-page]` / `[data-list]` / `[data-activity='browser']`. No unused `.pane-head` CSS.
- Do not: persist absolute tabs; return MCP URLs or `telegram.key` on `homeai:kernel:pulse`; `innerHTML` pulse chips; `Object.assign` the layout body; Settings gear on the composer; two sibling Review ghosts; `pane-head` beside `HxPage`; paint MCP `s.url`; `fetch`/`openExternal` Fleet domains; interpolate palette query or quick-open paths as HTML; fake Design avatars; `CHOOSE A TEMPLATE` Claude gallery; put Stage on the Chat|Code|Design row; hover `#04395e`; dead-gray disabled shape tools; `Agent 0/0` when no tools ran; `.send` `#0e639c`; `.send-round` `#fff`; plan chip `#89b4fa`; hunk/file/ctx `#569cd6`/`#519aba`; studio save `#82b1ff`; export `#ffab91`; invent a debugger for the Workflow tab; retint xterm/Monaco language colors as if they were chrome; add `homeai:fs:stat`; leave a nowrap 35px tab row that clips Checks/Runtime; keep `.pane-tab` on HxPage activities.

## Ports (same idea, other systems)
- Web/API: GET `/session` allowlisted DTO; PATCH `/layout` with the same take*
- Desktop/IPC: this recipe (`homeai:kernel:pulse`, `homeai:workbench:layout:*`, `homeai:fs:mkdir|rename|remove`)
- Mobile: Telegram Pulse / Mini App Glance already share `healthPulse`
- Worker/CLI: print pulse fields only; never dump `data/secrets`

## Curiosity (open)
- Why not `localStorage` for tabs? Renderer XSS would rewrite layout; main jails the file.
- What breaks at 40 open tabs? Cap 12 rels; skip missing files on restore.
- Analog: VS Code `storage.json` written by the trusted process.

## Weaknesses / bugs / holes
- New fs IPC that skips `editablePath` (AP-20260828-1 sibling). `writeFileSafe` now refuses `data/secrets` and `*.key`.
- Pulse assembled from raw `mcp.list()` would leak URLs — count only (AP-20260828-21).
- Unstripped job titles in the titlebar if anyone switches to HTML (AP-SEED-03). Chat home titles/leads stay React text nodes (AP-20260904-91). Page panes stay `HxPage` without a second `pane-head` (AP-20260904-93). Palette/quick-open query and paths stay text (AP-20260904-94). Overlay pops stay Hex tokens; disabled shape tools keep a hint; idle status is not `0/0` (AP-20260904-95). Send/studio/terminal leftover chrome stays Hex tokens, not VS Code/Claude hex (AP-20260904-96). Product chrome hex vs token: send-round/plan/hunk/file-icon/ctx/export use `--amber`/`--text`/`--muted` (AP-20260904-97). Form dumps stay `.hx-form`/`.hx-card`; crumbs use `takeCrumbPrefix` not `homeai:fs:stat`; outline is `takeBufferOutline` text (AP-20260904-98). Do not hide file-tree folders on filter without descendant knowledge — lazy `list()` would yank expand. `projectTag` must not mash folder `Home AI` into `HEX AI` beside a session named Home.
- Ports pane must allowlist names; `coder` is a kernel port, `vite` is not. Sidecar 8766 only appears when `ownedLlamaPort` is set (AP-20260901-54).
- Click-only bottom tabs and a compiler-only `No problems` footer. AP-20260905-26
- Flex `1fr` / missing `min-height: 0` clips lists, Checks tabs, status, and the composer under `body { overflow: hidden }`. AP-20260907-1
- List/page mounting the same HxPage beside the Agents session rail (AP-20260905-4).
- Skills listing an MCP URL would tempt fetch/openExternal (AP-20260828-21 sibling). Transport only.

## Prevent / robust delivery
- Tests: `packages/runtime/src/workbench-chrome.test.mjs`, `packages/runtime/src/hex-chrome.test.mjs` (T-99 T-100 T-101 T-102 T-103 T-104 T-105 T-111 T-133), `packages/runtime/src/pane-route.test.mjs` (T-113 T-114)
- Deny-by-default: activity/split/port/command enums; rel paths only; layout path fixed; `takePinnedChats` allowlists `chat[_-]` ids.
- Hunt layers: ipc, client

## Refinement log
- 2026-09-01 — Agents Stage. Worked: `layoutMode` + `density` + llama health fields on the same DTO. Next: do not add a generic `homeai:fs:stat` that echoes extra-root errors.
- 2026-09-01 — Wave R. Worked: `takeChatId` / `takePinnedChats` on layout JSON (`chat-1` allowed, `../` and `<>` dropped). Next: renderer restore uses the same regex, not a prefix-only check.
- 2026-09-01 — UX refine. Worked: `takeCowork` persist; `takeCrumbs` for the editor path; palette density + chords; overflow tabs; status click-through; Stage pills no longer yank Dock. Next: do not add `homeai:fs:stat` for crumb clicks.
- 2026-09-01 — Coder port name. Worked: `PORT_NAMES` includes `coder`; `takePortRow` still drops `vite`. Next: do not list 8766 unless the sidecar child is owned.
- 2026-09-04 — Fleet activity. Worked: `ACTIVITIES` + `COMMAND_IDS` include `fleet`. Next: do not put stack logs on the kernel pulse.
- 2026-09-04 — Dev boot. Worked: window paths from `import.meta.url`; Vite on 5175 with watch ignore. Next: still operator click-walk; see [electron-dev](electron-dev.md).
- 2026-09-04 — Dead activity buttons. Worked: `pane-route.mjs` `sidebarKind`/`centerViewForActivity`; studio CSS `!important`; `openFile({ keepActivity })`. Failed if we had kept `centerView === 'browser'` as a trap. Next: operator click-walk each icon; AP-20260904-89.
- 2026-09-04 — Electron click-walk (CDP on :9222). Worked: Debug/Skills/Notes/Maps/Design/Board/Library/Telegram/Fleet all mounted with real text; Design home 1392px not a black strip; Hex AI Design heading; `projectTag` maps folder `Home AI` → `HEX AI` chrome. Next: keep status/search as the real folder basename; do not invent Opus fleets.
- 2026-09-04 — Feature refine. Worked: Stage page grid `1fr` not `0.28fr`; Notes `setActivity`; About Hex AI pop; Terminal Debug `workflowPhaseLine`; Skills pin; no Customize stub. Next: live forge still needed for Critic rows; AP-20260904-90.
- 2026-09-04 — Chat-and-Cowork home. Worked: `projectTag` → `Hex AI`; HxEmpty in the void; titlebar placeholder Hex AI; dropped composer/footer trust stacks; Density is a labeled select; idle forge no longer sits next to a pty `1 running`. Failed if we had kept `HEX AI` uppercase beside session title Home. Next: operator `npm run ide` click-walk this exact screen; AP-20260904-91.
- 2026-09-04 — Composer grouping. Worked: Effort + Review menus; mind `follow-select` (Local/OpenAI/OpenRouter/Cursor); Settings gear gone; editor `HxEmpty`; `setTitle('Hex AI Workbench')` + title-brand. Failed if we had dropped `agentReview('deep')`. Next: operator `npm run ide`; AP-20260904-92.
- 2026-09-04 — Activity page chrome. Worked: Telegram/Settings/Fleet/Library/Board/Skills/Debug wrap `HxPage`; Search/Git/Notes/Maps/FileTree use `HxSideHead`; empties are `HxEmpty`; dropped `pane-head` on those pages; Skills hides MCP URLs; Design kicker Hex AI, no fake avatar. Failed if we had kept Fleet `fetch` of stored domains. Next: operator `npm run ide` click-walk each activity icon; AP-20260904-93.
- 2026-09-04 — Overlay leftovers. Worked: palette/quick-open Hex head + HxEmpty no-match (query/path as text); PlanDoc empty + Hex type ramp; Design canvas/inspector empty + no V avatar; StageGo 32px amber-on. Failed if we had put Stage on the pill row or used `innerHTML` for the filter. Next: operator `npm run ide` Ctrl+Shift+P / Ctrl+P / a blank plan / Design editor with no selection; AP-20260904-94.
- 2026-09-04 — Overlay leftover fill. Worked: About/llama Hex kicker; Mode/mention/sess/Effort/titlebar menus amber `--focus`; session/file-tree/browser/background/crash HxEmpty; shape tools `cd-tool-off` hint; dropped unused `.cd-avatar`; status `Agent idle`. Failed if we had kept `#04395e` hover or `Agent 0/0`. Next: operator `npm run ide` About, llama pop, Chat filter, Files filter, Design tools, Browser Go fail; AP-20260904-95.
- 2026-09-04 — Token leftover fill. Worked: `.send`/`.keep-btn`/`.cd-save` `--amber`/`--focus`/`--radius`; dropped unused `.pane-head`; Terminal Checks/Kernel log/Workflow; potato skips send motion. Failed if we had kept `#82b1ff` save or invented a debugger. Next: operator `npm run ide` Allow, Design save, bottom Checks/Kernel log/Workflow; AP-20260904-96.
- 2026-09-04 — Product chrome hex vs token. Worked: `.send-round` 32px `--amber` not `#fff`; plan chips / hunk / file-icon / ctx sys / Effort pips / Design export+dot to tokens; potato skips send-round/export motion; T-104 scans global.css+studio.css only. Failed if we had retinted xterm ANSI `#569cd6` or PhoneCanvas shop `#4c8dff`. Next: operator `npm run ide` composer send, a plan chip, Files filter, Design Export; file-tree empty folders stay visible (lazy `list()`); AP-20260904-97.
- 2026-09-04 — Form + editor UX. Worked: `.hx-form`/`.hx-card`; Settings rail; Design kinds not `CHOOSE A TEMPLATE`; `takeCrumbPrefix` + `treeFocus` via `list()`; `takeBufferOutline` Ctrl+Shift+O; activity `aria-label`. Failed if we had added `homeai:fs:stat` or HTML outline labels. Next: operator `npm run ide` Settings rail, crumb click, Ctrl+Shift+O; AP-20260904-98.
- 2026-09-05 — Refine existing workbench, not a new first-run product. Worked: titlebar/llama/About `--bg-raise`/`--bg-panel`; About `hx-card`+`hx-row`; dropped Onboard overlay so the T-105 workbench is the chrome. Next: operator `npm run ide` — GGUF/sandbox stay Settings/pack.
- 2026-09-05 — Chat replies were invisible beside the composer. Worked: thread-first `grid-area: thread`; `takeEditorColumn`; T-113. Next: operator send a turn in Code with a file open and confirm the log is readable.
- 2026-09-05 — Operator screenshot: leftover tabs kept a dead editor; "ss" sat at the top of an empty column. Worked: cowork hides editor even with tabs; bubbles + log spacer. Next: click-walk Chat and Cowork send.
- 2026-09-05 — Maps + chat painted four surfaces. Worked: `takeSlots` / `takeChatPx`; list/page hide `.agents-sessions`; Maps center is canvas-only. Next: operator open Maps with persisted chatW 720.
- 2026-09-05 — Runtime tab. Worked: `BOTTOM_TABS` `runtime` plus `inspect` port; Workflow stays `debug`. Next: operator F9 / Runtime Continue / Stop.
- 2026-09-05 — Checks a11y. Worked: bottom tabs are `term-tab` buttons with Enter/Space; footer counts QA with compiler diagnostics. Next: operator Tab to Checks / Runtime.
- 2026-09-06 — Checks tabpanel. Worked: `role="tabpanel"` + New Terminal / Edit selection labels. Next: operator Tab to Checks / Runtime.
- 2026-09-07 — Chrome overflow. Worked: workbench `minmax(0, 1fr)`; `.term-tabs` `overflow-x: auto`; tree/side-list/notes-list `min-height: 0`; composer/status shrink-0 + ellipsis; hide `.tabs` on page/list/Browser; kanban `auto-fit`; split columns `minmax(0, 1fr)`; page grid is 4 columns matching visible children (not `0px 0px` after `display: none`). Failed if we had kept a duplicate `.pane-tab` on HxPage or a 6-col page template. Next: operator `npm run ide` click-walk Files/Notes/Maps/Settings/Board with a narrow window; AP-20260907-1.
