# swatchbook — DO NOT BREAK (project invariants)

Attach this file when starting a new chat. It lists the things that must not change.
Break any of these and the user loses saved work or the app stops working on their phone.

## 1. localStorage keys — never rename, remap, or clear
The user's saved work lives entirely in these keys. A renamed key = silent data loss.

- `cq-saved` — **Saved palettes** (the critical one — protect above all else).
- `cq-saved-ideas` — Saved idea cards.
- `cq-pages` — Saved reference pages / uploads.
- `cq-favs` — Favorited prompts.
- `cq-stock` — Per-color running-low / out flags: `{ [uid]: "low" | "out" }`.
- Plus builder/UI state keys, all prefixed `cq-` (`cq-tab`, `cq-pal-mode`, `cq-b-*`,
  `cq-builder-*`, `cq-bridge-*`, `cq-grad-steps`, `cq-prompt`, `cq-ask-*`, `cq-studio-*`,
  `cq-learn-tab`). Backup/restore snapshots **every `cq-` key**.

Backup envelope shape (keep stable): `{ app:"swatchbook", v:1, exportedAt, keys:{...} }`.

## 2. Saved-palette JSON shape (`cq-saved` = array, newest first, capped at 60)
```js
{
  name: "dusty lagoon",              // user-facing name (older items may use `label`)
  kind: "Built" | "Blend" | "Gradient",
  note: "golden · complementary · 6",
  colors: [                          // ordered swatches
    { marker: { uid, code, name, hex, setName, type }, role: "shadow" } // role may be ""
  ],
  sig: "set:code|set:code|...",      // paletteSig(): sorted uids joined by "|", dedupes saves
  ts: 1700000000000                  // Date.now(); also the React list key
}
```

## 3. iOS scroll fixes — never remove or revert
These fix a real iOS Safari bug where the bottom of a screen sat under the fixed bottom
nav and rubber-banded back (content was reachable only as a "peek", not a full scroll).
All three must stay:
- **`dvh`** on `.app` (`min-height:100dvh`) and on `.sheet` / `.picker-scroll`
  (`max-height` in `dvh`). `100vh` on iOS is the *toolbar-hidden* height and overshoots;
  `dvh` tracks the real visible viewport. Keep the `vh` line above each `dvh` line as the
  old-browser fallback.
- **`env(safe-area-inset-bottom)`** in `.screen` and sheet bottom padding — keeps content
  clear of the home indicator / bottom nav.
- **`overscroll-behavior: contain`** on `.sheet` and `.picker-scroll` — stops inner
  scrollers from chaining their bounce into the page behind them.

## 4. Paths must stay relative (`./`) — served from a Pages SUBDIRECTORY
This is hosted at `https://<user>.github.io/<repo>/`, not a domain root. Any absolute
path starting with `/` will 404. Manifest link, service-worker registration, icon links,
and `start_url` / `scope` inside `manifest.json` all use `./`. Script/data paths
(`data/…`, `src/…`) are document-relative — keep them that way.

## 5. Local / pinned assets only (offline rule)
Everything must be local or a pinned CDN URL that `sw.js` precaches: React +
ReactDOM **production** builds and Babel at the exact pinned versions, plus the Fredoka
Google Fonts stylesheet. No un-cached external fetches or offline mode breaks. If you
bump a CDN version, update the `PRECACHE` list in `sw.js` to match.

## 6. Build outputs — regenerate, don't hand-edit
Canonical source is `Swatch Book.html`. `Swatch Book (offline).html` and everything in
`/deploy` are generated from it. Also ignore the old Doodlebench files
(`Doodlebench.html`, `src/app.jsx`, `src/tabs.jsx`, `src/components.jsx`, `src/styles.css`,
`data/colors.js`) — they are NOT part of swatchbook.
