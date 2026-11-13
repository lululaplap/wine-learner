// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCSV, toRows } from "../src/js/csv.js";
import { wineKey, keyList } from "../src/js/key.js";
import { buildWines, typeOf, price } from "../src/js/data.js";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const WINE = toRows(read("sheets/wine.csv"));
const STUDY = toRows(read("sheets/study.csv"));
const HEAD = "Section,Subsection,Unique Expression (♢),Vintage,Producer,Cuvée,Grape Varieties,Region,Bottle Price (£),Glass Price (£),Glass Size\n";
const STUDY_HEAD = "Key,Also matches,Display name,Short name,Compare,Source,Check\n";

test("CSV parser keeps quoted commas, quotes and line breaks", () => {
  assert.deepEqual(parseCSV('a,"b, c","say ""hi""","two\nlines"\n'), [["a", "b, c", 'say "hi"', "two\nlines"]]);
});

test("the key ignores case, accents, punctuation and spacing", () => {
  assert.equal(wineKey("Mas du Libian", "Bout d'Zan"), "mas du libian bout dzan");
  assert.equal(wineKey("Valérie  Courrèges", "Le Vent dans les Voiles"), wineKey("valerie courreges", "le vent dans les voiles"));
  assert.equal(wineKey("Apricity × Wasted Wine Club", "Riesling+"), "apricity wasted wine club riesling");
  assert.deepEqual(keyList("Pranzegg Rosso per tutti; fronsac,  CLOS fantine"), ["pranzegg rosso per tutti", "fronsac", "clos fantine"]);
});

test("the key leaves out the vintage, so notes survive a vintage change", () => {
  const sheet = toRows(HEAD + "Bottles,Red,,2019,Mas du Libian,Bout d'Zan,Grenache,\"Rhone, FR\",60,,\n");
  const later = toRows(HEAD + "Bottles,Red,,2025,Mas du Libian,Bout d'Zan,Grenache,\"Rhone, FR\",64,,\n");
  const study = toRows(STUDY_HEAD + "mas du libian bout dzan,,,,,estimate,\n");
  assert.equal(buildWines(sheet, study).wines[0].hasNotes, true);
  const w = buildWines(later, study).wines[0];
  assert.equal(w.hasNotes, true);
  assert.equal(w.vintage, "2025");
  assert.equal(w.bottle, 64);
});

test("Also matches keeps notes attached when the sheet spelling changes", () => {
  const study = toRows(STUDY_HEAD + "davenport horsmonden,davenport horsemonden,,,,estimate,\n");
  const typo = toRows(HEAD + "Bottles,White,,2023,Davenport,Horsemonden,Bacchus,\"Sussex, ENG\",77,,\n");
  const fixed = toRows(HEAD + "Bottles,White,,2023,Davenport,Horsmonden,Bacchus,\"Sussex, ENG\",77,,\n");
  assert.equal(buildWines(typo, study).wines[0].hasNotes, true);
  assert.equal(buildWines(fixed, study).wines[0].hasNotes, true);
  assert.equal(buildWines(typo, study).report.unmatchedStudy.length, 0);
});

test("a glass row and a bottle row merge into one wine with two prices", () => {
  const rows = toRows(HEAD +
    "By the Glass,Red,,2024,Pranzegg,Rosso per tutti,Vernatsch & Lagrein,\"Trentino, IT\",19,,\n" +
    "Bottles,Red — Soft & Juicy,,2024,Pranzegg,Rosso per tutti,Vernatsch & Lagrein,\"Trentino, IT\",92,,\n");
  const { wines } = buildWines(rows, []);
  assert.equal(wines.length, 1);
  assert.equal(wines[0].glass, 19);
  assert.equal(wines[0].bottle, 92);
  assert.equal(wines[0].section, "Red — Soft & Juicy");
});

test("a sweet wine with a Glass Price is sold by the glass", () => {
  const rows = toRows(HEAD + "Bottles,Sweet & Afters,,2020,Mas Amiel,Maury Vintage,Grenache,\"Roussillon, FR\",118,12,75ml\n");
  const w = buildWines(rows, []).wines[0];
  assert.deepEqual([w.bottle, w.glass, w.glassSize, w.type], [118, 12, "75ml", "sweet"]);
});

test("a wine with no study row still appears, marked as needing notes", () => {
  const rows = toRows(HEAD + "Bottles,Rosé,,2025,New Producer,Nouvelle,Cinsault,\"Provence, FR\",£58,,\n");
  const { wines, report } = buildWines(rows, toRows(STUDY_HEAD));
  assert.equal(wines.length, 1);
  assert.equal(wines[0].hasNotes, false);
  assert.equal(wines[0].bottle, 58);
  assert.equal(wines[0].country, "France");
  assert.equal(report.needsNotes.length, 1);
});

test("a study row that matches nothing is reported", () => {
  const study = toRows(STUDY_HEAD + "gone producer gone wine,,,,,estimate,\n");
  assert.deepEqual(buildWines([], study).report.unmatchedStudy.map(s => s.key), ["gone producer gone wine"]);
});

test("types come from the subsection", () => {
  assert.equal(typeOf("Orange / Skin Contact"), "orange");
  assert.equal(typeOf("Skin Contact"), "orange");
  assert.equal(typeOf("Champagne"), "sparkling");
  assert.equal(typeOf("Rosé"), "rose");
  assert.equal(typeOf("Red — Rich & Structured"), "red");
  assert.equal(typeOf("Sweet & Afters"), "sweet");
  assert.equal(typeOf("White — Round & Textured"), "white");
  assert.equal(price("£18"), 18);
  assert.equal(price(""), null);
});

test("the real sheets: 148 rows make 136 wines, every one with notes", () => {
  assert.equal(WINE.length, 148);
  const { wines, report } = buildWines(WINE, STUDY);
  assert.equal(wines.length, 136);
  assert.deepEqual(report.needsNotes.map(w => w.key), []);
  assert.deepEqual(report.unmatchedStudy, []);
  assert.deepEqual(report.duplicates.map(w => w.key), []);
  assert.deepEqual(report.brokenCompare, []);
  assert.deepEqual(report.clashes, []);
});

test("the real sheets: glass list, anchors and comparison links", () => {
  const { wines, links } = buildWines(WINE, STUDY);
  const glass = wines.filter(w => w.glass != null);
  assert.equal(glass.length, 19); // 14 by the glass + 5 sweet wines by the glass
  assert.equal(glass.filter(w => w.type === "sweet").length, 5);
  assert.equal(wines.filter(w => w.anchor).length, 5);
  assert.equal(links.length, 212); // the prototype's comparison links
  const galerne = wines.find(w => w.key === "montanetthoden vezelay galerne");
  assert.deepEqual([galerne.glass, galerne.bottle], [20, 110]);
  assert.equal(wines.filter(w => w.check).length, 34);
});

test("styles keep the wine sheet's bottle order", () => {
  const { sections } = buildWines(WINE, STUDY);
  assert.deepEqual(sections, ["Sparkling", "Champagne", "White — Aromatic & Fresh", "White — Round & Textured", "Rosé",
    "Orange / Skin Contact", "Red — Soft & Juicy", "Red — Rich & Structured", "Sweet & Afters",
    "White"]); // Gili Villo is only sold by the glass, so its style is the glass row's
});
