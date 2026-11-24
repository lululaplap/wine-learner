# Updating the wine notes

The wine study tool reads two sheets. Change either sheet and the tool updates by itself. Nothing else needs doing.

- **The wine sheet** (*apricity_wines*): what is on the list, prices and vintages. It also feeds the website and the table menu. Keep using it exactly as you do now. The tool only reads it.
- **The study sheet**: everything the tool adds. Style notes, guest lines, taste scores, comparisons, and the questions to check with the supplier.

**Changes usually appear within 5 minutes.** Google refreshes published sheets on its own schedule. The tool reads the sheets each time it opens; tap the time at the top (*List as of 17:42 ↻*) to read them again.

**The wine sheet wins.** Every wine in the wine sheet appears in the tool, even with no study notes. A wine with no notes shows a *Needs notes* badge. A wine taken off the wine sheet disappears from the tool, and its study row is listed in *Data check* so you can tidy it up.

## Everyday changes

**A price or vintage changes.** Change it in the wine sheet, as you do now. The notes stay attached.

**A new wine arrives.** Add it to the wine sheet as usual. It appears in the tool straight away with a *Needs notes* badge. Then open **Data check** in the tool: under *On the list, no study notes* it shows the wine with its key (for example `mas du libian bout dzan`). Add a row to the study sheet with that key in *Key* and fill in what you know.

**A wine's name is fixed in the wine sheet** (a typo corrected, say). Nothing to do if the study row's *Key* already uses the right spelling. If the wine then shows *Needs notes*, add the new spelling to its row's *Also matches*, or change its *Key*. Data check shows which study row has lost its wine.

**You taste a wine as a team.** Correct the notes and scores in its row, then change *Source* from `estimate` to `tasted`, with who and when: `tasted, LL, 2026-11-20`. The badge changes from *Estimate* to *Tasted*.

**A bottle is open to taste.** Open its wine card and tap *Open to taste today*. Lessons on that device then offer to taste it first, and the Lessons page shows it under *Open to taste today*. A glass wine that has run out can be marked *Not open today*. All of this resets at 4am, and only on the device where you set it.

**Collecting the team's tasting notes.** After tasting in a lesson, *Copy my notes* puts the person's assessment on the clipboard, with the notes' score beside each of theirs. Ask the team to send theirs to whoever keeps the study sheet; agreed corrections go into the sheet, with *Source* set to `tasted`.

**The estimates need checking.** Every wine's taste scores, flavours, making tags, "if you like" styles and guest line were drafted as estimates, from the grape, region, producer style and the existing note. Start with the five anchors and the glass list: taste them, correct the row, and change *Source* to `tasted`. The lessons use whatever the sheet says, so a correction reaches the quiz straight away.

**A supplier question is answered.** Fix the note, then clear the *Check* cell.

## The tabs

| Tab | What it holds |
| --- | --- |
| **Wine study** | One row per wine: the notes the tool shows |
| **Wine lists** | The fixed words for *Flavours*, *Making* and *If you like*, one per row, so the quiz and the Finder use the same words as you |
| **Wine regions** | The wine regions of the world for the Regions map: where each sits, what it is known for, its grapes |
| **Wine glossary** | Wine jargon and what it means. The tool turns these words into blue links in the notes; hover or tap one to read the definition |
| **Wine pairings** | The tasting menu, course by course: each dish, its wine and the script to say at the table. It comes from the *Pairing + BTG Bible* |

## Column guide

**Wine study**

| Column | What to type | Example |
| --- | --- | --- |
| Key | The wine's producer and cuvée in lower case, without accents or punctuation. Data check shows the exact key for any wine without notes | `mas du libian bout dzan` |
| Also matches | Other spellings of the same wine in the wine sheet, separated by `;` | `mas du libian bout d zan` |
| Display name | The name as it should read, with accents and corrected spelling | Mas du Libian, Bout d'Zan |
| Short name | A short name for the map and lists | Bout d'Zan |
| Pronunciation | Plain-English sounds | boo d'ZAHN |
| Lead grape | The main grape | Grenache |
| Grape family | The family for ladders (often the same as the lead grape) | Grenache |
| Region group | The region, corrected | Rhône & Ardèche |
| Country | The country | France |
| Place | The village or appellation the wine comes from, if known | Fronsac |
| Latitude, Longitude | Where that place is, in decimal degrees (right-click the spot in Google Maps to copy them). Leave blank and the wine is pinned at its region's centre, marked "region only" | 44.92, -0.27 |
| Sweetness, Acidity, Tannin, Body, Oak, Wildness | A score from 1 to 5 each (see below). Leave blank if unsure | 3 |
| Flavours | Up to four words from the *Flavours* list, separated by `,` | plum, licorice, herbs |
| Making | Words from the *Making* list | biodynamic |
| Style note | Two sentences for staff | Juicy plum, licorice, soft tannin… |
| Guest line | One sentence to say at the table | A juicy, fresh Rhône red from a biodynamic family farm. |
| If you like | Familiar styles this suits, from the *If you like* list | Côtes du Rhône, Malbec |
| Compare | Keys of wines to compare with, separated by `;` | `pranzegg rosso per tutti; matthieu cosse fronsac` |
| Anchor | `yes` for the five reference wines taught first | yes |
| Serve | Temperature and decanting | cool, no decant |
| Story | One memorable fact about the producer (hidden in Service mode) | Family estate since 1670 |
| Pairs with | Dishes (phase 5) | roast chicken |
| Source | `estimate`, or `tasted` with who and when | tasted, LL, 2026-11-20 |
| Check | A question for the supplier (hidden in Service mode). Clear it once answered | Confirm how dry it is |

