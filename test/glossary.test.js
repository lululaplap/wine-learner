// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toRows } from "../src/js/csv.js";
import { buildGlossary, findTerms, linkTerms } from "../src/js/glossary.js";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const G = buildGlossary(toRows(read("sheets/glossary.csv")));
const labels = text => findTerms(G, text).map(h => text.slice(h.start, h.end));
const terms = text => findTerms(G, text).map(h => h.term.term);

test("every glossary row has a term and a definition", () => {
  const rows = toRows(read("sheets/glossary.csv"));
  assert.equal(G.terms.length, rows.length);
  rows.forEach(r => assert.ok(r.definition.length > 10, r.term));
});

test("no form is listed under two terms", () => {
  const seen = new Map();
  toRows(read("sheets/glossary.csv")).forEach(r => [r.term, ...r["also matches"].split(";")].map(f => f.trim().toLowerCase()).filter(Boolean)
    .forEach(f => { assert.ok(!seen.has(f) || seen.get(f) === r.term, `"${f}" is under ${seen.get(f)} and ${r.term}`); seen.set(f, r.term); }));
});

test("matches whole words only", () => {
  assert.deepEqual(labels("Chalk-grown, partly barrel-fermented, low dosage"), ["Chalk-grown", "barrel-fermented", "low dosage"]);
  assert.deepEqual(labels("oaky"), ["oaky"]);
  assert.deepEqual(labels("soaked"), []); // not "oak"
  assert.deepEqual(labels("cloaked in villages"), []);
});

test("prefers the longest form", () => {
  assert.deepEqual(terms("Natural, no added sulfur."), ["Natural", "No added sulfur"]);
  assert.deepEqual(terms("A long-aged blanc de noirs"), ["Blanc de noirs"]);
  assert.deepEqual(terms("Old-vine Garnacha"), ["Old vines"]);
});

test("ignores capitals and accents, and treats hyphens and spaces alike", () => {
  assert.deepEqual(terms("A pink pét-nat"), ["Pét-nat"]);
  assert.deepEqual(terms("a PET NAT"), ["Pét-nat"]);
  assert.deepEqual(terms("whole bunch and Whole-Bunch"), ["Whole bunch", "Whole bunch"]);
});

test("does not link common words that only look like jargon", () => {
  assert.deepEqual(terms("orange blossom, blood orange, orange peel"), []);
  assert.deepEqual(terms("built to age, long-lived"), []);
});

test("links only the first mention on a screen, and escapes the text", () => {
  const used = new Set();
  const a = linkTerms(G, "Biodynamic <farm>, biodynamic again.", used);
  assert.equal((a.match(/class="term"/g) || []).length, 1);
  assert.ok(a.includes("&lt;farm&gt;"));
  assert.ok(a.startsWith('<button type="button" class="term"'));
  const b = linkTerms(G, "Also biodynamic.", used);
  assert.equal(b, "Also biodynamic.");
});

test("keeps the original spelling inside the link", () => {
  const html = linkTerms(G, "Topped-up Jura Savagnin");
  assert.ok(html.includes(">Topped-up</button>"));
});

test("with no glossary loaded, text is just escaped", () => {
  assert.equal(linkTerms(buildGlossary([]), "Oak & tannin"), "Oak &amp; tannin");
  assert.equal(linkTerms(null, "Oak"), "Oak");
});

test("most style notes link at least one term", () => {
  const notes = toRows(read("sheets/study.csv")).map(r => r["style note"]).filter(Boolean);
  const linked = notes.filter(n => findTerms(G, n).length).length;
  assert.ok(linked / notes.length > 0.6, `${linked} of ${notes.length}`);
});
