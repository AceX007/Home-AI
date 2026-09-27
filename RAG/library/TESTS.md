# Tests

Required tests for this repo. Status: `required` (must write) | `done` (file exists) | `missing` (path listed but file gone). Not a test runner.

| id | proves | feature | status | path |
|----|--------|---------|--------|------|
| T-01 | `../` and extra-root paths denied in `assertInside` | electron-ipc-fs | done | `packages/runtime/src/paths.test.mjs` |
| T-02 | new `ipcMain.handle` for fs uses `readFileSafe` | electron-ipc-fs | done | `packages/runtime/src/search-proof.test.mjs` |
| T-03 | skill loader skips `reference/` and `AGENT_SNIPPET.md` | forge-hunt-prevent | done | `packages/runtime/src/search-proof.test.mjs` |
| T-04 | `kindFromPath` maps `RAG/library/` to `library` | rag-fts | done | `packages/runtime/src/search-proof.test.mjs` |
| T-05 | ship without recipe log is treated incomplete (skill contract) | forge-hunt-prevent | done | `packages/runtime/src/search-proof.test.mjs` |
| T-06 | explore-first rule is `alwaysApply` | kernel-agent-loop | done | `packages/runtime/src/search-proof.test.mjs` |
| T-07 | `STATUS.md` counts match TESTS/EDGES tables | repo-library | done | `packages/runtime/src/search-proof.test.mjs` |
| T-08 | Library pane reads `STATUS.md` via existing `homeai.read` | repo-library | done | `packages/runtime/src/search-proof.test.mjs` |
| T-09 | DTCG ingest jails path, maps aliases, skips remote `$value` | design-fabric | done | `packages/runtime/src/dtcg.test.mjs` |
| T-10 | Cloud agent id cannot change the agents URL; summaries only | workbench-shell | done | `packages/runtime/src/cursor-jobs.test.mjs` |
| T-11 | Profile patch is own-key; markup and unknown enums dropped | telegram-bridge | done | `packages/runtime/src/profile.test.mjs` |
| T-12 | Think doc jail, required headings, HTML reject, key redact | think-handoff | done | `packages/runtime/src/think.test.mjs` |
| T-13 | Activity fold labels strip markup; running count does not double busy+wait | activity-groups | done | `packages/runtime/src/activity.test.mjs` |
| T-14 | Code-tab CSS and style maps reject url/html/__proto__; storefront IR validates | code-design-mode | done | `packages/runtime/src/design-style.test.mjs` |
| T-15 | publicToolCall drops arguments; tool names are allowlisted | activity-groups | done | `packages/runtime/src/activity.test.mjs` |
| T-16 | git pull is ff-only and git push is upstream-only; extra remotes/refs rejected | electron-ipc-fs | done | `packages/runtime/src/git-safe.test.mjs` |
| T-17 | Overlay drafts keep sibling nodes; comment pins strip markup; compileReactStyle drops url() | code-design-mode | done | `packages/runtime/src/design-draft.test.mjs` |
| T-18 | Undo overlay clone is own-key; ingest with no/empty path stays in designs/*.json | code-design-mode | done | `packages/runtime/src/design-draft.test.mjs` |
| T-19 | Overlay merge / sanitizeDraft / cloneOverlay drop url(); layerRows nests without cycles/proto | code-design-mode | done | `packages/runtime/src/design-draft.test.mjs` |
| T-20 | Think status bump is ready→implementing only; open-path jail | think-handoff | done | `packages/runtime/src/think.test.mjs` |
| T-21 | Code-tab css drafts persist per node id; no __proto__ keys | code-design-mode | done | `packages/runtime/src/design-draft.test.mjs` |
| T-22 | Thread ids jailed; turns strip markup; telegram chat binds once | telegram-bridge | done | `packages/runtime/src/conversations.test.mjs` |
| T-23 | Pairing hash + TTL; strangers denied; progress has no tool args | telegram-bridge | done | `packages/runtime/src/telegram-auth.test.mjs` |
| T-24 | Skills/rules write only under RAG trees; HTML rejected | telegram-bridge | done | `packages/runtime/src/knowledge-write.test.mjs` |
| T-25 | Agent default is core-only (no MCP dump); all-packs + think/ask/plan gates; public rows drop URLs | tool-packs | done | `packages/runtime/src/tool-surface.test.mjs` |
| T-26 | Group/supergroup: paired `/do` works; strangers and room chatter ignored; `/pair` refused; group thread does not steal Home | telegram-bridge | done | `packages/runtime/src/telegram-router.test.mjs`, `conversations.test.mjs` |
| T-27 | HOME chrome strips markup; no parse_mode; dock allowlist; callback ids jailed | telegram-bridge | done | `packages/runtime/src/telegram-chrome.test.mjs` |
| T-28 | initData HMAC + TTL; Mini App URL jail; body action allowlist; menu button jail | telegram-miniapp | done | `packages/runtime/src/telegram-initdata.test.mjs` |
| T-29 | Mini App hub remembers runs only; strips tool args; pulse done/hold | telegram-miniapp | done | `packages/runtime/src/miniapp-hub.test.mjs` |
| T-30 | Inbox drop jails name/ext/magic; SVG/HTML/PHP/`../` rejected | telegram-miniapp | done | `packages/runtime/src/inbox.test.mjs` |
| T-31 | Mini App body allowlist: glance/steer/implement/use/inbox jails | telegram-miniapp | done | `packages/runtime/src/telegram-initdata.test.mjs` |
| T-32 | Export frame strips markup/non-hex; handle deltas clamp and ignore proto keys | code-design-mode | done | `packages/runtime/src/design-export.test.mjs` |
| T-33 | `/mind` / Local / Cursor allowlist; unknown mind denied; photos jail file_id | telegram-bridge | done | `packages/runtime/src/telegram-router.test.mjs` |
| T-34 | takeMind / pickForgeProvider / health DTO drop secrets and paths | telegram-bridge | done | `packages/runtime/src/mind.test.mjs` |
| T-35 | Telegram file id/path jail; Mini App provider allowlist | telegram-miniapp | done | `packages/runtime/src/telegram-api.test.mjs`, `telegram-initdata.test.mjs` |
| T-36 | `/manage` and Manage dock open the control room; nav allowlist | telegram-bridge | done | `packages/runtime/src/telegram-router.test.mjs`, `telegram-chrome.test.mjs` |
| T-37 | Session DTO drops token/hash/proto; live and thread ids jailed | telegram-bridge | done | `packages/runtime/src/telegram-session.test.mjs` |
| T-38 | Layout persist drops `../`, secrets, proto; file is always `data/workbench.json` | workbench-chrome | done | `packages/runtime/src/workbench-chrome.test.mjs` |
| T-39 | Kernel pulse/ports drop keys and URLs; command/fs names allowlisted | workbench-chrome | done | `packages/runtime/src/workbench-chrome.test.mjs` |
| T-40 | Design slug jail; seed IR validates; markup stripped from brief | code-design-mode | done | `packages/runtime/src/design-path.test.mjs` |
| T-41 | layoutMode/density allowlisted; stage chatW cap; llama health DTO strips paths | agents-stage | done | `packages/runtime/src/workbench-chrome.test.mjs` |
| T-42 | compact thought fold; review hunks jail `..`; lane tokens allowlist | agents-stage | done | `packages/runtime/src/activity.test.mjs` |
| T-45 | capture/session names strip markup; last-active ago is numeric | agents-stage | done | `packages/runtime/src/activity.test.mjs` |
| T-43 | sessionTitle/chatLink/filterTranscript/splitHuntVerify jail markup and ids | activity-groups | done | `packages/runtime/src/activity.test.mjs`, `conversations.test.mjs` |
| T-44 | keepCanvasFocus across page growth; takePage rejects HTML names | code-design-mode | done | `packages/runtime/src/design-draft.test.mjs`, `designir.test.mjs` |
| T-46 | chromeRoute exclusive design or cowork or code; layoutMode strings are not cowork; phasePips clamp | activity-groups | done | `packages/runtime/src/activity.test.mjs`, `packages/runtime/src/stage-chrome.test.mjs` |
| T-47 | forgeForDesign remints cursor off Design; loop is get/patch/ingest; missing keys fall back without leaking secrets | code-design-mode | done | `packages/runtime/src/mind.test.mjs`, `packages/runtime/src/tool-surface.test.mjs` |
| T-48 | irGrew detects page/node growth; dead comment pins keep needs-re-anchor without HTML | code-design-mode | done | `packages/runtime/src/design-path.test.mjs`, `packages/runtime/src/design-draft.test.mjs` |
| T-49 | takePinnedChats jails ids; chat-1 allowed; markup and `../` dropped | agents-stage | done | `packages/runtime/src/workbench-chrome.test.mjs` |
| T-50 | shouldCloseThink only when hadError === false; error chunks are not text | think-handoff | done | `packages/runtime/src/think.test.mjs` |
| T-51 | stageCard strips markup; /stage + dock Stage/Trust jailed; no Hunt/Landlock claims | telegram-bridge | done | `packages/runtime/src/telegram-chrome.test.mjs`, `telegram-router.test.mjs` |
| T-52 | progressCard FAULT on error chunks; no token counts from text.length | telegram-bridge | done | `packages/runtime/src/telegram-progress.test.mjs` |
| T-53 | chromeRoute only design or cowork or code; thinkPick jails docs; lastForgeError/forgeIsFault | agents-stage | done | `packages/runtime/src/stage-chrome.test.mjs` |
| T-54 | Go strip peeks jail skill slashes and tool names; dock New/Skills; Mini App skills action | agents-stage | done | `packages/runtime/src/stage-chrome.test.mjs`, `telegram-chrome.test.mjs`, `telegram-initdata.test.mjs` |
| T-55 | designTask + parseQwenToolCalls grow IR; toolsForDesign drops explore; shop wording is not PhoneCanvas | code-design-mode | done | `packages/runtime/src/design-generate.test.mjs` |
| T-56 | gitPushArgv is `['push']` only | electron-ipc-fs | done | `packages/runtime/src/git-safe.test.mjs` |
| T-57 | ragWriteRel plans is human `.md`, never `.think.md`; Plan mode keeps rag_write | think-handoff | done | `packages/runtime/src/knowledge-write.test.mjs`, `tool-surface.test.mjs` |
| T-58 | grep query/hits jail newlines, `../`, extra-root, and HTML | rag-fts | done | `packages/runtime/src/search-proof.test.mjs` |
| T-59 | takeCowork is boolean-only; missing stays true | workbench-chrome | done | `packages/runtime/src/workbench-chrome.test.mjs` |
| T-60 | takeCrumbs drops `../`, markup, and non-strings | workbench-chrome | done | `packages/runtime/src/workbench-chrome.test.mjs` |
| T-61 | Truncated 2B JSON / extra page fields coerce to RFC ops; publicDesignEnvelope drops `_raw` | code-design-mode | done | `packages/runtime/src/design-generate.test.mjs`, `designir.test.mjs` |
| T-62 | `/pack` and keywords activate packs; `filterToolsByPack` drops research without pack | tool-packs | done | `packages/runtime/src/tool-surface.test.mjs` |
| T-63 | `task` parse + digest + nested jobs; think bash denied; max 4 | subagents | done | `packages/runtime/src/subagent.test.mjs`, `spawn-workers.test.mjs` |
| T-64 | `compute_run` node math, timeout, fetch denied; python `os.system` denied; script rel has no `..` | compute-run | done | `packages/runtime/src/compute.test.mjs` |
| T-65 | MCP HTTP initialize + tools/list fixture; starter merge drops proto | mcp-starter | done | `packages/runtime/src/mcp-http.test.mjs`, `mcp-packs.test.mjs` |
| T-66 | notes/calendar names jailed; inbox_ocr path must be data/inbox; HTML extract strips tags | home-os-life | done | `packages/runtime/src/life-files.test.mjs` |
| T-67 | extra-root jail; load patch drops `/` and `*`; autoRun markup/proto dropped | fs-extra-roots | done | `packages/runtime/src/paths.test.mjs`, `policy.test.mjs` |
| T-68 | VERIFY_TOOLS is str_replace/debug_log/ask_user; `takeVerifyCalls` drops terminal_run | kernel-agent-loop | done | `packages/runtime/src/tool-surface.test.mjs` |
| T-69 | coderLlamaArgs host/port/ctx/ngl; GGUF name jail; nested forge skipped without callback; skipVerify flags skip critic | coder-sidecar | done | `packages/governor/src/coder-args.test.mjs`, `packages/runtime/src/subagent.test.mjs` |
| T-70 | plot rel has no `..`; `assertInside`/`assertPlotInside` reject escape; png kept, script unlinked | compute-plots | done | `packages/runtime/src/compute.test.mjs` |
| T-71 | `knowledgeStamp` changes when a jailed SKILL.md, root AGENTS.md, or workspace `.cursor/skills` mtime changes; `reference/` and orphan trees ignored | compute-plots | done | `packages/runtime/src/compute.test.mjs` |
| T-72 | sidecar does not attach to a foreign listener; infill/nested forge need owned running port | coder-sidecar | done | `packages/llm/src/sidecar-own.test.mjs` |
| T-73 | fleet repo rel/recipe/clone URL jail; snapshot drops tokens; smtp host allowlist; host has no exec() | fleet-runtimes | done | `packages/runtime/src/fleet.test.mjs`, `git-safe.test.mjs` |
| T-74 | extra-root `root` id is folder basename; path/`__proto__`/object/collision denied | fs-extra-roots | done | `packages/runtime/src/paths.test.mjs` |
| T-75 | Think/extra-pack schema shrink; skill `web` substring is not research; `verifyUserPrompt` forbids test_run | tool-packs | done | `packages/runtime/src/tool-surface.test.mjs` |
| T-76 | compute `open`/`Path`/`os.open`/node `fs` cannot read `data/secrets`; `Figure.savefig` stays under plots | compute-run | done | `packages/runtime/src/compute.test.mjs` |
| T-77 | OCR image ext only; HTML extract second pass; research URL uses `web_extract`; Explore finished | home-os-life | done | `packages/runtime/src/life-files.test.mjs`, `subagent.test.mjs` |
| T-78 | `takeVerifyPatch` is workspace-relative; extra-root and `data/secrets` omitted; `takeVerifyDiff` is a jailed workspace git diff | kernel-agent-loop | done | `packages/runtime/src/tool-surface.test.mjs` |
| T-79 | compute writes stay in runs/plots; `chdir` denied; ESM named `readFileSync` cannot read `data/secrets` | compute-run | done | `packages/runtime/src/compute.test.mjs` |
| T-80 | compute `os.rename`/`shutil` cannot write `packages/`; named `fs/promises` cannot read secrets | compute-run | done | `packages/runtime/src/compute.test.mjs` |
| T-81 | `inbox_stt` jails svg/secrets; missing whisper is generic; inbox ogg magic accepted | home-os-life | done | `packages/runtime/src/voice.test.mjs`, `inbox.test.mjs` |
| T-82 | `speak` wav rel has no `..`; life pack opens on voice note; `inbox_stt` not on core | home-os-life | done | `packages/runtime/src/voice.test.mjs`, `tool-surface.test.mjs` |
| T-83 | STATUS meters count exact status cells when prove text contains pipes | repo-library | done | `packages/runtime/src/search-proof.test.mjs` |
| T-84 | `/fleet` clone/add jails; `removeSub` saves subscribers; fleet card drops tokens | fleet-runtimes | done | `packages/runtime/src/fleet.test.mjs`, `telegram-router.test.mjs` |
| T-85 | `takeWorkflow` jails `wf_` id/title; mismatched runId dropped; no markup | workflow-thinking | done | `packages/runtime/src/activity.test.mjs` |
| T-86 | Critic lane from VERIFY critic pass, not ACT `str_replace`; skipVerify is skipped | workflow-thinking | done | `packages/runtime/src/activity.test.mjs` |
| T-87 | Tokens from SSE usage only; `publicTokens` allows `1.7M`; markup rejected | workflow-thinking | done | `packages/runtime/src/activity.test.mjs` |
| T-88 | Stage/Glance/progress print Hunt/Verify/Critic from the same DTO | workflow-thinking | done | `packages/runtime/src/telegram-chrome.test.mjs`, `miniapp-hub.test.mjs`, `telegram-progress.test.mjs` |
| T-89 | Usage before `tool_call` fills that agent; empty critic statuses skip; stopped runs seal; desktop owns matching rid | workflow-thinking | done | `packages/runtime/src/activity.test.mjs` |
| T-90 | Ask blocks speak/stt/ocr/browser reads; missing life bins drop tools; web_search jails DDG URL | tool-packs | done | `packages/runtime/src/tool-surface.test.mjs`, `search-proof.test.mjs` |
| T-91 | Skill YAML `description: >-` folds to text; proto keys and markup dropped | forge-hunt-prevent | done | `packages/runtime/src/front-matter.test.mjs` |
| T-92 | Judge allow git status compound; ask `$()`/env; deny `rm -rf /` and `cat /etc/passwd` | auto-review | done | `packages/runtime/src/auto-review.test.mjs` |
| T-93 | Combinator flowchart; proto-key JSON dropped; block_instructions ask; allow_instructions cannot save too_destructive; clamp `auto-review` | auto-review | done | `packages/runtime/src/auto-review.test.mjs`, `policy.test.mjs` |
| T-94 | Site domain hostname-only; `cloneOf` forest; `/fleet fork` + Mini App `fleet-fork`; clone dest `data/fleet/clones/<id>` | fleet-runtimes | done | `packages/runtime/src/fleet.test.mjs`, `telegram-router.test.mjs`, `telegram-initdata.test.mjs` |
| T-95 | Auto-review MCP always Ask; empty Trust instructions persist null; Health stageCard gets autoReviewLine | auto-review | done | `packages/runtime/src/policy.test.mjs`, `auto-review.test.mjs` |
| T-96 | ESM `createWindow` uses `import.meta.url`; vite watch ignore; renderer off Node runtime barrels | workbench-shell | done | `packages/runtime/src/electron-dev-boot.test.mjs` |
| T-97 | Activity ids route a real sidebar/center; leaving browser clears overlay; Design studio CSS beats chat-off | workbench-shell | done | `packages/runtime/src/pane-route.test.mjs` |
| T-98 | Stage page layout is not 0.28fr; Notes uses `setActivity`; list activities keep a sidebar | workbench-shell | done | `packages/runtime/src/pane-route.test.mjs` |
| T-99 | Chat home HxEmpty is text nodes; `projectTag` is Hex AI; composer Review not two ghosts; editor empty HxEmpty; window title Hex AI | workbench-chrome | done | `packages/runtime/src/hex-chrome.test.mjs` |
| T-100 | Page panes wrap HxPage without pane-head; sidebars HxSideHead; Maps center is canvas-only; no MCP URL paint | workbench-chrome | done | `packages/runtime/src/hex-chrome.test.mjs` |
| T-101 | Palette/quick-open empty copy is text; PlanDoc has no innerHTML; StageGo stays off Chat pills; 0.28fr absent; Review grouping and HxPage stay | workbench-chrome | done | `packages/runtime/src/hex-chrome.test.mjs` |
| T-102 | Overlay pops, session/file-tree/browser empties, and disabled shape tools stay Hex text; no cd-avatar; no Agent 0/0; potato skips pop motion | workbench-chrome | done | `packages/runtime/src/hex-chrome.test.mjs` |
| T-103 | `.send` is not `#007acc`/`#0e639c`; studio save not `#82b1ff`; unused `.pane-head` CSS gone; Terminal Checks/Kernel log/Workflow; Review/HxPage/0.28fr stay | workbench-chrome | done | `packages/runtime/src/hex-chrome.test.mjs` |
| T-104 | `.send-round` is `--amber` not `#fff`; listed chrome hexes gone from global.css/studio.css; xterm ANSI left; Review/HxPage/0.28fr/pane-head/Terminal labels stay | workbench-chrome | done | `packages/runtime/src/hex-chrome.test.mjs` |
| T-105 | hx-form/hx-card on Settings/Telegram/Fleet/Mods; DesignHome has no CHOOSE A TEMPLATE; crumbs use takeCrumbPrefix; GotoSymbol text; no fs:stat; activity aria-label | workbench-chrome | done | `packages/runtime/src/hex-chrome.test.mjs` |
| T-106 | App vs profile vs workspace jail; GGUF dest; library stub day; secret names | consumer-pack | done | `packages/runtime/src/app-roots.test.mjs` |
| T-107 | GGUF URL host+name; `.partial`; size/checksum; sha256 suffix jail; hardware gate; diagnostics drop tokens | consumer-pack | done | `packages/runtime/src/pack-chrome.test.mjs` |
| T-108 | Preload is homeai-only; hunt diffs need AP or test | consumer-pack | done | `packages/runtime/src/pack-chrome.test.mjs` |
| T-109 | `sandbox: true`; prod scripts omit ELECTRON_DISABLE_SANDBOX; electron-updater; smoke script | consumer-pack | done | `packages/runtime/src/electron-pack.test.mjs` |
| T-110 | Builder excludes AI Resources/secrets/GGUF; legal files; SHA-pinned CI; Settings Download GGUF; HEX_LLAMA_ASSET; no Onboard overlay | consumer-pack | done | `packages/runtime/src/electron-pack.test.mjs` |
| T-111 | Titlebar/llama/About use tokens; About is hx-card; WorkbenchShell does not mount Onboard | workbench-chrome | done | `packages/runtime/src/hex-chrome.test.mjs` |
| T-112 | Sandboxed `createWindow` loads CJS `preload/index.js`, not ESM `.mjs` | workbench-shell | done | `packages/runtime/src/electron-dev-boot.test.mjs` |
| T-113 | Agents thread is `1fr`; cowork empty hides editor; no 3-col squeeze | workbench-shell | done | `packages/runtime/src/pane-route.test.mjs` |
| T-114 | List/page hide Agents session rail; Maps center is canvas-only; chat width capped | workbench-shell | done | `packages/runtime/src/pane-route.test.mjs` |
| T-115 | Harvest catalog covers AI Resources dirs; starter never auto DesktopCommander/gitmcp/uvx | resource-harvest | done | `packages/runtime/src/resource-harvest.test.mjs` |
| T-116 | Perceive pack + AP kind jail + promote Ask + starter trust + design think + one Stop | compiler-os | done | `packages/runtime/src/compiler-os.test.mjs` |
| T-117 | Frozen tools, analog graph callers, curator Ask, harness own-key / VERIFY persist | structural-memory | done | `packages/runtime/src/compiler-os.test.mjs` |
| T-118 | LSP/DAP/git impact/chrome depth stay jailed | agent-ide | done | `packages/runtime/src/compiler-os.test.mjs` |
| T-119 | Mesh, scene jail, ACP name, HITL cap, DNA scaffold, fidelity, outcome route | compound-os | done | `packages/runtime/src/compiler-os.test.mjs` |
| T-120 | Harvest ports analog/port/next; autoRun honored; Trust lane | compiler-os | done | `packages/runtime/src/compiler-os.test.mjs` |
| T-121 | DNA recipe metadata compiles to jailed CSP HTML/CSS/JS without executable interpolation | compound-os | done | `packages/runtime/src/compiler-os.test.mjs` |
| T-122 | CapabilityIR own-key validation precedes deterministic web/CLI emission and exact path allowlisting | compound-os | done | `packages/runtime/src/compiler-os.test.mjs` |
| T-123 | Generated loopback API enforces bind, JSON schema, body cap, error codes, and ephemeral-port live flow | compound-os | done | `packages/runtime/src/compiler-os.test.mjs` |
| T-124 | Desktop emitter uses sandboxed local main and frozen CJS preload bridge without Node/IPC in renderer | compound-os | done | `packages/runtime/src/compiler-os.test.mjs` |
| T-125 | Renderer transitive imports never reach Node runtime barrels or a TS LanguageService host | workbench-shell | done | `packages/runtime/src/electron-dev-boot.test.mjs` |
| T-126 | Jailed LanguageService: overlays, definitions, rename edits, traversal/oversized/proto denied | ts-intel | done | `packages/ts-intel/src/index.test.mjs` |
| T-127 | `homeai:ts:*` uses `takeTsRequest`; rename writes via `writeFileSafe` + checkpoint; renderer type-only ts-intel | ts-intel | done | `packages/runtime/src/electron-dev-boot.test.mjs` |
| T-128 | Inspector hits a jailed breakpoint, exposes a primitive, continues, stops; extra-root/public WS/eval denied | node-inspect | done | `packages/debug/src/index.test.mjs` |
| T-129 | `homeai:debug:*` uses `takeDebugLaunch`; spawn is `child_process`; renderer debug import denied; git lines use pathspecs | node-inspect | done | `packages/runtime/src/electron-dev-boot.test.mjs` |
| T-130 | `parseGitLineChanges` marks added lines and drops `..` paths; VERIFY extras redact HTML/secrets | agent-ide | done | `packages/runtime/src/git-safe.test.mjs` |
| T-131 | Workspace symbols cancel a stale generation and run in `worker_threads`; worker has no renderer root | ts-intel | done | `packages/ts-intel/src/index.test.mjs` |
| T-132 | Smoke skips non-SUID chrome-sandbox; does not set ELECTRON_DISABLE_SANDBOX on ide | consumer-pack | done | `packages/runtime/src/pack-chrome.test.mjs` |
| T-133 | Workbench rows/lists/tabs/composer scroll instead of clipping; page/list/Browser hide duplicate pane-tab | workbench-chrome | done | `packages/runtime/src/hex-chrome.test.mjs` |
