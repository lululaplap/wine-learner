# Apricity Wine Study Tool: Design Spec

Exported from the Claude Docs spec on 2026-11-13.

A web tool that helps the floor team learn the 136-wine list quickly, then answers guest questions in seconds during service. This spec is written for Claude Code to build from, starting with the existing interactive map prototype.

## Goal and users

The tool has two jobs, and every screen serves one of them.

- **Learn:** get a new team member confident on the by-the-glass wines in days and the full list in weeks, using the methods wine professionals study with: structured tasting grids, comparison against anchors, and repeated self-testing.
- **Serve:** during service, answer "what would you recommend?" in under ten seconds, and act as the reference once the list is learnt.

**Users.** A pilot team of five floor staff at Apricity. Wine knowledge ranges from beginner to experienced. Nobody should need training to use it.

**Devices.** A shared tablet during service (landscape, touch only, used standing, often in low light). Personal phones for study away from the floor. It must work well at 390px wide and at 1024px wide.

**Status.** A prototype for a team trial. It needs to be reliable enough to use in a real service, but it does not need accounts, a database or an admin area.

**What success looks like after the pilot**

- A new starter passes the by-the-glass quiz (14 wines) at 90% within one week.
- During service, staff find a suitable wine for a guest request in under ten seconds, without typing.
- The team has replaced at least half of the estimated notes with their own tasting notes.
- At least four of the five say they would keep using it.

**Out of scope for the prototype:** stock levels, till or booking integration, a guest-facing wine list, user accounts, and anything that changes the existing menu pages.

## What exists today

Four things are already in place, and the build should start from them.

| Asset | What it is | Use it for |
| --- | --- | --- |
| Tool repo (lululaplap/wine-learner) | A new, empty repo for this project. | Where the tool is built and hosted, as its own GitHub Pages site. |
| Menu site repo (`lululaplap/apricity-mocks`), for reference | A static site on GitHub Pages. Pages are built from `src/` by `build.sh` and read their content from published Google Sheets as CSV. | Reference only. Copy its conventions: sheet loading, the CSV parser, the build script, the accessibility bar and the staff guide style. Nothing in this repo changes. |
| Wine sheet (`apricity_wines`) | The restaurant's live wine list, published as CSV. Columns: Section, Subsection, Unique Expression (♢), Vintage, Producer, Cuvée, Grape Varieties, Region, Bottle Price (£), Glass Price (£), Glass Size. It also feeds the main website. | The source of truth for what is on the list, prices and vintages. Read only. Never add or rename columns. |
| Prototype wine map (`prototype-wine-map.html`) | One HTML page using D3. Shows 136 wines as a network with 212 comparison links, re-clustered by style, grape, region, country, producer or price, with a wine card, search and filters. | The starting point for the Map view and the wine card. |
| Seed data (`wine-study-seed.json`) | For each wine: short name, lead grape, region group, country, a two-sentence style note, comparator links and a "check with supplier" flag. | The first contents of the study sheet (see Data). |

**Known limits of the prototype**

- The list is a snapshot taken from `sheets/wine.csv`, not the live sheet, so it will drift.
- Notes describe what the producer, grape and region normally give. They were not written from tasting these bottles. About 30 wines are flagged "check".
- There is no structured taste data, so similarity is hand-picked and there is nothing to quiz on beyond names.
- Nothing is saved: no progress, no personal notes.
- The wine sheet has some errors that affect grouping (Ganko is filed under Rhône but is from Rioja) and several misspelt producer names, misspelt regions (Fruili, Silicy, Emiglia Romagna, Rias Baxias, Rousillon) and regions written two ways (Rhone and Rhône, Kent ENG and Kent UK), which is why Region group is normalised. The seed data carries corrected display names.

## Screens

The tool opens on a mode switch: **Learn** or **Service**. The mode sets the home screen, the theme and how much detail a wine card shows. Every view is reachable from either mode.

