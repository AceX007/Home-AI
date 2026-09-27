---
id: disc-code-design-electron-matrix
date: 2026-09-01
---
# Code/Design matrix — headless vs operator click

This environment cannot click Electron. Headless forge uses the same `designTask` string as Design Home ↑.

| Feature | Sub-feature | Headless / test | Operator in Electron |
|---|---|---|---|
| Home | Prompt + submit | `designCreate` + seed two pages; live 2B patched `prove-pitch` | Type a non-shop brief, pick Local 2B, ↑, wait busy, filmstrip > 2 |
| Home | Templates | `profileFromTemplate` T-40 | Click a tile then ↑ |
| Home | Projects | `designList` jailed slugs | Search/open a row |
| Canvas | Generic vs sample | `isShopSample` only `quokka-shop-storefront` | New slug → IrCanvas; open Quokka → PhoneCanvas |
| Home | Tabs | DTCG ingest no path | Projects / Design systems / Templates |
| Editor | Share | `designSlug` in `homeai://design/…` | Copy link; toast if clipboard missing |
| Tools | V H Comment T Edit | overlay/pins tests | Keys ignored in inputs |
| Canvas | Pages | `irGrew` + filmstrip cap 16 | Click p3…p6 on prove-pitch |
| Inspector | Save | `applyDesignPatch` RFC | Discard/Save overlay |
| Tweaks | Prompt | design loop two tools | Send a tweak after generate |
| Trust | Style/IR | no `innerHTML`; proto/`url()`/`<>` denied | Confirm canvas is React text |
| Chrome | Pills | T-46 `design\|cowork\|code` | Chat and Cowork \| Code \| Design exclusive |
| Chrome | Hunt/Verify | `splitHuntVerify` | Background lanes named Hunt / Verify |
| Chrome | Effort | `EFFORT_LABELS` length 6 | 6 dots, not forge |
| Chrome | Customize | disabled button | Stays disabled |
| Generate | OpenAI | remint local if key missing | Settings key, then Design Home OpenAI ↑ |
| Generate | OpenRouter | remint local if key missing | Settings key, then OpenRouter ↑ |
| Generate | Cursor | `forgeForDesign` remint | Banner: DesignIR needs tools |

Failed rows this agent: none in code. Unclicked: every Electron row. Cloud generate: no keys on disk.
