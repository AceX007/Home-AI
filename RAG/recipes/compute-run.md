---
id: rec-compute-run
title: Jailed compute, not python -c on the shell allowlist
stack: electron
status: refined
---

# Jailed compute, not python -c on the shell allowlist

## Shape (do this)
- Mechanism: write `data/compute/runs/<id>.py|mjs`, `python3 -I` or `node <abs.mjs>`, timeout, unlink the script.
- Plots: `computePlotRel` + `assertPlotInside` → `data/compute/plots/<id>.png` only. Env `MPLBACKEND=Agg`, `MPLCONFIGDIR` under the compute cwd. Keep the png.
- Secrets: wrap `builtins.open`, `io.open`, `os.open`, `pathlib.Path.open`, and the node `fs` default object so `data/secrets` raises `compute_run path jail`.
- Writes: `open`/`os.open`/`mkdir`/`chdir` and node `writeFile*`/`mkdirSync` only under `data/compute/runs` or `data/compute/plots`. Node named `readFileSync` goes through a jailed `--import` shim (`computeHookRel` / `computeShimRel`).
- Good code shape: `runCompute` + no-net preamble; `HOMEAI_PLOT_ABS` is the only figure path; missing matplotlib → `matplotlib unavailable`.
- Do not: `terminal_run python -c`; do not install packages from the worker; do not claim a VM/seccomp sandbox.

## Ports (same idea, other systems)
- Web/API: isolate runner with cgroup timeout; figures to a prefix-jailed blob store
- Desktop/IPC: this recipe
- Mobile: skip or HTTP to desktop
- Worker/CLI: same function; Agg backend so headless workers do not need a display

## Curiosity (open)
- Why cwd under data/compute/runs? Keep scripts off product trees.
- Why MPLCONFIGDIR under cwd? Matplotlib font cache must not touch the real HOME.
- What if the script opens `../../data/secrets`? Prefix jail on `open`/`Path`/`os.open`/`os.rename`/`shutil`/`fs.readFile*` plus `--import` shims for named `node:fs` and `node:fs/promises`. ctypes still bypasses (AP-20260904-64).

## Weaknesses / bugs / holes
- Preamble is not a security boundary against ctypes. Timeout + path jail is the Gate 0 prevent.
- `plt.savefig` and `Figure.savefig` redirect to `HOMEAI_PLOT_ABS`. `open` / `Path.open` / `os.open` / `os.rename` / `shutil` / node `fs` (default, named, and `node:fs/promises`) deny `data/secrets` and writes outside runs/plots (AP-20260904-64). ctypes is still not Landlock.
- Extra-roots must not be passed into `assertPlotInside`.

## Prevent / robust delivery
- Tests: `packages/runtime/src/compute.test.mjs` T-64 T-70 T-76 T-79 T-80
- Deny-by-default: empty code, `..` in id/plot/hook rel, timeout, plot prefix `data/compute/plots/`, writes outside runs/plots
- Hunt layers: ipc, data

## Refinement log
- 2026-09-01 — Wave A. Worked: node 2+2 + timeout flag + python `os.system` denied. Next: optional matplotlib cwd for plots under the same jail.
- 2026-09-01 — Wave E. Worked: plot rel has no `..`; Agg + MPLCONFIGDIR; png kept / script unlinked; generic matplotlib string. Failed: none in jail tests (matplotlib not required). Next: do not patch `Figure.savefig` unless a test shows a product path using it.
- 2026-09-04 — `Figure.savefig` follows the plot jail; `open()` cannot read `data/secrets`. Next: pathlib.Path.open and extra-root writes from compute are still not Landlock.
- 2026-09-04 — `Path.open` / `os.open` / `io.open` / node `fs` default deny `data/secrets`. Next: ESM named `readFileSync`, ctypes, and extra-root compute writes are still not Landlock; Whisper/Piper stay later.
- 2026-09-04 — Writes jailed to runs/plots (`chdir`/`mkdir` too). Node `--import` shim covers named `readFileSync`. Next: `os.rename`/`shutil`/`fs/promises` named import and ctypes still bypass; Whisper/Piper stay later.
- 2026-09-04 — `os.rename`/`replace`, `shutil.copy`/`move`, and named `node:fs/promises` are jailed. Next: ctypes / Landlock still WONT.
