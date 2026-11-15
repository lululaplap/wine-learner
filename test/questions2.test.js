// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toRows } from "../src/js/csv.js";
import { buildWines, buildRegions } from "../src/js/data.js";
import { GENERATORS, TYPED, questionFor } from "../src/js/quiz/questions.js";
import { parseGrapes, canonGrape, checkTyped, suggest, vocabulary, fold } from "../src/js/quiz/answer.js";
import { planLesson, Session, rngFrom } from "../src/js/quiz/session.js";
import { emptyProgress } from "../src/js/quiz/progress.js";
import { buildStages } from "../src/js/quiz/stages.js";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const { wines } = buildWines(toRows(read("sheets/wine.csv")), toRows(read("sheets/study.csv")));
const regions = buildRegions(toRows(read("sheets/regions.csv")), wines);
const kb = { regionsById: regions.byId };
const byShort = new Map(wines.map(w => [w.short, w]));
const all = type => { const out = []; wines.forEach(w => { for (let s = 0; s < 10; s++) { const q = GENERATORS[type](w, wines, rngFrom(s * 31 + w.id.length), kb); if (q) out.push([w, q]); } }); return out; };
const one = (type, short, seed = 1) => GENERATORS[type](byShort.get(short), wines, rngFrom(seed), kb);

// ---------- answers ----------
test("grape lists are split and tidied", () => {
  assert.deepEqual(parseGrapes("Grenache & Syrah"), ["Grenache", "Syrah"]);
  assert.deepEqual(parseGrapes("Clairette, Grenache Gris, Grenache Blanc & Bourboulenc"), ["Clairette", "Grenache Gris", "Grenache Blanc", "Bourboulenc"]);
  assert.deepEqual(parseGrapes("Bacchus, Ortega+"), ["Bacchus", "Ortega"]);
  assert.deepEqual(parseGrapes("Garanacha & Mazuelo"), ["Garnacha", "Mazuelo"]); // a slip in the sheet, taught correctly
  assert.deepEqual(parseGrapes("Listan Bianco (Palomino)"), ["Listán Blanco"]);
  assert.deepEqual(parseGrapes("Field Blend"), []);
});

test("typed answers ignore capitals and accents, forgive a slip, and accept synonyms", () => {
  assert.equal(checkTyped("grenache", ["Grenache"], { grapes: true }).exact, true);
  assert.equal(checkTyped("Garnacha", ["Grenache"], { grapes: true }).ok, true);
  assert.equal(checkTyped("mazuelo", ["Carignan"], { grapes: true }).ok, true);
  assert.equal(checkTyped("frankovka", ["Blaufränkisch"], { grapes: true }).ok, true);
  assert.equal(checkTyped("blaufrankisch", ["Blaufränkisch"], { grapes: true }).exact, true);
  const slip = checkTyped("Grenach", ["Grenache"], { grapes: true });
  assert.deepEqual([slip.ok, slip.exact], [true, false]);
  assert.equal(checkTyped("Gamy", ["Gamay"]).ok, false);           // short words must be spelt right
  assert.equal(checkTyped("Pinot Gris", ["Pinot Noir"], { grapes: true }).ok, false);
  assert.equal(checkTyped("Syrah", ["Grenache"], { grapes: true }).ok, false);
  assert.equal(checkTyped("", ["Grenache"]).ok, false);
  assert.equal(checkTyped("£19", ["19"], { numeric: true }).ok, true);
  assert.equal(checkTyped("18", ["19"], { numeric: true }).ok, false);
});

test("suggestions come from the list's own words, starting matches first", () => {
  const grapes = vocabulary(wines, "grape");
  assert.ok(grapes.includes("Grenache") && grapes.includes("Blaufränkisch") && !grapes.includes("Field Blend"));
  assert.equal(suggest(grapes, "gre")[0].toLowerCase().startsWith("gre"), true);
  assert.ok(suggest(grapes, "blanc").some(g => /blanc/i.test(g)));
  assert.deepEqual(suggest(grapes, ""), []);
  assert.ok(suggest(vocabulary(wines, "region"), "bur").includes("Burgundy"));
});

// ---------- the other way round ----------
test("Pick the wine: the facts fit the right wine and no other option", () => {
  const qs = all("pickWine");
  assert.ok(qs.length > 500);
  qs.forEach(([w, q]) => {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map(o => o.label)).size, 4);
    assert.equal(q.options.filter(o => o.correct).length, 1);
    q.options.filter(o => !o.correct).forEach(o => {
      const x = byShort.get(o.label);
      assert.ok(!(x.grapes === w.grapes && x.regionGroup === w.regionGroup), `${o.label} fits "${q.prompt}" too`);
    });
  });
  assert.match(one("pickWine", "Bout d'Zan").prompt, /^Grenache and Syrah, from Rhône & Ardèche\. A red\. Which wine\?$/);
});

test("Odd one out: exactly one option differs", () => {
  const qs = all("oddOneOut");
  assert.ok(qs.length > 200);
  qs.forEach(([, q]) => {
    assert.equal(q.options.length, 4);
    assert.equal(q.options.filter(o => o.correct).length, 1);
    const region = (q.prompt.match(/not from (.+)\?$/) || [])[1];
    const grape = (q.prompt.match(/not a (.+)\?$/) || [])[1];
    q.options.forEach(o => {
      const x = byShort.get(o.label);
      // Grouped by each wine's lead grape (Malvasia di Candia and Malvasia Volcánica are both a Malvasia).
      const fits = region ? x.regionGroup === region : parseGrapes(x.grapes).length <= 1 && fold(canonGrape(x.leadGrape)) === fold(grape);
      assert.equal(!fits, o.correct, `${q.prompt} ${o.label}`);
    });
  });
});

