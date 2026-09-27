# Phase 1 — Judge (deterministic, no LLM)

Depends on: `01`. Outputs: `packages/runtime/src/auto-review.mjs` (+ `.d.ts`). Tests land in phase 08 but write assertions against these symbols.

## Goal

Accept as many **fully understood safe argv** as possible without an LLM. Anything not modeled is **not allow**. Too-destructive and secret/abs reads are **deny**. This is an allowlist of shapes, not a bash parser.

## New file

`packages/runtime/src/auto-review.mjs`

Exports (names are load-bearing — tests and main import these):

```
judgeShell(command) → { verdict: 'allow'|'ask'|'deny', reason: string }
runAutoReviewPipeline(opts) → AutoReviewReport
publicAutoReviewLine(report) → string
lastAutoReviewLine(log) → string
takeRelativePath(s) → string | null
splitSafeAnd(command) → string[] | null
```

Also used later: `combineAxes`, `parseReviewerAxes`, `takeReviewerTranscript`, `reviewerUserPrompt`, `instructionHit` — may live in the same file (phases 02–03) so there is **one** module.

`packages/runtime/src/auto-review.d.ts` — match exports. No `any` on public report fields.

Re-export from `packages/runtime/src/index.ts` next to `decideTool`.

## Report type (closed)

```
AutoReviewReport = {
  stage: 'judge' | 'reviewer'
  verdict: 'allow' | 'ask' | 'deny'
  reason: ReasonToken
  risk: '' | 'low' | 'high' | 'too_destructive'
  authorization: '' | 'explicitly_no' | 'neutral' | 'explicitly_yes'
  correctness: '' | 'ok' | 'quoting_error' | 'unknown'
}
```

`ReasonToken` closed set (if unknown, coerce to `unmodeled`):

```
safe-git safe-read safe-test safe-npx safe-life safe-compute
workspace-write read net-allow extra-root
unmodeled env quote pipe powershell cd sudo
destructive abs-path secrets
block-instruction allow-instruction
axes json llama-off net-unknown bad-url
```

`publicAutoReviewLine(report)`:

```
stripActivityText(`auto-review · ${stage} · ${verdict} · ${reason}`, 80)
```

`stage` only `judge`|`reviewer`. `verdict` only `allow`|`ask`|`deny`.

`lastAutoReviewLine(log)`: walk array from the end; first item with `kind === 'status'` (or `type === 'status'`) whose `text` starts with `auto-review ·`; return `stripActivityText(text, 80)` else `''`.

## `runAutoReviewPipeline(opts)` order

`opts = { perms, permission, tool, detail, extraRoot, axes? }`

1. If `extraRootWriteAsks(permission, extraRoot)` → `{ stage:'judge', verdict:'ask', reason:'extra-root' }`. Stop. Do not classify.
2. If `permission === 'read'` → allow `read`.
3. If `permission === 'write'` → allow `workspace-write` (extra-root already handled).
4. If `permission === 'net'`:
   - `urlAllowed(detail, perms.netAllowlist)` → allow `net-allow`.
   - else if `parseHttpUrl(detail)` is null → deny `bad-url`.
   - else → ask `net-unknown` (Classify may upgrade later).
5. If `permission === 'exec'` → named-tool shortcuts (below), else `judgeShell(detail)`.
6. Judge `allow` + `instructionHit(detail, perms.autoReview.block_instructions)` → treat as review-stage ask `block-instruction` (combinator still denies too_destructive if axes say so; judge allow of `rm -rf /` must never happen).
7. Judge `deny` → report deny, stage `judge`.
8. Judge `ask` / unmodeled → if `opts.axes` present, `combineAxes(axes, report)`; else ask `unmodeled` (or the judge reason).

Do not call an LLM inside this function. Classify is a caller that passes `axes`.

## Named-tool shortcuts (before argv parse)

Use `opts.tool` + `opts.detail`. These are **not** shell.

| tool | detail (from `toolApprovalDetail`) | verdict | reason |
|---|---|---|---|
| `test_run` | `auto`, `npm`, `pytest`, `test_run`, `npm test`, empty | allow | `safe-test` |
| `speak` | `speak` | allow | `safe-life` |
| `inbox_stt` | `inbox_stt` | allow | `safe-life` |
| `inbox_ocr` | `inbox_ocr` | allow | `safe-life` |
| `compute_run` | `/^compute_run (python\|node)$/` | allow | `safe-compute` |
| `task` | any | ask | `unmodeled` |
| `git_worktree` | `git worktree list` | run through `judgeShell` | |
| `git_worktree` | starts with `git worktree add` | ask | `unmodeled` |

If `test_run` detail is a free-form command string, **do not** shortcut — `judgeShell` it.

## `judgeShell(command)` — capability extract

Input: string. Trim. Empty → ask `unmodeled`. Cap length **2000**; longer → ask `unmodeled`.

### Hard deny (`too_destructive` / secrets) — check on the **raw** string first

Normalize: collapse whitespace, lowercase a copy for matching, keep original for argv.

**Deny `destructive`** if any (reason token `destructive`; set `risk: 'too_destructive'` on the report when used from pipeline):

