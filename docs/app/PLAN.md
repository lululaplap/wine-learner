# Apricity Wine: plan from mock to production

Six phases, each ending in something the team can use. The order follows the combined design: one app and one wine record come first, because every later phase needs them. How each piece is built is in [`PRODUCTION-SPEC.md`](PRODUCTION-SPEC.md).

## Before phase 0: buy-in

- [ ] Walk the sommelier through [the mock](https://claude.ai/artifact/DCg83YkQmdBgfNmtZLr2PY) (share it from the page's Share menu first). A five-minute route:
  1. As Sam, open *Tonight*, then do *Before service*.
  2. As the Sommelier, open a bottle from *Team learning*.
  3. As Sam, taste it and send the notes.
  4. As the Sommelier, mark it tasted from *Tasting notes*.
- [ ] Settle the design doc's open questions, or accept their defaults.
- [ ] Note any screen changes, and make them in `mock/` first (see [`mock/README.md`](../../mock/README.md)), so the mock stays the picture of what is being built.

## Phase 0: access and skeleton

**Build**

- [ ] Ask Lightspeed for K-Series API access and a sandbox. Find out whether this account gets webhooks or must poll.
- [ ] Set up the Cloudflare account: a Worker, D1, R2 and an Access application, each for staging and production.
- [ ] Add `worker/` with a health route and the Access token check, plus `GET /api/me`.
- [ ] Write the first D1 migration: venues, people, person_roles, devices, audit_log.
- [ ] Set up GitHub Actions to run the unit tests on pull requests and deploy staging on merge.

**Done when**

- Test orders from the sandbox reach a logging endpoint.
- Three staff sign in on staging, and `/api/me` returns their roles, including one person with both wine lead and manager.

## Phase 1: one app, one record

**Build**

- [ ] Migrations for wines, wine_notes, wine_compare, vintages, suppliers, photos, glossary_terms, regions, menu_profiles, progress, learner_state, lesson_sessions and tastings.
- [ ] `tools/import-sheets.js`, and a test that the imported guest menu matches today's, line by line.
- [ ] `src/js/api.js` in place of the sheet loader, handing the study modules the same wine shape.
- [ ] `src/js/shell.js` from `mock/app.js`: areas, sidebar and bottom bar, search, accounts, roles that add up.
- [ ] Learn on the API: progress sync, *Bring this device's progress into your account?*, and *Who's learning?* on the tablet from the venue's people.
- [ ] Office, Wines: *Add a wine* and *Edit a wine* with photos to R2, *Data check*, and glossary and regions editing.
- [ ] The public guest menu, plus the sheet-shaped feed for the current menu site.
- [ ] The offline cache for reading. Writes queue from phase 2.

**Done when**

- The guest menu matches today's, line by line.
- A note edited in the editor shows in the next lesson.
- A person's progress follows them from the tablet to their phone.
- The old study tool can be switched off.

## Phase 2: stock by hand, and the links to learning

**Build**

- [ ] Migrations for movements, open_bottles, off_tonight, deliveries, stock_takes and pairings (simple).
- [ ] `src/js/stock.js` from `mock/app.js`: levels, glasses left, run-out, open to taste, off tonight, swaps.
- [ ] Service: *Tonight*, the wine card's stock part, *Take off stock* with undo, and *Off tonight*.
- [ ] Office, Stock: the stock screen with ledgers, *Book in a delivery*, *Stock take* with approval, and simple pairings.
- [ ] The opening stock take.
- [ ] The offline write queue, with `client_id` on every write.
- [ ] The 4am job, which clears off tonight and staff-tasting bottles.
- [ ] Learning links: staff-tasting bottles open to taste, *Before service* skips wines that are off, the *Tasting notes* inbox, and *Team learning*.

**Done when**

- A full stock take is done on phones in under an hour.
- A removal made with wifi off arrives when it returns, once.
- A bottle opened for a staff tasting is offered in the next lesson.
- Every count can be explained from its ledger.

## Phase 3: Lightspeed

**Build**

- [ ] Item linking.
- [ ] Sales and pours in, by webhook or polling, idempotent by sale line.
- [ ] Voids and refunds.
- [ ] The *Unmatched* list.
- [ ] The nightly check against Lightspeed's report.
- [ ] Run-out estimates from sales.
- [ ] Low-glass warnings in *Tonight*.
- [ ] Best sellers coming round more often in reviews.

**Done when**

- A week running alongside Lightspeed, with matching sales for every linked item.
- No sale is counted twice.

## Phase 4: menu profiles

**Build**

- [ ] Profile switches with preview.
- [ ] Sold out and *Off tonight* on the menu.
- [ ] Hosted menu pages.
- [ ] Decide whether the current menu site moves onto the Worker.

**Done when**

- A made-up second venue shows tasting notes and photos while Apricity's menu is unchanged.
- A wine at zero stock leaves the menu by itself.

## Phase 5: tracked pairings

**Build**

- [ ] Pairings by course.
- [ ] Pairing items in Lightspeed.
- [ ] Pours per cover.
- [ ] The end-of-night check.

**Done when**

- For a week, expected and actual open-bottle levels agree within one glass a night.

## Where the mock's code goes

| In the mock | In production |
| --- | --- |
| `mock/app.js`: accounts, areas, navigation, search | `src/js/shell.js` |
| `mock/app.js`: stock rules, `studyHooks`, *Tonight*, *Tasting notes*, *Team learning*, *Me* | `src/js/stock.js`, `src/js/views/service/`, `src/js/views/office/` |
| `mock/base.html`: office screens (stock, take off, editor, delivery, stock take, pairings, Lightspeed, menus, venue) | `src/js/views/office/` and `views/service/`, reading and writing through `api.js` |
| `mock/app.css` and the study tool's styles | `src/` styles, one sheet |
| `mock/study-patches.py` | Removed: each patch becomes a normal change in `src/js` |
| Example stock, sales and people | `tools/seed-staging.js`, for staging only |
| `mock/e2e/*.cjs` | `e2e/`, against staging |

## Risks

| Risk | Fallback |
| --- | --- |
| Lightspeed API access is slow to arrive, or the account has no webhooks | Phases 1 and 2 need no Lightspeed. Poll if there are no webhooks |
| The team doesn't take off stock by hand reliably | Keep *Take off stock* to three taps, show tonight's removals on *Tonight*, and let the stock take catch what was missed |
| The shared tablet's sign-in expires during service | It keeps working from its cache and queues writes. A manager re-signs it after service |
| Estimated notes are wrong and the team learns them | The *Estimate* badge stays until a tasting is used, and *Team learning* points at what to taste next |
