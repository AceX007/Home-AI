# Workbench page chrome

Task: raise Hex AI activity pages to shared HxPage / HxSideHead / HxEmpty chrome.

Files: `apps/renderer/src/layout/HxPage.tsx`, page panes (Telegram/Settings/Fleet/Library/Board/Mods/Qa), sidebars (Search/Git/Notes/Maps/FileTree), Terminal/Browser/Background/DesignHome, `global.css`, T-100 `hex-chrome.test.mjs`.

What worked: drop `pane-head` when HxPage already titles the page; titles stay React text nodes; Skills shows MCP transport only; Fleet still does not fetch stored domains; Stage `0.28fr` stays gone; composer Review grouping untouched.

Operator still needs `npm run ide` click-walk. See AP-20260904-93 and recipe workbench-chrome.
