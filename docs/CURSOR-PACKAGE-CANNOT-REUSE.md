# Cursor 3.17.21 package — what we cannot reuse

Source tree: `cursor_3.17.21_amd64/` (extracted `.deb`, Cursor `3.17.21-1787622916`, 2026-08-25).

This file is an **inventory + legal reason**, not a dump of their code. Nothing listed here is copied into Home AI. Implement the same *product surfaces* from [cursor.com/docs](https://cursor.com/docs) and MIT/npm upstreams. See [CURSOR-PARITY-PLAN.md](CURSOR-PARITY-PLAN.md).

---

## Legal basis (applies to every row unless noted)

Quoted from `usr/share/cursor/resources/app/LICENSE.txt` (Anysphere EULA, 2023-06-13):

| Clause | Effect |
| --- | --- |
| **§1.2** | License is limited, personal, **executable-form only**. Not a grant to reuse bits in another product. |
| **§1.3(a)** | No copy, modify, adapt, translate, **derivative works**, reverse engineer, disassemble, decompile, or discovering proprietary source / trade secrets. |
| **§1.3(b)** | No redistribute, sublicense, or ship their files inside Home AI. |
| **§2.1** | Software is licensed, not sold. IP stays with Anysphere or its licensors. |
| **§3** | Open-source *inside* the package keeps **its own** license — but we take that OSS from **upstream** (npm / github.com/microsoft/vscode), not by lifting Cursor’s patched tree. We cannot tell which bytes they changed. |

**Default rule:** if it ships in this `.deb` and is Anysphere-branded, compiled, or not clearly unmodified MIT from a public repo, **do not reuse it**.

---

## Whole product / Chromium shell

| Item | Path | Why we cannot reuse it |
| --- | --- | --- |
| Electron binary | `usr/share/cursor/cursor` (~203MB, Electron 40.10.3 / Chrome 144) | Anysphere’s signed Electron build. Not our app. Use **our** `electron` from npm (currently 35). |
| `chrome-sandbox` | `usr/share/cursor/chrome-sandbox` (SUID) | Chromium sandbox helper **from their install**. Copying a SUID helper from another vendor is wrong; we use Electron’s own sandbox (this kernel still needs `ELECTRON_DISABLE_SANDBOX=1`). |
| Crashpad | `chrome_crashpad_handler` | Their crash reporter → Cursor/Anysphere. Do not wire Home AI telemetry to it. |
| GPU / ICU / PAK | `libEGL.so`, `libGLESv2.so`, `libffmpeg.so`, `libvulkan.so.1`, `libvk_swiftshader.so`, `*.pak`, `icudtl.dat`, `snapshot_blob.bin`, `v8_context_snapshot.bin` | Chromium runtime **bundled with Cursor**. Comes with our Electron anyway. |
| Locales | `usr/share/cursor/locales/` | Cursor/VS Code chrome strings. Not our product. |
| CLI tunnels | `usr/share/cursor/bin/code-tunnel`, `bin/cursor-tunnel` (~20MB each) | Cursor/VS Code remote-tunnel services. Proprietary routing + their cloud. |
| `bin/cursor` launcher | `usr/share/cursor/bin/cursor` | Their CLI: routes `cursor agent` to `~/.local/bin/cursor-agent` and Cursor cloud. Shipping it would impersonate Cursor. |
| Package-manager stamp | `resources/cursor-package-manager` | Installer metadata for **their** updater. |
| Desktop / MIME / icon | `usr/share/applications/cursor*.desktop`, `pixmaps/co.anysphere.cursor.png`, `mime/packages` | **Trademark / branding** (`Cursor`, `co.anysphere.cursor`, `cursor://`). Write our own `.desktop` and icon. |
| AppArmor profile | `etc/apparmor.d/cursor-sandbox` | Written for **their** binary paths and sandbox helper. We author a Home AI profile if we ever ship one. |
| sysctl snippet | `etc/sysctl.d/50-cursor.conf` | Comments for **their** AppArmor 3 / userns story. Idea is public; the file is still their packaging. |
| Debian maintainer scripts | `DEBIAN/postinst`, `prerm`, `postrm`, `templates`, `control` | Install Cursor apt repo, `anysphere.gpg`, `/usr/bin/cursor`. Do not run or copy. (VS Code MIT installer *ideas* can be rewritten from `microsoft/vscode`.) |
| AppStream | `usr/share/appdata/cursor.appdata.xml` | Their store listing. |
| Completions | `resources/completions/{bash,zsh}` | Completes the **`cursor`** CLI. Write `homeai` completions later. |

---

## App core (closed + mixed)

| Item | Path | Why we cannot reuse it |
| --- | --- | --- |
| Main / CLI bundles | `resources/app/out/main.js`, `out/cli.js`, `out/bootstrap-fork.js` | Compiled Cursor workbench. Trade secret + EULA §1.3. |
| VS Code fork output | `resources/app/out/vs/**` | Microsoft MIT **plus Anysphere patches**. We cannot split the patches. Do not copy this tree. Use Monaco + our React shell. |
| `out/vs/glass` | `out/vs/glass/browser/**` | Cursor UI layer (effects worker, PDF viewer bits). Proprietary product UI. |
| NLS catalogs | `out/nls.messages.json`, `out/nls.keys.json` | Cursor-branded strings. |
| `product.json` | `resources/app/product.json` | Commit, gallery URLs, `updateUrl` (`api2.cursor.sh`), `aiConfig`, Statsig keys, extension tips. Secrets/config for **their** backend. Never copy. |
| `package.json` | `resources/app/package.json` | Declares product `Cursor` / Anysphere. |
| `node_modules.asar` | `resources/app/node_modules.asar` | Extra packed modules. Closed bundle. |
| EULA | `LICENSE.txt` | Governs **their** software. Keep it with the `.deb`; do not relicense. |
| Third-party notices | `ThirdPartyNotices.txt` | Attribution for **their** distribution, not a license for us to vendor their tree. |

---

## Proprietary native helpers

| Item | Path | Why we cannot reuse it |
| --- | --- | --- |
| Agent sandbox | `resources/app/resources/helpers/cursorsandbox` | Closed sandbox binary. EULA + we must not ship their security boundary. Approvals in our code instead (this kernel has no Landlock). |
| `crepectl` | `resources/app/resources/helpers/crepectl` | Closed helper (Cursor-specific). No public license. |
| Bundled Node | `resources/app/resources/helpers/node` (~125MB) | Their Node for agent/worker. Use system/`electron` Node. |
| `cursor-proclist` | `node_modules/cursor-proclist` (`*.node`) | Private native addon (`"private": true`). Process listing for their agent. Use `/proc` or `ps` ourselves. |
| `@anysphere/policy-watcher` | `node_modules/@anysphere/policy-watcher` | Version `1.3.2-cursor.2` — **Cursor-patched** native. Upstream `vscode-policy-watcher` is MIT; take **that** from GitHub if we ever need enterprise policy files, not this binary. |

---

## `cursor-*` extensions (all closed)

All live under `resources/app/extensions/`. `package.json` is metadata only; **`dist/` is not reusable**.

| Extension | What it is (from their description) | Why we cannot reuse it |
| --- | --- | --- |
| `cursor-agent-host` | Agent orchestration in AgentExec host | Core product. Independent Forge loop. |
| `cursor-agent-exec` | Tools, files, shell, **approvals** | Core product. Our `tools.ts` + permissions. |
| `cursor-agent-worker` | Worker install/run | Their worker protocol. Our child processes. |
| `cursor-local-agent-runtime` | Private inference **outside** workspace host | Tab/local models. Our llama-server. |
| `cursor-retrieval` | Indexing, grep client, `.cursorignore` / `.cursorindexingignore` | Instant Grep / index is their service + local client. Our FTS5 + ripgrep from npm. |
| `cursor-file-service` | Indexing/retrieval support | Same as retrieval. |
| `cursor-mcp` | MCP host (pins `@modelcontextprotocol/sdk` 1.25.1) | Their host. We depend on the **public** MCP SDK. |
| `cursor-browser-automation` | Browser automation MCP | Their CDP/MCP server. Our BrowserView tools. |
| `cursor-shadow-workspace` | Isolated / shadow workspace | Worktrees implemented via `git worktree`, not their extension. |
| `cursor-checkout` | Branch migration checkout provider | Their SCM integration. |
| `cursor-always-local` | Local experiments; `.cursor/permissions.json` + `environment.json` **schemas**; commit-message hook | Extension JS is closed. File **formats** are a public contract we implement ourselves (do not copy their `dist/`). |
| `cursor-resolver` | `background-composer` remote authority (`cloud-agent` suffix) | Cloud Agents as VS Code remote. We use their **public HTTP API** only. |
| `cursor-resolver-helper` | Connection tokens for that resolver | Auth to their cloud. Never copy. |
| `cursor-socket` | TCP/TLS for those remotes | Same. |
| `cursor-polyfills-remote` | Workspace-host polyfills for remotes | Their fork internals. |
| `cursor-explorer` | Cursor Explorer workspace ext | Their UI. |
| `cursor-commits` | Request/commit metrics | Telemetry to Cursor. Do not reuse. |
| `cursor-deeplink` | `cursor://` URIs | Their URL protocol. Ours would be `homeai://`. |
| `cursor-ndjson-ingest` | HTTP ingest → `.cursor/debug.log` | Their debug server. We write debug logs in-process. |
| `cursor-worktree-textmate` | TextMate grammars for `.cursor/worktrees/**` without LSPs | Their grammars/bundle. Monaco: disable semantic highlight on those paths; use our/Monaco language IDs. |
| `theme-cursor` | Cursor Dark/Light/Midnight/HC/colorblind themes | **Brand + copyright** color themes. Ship our own theme. |

---

## Branding, telemetry, cloud

| Item | Why we cannot reuse it |
| --- | --- |
| Name, logo, `cursor://`, `co.anysphere.cursor` | Trademark. |
| `theme-cursor` colors/icons, tray PNGs under `resources/linux`, `tray-status` | Copyright + brand. |
| `updateUrl` / `backupUpdateUrl` / `extensionsGallery` | Their update + marketplace. |
| `aiConfig.ariaKey`, Statsig client key / log proxy | Their analytics. Do not embed. |
| Cloud Agent VM snapshot fields in `environment.json` | Schema we may **speak**; their snapshot IDs and control plane we do not ship. |
| `cursor-agent` CLI install from `cursor.com/install` | Separate closed CLI. Not this `.deb`, still not ours. |

---

## Mixed / OSS-looking — still do not lift from this folder

These appear in the tree but are either patched, bundled with Cursor, or easier/safer from upstream:

| Item | In the `.deb` | What we do |
| --- | --- | --- |
| VS Code language extensions (`git`, `typescript-language-features`, `python`, …) | MIT-origin, **Cursor-built** | Need a language feature? Take **microsoft/vscode** or a marketplace extension under its license — not this copy. |
| `simple-browser` | MIT vscode | Idea: in-app browser. We already have Electron `BrowserView`. |
| `@vscode/ripgrep` `bin/rg` | MIT tooling, their build | `npm i @vscode/ripgrep` or system `rg`. |
| `node-pty`, `@xterm/*`, `vscode-oniguruma`, `vscode-textmate` | OSS | We already depend on pty/xterm from npm. |
| `@vscode/sqlite3`, `@vscode/spdlog`, native-keymap, parcel watcher | VS Code natives | We use `better-sqlite3` + `chokidar`. |
| Chromium `LICENSES.chromium.html` | Chromium licenses | Electron’s package already covers this for **our** Electron. |

---

## What this file is for

When implementing Home AI:

1. **Do not** copy, vendor, or decompile anything in the table.
2. **Do** match public docs and on-disk names (`.cursor/rules`, `permissions.json` fields, `mcp.json`).
3. **Do** pull MCP, ripgrep, pty, xterm, Monaco from npm.
4. Keep `cursor_3.17.21_amd64/` out of git (local reference only).
