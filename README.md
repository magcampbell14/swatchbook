# swatchbook — deploy to GitHub Pages

This folder is the whole app, ready to host. It installs to your phone's home screen
and works fully offline.

## Publish
1. Create a GitHub repo (e.g. `swatchbook`).
2. Upload **the contents of this folder** to the repo root (so `index.html`, `sw.js`,
   `manifest.json`, `data/`, `src/` all sit at the top level).
3. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, folder `/ (root)`. Save.
4. Wait ~1 min, then open the URL Pages gives you (e.g. `https://<you>.github.io/swatchbook/`).

## Install on iPhone
Open that URL **in Safari** → Share → **Add to Home Screen**. Launches full-screen,
no browser bar, works offline.

## Updating later
Edit the source in the design project, rebuild this folder, re-upload. Because the
service worker is network-first for the app, your phone picks up the new version
automatically whenever it's online — no cache-version bump needed.

Files: `index.html` (app) · `manifest.json` · `sw.js` (offline) · icons · `data/` + `src/`.
