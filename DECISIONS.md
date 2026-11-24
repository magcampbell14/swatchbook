# Swatch Book — decision log & working context

Plain-language record of what we've decided, why, and what is or isn't working, so any future
chat can pick up without re-asking. **Update this file in the same commit as any change.**
Technical details (data shapes, invariants, file map) live in `PROJECT-NOTES.md`.

---

## How we work
- **Source of truth:** this GitHub repo (`magcampbell14/swatchbook`), live at
  https://magcampbell14.github.io/swatchbook/ via GitHub Pages. The old Claude Design project is
  out of date — don't use it.
- **Shipping:** commit straight to `main`; Pages deploys in ~1 min. Tell Maggie to close and reopen
  the app (home-screen PWA) to pick it up. Verify the live files after each push.
- **Devices:** iPhone and iPad equally. Test every change at phone (390×844) and iPad (1024×1366).
- **Her data lives on her device** (localStorage + IndexedDB for real-life photos). Never change
  storage keys, set ids or `key` fields — see PROJECT-NOTES §2. Backup/restore in Palettes tab.
- **Process:** for big changes, Q&A first, mockups if the direction is unclear, then build. For
  clear requests, just build and show before/after. She isn't a UX expert and wants Claude to
  research and recommend, not ask her to design.
- **Communication:** lead with the answer, no padding. Multiple options with concrete examples
  help her. Keep replies phone-length.
- **Accuracy:** never guess marker codes/names/colors — ask for a cap or swatch photo.

## Who it's for / taste
- Maggie colors printed coloring pages with alcohol markers (mostly Ohuhu + an SFAIH pastel set),
  then adds lots by hand: textures (brick, wood grain, colored pencil), white acrylic/gel
  highlights, glitter, patterns.
- **Main value of the app (her words):** figuring out the palette — seeing the whole page filled
  in with different palettes and vibes. Tap-to-fill matters too, but the comparison is the point.
- Usual taste: **pastels**; also cozy/earthy (sage, brick red, browns).
- Don't clutter with obvious beginner tips (e.g., "use acrylic for highlights").

## Inventory decisions
- Sets owned: Ohuhu 48, Ohuhu Mid-tone 48, **SFAIH Pastel 51** (50 + blender — *not* Ohuhu Pastel
  Sweetness), Ohuhu 104, Ohuhu 36 Skin, Blue Tones 6, Oahu Portrait 6.
- Show both new and old Ohuhu codes/names.
- **SFAIH markers show the cap code/name first** (e.g., "B340 Lavender Mist"), with "Matches Ohuhu
  BV05 Cornflower" as a note. BR208 = **Black Brown** (Ohuhu's famously confusing name for a peach).
- Hexes measured from her swatch photos. **Known gap:** several inks look greyer/softer in the app
  than on paper — R26 Valentine Pink (coral-rose on paper), V13, RV35 (more purple), B015 (closer
  to navy), YG36 Beige Green and G220 Lime Green (greener). Waiting on a daylight swatch strip to
  recalibrate. Don't recalibrate from dim/flash photos of finished pages.
- Stock: long-press a tile in Markers to cycle Stocked → Low → Out; detail sheet sets each copy;
  Restock filter + copy list. "Out" markers are excluded from suggestions/palettes.

## Product decisions (timeline)
- **Nov 16 — v2 "coloring companion" rebuild.** Pages-first: snap a page → auto-crop & clean lines →
  tap-to-fill flat color → versions → shading recs (base + 1–2 darker shadows only; alcohol
  markers can't lighten) → coloring mode with pull list. Markers grid with restock. Palettes tab.
  Off-white theme. Shelved the Ask/Learn/Studio tabs (code kept, not loaded).
- Gestures: two-finger pinch/pan anchored between fingers, page can't get lost, forgiving taps,
  tap-on-a-line slides into the nearest small area; undo **and redo**.
- "+" marker picker: "Best with this page" ranking + color-family chips (search reds that fit).
- **Nov 17 — palette harmony overhaul.** Vibes are real color stories (Golden hour = honey/apricot
  with mauve shadows; Earthy = terracotta/ochre/olive/sage/sand; etc.), scored with the Ou & Luo
  (2006) harmony model, snapped to her markers. Shuffle & tune everywhere: lock colors, Back,
  color scheme, Warmer/Cooler/Lighter/Deeper/Softer/Bolder, 4–9 colors, include a marker.
- **Nov 19 — Try palettes.** The whole page auto-filled with any palette: Vibes, My palettes,
  Photo (camera roll), Recolor. Colors assigned by role (big areas calm, small areas accent,
  lights stay light, neighbors differ). Add/remove a color and the page re-balances.
  Fixed: versions of dark/earthy pages all kept the same browns.
- **Nov 24 — Pages organized Up next / Done, real-life photos + compare.** Mark a page done in real
  life, attach photos of the finished piece (with/without flash), compare plan vs. real side by
  side. Real-life photos stored in IndexedDB (localStorage is too small). Added a warning if the
  device runs out of storage, plus a storage meter in Backup.
- **Nov 24 — started this decision log** and a `CLAUDE.md` so future sessions load it.

## What's working (her feedback)
- Pastel palettes and harmony are "definitely working better" after the Nov 17 overhaul.
- Shading recommendations are useful.
- Plans translate well to paper: value structure (lights/darks) holds up.

## What didn't work → fixed
- Palette shuffles drifted off-vibe and many palettes clashed → Nov 17 overhaul.
- Starter palettes all pink → per-vibe recipes.
- Zooming was hard, small corners impossible to tap, no redo → gesture rewrite + tap-snap + redo.
- Couldn't find red options in "+" → family chips + harmony ranking.
- SFAIH names didn't match caps (showed "Cornflower" for B340 Lavender Mist) → cap-first naming.
- New versions of earthy pages all looked the same → recolor browns too.
- No way to try a saved palette on a page → Try palettes.

## Open items / ideas (not yet decided)
- Recalibrate the "too grey" markers once she sends a daylight swatch strip.
- Offered: Low/Out button inside the page editor's shading card and coloring mode (no answer yet).
- Page line-art images still live in localStorage (~0.25–0.5 MB per page). If she keeps adding
  pages, move them to IndexedDB too (the new storage warning will flag it first).
- Possible "In progress" status between Up next and Done.
