// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toRows } from "../src/js/csv.js";
import { buildWines, buildRegions, buildPairings } from "../src/js/data.js";
import { GENERATORS, questionFor } from "../src/js/quiz/questions.js";
import { rngFrom } from "../src/js/quiz/session.js";
import { searchIndex, search } from "../src/js/search.js";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const { wines } = buildWines(toRows(read("sheets/wine.csv")), toRows(read("sheets/study.csv")));
const regions = buildRegions(toRows(read("sheets/regions.csv")), wines);
const P = buildPairings(toRows(read("sheets/pairings.csv")), wines);
const byShort = new Map(wines.map(w => [w.short, w]));

test("every pairing on the menu finds its wine, course by course in menu order", () => {
  assert.deepEqual(P.unmatched, []);
  assert.deepEqual(P.courses.map(c => c.course), ["Starter 1", "Starter 2", "Middle course", "Main", "Cheese", "Dessert"]);
  assert.deepEqual(P.courses.find(c => c.course === "Main").dishes.map(d => `${d.dish}: ${d.pairings[0].wine.short}`),
    ["Pollack: Villo Grillo", "Venison: Garance", "Beetroot: Fronsac"]);
  assert.equal(P.courses.find(c => c.course === "Starter 2").choose, true);
  // the cheese and the mousse take the Maury or the Banyuls, whichever is on
  assert.deepEqual(P.courses.find(c => c.course === "Cheese").dishes[0].pairings.map(p => p.wine.short), ["Maury", "Banyuls Rimage"]);
  // every pairing has a script to say at the table
  assert.ok(P.pairings.every(p => p.script.length > 80));
});

test("retired pairings are kept apart, and don't reach the wines", () => {
  assert.deepEqual(P.retired.map(p => p.dish), ["Hogget", "Agnolotti", "Strawberry"]);
  assert.ok(wines.every(w => w.pairings.every(p => !p.retired)));
});

test("each wine carries its own pairings: L'Oiseau goes with both starter 1 dishes", () => {
  assert.deepEqual(byShort.get("L'Oiseau").pairings.map(p => p.dish), ["Ox terrine", "Carrot"]);
  assert.deepEqual(byShort.get("Maury").pairings.map(p => p.dish), ["Cheese", "Mousse"]);
  assert.deepEqual(byShort.get("Bout d'Zan").pairings, []);
});

test("which wine goes with the dish: one right answer, and never the other wine for the same dish", () => {
  for (let s = 0; s < 40; s++) {
    const q = GENERATORS.pairWine(byShort.get("Maury"), wines, rngFrom(s));
    assert.equal(q.options.filter(o => o.correct).length, 1);
    assert.ok(!q.options.some(o => o.label === "Banyuls Rimage"), q.prompt); // also right for the cheese and the mousse
    assert.equal(new Set(q.options.map(o => o.label)).size, 4);
  }
  const v = GENERATORS.pairWine(byShort.get("Garance"), wines, rngFrom(1));
  assert.equal(v.prompt, "Venison (main): which wine is it paired with on the tasting menu?");
});

test("which dish goes with the wine: never one of its own other dishes as a wrong answer", () => {
  for (let s = 0; s < 40; s++) {
    const q = GENERATORS.pairDish(byShort.get("L'Oiseau"), wines, rngFrom(s));
    assert.ok(["Ox terrine", "Carrot"].includes(q.answer));
    assert.equal(q.options.filter(o => ["Ox terrine", "Carrot"].includes(o.label)).length, 1);
  }
  assert.equal(GENERATORS.pairDish(byShort.get("Bout d'Zan"), wines, rngFrom(1)), null);
});

test("search finds a wine by its dish, and says so", () => {
  const idx = searchIndex(wines, regions);
  const v = search(idx, "venison", { limit: 1 })[0];
  assert.equal(v.wine.short, "Garance");
  assert.match(v.why, /tasting menu with the venison/);
  assert.equal(search(idx, "scallop", { limit: 1 })[0].wine.short, "Du Grappin Mâcon");
  assert.ok(search(idx, "jerusalem artichoke", { limit: 0 }).some(x => x.wine.short === "Alquimia"));
});

