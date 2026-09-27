# Edges

Edge-to-edge cases. Status: `tracked` | `tested` (has a prevent artifact / test) | `wont`. Cite a code path, not an exploit write-up.

| id | case | feature | status |
|----|------|---------|--------|
| E-01 | Renderer-controlled `../` path into main fs | electron-ipc-fs | tested |
| E-02 | Renderer XSS reaching `ipcMain` (preload allowlist) | electron-ipc-fs | tested |
| E-03 | Repo opened with no `RAG/library/ROADMAP.md` | workbench-shell | tested |
| E-04 | Hunt finding shipped with no prevention artifact | forge-hunt-prevent | tested |
| E-05 | Multiline YAML `description: >-` parsed as `>-` | forge-hunt-prevent | tested |
| E-06 | Untrusted PR + privileged workflow | forge-hunt-prevent | wont |
| E-07 | DTCG `$value` URL or `__proto__` into DesignIR tokens | design-fabric | tested |
| E-08 | Cloud agent id interpolated into Cursor URL | workbench-shell | tested |
| E-09 | Think writes product files or Implement dumps secrets to cloud | think-handoff | tested |
| E-10 | Fold headers or session titles render tool/user text as HTML | activity-groups | tested |
| E-11 | Code tab / style map `url()` or `__proto__` into canvas | code-design-mode | tested |
| E-12 | Tool call arguments (paths/tokens) streamed into Agents | activity-groups | tested |
| E-13 | Git pull extra remote/ref from renderer | electron-ipc-fs | tested |
| E-14 | Overlay style `url()` / comment pin `<>` painted on the phone | code-design-mode | tested |
| E-15 | Renderer-supplied token ingest path / undo overlay `__proto__` | code-design-mode | tested |
| E-16 | Overlay draft `url()` kept in memory until Save | code-design-mode | tested |
| E-17 | Implement rewrites think body or renderer sets arbitrary status | think-handoff | tested |
| E-18 | Code-tab css map prototype key / lost draft on node switch | code-design-mode | tested |
| E-19 | Unpaired Telegram user reaches runForge | telegram-bridge | tested |
| E-20 | Callback job/thread id outside allowlist | telegram-bridge | tested |
| E-21 | Skill/rule write escapes RAG/skills or RAG/rules | telegram-bridge | tested |
| E-22 | Telegram `/tools` or `/do` leaks MCP URLs or runs with empty MCP after headless boot | telegram-bridge | tested |
| E-23 | Group member or negative chat id treated as paired / Home rebound to the group | telegram-bridge | tested |
| E-24 | Telegram `parse_mode` HTML/Markdown on model text or unjailed callback ids | telegram-bridge | tested |
| E-25 | Mini App `/api` without valid initData, or loopback bypass while a public URL is set | telegram-miniapp | tested |
| E-26 | Inbox drop SVG/HTML/PHP or `../` filename into `data/inbox` | telegram-miniapp | tested |
| E-27 | Mini App `implement`/`use`/`steer` with a path or run id outside the jail | telegram-miniapp | tested |
| E-28 | Selection PNG/SVG interpolates node text or `url()` fill; handle drag writes unknown layout keys | code-design-mode | tested |
| E-29 | Cursor Cloud Agents launch dumps API JSON / keys onto Telegram | telegram-bridge | tested |
| E-30 | `/mind` or Mini App `provider` accepts an unknown mind string | telegram-bridge | tested |
| E-31 | Telegram `getFile` path or photo `file_id` writes outside `data/inbox` | telegram-miniapp | tested |
| E-32 | IDE Telegram session IPC returns bot token or pairing hash | telegram-bridge | tested |
| E-33 | Renderer layout JSON writes tabs outside the workspace or into `data/secrets` | workbench-chrome | tested |
| E-34 | Titlebar/status pulse dumps MCP URLs, keys, or model paths | workbench-chrome | tested |
| E-35 | Renderer/agent design id is a path (`../`, `__proto__`, extra-root) | code-design-mode | tested |
| E-36 | Unknown layoutMode/density from layout JSON | agents-stage | tested |
| E-37 | Review hunk path `..` or markup in session filter | agents-stage | tested |
| E-40 | Index capture filenames painted as HTML | agents-stage | tested |
| E-38 | Session rename / copy-link / Hunt names carry HTML or `../` ids | activity-groups | tested |
| E-39 | Design live reload wipes selection; `/pages` names are HTML | code-design-mode | tested |
| E-41 | Chat and Code pills both on; Design share slug / layer labels unsanitized | activity-groups | tested |
| E-42 | Design generate with Cursor mind stays on Cloud Agents (no design_patch) | code-design-mode | tested |
| E-43 | Open comment whose nodeId is gone stays as needs-re-anchor (no HTML) | code-design-mode | tested |
| E-44 | Pinned chat ids from layout JSON include `../` or markup | agents-stage | tested |
| E-45 | Think status flips to done after a forge that streamed error chunks | think-handoff | tested |
| E-46 | Phone Stage/Trust chrome uses HTML parse_mode or unjailed callback ids | telegram-bridge | tested |
| E-47 | layoutMode string passed to chromeRoute becomes a fourth route or both pills on | activity-groups | tested |
| E-48 | Go strip / phone Skills dock interpolates skill or tool names as HTML or unjailed slashes | agents-stage | tested |
| E-49 | Design generate stories instead of design_patch; `/pages/-` does not grow IR | code-design-mode | tested |
| E-50 | Git push extra remote/ref from renderer | electron-ipc-fs | tested |
| E-51 | Plan `rag_write` writes `.think.md` or escapes `RAG/plans/` | think-handoff | tested |
| E-52 | Search/workspace grep paints HTML or extra-root paths | rag-fts | tested |
| E-53 | Cowork flag from layout JSON is a string that becomes a class | workbench-chrome | tested |
| E-54 | Editor breadcrumbs paint `../` or markup from a raw path | workbench-chrome | tested |
| E-55 | Local 2B design_patch arguments truncated or extra page fields; IR does not grow | code-design-mode | tested |
| E-56 | Agent 2B receives full MCP dump without mcp-domain pack | tool-packs | tested |
| E-57 | Nested `task` or Think bash/browser workers | subagents | tested |
| E-58 | `compute_run` script path `..` or unbounded runtime | compute-run | tested |
| E-59 | `inbox_ocr` / notes_write path outside notes or data/inbox | home-os-life | tested |
| E-60 | `fsExtraRoots` accepts `/`, `$HOME`, or `data/secrets` | fs-extra-roots | tested |
| E-61 | VERIFY pass runs Qwen-parsed `terminal_run` | kernel-agent-loop | tested |
| E-62 | Coder sidecar binds `0.0.0.0`, renderer-chosen port, GGUF `..` path, nested forge on Think, or sidecar start killing the 2B | coder-sidecar | tested |
| E-63 | plot path `..` or write outside `data/compute/plots` | compute-plots | tested |
| E-64 | skill walk follows `reference/` or cache misses a SKILL.md save (incl. workspace `.cursor/skills`) | compute-plots | tested |
| E-65 | Coder sidecar attaches to any leftover `/health` on 8766 | coder-sidecar | tested |
| E-66 | Fleet start execs a renderer command string or clones `file://` / `user:pass@` | fleet-runtimes | tested |
| E-67 | Fleet snapshot / logs echo a bot token or SMTP password | fleet-runtimes | tested |
| E-68 | `fs_read`/`fs_write` `root` id is a path, `__proto__`, or colliding extra-root basename | fs-extra-roots | tested |
| E-69 | Think dumps full schemas; skill description `web` activates research pack | tool-packs | tested |
| E-70 | compute `open`/`Path`/`os.open`/node `fs` reads `data/secrets` or `Figure.savefig` writes beside the script | compute-run | tested |
| E-71 | `inbox_ocr` on SVG/HTML; `http_fetch`/digest stuffs raw HTML | home-os-life | tested |
| E-72 | VERIFY critic receives extra-root or `data/secrets` before/after | kernel-agent-loop | tested |
| E-73 | compute `open('w')` / `mkdir` / `chdir` writes workspace or extra-root; ESM named `readFileSync` reads secrets | compute-run | tested |
| E-74 | compute `os.rename` / `shutil` / named `fs/promises` writes `packages/` or reads `data/secrets` | compute-run | tested |
| E-75 | VERIFY git diff includes extra-root or `data/secrets` | kernel-agent-loop | tested |
| E-76 | `inbox_stt`/`speak` on SVG/secrets/`..`; Telegram voice.php | home-os-life | tested |
| E-77 | `removeSub` saves undefined `subscribers` | fleet-runtimes | tested |
| E-78 | Phone `/fleet` clones `file://` or accepts a bot token | fleet-runtimes | tested |
| E-79 | Workflow id / title / agent names painted as HTML in Background or Stage | workflow-thinking | tested |
| E-80 | Stop or stream chunk with a foreign runId mutates another workflow | workflow-thinking | tested |
| E-81 | Token counts from `text.length` or fake Opus / Hunt3 fleet labels | workflow-thinking | tested |
| E-82 | Stop clearing `runId` lets a foreign chunk double-fold that workflow | workflow-thinking | tested |
| E-83 | SSE usage before `tool_call` leaves per-agent Tokens empty; glance `phases` as unsanitized HTML | workflow-thinking | tested |
| E-84 | Unmodeled shell (`$()`, env assign, `;`, PowerShell) auto-allows | auto-review | tested |
| E-85 | too_destructive runs because allow_instructions or human said yes | auto-review | tested |
| E-86 | Fleet stores a website URL then fetches or `openExternal`s it | fleet-runtimes | tested |
| E-87 | Local clone overwrites `Repos/` or Mini App `fleet-fork` smuggles a git URL | fleet-runtimes | tested |
| E-88 | Auto-review auto-allows an allowlisted MCP tool | auto-review | tested |
| E-89 | Clearing Trust instructions resurrects `autoReview` from `~/.homeai` | auto-review | tested |
| E-90 | Mini App Health `stageCard` omits the live Auto Review line | auto-review | tested |
| E-91 | ESM main `createWindow` uses `__dirname` so the window never opens | workbench-shell | tested |
| E-92 | electron-vite watch includes `AI Resources`/`RAG` and hits EMFILE | workbench-shell | tested |
| E-93 | Renderer Vite bundles `policy.mjs` / `mcp-packs.mjs` Node APIs | workbench-shell | tested |
| E-94 | `rag.watch` EMFILE on RAG/mods leaves unhandled rejections | workbench-shell | tested |
| E-95 | Activity click keeps `centerView=browser` or FileTree; Design studio grid loses to chat-off | workbench-shell | tested |
| E-96 | Stage layout squeezes Board/Library/Fleet/Notes to a 0.28fr strip | workbench-shell | tested |
| E-97 | Empty Chat-and-Cowork paints titles as HTML or mashes Home HEX AI; duplicate trust stacks | workbench-chrome | tested |
| E-98 | Composer shows Settings gear + Quick hunks/Deep siblings; empty editor is a black void with HTML | workbench-chrome | tested |
| E-99 | Page pane keeps pane-head beside HxPage, or Skills paints MCP URLs | workbench-chrome | tested |
| E-100 | Command palette / quick-open paints the query or a file path as HTML | workbench-chrome | tested |
| E-101 | Overlay pop, session filter-zero, or disabled shape tools paint HTML / VS Code blue / fake Agent 0/0 | workbench-chrome | tested |
| E-102 | `.send` / Design save stay VS Code/Claude blue; unused `.pane-head` CSS; Terminal VS Code Problems/Output/Debug Console | workbench-chrome | tested |
| E-103 | Product chrome uses leftover hex (`#fff` send-round, `#89b4fa` chips, `#569cd6` hunk/ctx, `#ffab91` export) instead of Hex tokens | workbench-chrome | tested |
| E-104 | Settings/Telegram/Fleet dumps inline HTML color; Design CHOOSE A TEMPLATE; crumb `..` or `fs:stat`; outline query as HTML | workbench-chrome | tested |
| E-105 | First-run GGUF write torn dest or hash `/etc` | consumer-pack | tested |
| E-106 | `ide`/`pack`/`release` disable Chromium sandbox | consumer-pack | tested |
| E-107 | First-run HxPage sheet replaces the Hex workbench; titlebar/About dump leftover hex | workbench-chrome | tested |
| E-108 | Sandboxed renderer loads ESM preload so `window.homeai` is missing | workbench-shell | tested |
| E-109 | Chat dock 3-col grid collapses the thread; composer stays visible | workbench-shell | tested |
| E-110 | Maps/list+page paint duplicate HxPage and Agents rail over the canvas | workbench-shell | tested |
| E-111 | Enable MCP starter auto-spawns DesktopCommander, gitmcp.io, or uvx blender | resource-harvest | tested |
| E-112 | RAG ingest walks `data/secrets` or promote writes recipes without Ask | compiler-os | tested |
| E-113 | Trust starter allowlists skip-unjail MCP or Stop is per-surface | compiler-os | tested |
| E-114 | Mid-turn tool add or harness `__proto__` evolve | structural-memory | tested |
| E-115 | DAP evidence path `..` / `/etc` or chrome depth includes DesktopCommander | agent-ide | tested |
| E-116 | Scene IR / DNA plan escapes `data/scene` or writes `.think.md` | compound-os | tested |
| E-117 | New harvest port kind `skip-unjail` into starter | resource-harvest | tested |
| E-118 | RAG `data/` skip walks `workspace/bug-memory` instead of `data/bug-memory` | compiler-os | tested |
| E-119 | `gitWorktreeAdd('../Secrets')` keeps a `..` path segment | compound-os | tested |
| E-120 | Mid-turn `reloadMcp` expands the frozen tool list | structural-memory | tested |
| E-121 | Mini App kernel runs register as telegram | compiler-os | tested |
| E-122 | Structural graph walks `AI Resources` or `..` paths | structural-memory | tested |
| E-123 | Harness `__proto__.verifyOk` or evolve required to persist VERIFY | structural-memory | tested |
| E-124 | DNA scaffold writes `.think.md` or leaves `RAG/plans/` | compound-os | tested |
| E-125 | Design fidelity note carries HTML | compound-os | tested |
| E-126 | Recipe prose becomes executable HTML/JS or selects a DNA output path | compound-os | tested |
| E-127 | Invalid/mismatched CapabilityIR reaches an emitter or writes an arbitrary artifact | compound-os | tested |
| E-128 | Generated API binds publicly, enables CORS, or accepts unbounded/extra-key JSON | compound-os | tested |
| E-129 | Generated desktop renderer gets Node/IPC, remote navigation, permissions, windows, or webviews | compound-os | tested |
| E-130 | Renderer TS payload escapes workspace, pollutes prototypes, or oversizes the LanguageService | ts-intel | tested |
| E-131 | Monaco rename writes sibling files without `writeFileSafe` / checkpoint review | ts-intel | tested |
| E-132 | Inspector binds `0.0.0.0`, launches extra-root, or evaluates `process`/`require` | node-inspect | tested |
| E-133 | Debug stop kills PTYs or spawn uses `node-pty` | node-inspect | tested |
| E-134 | Git gutter IPC accepts `..` / extra-root or paints hunk HTML | agent-ide | tested |
| E-135 | Workspace-symbol worker takes a renderer root/seq or runs on the Electron UI thread | ts-intel | tested |
| E-136 | Bottom tabs ignore Enter/Space or status says No problems while QA records exist | workbench-chrome | tested |
| E-137 | Inspector evaluate retries without `throwOnSideEffect` | node-inspect | tested |
| E-138 | File TS IPC blocks Electron main, or smoke fails hard on non-SUID chrome-sandbox | ts-intel | tested |
| E-139 | Bottom tabs, status, sidebar lists, or composer clip; page grid auto-places HxPage into a 0px track | workbench-chrome | tested |
