# Lifeboard — handover

Everything you need to use, keep and change Lifeboard.

## 1. Open it

- **Your board, first time:** use the personal link in the email (`…/lifeboard/#gist=…`). It loads the starting board once into your browser. After that, just open https://mahornagda.github.io/lifeboard/
- Works on phone and laptop. On a phone, "Add to Home Screen" makes it feel like an app.
- Press `?` inside the app to see the keyboard shortcuts.

## 2. Where your data lives

- **In your browser only** (localStorage). Nothing personal is stored in the public code.
- Clearing browser data or switching browser/device = a blank board. To avoid that, turn on sync (next step).

## 3. Sync phone + laptop (do this once)

1. Make a free GitHub account if you don't have one.
2. Create a token: https://github.com/settings/tokens/new?scopes=gist&description=Lifeboard (tick only **gist**, then Generate, then copy it).
3. In Lifeboard open **Sync & backup**, paste the token, leave "Gist id" blank, press **Connect**. That creates your own private gist.
4. On your other device: open Lifeboard, paste the same token **and** the gist id shown on the first device, press Connect.

From then on every change saves to your gist; the latest edit wins. The token stays in that browser only.

## 4. How the board works

- **Themes** (the big boxes): Health – medical, Physical fitness, Finances, Errands, Social commitments, Projects, Self care. Rename, recolour, hide or add your own.
- **Each item has a type**, so one theme can mix them:
  - **To-do**: a one-off task you tick off.
  - **Daily**: a habit with a streak.
  - **Tracked**: a number you log (weight, savings…) with a chart.
- **Views:** Board · Today · Kanban · Matrix · List · Habits · Training · Wins · Digest.
- **Digest:** RBI "Directions" press releases from the last 60 days, a word of the day and a flag of the day. It refreshes on its own every 3 hours.
- **"Things to add"** in the sidebar is the wishlist of future features (OneNote/OneDrive, email, calendar, period tracker).

## 5. The code (only if you want to change it)

- Code: https://github.com/mahornagda/lifeboard. It's a plain static site with no build step.
- Run locally: `python3 -m http.server`, then open http://localhost:8000. Tests: `npm test`.
- Layout: `index.html`, `css/app.css`, `js/` (`store.js` holds the data model, `sync.js` the gist sync, `views/` one file per view, `digest.js` the digest view), `scripts/digest.py` fetches the digest.
- Publishing: every push to `main` runs the GitHub Action `.github/workflows/digest.yml` (tests → refresh digest → deploy to Pages). It also runs every 3 hours. Run it by hand with `gh workflow run digest.yml`. Pages caches for about 10 minutes.
- To own a copy: **Fork** the repo on GitHub, then turn on Settings → Pages → Source: GitHub Actions. Your site will then be `https://<your-username>.github.io/lifeboard/`. Your board data moves with your sync gist, not with the code.