- `rm -rf /` or `rm -rf / ` or `rm -rf --no-preserve-root`
- `rm -rf ~` or `rm -rf $HOME` or `rm -rf ~/`
- `mkfs`
- `dd if=`
- `:(){ :|:& };:` (fork bomb)
- `chmod 777 /` or `chmod -R 777 /`
- `curl` … piped to `sh`/`bash` **or** `wget` … piped to `sh`/`bash` (if the raw string contains `|` and `(curl|wget)` and `(sh|bash)` — deny, do not “ask”)
- `git push --force` / `git push -f` / `--force-with-lease` still **ask** (not too_destructive). Do not deny-as-destructive.

**Deny `abs-path` or `secrets`:**

- `cat /etc/passwd` and any `cat`/`head`/`grep`/`rg` with a posix absolute path starting `/etc/` or `/root/` → `abs-path`
- any command containing `data/secrets` as a path segment → `secrets`

Do not put the path in `reason`. Token only.

### Unmodeled → ask (cannot auto-allow)

If any of these appear in the command (after trim), **ask** unless a hard deny already matched:

| Detect | reason |
|---|---|
| `;` `\|` `` ` `` `$()` `${` | `unmodeled` (pipe/list/subst) |
| unmatched `'` or `"` | `quote` |
| `&&` handled separately | see split |
| `>` `<` newline CR | `unmodeled` |
| leading `sudo` or token `sudo` | `sudo` |
| `export ` or line-start `VAR=` or `VAR=value cmd` | `env` |
| token `cd` as argv0 | `cd` |
| PowerShell-ish: `Get-ChildItem`, `Select-String`, `ForEach-Object`, `$files`, `$_.` | `powershell` |

`TERM_DENY`-like: we are stricter than allowlist prefixes. A prefix allowlist of `git status` would allow `git status; rm` today via `startsWith` — Judge **must not**.

### `&&` split (the only compound allowed)

`splitSafeAnd(cmd)`:

- If cmd contains `; | ` $() backticks `>` `<` newlines besides `&&` → return `null` (caller asks unmodeled).
- Split on `&&`. Trim segments. Empty segment → null.
- Max **4** segments. More → null.
- Each segment must `judgeShell` **allow**. If any deny, whole deny (destructive wins). If any ask, whole ask.
- Example allow: `git status --short --branch && git diff --check`
- Example ask: `git status && base=$(git merge-base HEAD main)` because second segment has `$()`.

Do not split on `||`.

### Tokenize (no LLM, not a real shell)

Walk characters:

- Single and double quotes strip the quotes and keep inner text as one token.
- Unmatched quote → ask `quote`.
- Whitespace splits tokens.
- Do not expand globs. Token containing `*` `?` `[` → ask `unmodeled` except `git` pathspec `.` and `*` only if we **don't** support it — **reject glob tokens** (ask). Safer.
- Token starting with `$` → ask `unmodeled`.

Max 24 tokens per segment.

### Relative path jail — `takeRelativePath(s)`

Return the path string if safe, else `null`.

Reject if:

- empty
- starts with `/` or `~`
- includes `..`
- includes `\0` or `/` + `data/secrets` or `data/secrets`
- Windows `^[A-Za-z]:` 
- length > 240
- `stripActivityText` would empty it due to `<>` — reject `<>` in paths

Allow:

- `notes.txt`, `packages/runtime/src/x.mjs`, `.scratchpad/tsc.tsbuildinfo`, `tsconfig.json`
- `-` as stdin for `cat`/`head` only

`readableFileOrStdin`: `takeRelativePath` or `-`.

## Safe argv tables (command matching)

`argv0` is tokens[0]. No path to binary (`/usr/bin/git` → ask). No `./git`.

### git

`argv0 === 'git'`.

**Deny/ask subcommands (never allow):** `push`, `reset`, `clean`, `config`, `rebase`, `commit`, `merge`, `cherry-pick`, `stash`, `filter-branch`, `update-index`, `remote` (except we simply don't list them). Unknown subcommand → ask.

**Allow subcommands only:** `status`, `diff`, `log`, `branch`, `show`, `rev-parse`, `merge-base`, `worktree`.

`worktree`: tokens[2] must be `list`. No `add`, `remove`, `prune`.

**Forbidden flags anywhere in git argv:** `-c`, `--exec-path`, `--git-dir`, `--work-tree`, `--output`, `--output=`, `--no-ext-diff` is **allowed** (read-only). `--` is allowed as end-of-flags.

`status` allowed flags: `--short` `-s` `--branch` `-b` `--porcelain` `-sb` `--untracked-files=no` `-uno` `--`. No path args, or only `.`

`diff` allowed flags: `--check` `--stat` `--name-only` `--name-status` `--no-ext-diff` `--cached` `--staged` `-w` `--`. Positionals: `.` or `gitCommitish`.

`gitCommitish`: `/^[A-Za-z0-9._/~^:-]{1,80}$/` and must not start with `-` (except we don't allow `--output`). `HEAD`, `main`, `HEAD~1`, `main...HEAD`, `abc1234` OK. `--output=secret` starts with `-` after split as one token → reject.

`log`: `-n` / `--oneline` / `--decorate` / `-1` … `-20` / `--`. No `--all` if we want to be strict — **allow** `--oneline -n 20 -- .` only. No `-p` patch dump? Allow `-n` with number `^[1-9][0-9]?$`. Keep small.

`branch`: `-a` `--show-current` `-v` no `--set-upstream`, no `-D`, no `-m`.

`show`: commitish only, optional `--stat`.

`rev-parse`: `HEAD`, `--abbrev-ref`, `HEAD`, `main`. No `--parseopt`.

`merge-base`: two commitish (`HEAD` `main`). **Allow** `git merge-base HEAD main` as a **complete command**. Do not track its stdout as a typed commitHash for later `$base`.

Reason on allow: `safe-git`.

### cat / head / ls / pwd / wc / rg / grep

`pwd` — tokens length 1 only. `safe-read`.

`ls` — optional `-l` `-a` `-la` `-1` `-h` and relative paths only. No `-R`? Allow `-R` on relative. No `--` color injection issues — drop `--color=always` (ask). Flags from set `{ -l, -a, -la, -al, -1, -h }`.

`wc` — `-l` `-c` `-w` + relative paths.

`cat` — optional GNU-ish flags from a small set `{ -n, -b, -s, -A, -E, -T }` + `readableFileOrStdin`. No `--` extra. Multiple files OK up to 8, all relative.

`head` — `-n` with `^[1-9][0-9]{0,3}$` + relative / `-`.

`rg ` / `grep `:

- `grep` flags `{ -n, -i, -E, -F, -c, -l, -r }` then pattern token (no leading `-`) then relative paths. Pattern length ≤ 120. No `-f` file-of-patterns. No `--include`.
- `rg` flags `{ -n, -i, -F, -l, --glob }` — **drop `--glob`** (unmodeled). Keep `-n -i -F -l --hidden`? `--hidden` ask. Simple: `-n -i -F -l` + pattern + relative files. No `--json`.

Reason: `safe-read`.

### npm / npx / pytest

`npm test` — tokens `npm`, `test`, optional `--silent` `--` extra tokens matching `/^[\w.=/-]+$/` max 4 extras. No `npm publish`. Reason `safe-test`.

`npm run <script>` — script `/^[\w.-]+$/`, tokens length 3 or 4 if `--silent`. No `npm run env`. Block script names `publish`, `prepublish`, `install`. Reason `safe-test`.

`npx tsc` — remaining tokens from allow set: `-p` + relative path, `--noEmit`, `--incremental`, `--tsBuildInfoFile` + relative under `.scratchpad/` or `*.tsbuildinfo` relative, `--pretty`, `false`. Unknown flag → ask. Reason `safe-npx`.

`npx vitest` — `--run` `--reporter=dot` `--coverage` ask (coverage write). Allow `--run` only. Reason `safe-npx`.

`pytest` — `-q` `--tb=short` relative paths. No `--lf` needed. No `-k` with `;`. `-k` ask (injection). Reason `safe-test`.

### Everything else

`echo`, `node`, `python`, `chmod`, `curl`, `wget`, `rm`, `mv`, `cp`, `mkdir`, `kill`, `ssh` → ask `unmodeled` unless a hard deny already fired (`rm -rf /`).

`node --version` we **could** allow; v1 of this ship: **ask** (keep the table small). Do not pretend GNU args parsing.

## Honesty vs LM Studio examples

| Their example | Home AI Judge |
|---|---|
| `git status --short --branch && git diff --check main...HEAD` | **allow** (both segments modeled) |
| `base=$(git merge-base HEAD main) && echo "merge-base=$base"` | **ask** (`$()` + `env`) |
| `set +e` / `output=$(npx tsc …)` | **ask** |
| PowerShell `Get-ChildItem` | **ask** `powershell` |
| `cat notes.txt` | **allow** |
| `cat /etc/passwd` | **deny** `abs-path` |
| `rm -rf /` | **deny** `destructive` |

Do not claim we auto-approve their 82% corpus.

## `instructionHit(detail, list)`

Case-insensitive substring. `list` from `instructionList` already sanitized. Empty list → false. Used for block (force ask) and allow (authorization only, phase 03). Never used to skip destructive deny.

## Do not

- Import a shell parser.
- Evaluate variables / finite alternatives / cwd tracking.
- Allow `commandAllowed` prefix `*` (already sanitized out of file, but Judge must not treat `*` as allow).
- Allow `git -c diff.external=…`.
- Return the raw command in `reason`.

## Done when

- `judgeShell('git status --short --branch').verdict === 'allow'`
- `judgeShell('git status --short --branch && git diff --check').verdict === 'allow'`
- `judgeShell('base=$(git merge-base HEAD main)').verdict === 'ask'`
- `judgeShell('rm -rf /').verdict === 'deny'`
- `judgeShell('cat /etc/passwd').verdict === 'deny'`
- `judgeShell('cat notes.txt').verdict === 'allow'`
- `runAutoReviewPipeline` extra-root write → ask, never allow

Wire `decideTool` in phase 04, not here, unless you batch 02–04.
