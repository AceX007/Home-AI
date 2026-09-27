---
id: rec-life-pack
title: Notes calendar extract OCR stay inside named trees
stack: electron
status: refined
---

# Notes calendar extract OCR stay inside named trees

## Shape (do this)
- Mechanism: slug names → `notesRel` / `calendarRel`; OCR `inboxOnly` + image ext; STT `inbox_stt` on inbox audio; TTS `speak` writes `data/tts/<id>.wav`; `extractHtml` strips tags twice; `http_fetch` HTML uses `looksLikeHtml` then extract.
- Good code shape: own-key slugs `[\w.-]`; ICS SUMMARY strips `<>`; `inboxOcrAllowed` images; `inboxSttAllowed` ogg/wav/mp3/webm/m4a; PATH `whisper-cli`/`whisper`/`piper` with fixed argv; missing binary → drop the tool from `toolsForMode` (`filterLifeTools`) and `stt unavailable` / `tts unavailable` if called anyway.
- Do not: extra-root mailboxes; do not OCR/STT SVG/HTML/PHP; do not vendor Whisper/Piper; do not auto-play speakers or send Telegram voice. Auto-STT inbound notes is allowed.

## Ports (same idea, other systems)
- Web/API: per-user blob prefix
- Desktop/IPC: this recipe
- Mobile: Telegram inbox already jailed
- Worker/CLI: same rel helpers

## Curiosity (open)
- Why ics not extra-root calendars? Wave C extra roots are explicit and Ask-on-write.
- What if tesseract/whisper/piper is missing? Tool returns a generic string, not a throw-to-forge-crash.

## Weaknesses / bugs / holes
- notes_list used `root()` not workspace historically (notes IPC). Tools use workspace `root` from forge.
- OCR used to spawn tesseract on `.svg`/`.html`. Link: AP-20260904-59.
- Note previews used to keep `<>`.
- Voice tools used to be markdown-only. Now PATH binaries, jailed paths (AP-20260904-66). Binaries are not vendored.

## Prevent / robust delivery
- Tests: `packages/runtime/src/life-files.test.mjs` `voice.test.mjs` T-81 T-82 `inbox.test.mjs`
- Deny-by-default: bad slugs, inbox-only OCR
- Hunt layers: ipc, data

## Refinement log
- 2026-09-01 — Wave B. Worked: note + ics jail. Next: Whisper/Piper still recipe-next.
- 2026-09-04 — Image-only OCR; HTML extract second pass; note preview strips `<>`; fetch HTML → extract. Next: Whisper/Piper still recipe-next.
- 2026-09-04 — `inbox_stt` / `speak` on PATH binaries; inbox audio magic; life keywords `voice|whisper|piper|stt|tts|speak`. Next: no speaker playback, no Telegram outbound voice, no vendored models.
- 2026-09-04 — Missing bins hide `inbox_ocr`/`inbox_stt`/`speak`. Telegram/Mini inbound audio runs `inboxTranscript` when whisper exists. Next: still no outbound voice, no vendored models.
- 2026-09-04 — Feature refine. Worked: Notes open uses `setActivity` (BrowserView hides); Save explains pick-a-note. Next: still no outbound voice.
