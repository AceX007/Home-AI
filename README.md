# Hex AI Workbench

Local-first Electron kernel. One machine, one kernel, optional Telegram bot you create. Not a hosted SaaS.

## Install and run

Node.js 22 or newer. On Linux and macOS, `python3`, `make`, and a C++ compiler are required so `better-sqlite3` and `node-pty` can build.

```bash
npm install
npm run vendor:llama
npm run doctor
```

`npm run doctor` prints the command that opens the window:

- Linux, when `chrome-sandbox` is not setuid: `npm run dev`
- Linux with a setuid sandbox helper, and Windows or macOS: `npm run ide`

The window opens without a model. In the app, open Settings → Hardware → Download GGUF (about 2 GB, saved in the profile, not in git), then Load 2B. Chat stays offline until that file and `llama-server` are both present.

`npm test` does not need the model. `npm run dev` is the only script that turns the Chromium sandbox off, and only so hot reload works on locked-down Linux. `npm run ide` stays sandboxed.

## Consumer install (1.0)

GitHub Releases: AppImage / `.deb` (Linux), NSIS (Windows), dmg (macOS, notarize with your cert). First run picks a workspace (`~/Hex` default), Trust stays Ask, GGUF downloads into the **profile** (not git).

See [SECURITY.md](SECURITY.md), [PRIVACY.md](PRIVACY.md), [TERMS.md](TERMS.md).