| Screen | Mode | What it does | Phase |
| --- | --- | --- | --- |
| Wine card | Both | One wine: name, pronunciation, price, grapes, region, taste profile, style note, a line to say to a guest, serving notes, comparators, and a badge showing whether the notes are estimated or tasted by the team. | 1 |
| Data check | Both | Lists wines on the live list with no study notes, study rows with no matching wine, and wines flagged "check". | 1 |
| Map | Learn | The existing network map with its group-by options. | 1 |
| Learning path | Learn | Home for Learn mode. Shows the stages, progress in each, and a "Start today's session" button. | 2 |
| Quiz | Learn | Short sessions of generated questions with spaced repetition. | 2 |
| Finder | Service | Home for Service mode. Tap a few filters, get three recommendations with a line to say. No typing. | 3 |
| By the glass | Service | The glass list as large cards, for the most common request. | 3 |
| Taste map | Learn | Wines plotted by body against acidity (whites) or tannin (reds). Shows substitutes and gaps. | 4 |
| Ladders | Both | Each family (Pinot Noir, Chardonnay, Sangiovese and so on) laid out by price, for step-up and step-down selling. | 4 |
| Compare | Both | Any two wines side by side, with the differences highlighted. | 4 |
| Pairings | Service | Pick a dish from the current menu, see three wines at three prices. | 5 |
| Off tonight | Service | Mark a wine unavailable on this tablet until 4am. It drops out of the Finder. | 5 |

**Rules that apply to every screen**

- Touch targets at least 44px. Body text at least 16px. Works one-handed on a phone and in landscape on a tablet.
- Light and dark themes. Service mode defaults to dark for a low-lit room.
- Every wine name anywhere in the tool opens its wine card.
- A wine with estimated notes always shows an "Estimate" badge. Staff must be able to tell at a glance what has been verified by tasting.
- If a sheet cannot be loaded, show the last saved copy with its date and a clear "may be out of date" notice.

## Data

The wine list stays where it is. Everything the tool adds lives in one new sheet that the team can edit, in the same way they already edit the menus.

The tool reads both sheets as published CSV each time it opens, joins them by a wine key, and keeps personal progress on the device.

**Matching wines between the two sheets**

- The key is the producer plus the cuvée, lower-cased, with accents and punctuation removed. Vintage is not part of the key, so notes survive a vintage change.
- The study sheet has an optional `Also matches` column for alternative spellings, so fixing a typo in the wine sheet does not orphan a wine's notes.
- A wine with no study row still appears everywhere, with list data only and a "Needs notes" badge. It is never hidden.
- The by-the-glass rows and bottle rows for the same wine merge into one wine with two prices. On a By the Glass row the glass price is in the Bottle Price (£) column; Glass Price (£) and Glass Size are filled only for the sweet wines sold by the glass. Merging uses Also matches as well: two glass wines are named differently on their bottle row (Davenport Horsmonden and Horsemonden, Montanet-Thoden Vezelay and Galerne). The sheet's 148 rows come to 136 wines only once both merge.

**Study sheet columns**

| Column | Contents | Example |
| --- | --- | --- |
| Key, Also matches | The matching key and any alternative spellings | `mas du libian bout dzan` |
| Display name, Short name | Corrected names for cards and map labels | Mas du Libian, Bout d'Zan / Bout d'Zan |
| Pronunciation | Plain-English phonetics | boo d'ZAHN |
| Lead grape, Grape family | For grouping and ladders | Grenache / Grenache |
| Region group, Country | Corrected, normalised region | Rhône & Ardèche / France |
| Sweetness, Acidity, Tannin, Body, Oak, Wildness | Six scores, 1 to 5 (scales below) | 1, 3, 2, 3, 1, 2 |
| Flavours | Up to four tags from a fixed list | plum, licorice, herbs |
| Making | Tags from a fixed list: organic, biodynamic, no added sulfur, skin contact, whole bunch, oak aged, traditional method | biodynamic |
| Style note | Two sentences for staff | Juicy plum, licorice, soft tannin... |
| Guest line | One sentence to say at the table | "A juicy, fresh Rhône red from a biodynamic family farm." |
| If you like | Familiar styles this suits, from a fixed list | Côtes du Rhône, Malbec |
| Compare | Keys of wines to compare with | pranzegg, fronsac, clos fantine |
| Anchor | Yes for the reference wines taught first | yes |
| Serve | Temperature band and decanting | cool, no decant |
| Story | One memorable fact about the producer | Family estate since 1670 |
| Pairs with | Dish names or dish types (phase 5) | roast chicken, charcuterie |
| Source | `estimate` or `tasted`, plus who and when | tasted, LL, 2026-11-20 |
| Check | A question to resolve with the supplier | Confirm how dry it is |

**Taste scales**

Scores follow the five-step scale used in professional tasting grids, so they map onto WSET-style language.

| Score | Sweetness | Acidity, Tannin, Body | Oak | Wildness |
| --- | --- | --- | --- | --- |
| 1 | Dry | Low | None | Clean and classic |
| 2 | Off-dry | Medium minus | Subtle | Mostly classic |
| 3 | Medium | Medium | Noticeable | Some natural character |
| 4 | Sweet | Medium plus | Pronounced | Clearly natural, may be cloudy or funky |
| 5 | Luscious | High | Dominant | Divisive; warn the guest |

