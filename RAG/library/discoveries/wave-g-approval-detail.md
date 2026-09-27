---
id: disc-wave-g-approval-detail
folder: discoveries
---

# Wave G — approval detail + MCP reload

- **Task:** Hang-ons from post–Wave E ranking: net `detail` was query/tool-name; MCP URL servers stayed down until reboot after allowlist save.
- **Files:** `policy.mjs` `toolApprovalDetail`; `browserCurrentUrl`; ModsPane Reload; `homeai:permissions:set` reloads hub.
- **Worked:** `urlAllowed` still origin-based; search URL is constructed in main, not taken from the renderer.
- **Anti-patterns:** AP-20260828-7