test("Match: four wines, four different answers, each pair true", () => {
  const qs = all("match");
  assert.ok(qs.length > 500);
  qs.forEach(([, q]) => {
    assert.equal(q.pairs.length, 4);
    assert.equal(new Set(q.pairs.map(p => p.left)).size, 4);
    assert.equal(new Set(q.pairs.map(p => fold(p.right))).size, 4);
    q.pairs.forEach(p => {
      const x = byShort.get(p.left);
      assert.ok(q.by === "grape" ? parseGrapes(x.grapes)[0] === p.right : x.regionGroup === p.right);
    });
  });
});

// ---------- typed ----------
test("Missing grape: the hidden grape is the answer, the others are shown", () => {
  const qs = all("missingGrape");
  assert.ok(qs.length > 200);
  qs.forEach(([w, q]) => {
    const grapes = parseGrapes(w.grapes);
    assert.ok(grapes.includes(q.answer));
    assert.ok(!q.prompt.includes(` ${q.answer} `) && !q.prompt.includes(` ${q.answer}.`) && !q.prompt.includes(` ${q.answer},`), q.prompt);
    assert.ok(q.prompt.includes("___"));
    assert.equal(checkTyped(q.answer, q.accept, { grapes: true }).exact, true);
    grapes.filter(g => fold(g) !== fold(q.answer)).forEach(g => assert.equal(checkTyped(g, q.accept, { grapes: true }).ok, false));
  });
  const q = one("missingGrape", "Bout d'Zan");
  assert.ok(["Bout d'Zan is made from ___ and Syrah. Which grape is missing?", "Bout d'Zan is made from Grenache and ___. Which grape is missing?"].includes(q.prompt), q.prompt);
});

test("Name the grape: single-grape wines only", () => {
  const qs = all("typeGrape");
  assert.ok(qs.length > 500);
  qs.forEach(([w, q]) => assert.equal(parseGrapes(w.grapes).length, 1));
  assert.equal(one("typeGrape", "Monfarina").answer, "Jacquère");
  assert.equal(checkTyped("jacquere", one("typeGrape", "Monfarina").accept, { grapes: true }).exact, true);
});

test("Where from: the region, its other names or the place all count", () => {
  const q = one("typeRegion", "Sancerre");
  assert.equal(q.answer, "Loire");
  ["Loire", "loire valley", "Sancerre"].forEach(t => assert.equal(checkTyped(t, q.accept).ok, true, t));
  assert.equal(checkTyped("Burgundy", q.accept).ok, false);
  const ye = one("typeRegion", "Ye-Ye");
  assert.equal(checkTyped("Lanzarote", ye.accept).ok, true);
});

test("Name the wine: only asked when the facts point to one wine", () => {
  const qs = all("typeWine");
  assert.ok(qs.length > 500);
  qs.forEach(([w, q]) => {
    const matches = wines.filter(x => x.grapes === w.grapes && x.regionGroup === w.regionGroup && x.type === w.type && q.prompt.includes(x.regionGroup));
    const pricey = q.prompt.match(/£\d+/);
    const left = pricey ? matches.filter(x => q.prompt.includes(`£${x.bottle} a bottle`) || q.prompt.includes(`£${x.glass} a glass`)) : matches;
    assert.equal(left.length, 1, q.prompt);
    assert.equal(checkTyped(w.short, q.accept).ok, true);
  });
});

test("Type the price: the glass or bottle price, typed as a number", () => {
  const q = one("typePrice", "Rosso per tutti", 2);
  assert.equal(q.input, "number");
  assert.ok(["£19", "£99"].includes(q.answer));
  assert.equal(checkTyped(q.answer, q.accept, { numeric: true }).ok, true);
});

// ---------- recognise, then recall ----------
test("typed questions wait until a wine has left box 1", () => {
  const w = byShort.get("Bout d'Zan");
  for (let s = 0; s < 40; s++) assert.ok(!TYPED.has(questionFor(w, wines, rngFrom(s), { recall: false, kb }).type));
  let typed = 0;
  for (let s = 0; s < 80; s++) if (TYPED.has(questionFor(w, wines, rngFrom(s), { recall: true, kb }).type)) typed++;
  assert.ok(typed > 10, `${typed} typed out of 80`);
});

test("a lesson on new wines asks no typed questions; a review of known wines does", () => {
  const stages = buildStages(wines), lesson = stages[1].lessons[0];
  const fresh = emptyProgress();
  const s1 = new Session({ kind: "lesson", plan: planLesson({ newWines: lesson.wines, wines, progress: fresh, now: 0 }), all: wines, progress: fresh, rng: rngFrom(5), now: () => 0, kb });
  const types1 = []; while (s1.next()) { types1.push(s1.current.type); s1.answer(true); }
  assert.ok(types1.every(t => !TYPED.has(t)), types1.join());
  const known = emptyProgress();
  wines.forEach(w => (known.wines[w.id] = { box: 3, due: 0, right: 2 }));
  const s2 = new Session({ kind: "review", plan: planLesson({ newWines: [], wines, progress: known, now: 1 }), all: wines, progress: known, rng: rngFrom(9), now: () => 1, kb });
  const types2 = []; while (s2.next()) { types2.push(s2.current.type); s2.answer(true); }
  assert.ok(types2.some(t => TYPED.has(t)), types2.join());
});
