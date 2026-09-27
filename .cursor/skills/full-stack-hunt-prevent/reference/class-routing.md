# Class routing — signal → hunt-* (cap 3–5)

Load by **name** only if the skill exists on disk (`~/.claude/skills/<name>/SKILL.md` or project skills). Do not paste payloads into this repo. Prefer 1 stack skill + 1–2 classes from fingerprint + 1 from git history.

## Stack / runtime

| Signal | Skill |
|--------|--------|
| `__NEXT_DATA__`, `/_next/`, `next` dep | `hunt-nextjs` |
| Express, Fastify, `package.json` node, Electron renderer | `hunt-nodejs` |
| Electron `ipcMain`, `preload`, `BrowserWindow` | (this skill’s IPC layer; optional `hunt-nodejs`) |
| Laravel, `artisan`, Ignition | `hunt-laravel` |
| Spring, `/actuator`, Whitelabel | `hunt-springboot` |
| ASP.NET, VIEWSTATE | `hunt-aspnet` |
| k8s, `:6443`, Dockerfile+helm | `hunt-k8s` |
| GraphQL, `graphql` | `hunt-graphql` |
| gRPC, `:50051` | `hunt-grpc` |
| WebSocket, socket.io | `hunt-websocket` |

## Class (from code / git)

| Signal | Skill |
|--------|--------|
| AuthZ, IDOR, object id in IPC/API | `hunt-idor`, `hunt-auth-bypass` (if present) |
| Session cookie, JWT | `hunt-session`, `hunt-jwt-crypto` |
| HTML/markdown render, `dangerouslySetInnerHTML` | `hunt-xss`, `hunt-dom`, `hunt-html-injection` |
| File path, upload, `readFile(user)` | `hunt-lfi`, `hunt-file-upload` |
| SQL/NoSQL string build | `hunt-sqli`, `hunt-nosqli` |
| Server-side URL fetch | `hunt-ssrf` |
| Template strings in server render | `hunt-ssti` |
| CSRF, cookie session + state change | `hunt-csrf` |
| CORS reflection | `hunt-cors` |
| Open redirect params | `hunt-open-redirect` |
| Race, checkout, balance | `hunt-race-condition` |
| `.github/workflows` | `hunt-cicd` |
| `.env`, source maps | `hunt-source-leak` |
| LLM/RAG prompts | `hunt-llm-ai`, `hunt-rag-vector` |
| Prototype pollution, `Object.assign` body | `hunt-api-misconfig`, `hunt-nodejs` |

If more than five match: keep stack + the classes that appear in `data/bug-memory/anti-patterns.md` or this run’s `mine-past-bugs.sh` output. Print `deferred: <names>`.
