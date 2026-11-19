// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toRows } from "../src/js/csv.js";
import { buildWines, buildRegions } from "../src/js/data.js";
import { searchIndex, search, words, didYouMean, distance } from "../src/js/search.js";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const { wines } = buildWines(toRows(read("sheets/wine.csv")), toRows(read("sheets/study.csv")));
const regions = buildRegions(toRows(read("sheets/regions.csv")), wines);
const idx = searchIndex(wines, regions);
const found = (q, n = 0) => search(idx, q, { limit: n }).map(x => x.wine.short);
const first = q => found(q, 1)[0];

test("Côtes du Rhône finds Bout d'Zan, however it is typed", () => {
  for (const q of ["cotes du rhone", "Côtes du Rhône", "cote du rhone", "Côte-du-Rhône", "COTES DU RHONE", "cotes rhone", "rhone"]) {
    assert.ok(found(q).includes("Bout d'Zan"), q);
  }
  // and says why, since its notes call it Rhône & Ardèche, not Côtes du Rhône
  const hit = search(idx, "cotes du rhone", { limit: 0 }).find(x => x.wine.short === "Bout d'Zan");
  assert.match(hit.why, /Rhône & Ardèche, which includes Côtes du Rhône/);
});

test("a wine's own names come first, with or without accents and apostrophes", () => {
  assert.equal(first("bout d'zan"), "Bout d'Zan");
  assert.equal(first("bout dzan"), "Bout d'Zan");
  assert.equal(first("rocambulle"), "Roc'Ambulle");
  assert.equal(first("saint veran"), "Saint-Véran");
  assert.equal(first("vezelay"), "Vézelay Galerne");
  assert.equal(first("fronsac"), "Fronsac");
  assert.equal(first("mas du libian"), "Bout d'Zan");
});

test("every word typed must match, in any order", () => {
  assert.ok(found("grenache rhone").includes("Bout d'Zan"));
  assert.ok(found("rhone grenache").includes("Bout d'Zan"));
  assert.deepEqual(found("rhone sparkling champagne"), []);
});

test("grapes match under any of their names", () => {
  assert.ok(found("garnacha").includes("Bout d'Zan"));
  assert.ok(found("shiraz").some(s => found("syrah").includes(s)));
  assert.ok(found("frankovka").length && found("frankovka").every(s => found("blaufrankisch").includes(s)));
});

test("a slip in a longer word, and a word still being typed, are forgiven", () => {
  assert.ok(found("grenach").includes("Bout d'Zan"));
  assert.ok(found("granache").includes("Bout d'Zan"));
  assert.ok(found("chateaun").length);
  assert.deepEqual(found("gamy"), [], "words under 5 letters get no slips");
  assert.ok(found("gamay").length);
});

test("a guest's style finds wines too, ranked below the real thing, with the reason", () => {
  const res = search(idx, "beaujolais", { limit: 0 });
  assert.equal(res[0].why, ""); // a wine from Beaujolais itself
  const styled = res.find(x => x.why.startsWith("For guests who like"));
  assert.ok(styled);
  assert.ok(res.indexOf(styled) > 0);
});

test("small words alone find nothing, and so does an empty box", () => {
  assert.deepEqual(found(""), []);
  assert.deepEqual(found("du de la"), []);
  assert.deepEqual(words("Côtes du Rhône"), ["cote", "rhone"]);
});

// ---------- spelling ----------
test("slips are forgiven by length: a swap in 4 letters, one slip from 5, two from 8", () => {
  assert.ok(found("pinot nior").includes("Frick Pinot Noir"));       // 4 letters: two letters swapped
  assert.ok(found("reisling").some(s => /Riesling/.test(s)));         // one swap
  assert.ok(found("shardonay").some(s => /Chardonnay/.test(s)));      // two slips in a long word
  assert.ok(found("chateneuf").includes("Bout d'Zan"));               // two letters missing
  assert.deepEqual(found("rosa").filter(s => /Rosé/.test(s)), [], "4 letters: a wrong letter is not forgiven");
  assert.equal(distance("abcd", "abdc"), 1);
  assert.equal(distance("shardonay", "chardonnay"), 2);
});

test("a closer match always ranks first, wherever it is found", () => {
  // "rioha" is one slip from Rioja (a region) and one slip from the start of "Richard" (a name): Rioja wins.
  const top = search(idx, "rioha", { limit: 1 })[0].wine;
  assert.match(top.regionGroup, /Rioja/);
});

test("words typed apart are tried joined up", () => {
  assert.ok(found("chateau neuf").includes("Bout d'Zan"));
});

test("sound-alikes from the Misspellings column, which search uses but never shows", () => {
  assert.ok(found("bojolais").length);
  assert.ok(found("shablee").length);
  assert.ok(found("shampain").length);
  assert.ok(found("cotes du rone").includes("Bout d'Zan"));
  search(idx, "bojolais", { limit: 0 }).forEach(x => assert.doesNotMatch(x.why, /bojolais/i));
});

test("did you mean: the nearest word on the list, only when it is close and finds wines", () => {
  assert.equal(didYouMean(idx, "shardoney"), "chardonnay");
  assert.equal(didYouMean(idx, "voignier"), "");   // no Viognier on the list, and nothing else that close
  assert.equal(didYouMean(idx, "xyzzy"), "");
  assert.equal(didYouMean(idx, "chardonnay"), ""); // already matches
});
