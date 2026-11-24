# Apricity Wine: production spec

How the clickable mock becomes the real app. **What** the app does is in the design docs (links below); this spec covers **how** it is built, run and kept safe. Where this spec and a design doc disagree on behaviour, the design doc wins; where they disagree on technology, this spec wins.

| Document | What it decides |
| --- | --- |
| [Apricity Wine App: Combined Design](https://claude.ai/artifact/WEAVRy9ACL8JuteC9BzHoZ) | One app, one wine record, roles, areas, the wine card, how stock and learning feed each other |
| [Inventory, POS and Menu Spec](https://claude.ai/artifact/Qb8EmR6LfMoWqw3riQBwZR) | Stock, movements, deliveries, stock takes, pairings, Lightspeed, menu profiles |
| [Wine Study Tool spec](https://claude.ai/artifact/HqeS6A5AWURgscoyyjFfrf) and [`docs/wine-study/SPEC.md`](../wine-study/SPEC.md) | Lessons, cards, maps, glossary |
| [The mock](https://claude.ai/artifact/DCg83YkQmdBgfNmtZLr2PY), built from [`mock/`](../../mock/README.md) | What every screen looks like and does |
| [`PLAN.md`](PLAN.md) | The order of work, and what "done" means for each step |

The design docs are living Claude Docs; they are linked, not copied, so there is one version of each.

## 1. What the mock proves, and what it fakes

The mock runs the study tool's real code against example stock. Everything a person can click works, but nothing is shared or saved on a server.

| Part | Real in the mock | Faked in the mock | Production |
| --- | --- | --- | --- |
| Lessons, cards, maps, glossary | The study tool's own modules (`src/js`), unchanged apart from the patches in `mock/study-patches.py` | Progress lives in the viewer's browser | Progress saved per person on the server, cached on the device |
| Stock, take off, deliveries, stock takes | Screens, steps, undo, the stock maths | Example numbers in memory; gone on reload | Movements in D1; stock is the sum of movements |
| Sign-in and roles | Screens shown per role; roles add up | A picker instead of a real sign-in; no server checks | Cloudflare Access, and every API route checks roles |
| Open to taste, Tonight, swaps | The rules (glass wines, staff tastings, off tonight, comparisons in stock) | `globalThis.studyHooks` reads in-memory stock | The same rules, in a `stock.js` module fed by the API |
| Tasting notes, Team learning | Screens and actions | Inbox and progress are example data | Tastings and progress rows in D1; team totals computed by the server |
| Lightspeed | Item linking screen | No connection; sales are example movements | K-Series sales become movements (section 8) |
| Guest menu | The menu profile switches and preview | Not connected to the menu site | Served by the Worker, plus a sheet-shaped feed for the current menu site |

## 2. Architecture

One Cloudflare Worker serves the front end, the API and the public menu. Everything for a venue sits in one D1 database.

| Piece | Cloudflare product | Does |
| --- | --- | --- |
| Front end | Workers static assets | The staff app and the public menu page, as plain files built by esbuild |
| API | The same Worker, under `/api` | JSON over HTTPS. Checks the person and their roles on every call |
| Sign-in | Cloudflare Access (Zero Trust) | Email code or Google for staff, in front of `/app` and `/api`. The public menu, the menu feed and the Lightspeed webhook are outside Access |
| Data | D1 | Wines, vintages, movements, people, progress, tastings, settings |
| Photos | R2 | Bottle photos in several sizes |
| Scheduled jobs | Cron Triggers | 4am day close (off tonight, open-to-taste), the nightly Lightspeed check, the weekly export to R2 |

There is no framework and no server-side rendering. The front end stays plain ES modules, as the study tool is today, so the existing modules and tests carry over.

## 3. Repository layout

```
src/                 the front end
  index.html         the app shell
  js/shell.js        areas, navigation, bottom bar, search, sign-in state (from mock/app.js)
  js/api.js          fetch wrapper, offline queue, sync
  js/stock.js        stock maths and the open-to-taste, off-tonight and swap rules (from mock/app.js)
  js/views/          study views as today, plus service/ and office/ (from mock/base.html)
  js/quiz/, data.js, glossary.js ...   unchanged study modules
worker/
  src/index.js       routes
  src/auth.js        Access token check, person and roles
  src/routes/*.js    one file per area: wines, stock, learning, menu, lightspeed, venue
  db/migrations/     numbered SQL files, applied by wrangler
test/                unit tests (node --test), as today
worker/test/         API tests against a local D1
e2e/                 Playwright flows, grown from mock/e2e
mock/                the clickable mock, kept for design work
tools/               import from the sheets, seed data, the estimates
```

## 4. Data model

Every table except `people` and `regions` has a `venue_id`. Ids are text ULIDs, so devices can create records offline without clashing. Times are UTC milliseconds. Stock is held in millilitres.

| Table | Key columns | Notes |
| --- | --- | --- |
| `venues` | name, time_zone, day_cutoff (`04:00`), service_hours, glass_sizes, settings | Apricity is the first row |
| `people` | email (unique), name, active | One row per human, across venues |
| `person_roles` | person_id, venue_id, role (`floor`, `wine_lead`, `manager`) | **One row per role.** Roles add up: screens and routes check "has any of", never "is exactly" |
| `devices` | venue_id, name, kind (`service_tablet`), last_seen | The shared tablet. Its writes still name a person |
| `wines` | key, producer, cuvee, display and short names, section, type, grapes, lead_grape, family, region_id, place, lat, lon, unique_expression, anchor, pronunciation | Identity: the wine whatever the vintage. `key` is the study tool's wine key |
| `wine_notes` | wine_id, style_note, guest_line, scores (JSON), flavours, making, if_you_like, serve, story, pairs_with, status (`estimate`, `tasted`, `needs_notes`), tasted_on, source, check_note | Study notes, one row per wine. Learning attaches here, so a new vintage keeps progress |
| `wine_compare` | wine_id, other_id | The comparison links |
| `vintages` | wine_id, vintage, bottle_ml, bottle_price, glass_price, glass_ml, cost_price, supplier_id, on_list, created_at | What is stocked and sold. Two vintages are two rows |
| `movements` | vintage_id, ml (signed), kind, reason, note, person_id, device_id, at, source_ref, client_id (unique), undoes | The ledger. Append-only: an undo is a new movement pointing at the one it undoes |
| `open_bottles` | vintage_id, opened_at, ml_left, opened_for (`glass`, `staff_tasting`, `pairing`), service_day | Drives "open to taste" |
| `off_tonight` | vintage_id, service_day, person_id, at | Cleared by the 4am job |
| `suppliers`, `deliveries`, `delivery_lines` | as in the inventory spec | A delivery writes `delivery` movements |
| `stock_takes`, `stock_take_counts` | started_at, approved_by; counted ml per vintage and person | Approval writes `count` movements for the differences |
| `menu_pairings` | course_order, course, choose_one, dish, dish_detail, wine_id, note, script, status (`on`, `retired`), updated_by, updated_at | The tasting menu, as the *Wine pairings* tab holds it today: one row per dish and wine, so a dish served with either of two wines has two rows. Edited in Office → Pairings |
| `pairings`, `pairing_courses` | as in the inventory spec | The pours of a tracked pairing (stock), not the menu |
| `lightspeed_items` | ls_item_id, name, vintage_id or pairing_id, pour_ml | Item linking |
| `photos` | wine_id or vintage_id, r2_key, credit | |
| `menu_profiles` | name, fields (JSON), sold_out (`hide`, `show`), look | |
| `glossary_terms`, `regions` | as the sheets today | Edited by the wine lead |
| `progress` | person_id, wine_id, box, due, seen, right, wrong, last | One row per person and wine. The team overview aggregates these |
| `learner_state` | person_id, list_signatures (JSON), changed (JSON) | What "New on the list" needs, as in `quiz/progress.js` |
| `lesson_sessions` | person_id, at, kind, lesson, right, wines, client_id | |
| `tastings` | person_id, wine_id, vintage_id, at, scores, flavours, note, status (`waiting`, `used`, `kept`), reviewed_by, reviewed_at | The *Tasting notes* inbox is `status = waiting` |
| `audit_log` | person_id, at, action, entity, entity_id, before, after | Every edit to wines, prices, people and settings |

Stock for a vintage is the sum of its movements. Bottles are `floor(ml / bottle_ml)`; the open bottle is `ml_left`. Only vintages with a glass price have open bottles, except bottles opened for a staff tasting or a pairing. This is the rule the mock enforces today.

## 5. Sign-in and roles

- **Staff** sign in through Cloudflare Access with an email code or Google. The Worker checks the Access token on every request (the `Cf-Access-Jwt-Assertion` header, against the application's audience and Access's public keys). It then looks up the person by email and loads their roles for the venue. No token or no roles: 403.
- **Roles add up.** A route lists the roles that may use it, and a person passes if they hold any of them. The matrix is the one in the design doc's *App structure* table. The API enforces it; hiding buttons is only for comfort.
- **Shaped responses.** Cost prices, suppliers and Lightspeed items are left out of responses unless the person is a wine lead or a manager. The floor never receives them, even in the page's data.
- **The service tablet** signs in once as the venue's tablet identity, with the longest session the Access policy allows. It is re-signed by a manager when the session ends. Its requests carry the device id. Every stock write from it must name a member of the venue ("Who is this?"), and the server checks that they are one. Learning on the tablet sends the chosen person's id; the tablet's own identity holds no progress.
- **Leaving.** A manager removes a person's roles. Access is cut at once, because the Worker finds no roles. Their movements keep their name. Their progress is deleted after the retention period: a default of 30 days, an open question in the design doc.

## 6. API

JSON over HTTPS. Reads return an `ETag`. Writes that may be retried carry a `client_id`, so a repeated request does nothing twice.

| Route | Who | Does |
| --- | --- | --- |
| `GET /api/me` | any member | Person, roles, venue, settings |
| `GET /api/wines` | any member | All wines with notes, vintages, prices and stock, shaped by role |
| `POST /api/wines`, `PUT /api/wines/:id`, `POST /api/wines/:id/vintages` | wine lead | Add and edit. `PUT` sends the `updated_at` it read; a stale one gets 409 |
| `GET /api/stock`, `GET /api/vintages/:id/ledger` | any member (costs: wine lead, manager) | Levels, run-out estimates, history |
| `POST /api/movements` | any member | Take off stock: vintage, amount, reason, person (from the tablet). Idempotent by `client_id` |
| `POST /api/movements/:id/undo` | the author until the day cut-off; a manager at any time | Writes the undoing movement |
| `PUT /api/off-tonight/:vintage` | any member | On or off for this service day |
| `POST /api/deliveries` | wine lead, manager | Books bottles in |
| `POST /api/stock-takes`, `PUT .../counts`, `POST .../approve` | counting: any member; approving: wine lead, manager | |
| `GET /api/progress`, `POST /api/progress/sync` | the person themselves | Sync sends changed rows since the last sync; per wine, the row with the later `last` wins |
| `POST /api/tastings` | any member | From a lesson's tasting step |
| `GET /api/menu-pairings` | any member | The tasting menu, course by course, for Service → Pairings, the wine cards, lessons and search |
| `POST /api/menu-pairings`, `PUT /api/menu-pairings/:id`, `POST .../:id/retire`, `.../:id/restore`, `PUT /api/menu-pairings/courses` | wine lead | Add, edit, retire and bring back dishes; rename and reorder courses. Every change goes in `audit_log` |
| `GET /api/tastings?status=waiting`, `POST /api/tastings/:wine/use`, `.../keep` | wine lead | The inbox; *use* averages the scores into the notes and marks the wine tasted |
| `GET /api/team-learning` | wine lead, manager | Totals per wine and per unit only. No per-person rows |
| `GET /api/venue`, `PUT /api/venue`, `GET/PUT /api/people` | manager | Settings, people and roles |
| `POST /api/photos` | wine lead | Upload to R2; sizes made on upload |
| `GET /menu/:venue`, `GET /api/menu/:venue.json`, `GET /api/menu/:venue.csv` | public | The guest menu page, its data, and a feed shaped like today's wine sheet for the current menu site |
| `POST /lightspeed/webhook` | Lightspeed, checked by signature | Sales in (section 8) |

## 7. Front end and offline

- **From the mock to `src/`.** `mock/app.js` splits into `shell.js` (areas, navigation, search, accounts) and `stock.js` (stock maths, open to taste, off tonight, swaps). The office and service screens in `mock/base.html` become modules under `views/office/` and `views/service/`. The study views stay as they are. The mock's patches become real code: the hooks become imports from `stock.js`, *Send to the sommelier* posts to `/api/tastings`, and the tablet's *Who's learning?* uses the venue's people.
- **Loading.** `api.js` replaces `load.js` and the sheet loader. It hands the study modules wines in the shape `buildWines` makes today, so the quiz engine, scheduler, maps and glossary need no change.
- **Offline.** A service worker caches the app shell and the last data. Writes (movements, off tonight, progress, tastings, counts) go into an IndexedDB queue and are sent in order when the connection returns. A bar shows *Offline: 3 changes waiting*.
  - Movements are append-only, so they never conflict.
  - Progress merges per wine by the latest answer.
  - Wine edits are online-only, because only the wine lead makes them and a 409 is clearer than a silent merge.
- **Office → Pairings** is where the wine lead edits the tasting menu (`mock/app.js`, *Office → Pairings*). Each dish reads as Service shows it; *Edit* opens a form for the dish, its full description, its wine (or either/or wines, each with its own script) and a note. Courses can be renamed, reordered and marked *choose one*, and dishes added, retired and brought back. A save updates Service → Pairings, the wine cards, lessons and search at once. The pours of a tracked pairing are the second part of the same screen. Floor staff see the pours only.
- **Choosing a wine is always a search.** No dropdown lists every wine: with about 140 wines and more vintages, a long list is slow to scroll and easy to mis-tap. Every place a wine is chosen uses one component, `winePicker`, which `mock/app.js` already has. That covers editing a wine, a pairing's course, linking a Lightspeed item, adding a wine to a delivery and taking off stock.
  - Type any part of the producer, wine, grape, region or vintage. Capitals and accents don't matter, and every word typed must match. Up to 8 results show, each with its vintage, section and stock.
  - Before typing it offers suggestions where there is a sensible set. A pairing course suggests that wine's comparisons, a delivery suggests what is running low from that supplier, and a Lightspeed item is searched by its own name.
  - Enter takes the first match, the arrow keys move through the results, and Escape keeps the wine already chosen.
  - No match says so, and offers *Add a wine* where that is the likely next step.
  - Dropdowns stay only for short fixed lists: glass sizes, sections, suppliers, pour sizes.
- **Theme and layout.** As in the mock: Service is dark, Learn and Office follow the device. Phones get the bottom bar and the tablet and laptop the sidebar. The public menu keeps its own colours.
- **Accessibility.** Keep the study tool's bar: text contrast of at least 6.7:1 in both themes, 44px targets, everything reachable by keyboard, and no information carried by colour alone.

## 8. Lightspeed

As the inventory spec describes. The parts that shape the code:

- Sales arrive by webhook where K-Series offers one, otherwise by polling from a Cron Trigger. Phase 0 settles which, with API access and a sandbox.
- Each sale line becomes a movement with `source_ref` set to the Lightspeed line id. A unique index on it means a repeated notification never counts twice. Voids and refunds write the reversing movement.
- Unlinked items go to *Lightspeed → Unmatched* and are applied once linked.
- The nightly job compares the day's movements with Lightspeed's own report for every linked item. It shows the differences on *Office → Today*.
- Nothing is written back to Lightspeed, until the open decision on sold-out sync is made.

## 9. Moving off the sheets

1. `tools/import-sheets.js` reads the published *apricity_wines* sheet, the study sheet, the glossary, the regions and the lists. It joins them with the study tool's own `buildWines` and writes SQL for D1.
2. A test compares the Worker's guest menu with the menu built from the sheets, line by line, and must match.
3. Opening stock comes from the first stock take in the app, not from the sheet.
4. Progress saved on a device by today's study tool is offered on first sign-in: *Bring this device's progress into your account?* The client posts it to `/api/progress/sync`.
5. Run alongside the old tools until the team has switched. Then point the GitHub Pages address at the app and stop editing the sheets.

## 10. Environments, deploys and backups

- **Two environments**, *staging* and *production*, each with its own Worker, D1 database, R2 bucket and Access application. Staging holds seed data made from the mock's examples.
- **Deploys** use `wrangler`. GitHub Actions run the unit tests, the Worker tests and the Playwright flows on every pull request. A merge to `master` deploys to staging; production deploys from a release tag, after a check on staging.
- **Secrets** (Lightspeed credentials, the webhook signing key) are Worker secrets, never in the repo.
- **Migrations** are numbered SQL files. They are applied to staging first; a migration never edits an applied file.
- **Backups**: D1's point-in-time restore for recent mistakes, plus a weekly export of every table to R2 that is kept longer. A restore is tested before go-live and after any schema change.

## 11. Tests

| Level | Tool | Covers |
| --- | --- | --- |
| Unit | `node --test`, as today (75 tests) | Study modules, plus new pure modules: stock maths, open-to-taste rules, swaps, progress merge |
| API | Vitest with Cloudflare's Workers test pool, against a local D1 | Every route's role checks, response shaping (no costs for floor), idempotent writes, undo rules |
| End to end | Playwright, growing from `mock/e2e/flows.cjs` | The same journeys as the mock, on laptop, phone and iPad sizes, against staging with seed data |
| Lightspeed | Recorded sandbox payloads | Sales, voids, refunds, repeats, unlinked items |

## 12. Security and privacy

- Role checks happen on the server for every route, and responses are shaped by role (section 5).
- Learning progress is private to the person. *Team learning* returns totals only.
- The public routes are the menu page, its feeds and the Lightspeed webhook. They are read-only, apart from the signed webhook, and rate-limited.
- Every change to wines, prices, people and settings is in `audit_log`.
- The guest menu and its feeds never include cost, stock levels, suppliers or internal notes. A test checks the feed for those fields.

## 13. Open technical questions

| Question | Default until decided |
| --- | --- |
| Does K-Series offer webhooks for this account, or only polling? | Build for polling on a 5-minute Cron Trigger; switch if webhooks are confirmed |
| How should the shared tablet sign in? | A dedicated tablet identity with a long Access session, re-signed by a manager |
| Does the team fit Cloudflare Zero Trust's free plan? | Check the plan's user limit against the staff count before phase 0 ends |
| Does the public menu move to the Worker, or does the current menu site keep reading a feed? | Keep the menu site, fed by `/api/menu/:venue.csv`, until phase 4 |
| How long is a leaver's progress kept? | 30 days (the design doc's default) |
