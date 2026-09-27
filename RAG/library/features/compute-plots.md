---
id: feat-compute-plots
---
# Compute plots + skill stamp

- **Works:** Python `compute_run` writes figures only under `data/compute/plots/` (`assertPlotInside`), including `Figure.savefig`. `open` / `Path` / `os.open` / node `fs` cannot read `data/secrets`. `knowledgeStamp` includes jailed `SKILL.md` under RAG/mods and workspace `.cursor` / `.agents` / `.homeai` trees, plus root `AGENTS.md`; never `$HOME`. `loadAllKnowledge` caches until the stamp changes.
- **Made:** [`packages/runtime/src/compute.mjs`](../../../packages/runtime/src/compute.mjs) [`packages/mods/src/knowledge-stamp.mjs`](../../../packages/mods/src/knowledge-stamp.mjs)
- **Recipe:** [compute-run](../../recipes/compute-run.md) [skill-cards](../../recipes/skill-cards.md)
- **Tests:** T-70 T-71 T-76 T-79 T-80
- **Edges:** E-63 E-64 E-70 E-73
- **AP:** AP-20260901-53 · AP-20260904-60 · AP-20260904-62 · AP-20260904-63
