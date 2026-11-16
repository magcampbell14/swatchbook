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

## 2b. Marker ids (uid) — never change a color's `key`, a set `id`, or a `code` without a `key`
Every color's saved-data id is `setId:(key || code)` (built in `cq-ui.jsx`). Saved palettes,
the palette signature, and `cq-stock` flags all point at that uid.
- Nov 2026 audit: each color now has `code` (2025 code, shown first), `old` (pre-2025 cap code),
  `name` (2025 name), `oldName`. The UI shows both codes everywhere via `codeLabel()`.
- Colors whose displayed code changed carry `key:"<pre-audit code>"` (all Pastel Sweetness
  colors, e.g. BV05 has key "B340"). NEVER edit or remove a `key`.
- Set ids are permanent even when the label is wrong: `sfaih` = Honolulu 48 Pastel Sweetness,
  `ohuhu-honolulu-b` = Honolulu 48 Mid-tone, `ohuhu-oahu` = Oahu Portrait/Skin 6.
- To add a color: new entries need no `key`. To fix a code typo on an EXISTING color, add
  `key:"<old typo>"` first so saved data still resolves.

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
and `start_url` / `scope` inside `manifest.json` all use `./`. Script/data paths are
document-relative — keep them that way.

## 4b. FLAT FILE STRUCTURE — no subfolders, ever
Every file sits at the top level. There is NO `src/` and NO `data/` folder.
This is deliberate and must not be "tidied up": deployment happens by dragging files
from the iPadOS Files app into GitHub's web uploader, and iPadOS Safari CANNOT upload
folders — a folder drag silently delivers nothing. Any future export must keep all
JS/JSX/data files flat alongside `index.html`.

## 5. Local / pinned assets only (offline rule)
Everything must be local or a pinned CDN URL that `sw.js` precaches: React +
ReactDOM **production** builds and Babel at the exact pinned versions, plus the Fredoka
Google Fonts stylesheet. No un-cached external fetches or offline mode breaks. If you
bump a CDN version, update the `PRECACHE` list in `sw.js` to match.

## 6. Source of truth
As of Nov 2026 the GitHub repo (magcampbell14/swatchbook) IS the source. Edit these files
directly (Claude Code). The older Claude Design project ("Swatch Book.html") is out of date —
don't export from it over the top of this repo, or the audit is lost.
