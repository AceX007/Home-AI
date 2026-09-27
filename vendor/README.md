# llama.cpp vendor

Linux (default): `bash vendor/fetch-llama-server.sh` pulls Ubuntu Vulkan x64.

Windows / macOS (P2): the same script accepts `HEX_LLAMA_ASSET`:

- `win-cpu-x64` — Windows CPU (or CUDA if you vendor that zip yourself)
- `macos-arm64` — Apple Silicon
- `macos-x64` — Intel Mac
- `ubuntu-vulkan-x64` — Linux (default)

Or put `llama-server` / `llama-server.exe` on PATH. Hex never attaches to a leftover `/health` that it does not own.

Do not vendor whisper/piper/tesseract. Do not copy Cursor binaries.
