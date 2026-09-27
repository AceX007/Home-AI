# Wave D — Coder GGUF sidecar + nested Explore forge

Status: shipped (2026-09-01). Parallel with Wave E (`compute-plots-skills.md`). Do not edit Wave E files.

Keep the 2B as orchestrator. If VRAM profile is `standard` and a coder GGUF exists in the workspace root (`DEFAULT_CODER_MODEL_NAMES`), start a **second** `LlamaServerManager` on `127.0.0.1` + `DEFAULT_CODER_PORT` (8766). Tab/FIM and optional Explore nested `runForge` use that port. Failure to start the sidecar must not stop the 2B.

## Shape
- Second `LlamaServerManager` instance (do not overload the 2B child).
- `coderLlamaArgs(probe, modelPath)`: smaller ctx (≤2048), fewer GPU layers than the 2B (half ngl, min 0), same host jail `127.0.0.1`.
- `homeai:infill` prefers coder port when `coder.status.running`, else 2B port.
- Nested forge: **explore only**, `skipVerify` + `skipRemember`, `maxTurns` 2, `toolsForSubagent('explore')`. Bash/browser/research stay deterministic digests. Nested `task` still denied via `host.depth`.
- Think mode: no nested LLM forge (stay 2B + explore tools).
- OOM: catch sidecar start; leave `coderEnabled` false; never kill the 2B process.

## Hunt
Classes: path jail (model path under workspace), IPC (no renderer-chosen port), secrets (nested forge is local only).
AP id: `AP-20260901-52`. Tests: **T-69**. Edge: **E-62**.

## Do not
- Touch `packages/runtime/src/compute.mjs` or Wave E files.
- Run `count-status.sh` (parent merges).
- Fake Landlock. Do not bind `0.0.0.0`.
- Start a sidecar on tiny/cpu/small profiles.
- Copy Cursor proprietary infill.

## Library
Feature `coder-sidecar`. Refine `RAG/recipes/kernel-loop.md` and `subagents.md`. Append only your TESTS/EDGES/FEATURES rows.
