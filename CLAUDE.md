# Swatch Book — read me first

Maggie's personal alcohol-marker coloring companion (static React PWA, no build step).

Before doing anything:
1. Read `DECISIONS.md` — what's been decided, her preferences, what is/isn't working, open items.
2. Read `PROJECT-NOTES.md` — data shapes, storage invariants (never rename `cq-*` keys, set ids or
   marker `key` fields), file map, engines.

Every change:
- Update `DECISIONS.md` (timeline + working/not-working + open items) in the same commit.
- Test at phone (390×844) and iPad (1024×1366) sizes; check old saved data still loads.
- Commit to `main`, confirm the live site updated, then tell Maggie to close and reopen the app.