**Seeding the sheet.** Fill it first from `wine-study-seed.json`. Then draft the six scores, flavours, making tags, guest line and "if you like" for every wine, and mark all of it `estimate`. Estimates must come from reliable published information about the wine or, failing that, the typical style of the grape and region. Leave a field blank if there is no sound basis. Phase 1 also sets the three fixed lists (Flavours, Making, If you like) in a Lists tab of the study sheet, so the quiz, the Finder and staff all use the same words.

**Similarity.** A wine's comparators are the hand-picked `Compare` links first, then the nearest wines of the same type by distance across the six scores.

**Saved on each device.** A first name chosen from a list, quiz history per wine, the last mode and view, and wines marked off tonight. Use `localStorage`, handle it being unavailable, and offer "Reset my progress".

## Learning design

Learning is built on three ideas from how professionals study: learn a few anchors first and describe everything else against them, test yourself instead of re-reading, and revisit each fact just before you would forget it.

**Stages.** The path recommends an order but never locks anything.

1. **The anchors (5 wines).** Vézelay Galerne, L'Oiseau, Rosso per tutti, Fronsac, Bout d'Zan.
2. **Everything poured by the glass.** The 14 glass wines, then the 5 sweet wines sold by the glass (Sweet & Afters bottles with a Glass Price).
3. **Bottles under £100.** The wines most often ordered. A wine belongs to the first stage it qualifies for, so the glass wines' bottles are not asked again here.
4. **Families and ladders.** Pinot Noir, Chardonnay, Sauvignon Blanc, Riesling, Sangiovese, Syrah, Blaufränkisch, and the grower Champagnes.
5. **Bottles from £100 to £179.**
6. **The top of the list and the unusual wines.**

A stage counts as learnt when 90% of its wines are at "known" (see below). Stage membership is calculated from the live list, so a new wine by the glass joins stage 2 automatically.

**Question types.** All questions are generated from the data, never written by hand. Wrong options are drawn from wines of the same type so they are plausible.

| Type | Example | Needs |
| --- | --- | --- |
| Identify | "Bout d'Zan: which grapes, which region?" | List data |
| Describe | "Which of these four is the leanest white?" | Taste scores |
| Reverse | "Meaty, herbal, smoky, no added sulfur. Which wine?" | Style note, tags |
| Price | "Rosso per tutti by the glass: £15, £17, £19 or £22?" | List data |
| Step up or down | "A guest enjoyed Fanny Sabre. What is the step up?" | Ladders |
| Guest request | "They usually drink Sancerre and want something more unusual. Pick one." | If you like, Compare |
| Heads-up | "Which of these should you warn a guest about before pouring?" | Wildness |
| Say it | Shows a wine. The learner says their pitch aloud, reveals the guest line, and grades themselves. | Guest line |

Do not generate a question from a field marked `estimate` for the Describe, Reverse or Heads-up types unless no tasted data exists yet for that stage. Where estimates are used, say so on the answer screen.

**Spaced repetition.** Use a simple five-box system per wine and per person.

| Box | Meaning | Asked again after |
| --- | --- | --- |
| 1 | New or just missed | Later in the same session |
| 2 | Seen | 1 day |
| 3 | Learning | 3 days |
| 4 | Known | 7 days |
| 5 | Solid | 21 days |

A correct answer moves the wine up one box. A wrong answer sends it back to box 1. "Known" means box 4 or above.

**Sessions.** A session is 10 questions and should take about three minutes. It mixes due reviews with new wines from the current stage, and adds no more than 4 new wines per session. A separate "Before service" session asks 5 questions on tonight's by-the-glass wines only.

**After each answer.** Show whether it was right, the wine's guest line, and one comparator ("lighter than Bout d'Zan"). Tapping the wine opens its card.

**List changes.** When a wine's vintage or price changes, or a new wine appears, show it under "New on the list" on the learning path and put it in box 1.

## Service design

Service mode is for a member of staff standing at the pass with a tablet and a guest waiting. It must give a usable answer within three taps and without the keyboard.

**Finder layout (tablet, landscape).** Filters on the left, results on the right, both visible at once. On a phone the filters collapse into a bar above the results.

| Filter | Options | Works from |
| --- | --- | --- |
| Type | Sparkling, White, Rosé, Orange, Red, Sweet | List data |
| How to buy | By the glass, Bottle | List data |
| Budget | Under £80, £80 to £99, £100 to £129, £130 to £179, £180 and over | List data |
| Style | Crisp and light, Aromatic, Round and rich, Light red, Medium red, Full red. Each style is a written rule on the scores, for example Crisp and light = white, body 1 or 2, acidity 4 or 5 | Taste scores |
| Guest usually drinks | A fixed list of familiar styles, such as Sancerre, Chablis, Pinot Grigio, Provence rosé, Rioja, Malbec, Pinot Noir | If you like |
| How adventurous | Classic, Curious, Bring it on | Wildness |

