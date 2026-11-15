// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A stand-in for the browser's localStorage, so the open/closed marks can be tested.
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k),
  key: i => [...mem.keys()][i], get length() { return mem.size; }
};
const { toRows } = await import("../src/js/csv.js");
const { buildWines } = await import("../src/js/data.js");
const T = await import("../src/js/quiz/tasting.js");
const { emptyProgress } = await import("../src/js/quiz/progress.js");

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const { wines } = buildWines(toRows(read("sheets/wine.csv")), toRows(read("sheets/study.csv")));
const glassWine = wines.find(w => w.glass != null && w.type === "red");
const bottle = wines.find(w => w.glass == null && w.type === "white");
const at = (d, h) => new Date(2026, 10, d, h, 0).getTime(); // 2026-11-d, h:00 local time

test("the service day turns over at 4am", () => {
  assert.equal(T.serviceDay(at(15, 23)), "2026-11-15");
  assert.equal(T.serviceDay(at(16, 2)), "2026-11-15");
  assert.equal(T.serviceDay(at(16, 5)), "2026-11-16");
});

test("wines by the glass are open by default; other bottles are not", () => {
  mem.clear();
  assert.equal(T.isOpen(glassWine, at(15, 12)), true);
  assert.equal(T.isOpen(bottle, at(15, 12)), false);
});

test("any bottle can be opened for the day, a glass wine closed, and both clear at 4am", () => {
  mem.clear();
  const day = at(15, 18);
  T.setOpen(bottle, true, day);
  T.setOpen(glassWine, false, day);
  assert.equal(T.isOpen(bottle, day), true);
  assert.equal(T.isOpen(glassWine, day), false);
  assert.deepEqual(T.openExtras(wines, day).map(w => w.id), [bottle.id]);
  assert.equal(T.isOpen(bottle, at(16, 1)), true);   // still the same service day after midnight
  assert.equal(T.isOpen(bottle, at(16, 5)), false);  // the next day it is closed again...
  assert.equal(T.isOpen(glassWine, at(16, 5)), true); // ...and the glass wine open again
  T.setOpen(bottle, false, day);
  assert.equal(T.isOpen(bottle, day), false);
});

test("'Don't ask again today' lasts until 4am", () => {
  mem.clear();
  assert.equal(T.askToday(at(15, 18)), true);
  T.dontAskToday(at(15, 18));
  assert.equal(T.askToday(at(15, 22)), false);
  assert.equal(T.askToday(at(16, 6)), true);
});

test("the grid offers tannin only for reds and orange wines", () => {
  assert.ok(T.gridScores(glassWine).includes("tannin"));
  assert.ok(!T.gridScores(bottle).includes("tannin"));
});

test("comparing an assessment with the notes", () => {
  const w = { ...bottle, scores: { sweetness: 1, acidity: 4, body: 2, oak: 1, wildness: 1 }, flavours: ["lemon", "chalk", "green apple"] };
  const c = T.compareTasting({ scores: { acidity: 4, body: 3, oak: 3, tannin: 2 }, flavours: ["lemon", "honey"] }, w);
  assert.deepEqual(c.rows.map(r => [r.name, r.verdict]), [["acidity", "match"], ["body", "close"], ["oak", "apart"]]); // tannin is not on a white's grid
  assert.deepEqual([c.matched, c.compared], [2, 3]);
  assert.deepEqual(c.shared, ["lemon"]);
  assert.deepEqual(c.onlyMine, ["honey"]);
  assert.deepEqual(c.onlyNotes, ["chalk", "green apple"]);
  const none = T.compareTasting({ scores: { acidity: 3 } }, { ...w, scores: null });
  assert.equal(none.rows[0].verdict, "none");
});

test("copied notes read plainly, with the notes' own score beside each", () => {
  const w = { ...bottle, name: "Test Wine", vintage: "2023", scores: { acidity: 4 } };
  const text = T.tastingText({ scores: { acidity: 5, body: 2 }, flavours: ["lemon"], note: "Very saline" }, w, "Sam", at(15, 18));
  assert.equal(text, "Test Wine 2023, tasted by Sam, 15 Nov 2026\nAcidity: 5 High (notes say 4)\nBody: 2 Med −\nFlavours: lemon\nNote: Very saline");
});

test("each assessment is saved under the learner, newest last, five kept", () => {
  const p = emptyProgress();
  for (let i = 1; i <= 7; i++) T.saveTasting(p, bottle, { scores: { body: (i % 5) + 1 }, flavours: [], note: "" }, i);
  assert.equal(p.tastings[bottle.id].length, 5);
  assert.equal(T.latestTasting(p, bottle.id).at, 7);
  assert.equal(T.latestTasting(p, "nope"), null);
});
