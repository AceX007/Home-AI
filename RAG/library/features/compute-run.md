---
id: feat-compute-run
---
# Jailed compute

- **Works:** `compute_run` writes `data/compute/runs/*`, `python3 -I` or node, timeout, no network preamble. `Figure.savefig` → plot jail. Reads of `data/secrets` denied. Writes only under runs/plots including `os.rename`/`shutil`/`fs/promises`. Not `terminal_run python -c`.
- **Made:** [`packages/runtime/src/compute.mjs`](../../../packages/runtime/src/compute.mjs)
- **Recipe:** [compute-run](../../recipes/compute-run.md)
- **Tests:** T-64 T-70 T-76 T-79 T-80
- **Edges:** E-58 E-70 E-73 E-74
