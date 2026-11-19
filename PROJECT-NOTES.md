# swatchbook — DO NOT BREAK (project invariants)

Attach this file when starting a new chat. It lists the things that must not change.
Break any of these and the user loses saved work or the app stops working on their phone.

## 1. localStorage keys — never rename, remap, or clear
The user's saved work lives entirely in these keys. A renamed key = silent data loss.

- `cq-saved` — **Saved palettes** (the critical one — protect above all else).
- `cq-saved-ideas` — Saved idea cards.
- `cq-pages` — Pages (coloring pages / sketches + their fills). Shape in §2c.
- `cq-favs` — Favorited prompts.
- `cq-stock` — Per-color running-low / out flags: `{ [uid]: "low" | "out" }`.
- Plus builder/UI state keys, all prefixed `cq-` (`cq-tab`, `cq-pal-mode`, `cq-b-*`,
  `cq-builder-*`, `cq-bridge-*`, `cq-grad-steps`, `cq-prompt`, `cq-ask-*`, `cq-studio-*`,
  `cq-learn-tab`). Backup/restore snapshots **every `cq-` key** (Palettes tab → Backup).
- v2 UI-only state uses `sb-` keys (`sb-tab`, `sb-mk-filter`) — not backed up, safe to lose.

Backup envelope shape (keep stable): `{ app:"swatchbook", v:1, exportedAt, keys:{...} }`.

## 2. Saved-palette JSON shape (`cq-saved` = array, newest first, capped at 60)
```js
{
  name: "dusty lagoon",              // user-facing name (older items may use `label`)
  kind: "Built" | "Blend" | "Gradient" | "Photo" | "Page",
  note: "golden · complementary · 6",
  colors: [                          // ordered swatches
    { marker: { uid, code, name, hex, setName, type }, role: "shadow" } // role may be ""
  ],
  sig: "set:code|set:code|...",      // paletteSig(): sorted uids joined by "|", dedupes saves
  ts: 1700000000000                  // Date.now(); also the React list key
}
```

## 2c. Page shape (`cq-pages` = array)
```js
{ id, name, img /* JPEG data URL, ≤1100px */, w, h, tol,
  fill,              // PNG cache of the ACTIVE version's fill layer (thumbnail only — can be "")
  versions: [ { id, name, history:[{x,y,uid,tol}], tray:[uid], active:uid|null, star:bool } ],
  ver,               // index of the active version
  history, tray, active,   // mirror of the active version (kept for older code paths)
  createdAt, updatedAt }
```
Pages saved before v2 have no `versions`; `migrate()` in sb-pages.jsx turns their
history/tray into version "V1" in memory. Fills are always rebuilt by replaying `history`.

## 2b. Marker ids (uid) — never change a color's `key`, a set `id`, or a `code` without a `key`
Every color's saved-data id is `setId:(key || code)` (built in `cq-ui.jsx`). Saved palettes,
the palette signature, and `cq-stock` flags all point at that uid.
- Nov 2026 audit: each color now has `code` (2025 code, shown first), `old` (pre-2025 cap code),
  `name` (2025 name), `oldName`. The UI shows both codes everywhere via `codeLabel()`.
- Colors whose displayed code changed carry `key:"<pre-audit code>"` (all SFAIH Pastel
  colors, e.g. BV05 has key "B340"; Y43 keeps key "YR217", an old cap misread of YR212). NEVER edit or remove a `key`.
