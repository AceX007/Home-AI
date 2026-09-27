# Privacy

Hex AI Workbench runs on **your machine**. Default: **no telemetry**.

- Secrets stay in the profile (`safeStorage` / `data/secrets`). They are not uploaded by Hex.
- Workspace files stay in the folder you opened. Agents may read/write inside that jail when you allow the tool.
- Cloud providers (OpenAI, OpenRouter, Cursor, …) receive prompts only if you paste an API key. **ChatGPT Plus is not an API.**
- Telegram is **your** BotFather bot. Hex does not operate a shared bot. Pairing binds your Telegram user id to this kernel.
- Mini App traffic is loopback unless you set an HTTPS tunnel.
- Auto-update checks GitHub Releases for this product when packaged. That request is a version check, not a workspace upload.
- Crash reporter is **off** unless you choose “save crash dump locally.” Opt-in dumps must not include tokens.

There is no advertising ID, no account system, and no Hex cloud analytics in 1.0.
