# Hex AI Workbench

Local-first Electron kernel. One machine, one kernel, optional Telegram bot you create. Not a hosted SaaS.

## Operator (this repo)

```bash
npm install
bash vendor/fetch-llama-server.sh   # Linux Vulkan x64; Win/mac: see vendor/README.md
# Drop Qwen3.5-2B-Q8_0.gguf in the repo root or download from Settings / first-run.
npm test
npm run ide    # renderer 5175 is the Vite dev port; leave 5173 alone
```

`npm run dev` still sets `ELECTRON_DISABLE_SANDBOX` for HMR on locked-down Linux. **Release scripts do not.**

## Consumer install (1.0)

GitHub Releases: AppImage / `.deb` (Linux), NSIS (Windows), dmg (macOS, notarize with your cert). First run picks a workspace (`~/Hex` default), Trust stays Ask, GGUF downloads into the **profile** (not git).

See [SECURITY.md](SECURITY.md), [PRIVACY.md](PRIVACY.md), [TERMS.md](TERMS.md).