Filters are large chips. Selecting one updates the results straight away. A single "Clear" button resets everything.

**Results.** The top of the list is always three labelled picks, chosen from the wines that match:

- **The safe pick:** lowest wildness, closest to the request.
- **The step up:** the next wine up the same ladder or price band.
- **Something different:** a comparator with a higher wildness score or a less familiar grape.

Each pick shows the short name, price, three style words and the guest line. Below the three picks, list every other match sorted by price. If nothing matches, relax the budget filter first and say that this was done.

**Service wine card.** A cut-down card showing only what is needed at the table: name and pronunciation, bottle and glass price, the guest line, three style words, serving note, a heads-up line if wildness is 4 or 5, and two alternatives ("a little less" and "a little more"). Internal fields (Check, Source, Story) are hidden in Service mode, so the tablet can be turned towards a guest.

**By the glass.** One screen of large cards for the glass list, grouped by type, with price and guest line. This is the default answer to "what do you have by the glass?".

**Tablet behaviour**

- Keep the screen awake in Service mode where the browser supports it.
- After two minutes without a touch, return to the Finder with filters cleared.
- Work offline after the first load, using the last saved copy of both sheets (a service worker caches the page and its scripts; the sheets are saved in localStorage). Show "List as of 17:42" in the header.
- No sound, no animation longer than 200ms, nothing that needs a hover.

## Build plan

Build in five phases, each of which leaves something the team can use. Stop after any phase and the tool still works.

| Phase | Build | Done when |
| --- | --- | --- |
| 1. Data foundation | Study sheet template and seed import. Loader that fetches both sheets and joins them. Wine card. Data check. Port the existing map onto the live data. Learn and Service mode switch. | Every wine on the live list appears. A price changed in the wine sheet shows in the tool within about five minutes. A wine added to the list appears with a "Needs notes" badge. Data check lists zero unmatched study rows for the seed data. |
| 2. Learn | Estimated taste scores and guest lines for all wines. Learning path. Quiz with the eight question types and the five-box schedule. Name picker and saved progress. | A new user can complete a 10-question session on a phone in about three minutes. Progress survives closing the browser. Questions never offer two correct options. Automated tests cover the scheduler and every question generator. |
| 3. Service | Finder, By the glass board, service wine card, offline copy, screen wake, idle reset. | From a cleared Finder, any by-the-glass red is reachable in two taps and a bottle recommendation in three. The tool loads and works with the network switched off after one online visit. Usable on a 10-inch tablet in landscape with no horizontal scrolling. |
| 4. Reference views | Taste map, Ladders, Compare. Computed similarity alongside hand-picked comparators. | Each view opens the wine card on tap. Ladders update when prices change. Taste map marks estimated wines differently from tasted ones. |
| 5. Pairings and upkeep | Pairings from the live menu sheets. Off tonight. A printable one-page sheet per stage. | Picking a dish returns three wines at three price points. A wine marked off tonight is absent from the Finder on that tablet until 4am. |

**Technical constraints**