- Set ids are permanent even when the label is wrong: `sfaih` = SFAIH Pastel 51 (cap codes = Ohuhu's old codes),
  `ohuhu-honolulu-b` = Honolulu 48 Mid-tone, `ohuhu-oahu` = Oahu Portrait/Skin 6.
- To add a color: new entries need no `key`. To fix a code typo on an EXISTING color, add
  `key:"<old typo>"` first so saved data still resolves.

## 3. iOS scroll fixes — never remove or revert
These fix a real iOS Safari bug where the bottom of a screen sat under the fixed bottom
nav and rubber-banded back (content was reachable only as a "peek", not a full scroll).
All three must stay:
- v2 classes: `.app`, `.sb-sheet` / `.sb-sheet-body`, `.sb-editor`, `.sb-colormode` carry these.
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

## 4b. FLAT FILE STRUCTURE — no subfolders
Every file sits at the top level. Updates are now pushed directly from Claude Code, but
staying flat keeps the iPad drag-and-drop upload working as a fallback (iPadOS Safari
cannot upload folders).

## 5. Local / pinned assets only (offline rule)
Everything must be local or a pinned CDN URL that `sw.js` precaches: React +
ReactDOM **production** builds and Babel at the exact pinned versions, plus the Fredoka + Inter
Google Fonts stylesheet. No un-cached external fetches or offline mode breaks. If you
bump a CDN version, update the `PRECACHE` list in `sw.js` to match.

## 6. Source of truth
As of Nov 2026 the GitHub repo (magcampbell14/swatchbook) IS the source. Edit these files
directly (Claude Code). The older Claude Design project ("Swatch Book.html") is out of date —
don't export from it over the top of this repo, or the audit is lost.

## 7. v2 structure (Nov 2026 redesign)
Three tabs: **Pages** (home) · **Markers** · **Palettes**. Loaded files:
`inventory.js`, `cq-engine.js`, `cq-ui.jsx` (storage, merged inventory, codeLabel/hexOf),
then `sb-core.jsx` (marker groups, stock, shading recs, harmony recolor, photo palette,
shared UI), `sb-pages.jsx`, `sb-markers.jsx`, `sb-palettes.jsx`; the App shell is inline in
`index.html`. Each `sb-*.jsx` is wrapped in an IIFE (babel scripts share one global scope).
- New page photos run through `cleanPage()` (sb-pages.jsx): find the paper (bright + smooth +
  unsaturated), perspective-flatten it, divide out lighting, keep dark unsaturated strokes as
  black-on-white lines, trim to the drawing. The start sheet can switch back to the original photo.
- cq-engine `build()` accepts `lo` (darkest target L; soft/pastel recipes use ~50) and a neutral
  `balanced` mood (not in MOOD_ORDER). Starter vibes use per-vibe key hues (`RECIPES`).
- Editor gestures: tap = fill (taps on an outline slide to the nearest paper pixel within ~16
  screen px); two fingers = zoom + move anchored between the fingers; a deliberate one-finger
  drag (>22px) also moves; the view is clamped so the page can't be lost. Undo + redo.
- "Best with this page" (`fitScore` in sb-core): harmony with hues already on the page
  (same/neighbor/complement/split/triad) + tonal match (similar chroma) + lightness range.
  Used by the + picker (with family filters) and the "Goes with this page" row.
- SFAIH display rule: show the CAP (old code + SFAIH name, e.g. "B340 Lavender Mist") first;
  the Ohuhu 2025 match ("BV05 Cornflower") is only a small reference. In inventory.js the SFAIH
  `name` is the cap name and `oldName` is the Ohuhu name (set flag `capCodes:true`); uids unchanged.
- Same-ink grouping: Ohuhu markers with the same `code` are ONE ink across sets (×2 badge);
  SFAIH inks are separate even when codes match.
- Design rule from Maggie: no beginner tips or reminders of basics (e.g. acrylic highlights).
- SHELVED, not deleted (code + their saved data kept): Prompts, Studio, Learn and the v1
  screens — `cq-ask.jsx`, `cq-learn.jsx`, `cq-studio.jsx`, `cq-screens.jsx`,
  `cq-palettes.jsx`, `cq-pages.jsx`, `cq-sketch.js`, `prompts.js`, `mixing.js`.

## 8. Palette engine (`sb-palette.jsx`, Nov 2026 harmony audit)
- **Every palette comes from `SB.PAL`**: starter vibes, "Palettes with X", New version (schemes + vibes),
  Palettes tab → Make a palette, and the "goes with this page" ranking (`fitScore` adds Ou–Luo).
  `CQ.build`, `SB.harmonyMap`/`SB.SCHEMES` are no longer used by the UI (kept for reference).
- **Vibes are color stories** (`VIBES`): parts with hue/L/C ranges in CIELAB LCh, most important first.
  Fixed-story vibes (golden, blue, fresh, earthy, vintage) always use their first 3 parts, then shuffle the rest.
  Relative vibes (pastel, moody, vibrant) build from a base hue + color scheme (`SCHEME_OFFS`).
  Vibrant uses `L:"cusp"` = the lightness where HER markers are most saturated at that hue (`CUSP`).
- **Generator**: ~40 seeded candidates → snap each slot with CIEDE2000 (no ink twice, never "out")
  → score = harmony (Ou & Luo 2006 CH, averaged over pairs) − target misses − out-of-band − near-twins
  − overlap with the last shuffle (`avoid`) − mud (light vibes). Scheme is fixed per shuffle (seeded),
  not per try, so "Mix it up" really rotates schemes.
- **Recolor (versions)**: schemes keep each color's L and C and squeeze the page's hue layout into the
  scheme (sky stays different from grass); one-hue pages get spread across the scheme by use rank.
  Vibes map the page's lights→darks onto a generated vibe palette. `seed>1` = a "different take".
  "Keep browns & greys" holds only real browns (L<72) and greys — pale creams/peaches move.
- **Tuner** (`SB.PaletteTuner`): tap to lock, Shuffle/Back (history 20), scheme, Warmer/Cooler/
  Lighter/Deeper/Softer/Bolder (same seed, so it adjusts instead of reshuffling), 4–9 colors,
  Include a marker (MarkerPicker → onPick receives a GROUP, not a uid).
- Audit harness: /home/claude/scripts/audit_*.js + audit_run.py + audit_sheet.py (not in repo).

## 9. Try palettes / auto-fill (`sb-autofill.jsx`, Nov 19 2026)
- The version "+" button, the ✳︎ header button, "Try palettes" on a blank page, and the start
  sheet's "See it filled in" all open **Try palettes** (`NewVersionSheet` in sb-pages.jsx).
  Tabs: Vibes · My palettes (cq-saved) · Photo (camera roll, several at once) · Recolor (old
  scheme/vibe recolors, only once something is filled).
- `SB.AUTO.segment` labels every fillable area with the SAME rule as `floodFill` (seed color ±tol),
  starting only from paper pixels (lum ≥ 230). Areas touching the image edge (the margin) and
  specks are skipped. Neighbors = separated only by a short run of line pixels.
- `groupsFor`: filled areas keep your grouping (one group per marker, with its lightness);
  empty areas group by repeated shape (log area, aspect, fill ratio), and touching areas in a
  group are split (tile patterns alternate).
- `assign`: role cost — biggest groups ↔ calmest colors, smallest ↔ accents; lightness rank
  kept on filled pages; touching groups kept apart; more colors than groups → groups split.
  `seed>1` (Re-arrange) = looser, more varied pass.
- Output is a normal history (your taps recolored + one tap per newly filled area), so undo,
  versions, export, coloring mode all work. Blank current version → filled in place;
  otherwise → new version named after the palette.
- Previews paint a downsampled label map (300px cards, 1100px detail), not flood fills.
- Recolor fix: vibes/pastel (and pages that are mostly browns) recolor browns too; "Keep browns
  & greys" then only holds true greys/near-blacks.
