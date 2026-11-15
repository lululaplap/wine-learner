# Apricity wine study tool

A web tool that helps the floor team learn the wine list quickly, then answers guest questions in seconds during service. The design is in [`docs/wine-study/SPEC.md`](docs/wine-study/SPEC.md). This is **phase 1, the data foundation**.

## What phase 1 does

- **Reads the live wine list.** Every wine in the restaurant's *apricity_wines* sheet appears, joined to its study notes by a wine key (producer plus cuvée, lower case, no accents or punctuation, no vintage). Glass and bottle rows merge into one wine with two prices.
- **Lessons.** Learn mode's home: a Duolingo-style path, one unit per stage (anchors, by the glass, bottles under £100, families, £100 to £179, the top of the list), each a row of short lessons. A lesson is 10 questions in about three minutes, mixing up to 4 new wines with reviews that are due, in sixteen question types: multiple choice both ways round (Identify, Pick the wine, Describe, Reverse, Price, Step up, Guest request, Heads-up, Odd one out), Match (tap the pairs), Say it, and five typed with suggestions as you type (Missing grape, Name the grape, Where from, Name the wine, Type the price). Typed answers forgive capitals, accents, a spelling slip and grape synonyms (Garnacha for Grenache), and only start once a wine has left box 1. Spaced repetition uses five boxes per wine and per person, kept on the device. Also *Before service* (5 questions on the glass list), *Review*, *New on the list* and *Reset my progress*.
- **Taste first.** A lesson with a wine that is open starts by offering to taste it: the learner fills in the tasting grid (the six scores, up to four flavours, a note), then sees it beside the notes, with *Copy my notes* to send to the wine lead. Wines by the glass are open by default; any bottle can be marked *Open to taste today* on its card (and a glass wine *Not open today*). The marks are per device and clear at 4am. The path lists extra open bottles with a *Taste what's open* lesson.
- **Mode switch.** *Learn* (home: the lessons) and *Service* (home: the wine list, dark theme). The mode sets the theme and how much a wine card shows. Every screen is reachable from both.
- **Wine card.** Name, price, grapes, region, style note, comparisons and a badge: *Estimate*, *Tasted* or *Needs notes*. In Service mode the internal fields (Check, Source, Story) are hidden.
- **Wine list.** By the glass first, then bottles by style, with one-tap type chips.
- **Map.** The prototype network map, on the live data, grouped by connections, style, grape, region, country, producer or price.
- **Regions map.** A real map of the wine world: 70 regions, 41 of which we pour from. Tap a region for what it is known for and our wines from it; zoom in to see each wine at its village or appellation (34 wines so far; the rest sit at their region's centre). Every wine card has *Show on the map*.
- **Glossary links.** Wine jargon in the notes is a blue, Wikipedia-style link. Hover with a mouse, or tap on an iPad or phone, to read a short definition. The 72 terms live in `sheets/glossary.csv` (the *Wine glossary* tab).
- **Data check.** Wines with no notes, study rows that match no wine, broken comparison links, duplicate rows, and the wines flagged "check with supplier".
- **Saved copy.** Each sheet is saved on the device when it loads. If a sheet cannot be loaded, the tool shows the saved copy with its time and a "may be out of date" notice. On a device with no saved copy, it falls back to the copy in `sheets/`.

The study sheet was seeded from the prototype (`tools/seed-to-study.py`): 136 wines with style notes, comparison links and 34 "check" flags. Taste scores, flavours, making tags, "if you like" styles and guest lines were then drafted for every wine (`tools/estimates.txt`, applied with `tools/apply-estimates.py`, which only fills empty cells). Everything is marked `estimate` until the team tastes it.

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