test("the Pairings screen: every course in order, every dish, its wine linked to its card, and the scripts", async () => {
  const { renderPairings } = await import("../src/js/views/pairings.js");
  const html = renderPairings({ pairings: P, glossary: null });
  const order = ["Starter 1", "Starter 2", "Middle course", "Main", "Cheese", "Dessert"].map(c => html.indexOf(`>${c}`));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), order.join());
  P.pairings.forEach(p => assert.ok(html.includes(`href="#/wine/${encodeURIComponent(p.wine.id)}"`), p.dish));
  assert.equal((html.match(/Script for the table/g) || []).length, P.pairings.length);
  assert.match(html, /Serve the Maury or the Banyuls, whichever is on/);
  assert.ok(!/href="#pp-/.test(html), "course shortcuts must not change the address");
  assert.match(renderPairings({ pairings: null }), /No pairings yet/);
});

test("why it works: ten pairings have a reason, and no reason names its own dish", () => {
  const withWhy = P.pairings.filter(p => p.why);
  assert.equal(withWhy.length, 10);
  withWhy.forEach(p => assert.ok(!p.why.toLowerCase().includes(p.dish.toLowerCase()), `${p.dish}: ${p.why}`));
  assert.equal(new Set(withWhy.map(p => p.why)).size, 10);
  assert.match(byShort.get("Garance").pairings[0].why, /Pinot acidity/);
});

test("why does the pairing work: the reason is the answer, other pairings' reasons are wrong", () => {
  for (let s = 0; s < 40; s++) {
    const q = GENERATORS.pairWhy(byShort.get("L'Oiseau"), wines, rngFrom(s));
    const p = byShort.get("L'Oiseau").pairings.find(x => x.dish === q.dish);
    assert.equal(q.answer, p.why);
    assert.equal(q.prompt, `L'Oiseau with the ${p.dish.toLowerCase()}: why does it work?`);
    assert.equal(q.options.filter(o => o.correct).length, 1);
    assert.equal(new Set(q.options.map(o => o.label)).size, 4);
  }
  // no reason in the bible, no question
  assert.equal(GENERATORS.pairWhy(byShort.get("Maury"), wines, rngFrom(1)), null);
  assert.equal(GENERATORS.pairWhich(byShort.get("Maury"), wines, rngFrom(1)), null);
});

test("which pairing is this: from the reason to the wine and dish", () => {
  for (let s = 0; s < 40; s++) {
    const q = GENERATORS.pairWhich(byShort.get("Garance"), wines, rngFrom(s));
    assert.equal(q.answer, "Garance with the venison");
    assert.ok(q.prompt.includes(byShort.get("Garance").pairings[0].why));
    assert.ok(!q.options.some(o => !o.correct && / venison$/.test(o.label)), "never another wine for the same dish");
    assert.equal(new Set(q.options.map(o => o.label)).size, 4);
  }
});

test("Before service: three from the glass list and two from the tasting menu, asked about the pairing", async () => {
  const { beforeServicePlan } = await import("../src/js/views/lesson.js");
  const types = new Set();
  for (let s = 0; s < 40; s++) {
    const { plan, fromGlass, fromMenu } = beforeServicePlan(wines, rngFrom(s));
    assert.equal(plan.length, 5);
    assert.equal(fromGlass.length, 3);
    assert.equal(fromMenu.length, 2);
    assert.ok(fromGlass.every(w => w.glass != null) && fromMenu.every(w => w.pairings.length));
    assert.equal(new Set(plan.map(it => it.wine.id)).size, 5);
    fromMenu.forEach(w => { const it = plan.find(x => x.wine === w); assert.ok(it.prefer.every(t => t.startsWith("pair"))); });
    // the first question asked about a menu wine is about its pairing (dish, wine or why)
    fromMenu.forEach(w => { const it = plan.find(x => x.wine === w);
      const q = questionFor(w, wines, rngFrom(s), { prefer: it.prefer }); assert.ok(q.type.startsWith("pair"), q.type); types.add(q.type); });
  }
  assert.deepEqual([...types].sort(), ["pairDish", "pairWhich", "pairWhy", "pairWine"]);
  // with fewer wines to ask about than five, it asks about each once
  const four = wines.filter(w => w.pairings.length).slice(0, 4), short = beforeServicePlan(four, rngFrom(3));
  assert.deepEqual(short.plan.map(it => it.wine.id).sort(), four.map(w => w.id).sort());
});
