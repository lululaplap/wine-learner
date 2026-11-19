// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toRows } from "../src/js/csv.js";
import { buildWines, buildRegions } from "../src/js/data.js";
import { searchIndex, search, words } from "../src/js/search.js";

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