- Static files only, served by GitHub Pages from the wine-learner repo. No server, no database, no sign-in.
- Build in `wine-learner` and follow the pattern `apricity-mocks` uses: source in `src/`, built output at the repo root, sheet links set in one build script, a local copy of each sheet in `sheets/` for testing. Reuse the menu's CSV parser (`parseCSV` in `src/menu.html`) rather than writing a new one.
- Do not change anything in `apricity-mocks`, or the wine sheet's columns.
- Plain JavaScript modules and D3 for the visual views. No framework is required. Keep the first load under 300KB excluding fonts. The full D3 build is about 280KB on its own, so load only the D3 modules the map views need, and only when one opens.
- Parse CSV with a real parser that handles quoted commas. The wine sheet has them.
- Meet the accessibility bar the menu already sets: text at least 16px in this tool, contrast of at least 6.7:1 (the menu's own bar; WCAG AA asks for 4.5:1), visible keyboard focus, and no information carried by colour alone (wine type also uses shape, as in the prototype).
- Write the taste-score estimates into the study sheet file, not into the code, so staff can correct them without a developer.
- Add a short staff guide, `UPDATING-THE-WINE-NOTES.md`, in the style of `UPDATING-THE-MENU.md in apricity-mocks`.

## Pilot with the team

Run a three-week trial with all five people once phases 1 to 3 are built. Phases 4 and 5 can follow the trial and be shaped by it.

| Week | What the team does | What to record |
| --- | --- | --- |
| 1 | Everyone does one session a day on their phone. Taste the five anchors together and replace their estimated notes. | Sessions completed per person. By-the-glass quiz score at the end of the week. |
| 2 | The tablet is used in Service mode on every shift. Taste the rest of the glass list together. | How often the Finder is opened per shift. Any request it could not answer. |
| 3 | Continue both. Work through bottles under £100. | Share of wines marked `tasted`. Quiz score on stage 3. |

The tool should keep a simple local count of sessions completed and Finder searches per day, shown on a "Pilot stats" page, because there is no shared database to collect them. Each person reads their numbers out at the end of the week.

**Questions to ask the team afterwards**

- Did it change what you recommended, or how confident you felt recommending it?
- Which screen did you use most, and which never?
- Where were the notes wrong?
- What did a guest ask that you could not answer with it?

## Open decisions

Each has a recommended default, so the build can start without waiting.

| Decision | Recommended default | Why it matters |
| --- | --- | --- |
| Is a public web address acceptable? | Yes for the pilot, at an unlisted address. | GitHub Pages is public. Anyone with the link could read the staff notes and guest lines. Nothing personal is stored. |
| Who edits the study sheet? | One wine lead edits; the other four send corrections. | Five editors on one sheet during a trial leads to conflicting notes. |
| Should taste scores be estimated before anyone tastes? | Yes, clearly badged as estimates. | Without them the Finder, taste map and half the quiz cannot work on day one. The risk is staff repeating an unverified note to a guest. |
| Do you need to see each other's progress? | Not in the pilot. | A shared progress board needs a database and sign-in, which is the largest step up in complexity. Add it only if the trial shows it is wanted. |
| Who writes the food pairings? | The wine lead with the kitchen, in phase 5. | Generated pairings would be guesses. Pairings are only worth showing if someone who knows the dishes wrote them. |
| Will the errors in the wine sheet be fixed at source? | Yes, by whoever owns the sheet. | The study sheet can work around typos, but the guest-facing menu shows them too. |
| Does the tablet have reliable wifi on the floor? | Assume not; build the offline copy in phase 3. | Decides whether offline support can be dropped. |
| Where does the study sheet live? | A new tab in the Apricity menus sheet, published as CSV, its link set in the tool's build script. | The team already edits that sheet and knows how to publish its tabs. The wine sheet can't take it: its columns must not change. |

## Handover to Claude Code

Give Claude Code three files, placed in a `docs/wine-study/` folder in the wine-learner repo, with apricity-mocks cloned beside it: this spec exported as Markdown (`SPEC.md`), `prototype-wine-map.html` and `wine-study-seed.json`. Then paste the prompt below.

```
You are working in the wine-learner repo, a new, empty repo for a wine study tool for the floor staff at the restaurant Apricity. It will be a static site on GitHub Pages. The restaurant's menu site, apricity-mocks, is cloned beside it for reference only: copy its conventions and change nothing in it.

Read these first:
- In apricity-mocks: README.md, UPDATING-THE-MENU.md, build.sh and src/menu.html, to learn how its pages are built and how they read published Google Sheets. Follow the same pattern here.
- docs/wine-study/SPEC.md, the design spec for a new wine study tool for floor staff.
- docs/wine-study/prototype-wine-map.html, a working single-page prototype of the Map view.
- docs/wine-study/wine-study-seed.json, starting notes and comparator links for 136 wines.

Build Phase 1 of the spec only. Before writing code, reply with:
1. A short plan: the files you will add, and how the build works.
2. The exact column list for the study sheet, and the CSV you will generate from the seed file.
3. Anything in the spec that is unclear or that conflicts with apricity-mocks or the wine sheet.

Rules:
- Do not change anything in apricity-mocks, or the wine sheet's columns.
- Static files only. No server, database or sign-in.
- Notes in the seed file are style estimates, not tasting notes. Keep the Source field as "estimate" and keep every "check" flag.
- Do not invent facts about a wine. If you draft taste scores later, base them on the grape, region and producer style, mark them "estimate", and leave a field blank when unsure.
- Add tests for the sheet matching logic, and run them.
- When Phase 1 meets its "Done when" checks in the spec, stop and summarise what you built and how to preview it locally.
```

For each later phase, start a new session with: "Read docs/wine-study/SPEC.md. Phase N is next. Plan it, then build it, and stop at its Done-when checks."
