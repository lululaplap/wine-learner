# The clickable mock of the combined app

One HTML page that shows the whole Apricity Wine app: Service, Learn and Office, the public wine list, and sign-in by role. It uses example stock, sales and people, and keeps nothing on a server. The published copy is at <https://claude.ai/artifact/DCg83YkQmdBgfNmtZLr2PY> (private until shared). The design is in [Apricity Wine App: Combined Design](https://claude.ai/artifact/WEAVRy9ACL8JuteC9BzHoZ); the road to production is in [`docs/app/`](../docs/app/).

The Learn area runs the study tool's real code from `src/js`, not a copy of it. A change to the lessons, cards or maps shows up in the mock on the next build.

## Build and test

```sh
npm install           # once: esbuild
npm run mock          # writes mock/dist/wine-app.html
npm run test:mock     # every screen for every account, then the stock and learning flows on laptop, phone and iPad
```

Open `mock/dist/wine-app.html` in a browser, or `/mock/` on the GitHub Pages site (it forwards to the built page). Signed out, it shows the guest wine list; *Sign in* offers five example accounts:

| Account | Roles | Shows |
| --- | --- | --- |
| Sam | Floor | Floor staff on their own phone |
| Service tablet | Floor, shared | Asks *Who is this?* for stock changes and *Who's learning?* in Learn |
| Sommelier | Floor, wine lead | Wines, tastings, stock, menus, team learning |
| Manager | Floor, manager | Venue, people, stock, menus, team learning |
| Manager and wine lead | Floor, wine lead, manager | Everything: roles add up |

Stock changes last until the page is reloaded. Learning progress is kept in the browser; *Me → Reset the example data* starts again.

## Files

| File | What it is |
| --- | --- |
| `base.html` | The page: styles, layout, and the office and service screens (stock, take off, editor, deliveries, stock take, pairings, Lightspeed, menus, venue) |
| `app.js` | The combined app: accounts and roles, areas and navigation, search, *Tonight*, *Tasting notes*, *Team learning*, *Me*, the example data, and the hooks that connect stock to the study tool |
| `app.css` | Styles for the combined app, added after the study tool's own |
| `study-entry.js` | What the bundle of the study tool exposes to the page (`globalThis.Study`) |
| `study-patches.py` | The small changes made to a temporary copy of `src/js` before bundling: bundled maps, stock-driven *open to taste*, tastings sent to the inbox, account wording |
| `wine-data.cjs` | Makes the example wine list from `sheets/`, through the study tool's own join |
| `build.py` | Puts it all together into `dist/wine-app.html` |
| `e2e/` | The Playwright checks |
| `dist/wine-app.html` | The built page, committed so it can be opened without building |

## Changing the mock

Edit `base.html`, `app.js` or `app.css`, run `npm run mock` and `npm run test:mock`, then republish `dist/wine-app.html` to the artifact. If a study module changes so that a patch no longer applies, `build.py` stops and names the patch. Change the patch to match.
