---
id: disc-code-session-chrome
date: 2026-09-01
---
# Code 01–13 session chrome

- **What:** Chat and Cowork vs Code vs Design pills, header kebab (Artifacts, Background tasks, Open in, Rename, Transcript, Copy link, Archive, Delete), Effort/Models, Hunt/Verify tables. Titles and `homeai://chat/…` go through `sessionTitle` / `chatLink`.
- **Files:** `activity.mjs`, `ChatPane.tsx`, `global.css`, `useWorkbench.ts` (`cowork`, `renameChat`, `archiveChat`).
- **Do not:** interpolate raw thread ids into URLs; `innerHTML` session rows; fake a 22-agent Ultracode fleet; persist Effort until forge has a real knob.
