# Apricity wine study tool

A web tool that helps the floor team learn the wine list quickly, then answers guest questions in seconds during service. The design is in [`docs/wine-study/SPEC.md`](docs/wine-study/SPEC.md). This is **phase 1, the data foundation**.

**Next: one app.** The study tool is joining the stock, POS and menu system in one app, Apricity Wine. The clickable mock is in [`mock/`](mock/README.md). The production spec and the plan are in [`docs/app/`](docs/app/PRODUCTION-SPEC.md).

## What phase 1 does

- **Reads the live wine list.** Every wine in the restaurant's *apricity_wines* sheet appears, joined to its study notes by a wine key (producer plus cuvée, lower case, no accents or punctuation, no vintage). Glass and bottle rows merge into one wine with two prices.
- **Lessons.** Learn mode's home: a Duolingo-style path, one unit per stage (anchors, the tasting menu, by the glass, bottles under £100, families, £100 to £179, the top of the list), each a row of short lessons. A lesson is 10 questions in about three minutes, mixing up to 4 new wines with reviews that are due, in twenty question types: multiple choice both ways round (Identify, Pick the wine, Describe, Reverse, Price, Step up, Guest request, Heads-up, Odd one out, and four on the tasting menu: which wine, which dish, why it works, which pairing), Match (tap the pairs), Say it, and five typed with suggestions as you type (Missing grape, Name the grape, Where from, Name the wine, Type the price). Typed answers forgive capitals, accents, a spelling slip and grape synonyms (Garnacha for Grenache), and only start once a wine has left box 1. Spaced repetition uses five boxes per wine and per person, kept on the device. **Wine words** brings the glossary in: a lesson asks about a word or two its own wines use (due ones first, at most one new), and *Wine words* on the path is a lesson of terms alone. Questions go both ways (what a term means, which term a meaning describes), match terms to meanings, ask which wine a word describes (“Chalky”: which of these wines?), and ask to find every wine with a word in its notes. Each term has its own five boxes: it comes round less often as it is answered right on separate days, and once in box 5 it is learnt and no longer asked. A word answered right the first time it is met skips to box 4, so one more right answer retires it. How many words a lesson asks follows the learner's recent answers to word questions: two while the app finds out, then fewer as they get them right, and none at 90% or more, so someone who knows wine and is here for the list sees only wines. A missed word comes back once in a lesson, not again and again. Also *Before service* (5 questions: 3 on the glass list, 2 on the tasting menu), *Review*, *New on the list* and *Reset my progress*.
- **Taste first.** A lesson with a wine that is open starts by offering to taste it: the learner fills in the tasting grid (the six scores, up to four flavours, a note), then sees it beside the notes, with *Copy my notes* to send to the wine lead. Wines by the glass are open by default; any bottle can be marked *Open to taste today* on its card (and a glass wine *Not open today*). The marks are per device and clear at 4am. The path lists extra open bottles with a *Taste what's open* lesson. Every wine card also has **Taste it**: it goes straight to the grid for that wine, open or not, then shows your notes beside the card's, with *Back to the wine* (where your tasting now shows) or *Two questions on it*.
- **Mode switch.** *Learn* (home: the lessons) and *Service* (home: the wine list, dark theme). The mode sets the theme and how much a wine card shows. Every screen is reachable from both.
- **Wine card.** Name, price, grapes, region, style note, comparisons and a badge: *Estimate*, *Tasted* or *Needs notes*. In Service mode the internal fields (Check, Source, Story) are hidden.
- **Wine list.** By the glass first, then bottles by style, with one-tap type chips and a search box.
- **Search.** One search (`src/js/search.js`) behind every search box, here and in the mock. Capitals, accents, punctuation, small words (du, de, la) and plurals don't matter, so “cotes du rhone” finds the Rhône wines. Every word must match, in any order. Slips are forgiven by length (two swapped letters in a 4-letter word, one slip from 5 letters, two from 8), and closer matches always rank first. Words typed apart are tried joined (“chateau neuf”), sound-alikes too far off for that come from the *Misspellings* column of the *Wine regions* tab (“bojolais”), and when nothing matches, *Did you mean…?* offers the nearest word on the list. It looks at the names, the grapes under any of their names (Garnacha finds Grenache), the region and its other names from the *Wine regions* tab (Côtes du Rhône, Châteauneuf-du-Pape), the style, and the *If you like* styles and flavours, which rank lower and show why: “From Rhône & Ardèche, which includes Côtes du Rhône”.
- **Map.** The prototype network map, on the live data, grouped by connections, style, grape, region, country, producer or price.
- **Regions map.** A real map of the wine world: 70 regions, 41 of which we pour from. Tap a region for what it is known for and our wines from it; zoom in to see each wine at its village or appellation (34 wines so far; the rest sit at their region's centre). Every wine card has *Show on the map*.
- **Glossary links.** Wine jargon in the notes is a blue, Wikipedia-style link. Hover with a mouse, or tap on an iPad or phone, to read a short definition. The 72 terms live in `sheets/glossary.csv` (the *Wine glossary* tab).
- **Data check.** Wines with no notes, study rows that match no wine, broken comparison links, duplicate rows, and the wines flagged "check with supplier".
- **Saved copy.** Each sheet is saved on the device when it loads. If a sheet cannot be loaded, the tool shows the saved copy with its time and a "may be out of date" notice. On a device with no saved copy, it falls back to the copy in `sheets/`.

**Tasting-menu pairings.** The *Wine pairings* tab (`sheets/pairings.csv`) holds the tasting menu from the *Pairing + BTG Bible* (6 Oct 2026): course by course, each dish, its wine and the script to say at the table. A **Pairings** screen (in the menu, in Service and Learn) shows the whole tasting menu course by course: each dish, its wine and the script, with buttons to jump to a course. The wine card shows them under *On the tasting menu*, with the script folded away; each pairing can have a *Why it works* line (from the bible's scripts, written without naming the dish), shown on the Pairings screen, the card and the answer screen. The path has a unit, *The tasting menu*, straight after the anchors, that asks which wine goes with each dish, which dish with each wine, why the pairing works (“Garance with the venison: why does it work?”) and the reverse (a reason: which pairing is this?); *Before service* asks two of these beside three on the glass list; search finds a wine by its dish ("venison"). Retired pairings are kept in the tab for reference.

The study sheet was seeded from the prototype (`tools/seed-to-study.py`): 136 wines with style notes, comparison links and 34 "check" flags. On 24 Nov 2026 the wine sheet copy was refreshed (156 wines) and the bible's notes, stories, places and pairings were added; 22 wines new to the list still need notes (see Data check). Taste scores, flavours, making tags, "if you like" styles and guest lines were then drafted for every wine (`tools/estimates.txt`, applied with `tools/apply-estimates.py`, which only fills empty cells). Everything is marked `estimate` until the team tastes it.

## How it is built

The same pattern as the menu site (`apricity-mocks`):

| Path | What it is |
| --- | --- |
| `src/index.html`, `src/js/` | The source. Plain JavaScript modules, no framework |
| `index.html`, `js/` | The built pages GitHub Pages serves. Made by `./build.sh`; don't edit them by hand |
| `build.sh` | Copies `src/` to the root and points each sheet at its published Google Sheets link |
| `sheets/` | Local copies of the sheets, for testing and as the last-resort copy |
| `vendor/d3-map.js` | Just the D3 modules the maps use (105KB), loaded only when a map opens |
| `vendor/world-50m.json` | Country outlines for the Regions map (Natural Earth, public domain; 75KB compressed), loaded only when it opens |
| `tools/seed-to-study.py` | Made the first `sheets/study.csv` from the seed file (run `tools/apply-estimates.py` after it) |
| `tools/estimates.txt` | The drafted tasting estimates, one line per wine |
| `test/` | Tests for the sheet matching, glossary, regions, scheduler and every question generator: `npm test` (Node 20+) |
| `docs/wine-study/` | The spec, the prototype map and the seed data |

## Preview it locally

```sh
./build.sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/> for the live wine sheet, or <http://localhost:8000/?local> to read only the copies in `sheets/`.

## Updating the notes

See [`UPDATING-THE-WINE-NOTES.md`](UPDATING-THE-WINE-NOTES.md). Until the study sheet is set up in Google Sheets, the tool reads `sheets/study.csv`.

## Publishing

Turn on GitHub Pages for this repository (Settings → Pages → Deploy from a branch → the main branch, root folder). The address is public but unlisted, and the page asks search engines not to index it.