**Taste scores**

| Score | Sweetness | Acidity, Tannin, Body | Oak | Wildness |
| --- | --- | --- | --- | --- |
| 1 | Dry | Low | None | Clean and classic |
| 2 | Off-dry | Medium minus | Subtle | Mostly classic |
| 3 | Medium | Medium | Noticeable | Some natural character |
| 4 | Sweet | Medium plus | Pronounced | Clearly natural, may be cloudy or funky |
| 5 | Luscious | High | Dominant | Divisive; warn the guest |

**Wine lists**: two columns, *List* (`Flavours`, `Making`, `If you like` or `Team`) and *Value*. Add a row to add a word. Rows with *List* `Team` are the first names offered when someone opens Lessons for the first time; anyone not listed can type their name.

**Wine regions**

| Column | What to type | Example |
| --- | --- | --- |
| Region | The region's name. A wine's *Region group* must match it (or one of its *Also matches*) | Loire |
| Country | The country | France |
| Latitude, Longitude | The middle of the region, in decimal degrees | 47.30, 0.70 |
| Also matches | Other names that mean this region, separated by `;`: appellations, local spellings, and the region names used in the wine sheet | Sancerre; Muscadet; Loire Valley |
| Misspellings | Ways guests and staff spell it that are too far off for search to catch by itself, separated by `;`. Search uses them; they are never shown. A slip of a letter or two needs no entry | Sansair; Sanser |
| Known for | One plain sentence | France's longest river: Muscadet near the sea… |
| Grapes | The main grapes | Chenin Blanc, Sauvignon Blanc, Cabernet Franc |

**When a search finds nothing.** Search forgives a slip or two in a word (more in longer words) and offers *Did you mean…?* when a word is close to one on the list. If the team keeps typing a name it can't place (“bojolais”), add that spelling to the region's *Misspellings*.

A wine whose region matches no row is listed in **Data check** under *Wines with no region on the map*. Add the name to a region's *Also matches* (or fix the spelling), and it appears on the map.

**Wine glossary**

| Column | What to type | Example |
| --- | --- | --- |
| Term | The word as the definition's heading shows it | Pét-nat |
| Also matches | Other forms to link, separated by `;`: plurals, spellings with and without accents, French or German versions | pet-nat; pétillant naturel |
| Definition | One or two plain sentences for a new starter | A sparkling wine bottled before its first fermentation finishes… |

Capitals, accents and hyphens don't matter: `pet nat` also finds "Pét-nat". Only whole words are linked, and only the first mention on a screen. Keep forms specific: a form like `orange` would also link "orange peel", so the glossary uses `orange wine` instead.

**Add a term.** Add a row. It is linked everywhere it appears from the next time the tool loads.

### Wine pairings

One row per dish and wine. A dish served with either of two wines (the cheese: the Maury or the Banyuls, whichever is on) has a row for each wine. The wine card shows the course, the dish and the script; lessons ask which wine goes with each dish and which dish with each wine; search finds a wine by its dish.

| Column | What to type | Example |
| --- | --- | --- |
| Order | The course's place on the menu: 1 for the first course | 4 |
| Course | The course's name | Main |
| Choose one | `yes` when guests pick one dish from the course | yes |
| Dish | The dish's short name, as staff say it | Venison |
| Dish detail | The full dish, if the short name isn't enough (optional) | Pollack with sardine emulsion, borlotti beans and tomato |
| Wine | The wine's study *Key* | montanetthoden garance |
| Status | `On` for tonight's menu; `Retired` for a pairing kept for reference | On |
| Note | Anything staff need to know (optional) | Serve the Maury or the Banyuls, whichever is on |
| Script | What to say at the table, written to be spoken | Garance comes from Domaine Montanet-Thoden… |

**The menu changes.** Set the old pairing's *Status* to `Retired` and add the new one. Lessons stop asking about the retired one straight away. **Data check** lists any pairing whose wine isn't on the list.

## Setting up the study sheet (once)

1. In the **Apricity menus** Google Sheet, add five tabs: **Wine study**, **Wine lists**, **Wine glossary**, **Wine regions** and **Wine pairings**.
2. Import `sheets/study.csv` into *Wine study*, `sheets/lists.csv` into *Wine lists*, `sheets/glossary.csv` into *Wine glossary*, `sheets/regions.csv` into *Wine regions* and `sheets/pairings.csv` into *Wine pairings* (File → Import → Upload → *Replace current sheet*).
3. File → Share → Publish to web. Publish each tab as *Comma-separated values (.csv)* and copy its link.
4. Paste the links into `STUDY_CSV`, `LISTS_CSV`, `GLOSSARY_CSV`, `REGIONS_CSV` and `PAIRINGS_CSV` in `build.sh`, run `./build.sh`, and commit.

Until then the tool reads the copies in `sheets/`, which only change when someone edits them in the repo.
