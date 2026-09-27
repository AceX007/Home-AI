# Features

| Slug | What | How made |
|------|------|----------|
| [workbench-shell](features/workbench-shell.md) | Electron workbench UI | Vite + React panes |
| [workbench-chrome](features/workbench-chrome.md) | Titlebar pulse, layout persist, split, explorer | `takeLayout` / `takeChromePulse` |
| [electron-ipc-fs](features/electron-ipc-fs.md) | Workspace-scoped FS/IPC | main `readFileSafe` |
| [rag-fts](features/rag-fts.md) | FTS memory | better-sqlite3 |
| [forge-hunt-prevent](features/forge-hunt-prevent.md) | Hunt+prevent+recipes | mods/full-stack-guard |
| [kernel-agent-loop](features/kernel-agent-loop.md) | PERCEIVE→REMEMBER | packages/agent |
| [repo-library](features/repo-library.md) | Roadmap, tests, edges, progress pane | RAG/library + LibraryPane |
| [design-fabric](features/design-fabric.md) | DesignIR + DTCG tokens + Design studio | runtime `applyDtcgToIr` |
| [code-design-mode](features/code-design-mode.md) | Claude Design–matching Code/Design studio | `apps/renderer/src/panes/design/` |
| [think-handoff](features/think-handoff.md) | Local Think / cloud Implement | `plan_write` + thinkPath |
| [activity-groups](features/activity-groups.md) | Agents sessions + grouped log + Background | `groupActivity` |
| [telegram-bridge](features/telegram-bridge.md) | Telegram + shared Home thread + skills/rules | `telegram-bridge.ts` |
| [telegram-miniapp](features/telegram-miniapp.md) | Telegram Mini App glass on the same kernel | `miniapp-server.ts` |
| [agents-stage](features/agents-stage.md) | Dock/Stage/Focus Agents chrome | `takeLayoutMode` + ChatPane |
| [tool-packs](features/tool-packs.md) | Core + keyword/slash packs; MCP not dumped | `detectToolPacks` |
| [subagents](features/subagents.md) | Explore/Bash/Browser/Research digests | `task` + `runSubagentJobs` |
| [compute-run](features/compute-run.md) | Jailed python/node compute | `compute_run` |
| [mcp-starter](features/mcp-starter.md) | Example MCP servers + handshake | `enableMcpStarter` |
| [resource-harvest](features/resource-harvest.md) | Backend-only AI Resources catalog + Blender MCP | `RESOURCE_HARVEST` + `takeMcpEnableOpts` |
| [home-os-life](features/home-os-life.md) | Notes, calendar, OCR, STT, TTS | `life-files.mjs` `voice.mjs` |
| [fs-extra-roots](features/fs-extra-roots.md) | Opt-in extra FS roots | `fsExtraRoots` + `jailPath` |
| [compute-plots](features/compute-plots.md) | Jailed plots + skill stamp cache | `assertPlotInside` + `knowledgeStamp` |
| [coder-sidecar](features/coder-sidecar.md) | Second GGUF on :8766; nested explore forge | `coderLlamaArgs` + `ownedLlamaPort` |
| [fleet-runtimes](features/fleet-runtimes.md) | Nested clones + website domains, bot fleet, `/fleet` | `stackForest` + `takeSiteDomain` |
| [workflow-thinking](features/workflow-thinking.md) | Shared Hunt/Verify/Critic workflow DTO | `takeWorkflow` + BackgroundTasks |
| [auto-review](features/auto-review.md) | Pre-tool Judge then classifier then human | `auto-review.mjs` + `decideTool` |
| [consumer-pack](features/consumer-pack.md) | Packaged roots, GGUF first-run, sandbox-on release | `takeAppRoots` + `takeGgufReady` |
| [compiler-os](features/compiler-os.md) | Unified PERCEIVE + promote + kernel Stop | `composePerceivePack` + `registerKernelRun` |
| [structural-memory](features/structural-memory.md) | Frozen tools, analog graph, harness mint | `freezeToolList` + `queryGraph` |
| [agent-ide](features/agent-ide.md) | LSP / DAP / git impact tools | `lspQuery` + `takeDapEvidence` |
| [ts-intel](features/ts-intel.md) | Jailed TS/JS LanguageService + Checks | `takeTsRequest` + Monaco providers |
| [node-inspect](features/node-inspect.md) | Loopback Node Inspector + Runtime pane | `takeDebugLaunch` + `NodeDebugHost` |
| [compound-os](features/compound-os.md) | CapabilityIR web/CLI/API/sandboxed desktop emitters | `compileCapabilityIr` + `emitDesktopShell` |
