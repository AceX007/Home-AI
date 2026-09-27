# Fleet runtimes

Status: shipped (2026-09-04). Supervisor pane for `Repos/` clones, bot tokens, and opt-in broadcasts.

Link INFO (`Repos/Link INFO BOT`) is the first telegram-bot recipe (`python -m app.main`). Fleet injects `HUB_BOT_TOKEN` / `TEST_BOT_TOKENS` from `data/secrets/fleet/` when that stack starts. The hub’s own link pool still rotates active t.me usernames; Fleet **Announce** pushes the current `@username` to stored chat ids so subscribers keep a spare link.
