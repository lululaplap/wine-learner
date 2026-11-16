// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toRows } from "../src/js/csv.js";
import { buildWines } from "../src/js/data.js";
import { buildGlossary, findTerms } from "../src/js/glossary.js";
import { buildTermIndex, TERM_GENERATORS, termQuestionFor, pickTerms, withTerms, termStats, shortDefinition, isLearnt, TERM_LEARNT, wordQuota, termFluency, FIRST_RIGHT_BOX } from "../src/js/quiz/terms.js";
import { planLesson, Session, rngFrom } from "../src/js/quiz/session.js";
import { emptyProgress, grade } from "../src/js/quiz/progress.js";
import { fold } from "../src/js/quiz/answer.js";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const { wines } = buildWines(toRows(read("sheets/wine.csv")), toRows(read("sheets/study.csv")));
const glossary = buildGlossary(toRows(read("sheets/glossary.csv")));
const idx = buildTermIndex(glossary, wines);
const byTerm = name => glossary.terms.find(t => t.term === name);
const usesTerm = (w, t) => idx.byTerm.get(t.id).wines.includes(w.id);
const runs = (type, seeds = 6) => { const out = []; glossary.terms.forEach(t => { for (let s = 0; s < seeds; s++) { const q = TERM_GENERATORS[type](t, idx, rngFrom(s * 17 + t.id.length), { all: wines }); if (q) out.push([t, q]); } }); return out; };

test("every term is indexed with the wines whose notes use it, and the word as written", () => {
  assert.equal(idx.terms.length, glossary.terms.length);
  const chalk = idx.byTerm.get(byTerm("Chalk").id);
  assert.ok(chalk.wines.length >= 5);
  chalk.wines.forEach(id => assert.match(fold(chalk.forms.get(id)), /chalk/));
});

test("a short definition is one sentence, never cut mid-word", () => {
  glossary.terms.forEach(t => { const d = shortDefinition(t); assert.ok(d.length <= 121, d); assert.ok(!/\s\S{1,2}…$/.test(d) || d.endsWith("…")); });
});

test("term to meaning, and meaning to term: four different options, exactly one right, the term never given away", () => {
  for (const type of ["termDefine", "termName"]) {
    const list = runs(type);
    assert.ok(list.length >= glossary.terms.length, type);
    list.forEach(([t, q]) => {
      assert.equal(q.options.length, 4);
      assert.equal(q.options.filter(o => o.correct).length, 1);
      assert.equal(new Set(q.options.map(o => o.label)).size, 4);
      assert.equal(q.gradeId, "term:" + t.id);
      // The meaning shown must not name the term it describes.
      const meaning = type === "termName" ? q.prompt : q.options.find(o => o.correct).label;
      assert.ok(!findTerms(glossary, meaning).some(h => h.term.id === t.id), `${t.term}: ${meaning}`);
    });
  }
});

test("matching pairs four different terms with their meanings", () => {
  runs("termMatch").forEach(([t, q]) => {
    assert.equal(q.pairs.length, 4);
    assert.equal(new Set(q.pairs.map(p => p.left)).size, 4);
    assert.equal(q.pairs[0].left, t.term);
  });
});

test("which wine: the right one uses the term, the other three don't, and very common words are skipped", () => {
  const list = runs("termWine");
  assert.ok(list.length > 20);
  list.forEach(([t, q]) => {
    const right = wines.find(w => w.id === q.wineId);
    assert.ok(usesTerm(right, t));
    q.options.filter(o => !o.correct).forEach(o => assert.ok(!usesTerm(wines.find(w => w.short === o.label), t), `${t.term}: ${o.label}`));
    assert.ok(idx.byTerm.get(t.id).wines.length <= wines.length * 0.4);
  });
  // The example from the brief: "chalky".
  const q = TERM_GENERATORS.termWine(byTerm("Chalk"), idx, rngFrom(3), { all: wines });
  assert.match(q.prompt, /^“Chalk/);
});

test("find them all: two to four right among six, all the right ones use the term and none of the others", () => {
  const list = runs("termPickAll");
  assert.ok(list.length > 10);
  list.forEach(([t, q]) => {
    const right = q.options.filter(o => o.correct);
    assert.equal(q.options.length, 6);
    assert.ok(right.length >= 2 && right.length <= 4);
    assert.match(q.prompt, new RegExp(`^Find the ${right.length} wines`));
    q.options.forEach(o => assert.equal(usesTerm(wines.find(w => w.id === o.wineId), t), o.correct));
  });
});

test("a term met for the first time starts with its meaning", () => {
  const t = byTerm("Biodynamic");
  for (let s = 0; s < 10; s++) assert.ok(["termDefine", "termName"].includes(termQuestionFor(t, idx, wines, rngFrom(s), {}).type));
});

test("lessons ask about the words their own wines use: due ones first, at most one new, learnt ones never", () => {
  const lessonWines = wines.filter(w => idx.termsOf(w).length).slice(0, 4);
  const p = emptyProgress(), now = Date.now();
  const first = pickTerms(idx, p, { wines: lessonWines, now });
  assert.equal(first.length, 1); // nothing due yet: one new word
  assert.ok(lessonWines.some(w => usesTerm(w, first[0].term)));
  // Two of the lesson's words are due, one is learnt.
  const used = [...new Set(lessonWines.flatMap(w => idx.termsOf(w)))];
  assert.ok(used.length >= 3);
  p.terms[used[0].id] = { box: 2, due: now - 1000, right: 1, seen: 1 };
  p.terms[used[1].id] = { box: 3, due: now - 5000, right: 2, seen: 2 };
  p.terms[used[2].id] = { box: TERM_LEARNT, due: now - 9000, right: 5, seen: 5 };
  const next = pickTerms(idx, p, { wines: lessonWines, now }).map(x => x.term.id);
  assert.deepEqual(next, [used[1].id, used[0].id]);
  assert.ok(!next.includes(used[2].id));
});

test("a term answered right on separate days moves up a box each time, and at box 5 it is learnt and no longer asked", () => {
  const t = byTerm("Skin contact");
  let rec = null, day = Date.now();
  for (let i = 0; i < 5; i++) { rec = grade(rec, true, day); day = rec.due; }
  assert.equal(rec.box, 5);
  assert.ok(isLearnt(rec));
  const p = emptyProgress(); p.terms[t.id] = Object.assign({}, rec, { due: 0 });
  assert.ok(!pickTerms(idx, p, { pool: [t], n: 5 }).length);
  assert.equal(termStats(idx, p).learnt, 1);
});

test("mixing words into a lesson keeps it ten questions, and the session grades words apart from wines", () => {
  const lessonWines = wines.filter(w => idx.termsOf(w).length).slice(0, 4);
  const p = emptyProgress();
  const plan = withTerms(planLesson({ newWines: lessonWines, wines, progress: p }), pickTerms(idx, p, { wines: lessonWines, n: 2, newMax: 2 }), 10);
  assert.equal(plan.length, 10);
  assert.equal(plan.filter(x => x.term).length, 2);
  const s = new Session({ kind: "lesson", lessonId: "x", plan, all: wines, progress: p, rng: rngFrom(7), kb: { terms: idx } });
  let termQs = 0;
  for (let q = s.next(); q; q = s.next()) {
    if (q.termId) { termQs++; assert.ok(q.gradeId.startsWith("term:")); }
    s.answer(true);
  }
  assert.equal(termQs, 2);
  assert.equal(Object.keys(p.terms).length, 2);
  Object.keys(p.terms).forEach(id => assert.ok(!(id in p.wines)));
  const sum = s.summary();
  assert.equal(sum.terms, 2);
  assert.equal(sum.wines, lessonWines.length);
});

test("a word answered wrong comes back later in the same lesson", () => {
  const t = byTerm("Lees"), p = emptyProgress();
  const s = new Session({ kind: "words", lessonId: "words", plan: [{ term: t }, { term: byTerm("Dosage") }, { term: byTerm("Flor") }], all: wines, progress: p, rng: rngFrom(2), kb: { terms: idx } });
  s.next(); s.answer(false);
  assert.ok(s.queue.slice(s.index).some(x => x.term && x.term.id === t.id));
});

// ---------- fewer words for those who know them ----------
const lessonWithWords = (p, rng, lessonWines) => {
  const q = wordQuota(p);
  const plan = withTerms(planLesson({ newWines: lessonWines, wines, progress: p }), pickTerms(idx, p, { wines: lessonWines, n: q.n, newMax: q.newMax }), 10);
  const s = new Session({ kind: "lesson", lessonId: "x", plan, all: wines, progress: p, rng, kb: { terms: idx } });
  let words = 0;
  for (let q2 = s.next(); q2; q2 = s.next()) { if (q2.termId) words++; s.answer(q2.termId ? p.knowsWords : true); }
  return words;
};
const lessonsOfWines = () => { const ws = wines.filter(w => idx.termsOf(w).length); return Array.from({ length: 8 }, (_, i) => ws.slice(i * 4, i * 4 + 4)); };

test("the number of word questions follows how well someone knows the words", () => {
  const p = emptyProgress();
  assert.equal(termFluency(p), null);
  assert.equal(wordQuota(p).n, 2); // finding out
  p.termLog = [true, true, true, true]; assert.equal(wordQuota(p).n, 0);
  p.termLog = [true, true, true, false, true, true, true, true]; assert.equal(wordQuota(p).n, 1); // 7 of 8: mostly known
  assert.equal(wordQuota(p).newMax, 0);
  p.termLog = [true, false, true, false, true, true]; assert.equal(wordQuota(p).n, 1); // 4 of 6
  p.termLog = [false, false, true, false]; assert.equal(wordQuota(p).n, 2);
  p.termLog = Array(12).fill(true).concat(false); // only the last 12 count
  assert.equal(termFluency(p), 11 / 12);
});

test("a word answered right the first time it is met skips to box 4, and one more right answer retires it", () => {
  const t = byTerm("Biodynamic"), p = emptyProgress();
  const s = new Session({ kind: "words", lessonId: "words", plan: [{ term: t }], all: wines, progress: p, rng: rngFrom(4), kb: { terms: idx } });
  s.next(); s.answer(true);
  assert.equal(p.terms[t.id].box, FIRST_RIGHT_BOX);
  assert.deepEqual(p.termLog, [true]);
  const later = new Session({ kind: "words", lessonId: "words", plan: [{ term: t }], all: wines, progress: p, rng: rngFrom(5), kb: { terms: idx }, now: () => p.terms[t.id].due });
  later.next(); later.answer(true);
  assert.ok(isLearnt(p.terms[t.id]));
  // A word missed on first meeting starts at box 1, as before.
  const u = byTerm("Lees"), s2 = new Session({ kind: "words", lessonId: "words", plan: [{ term: u }], all: wines, progress: p, rng: rngFrom(6), kb: { terms: idx } });
  s2.next(); s2.answer(false);
  assert.equal(p.terms[u.id].box, 1);
});

test("an expert sees words only while the app finds out, then lessons are all wines; a beginner keeps seeing two", () => {
  const expert = Object.assign(emptyProgress(), { knowsWords: true }), novice = Object.assign(emptyProgress(), { knowsWords: false });
  const ex = lessonsOfWines().map((lw, i) => lessonWithWords(expert, rngFrom(10 + i), lw));
  const nv = lessonsOfWines().map((lw, i) => lessonWithWords(novice, rngFrom(10 + i), lw));
  assert.ok(ex.slice(0, 2).reduce((a, b) => a + b, 0) >= 3, `expert, first lessons: ${ex}`);
  assert.deepEqual(ex.slice(3), [0, 0, 0, 0, 0], `expert, later lessons: ${ex}`);
  assert.ok(nv.slice(3).every(n => n >= 1), `beginner: ${nv}`);
});

test("a missed word comes back once in the lesson, not again and again", () => {
  const t = byTerm("Lees"), p = emptyProgress();
  const s = new Session({ kind: "words", lessonId: "words", plan: [{ term: t }, { term: byTerm("Dosage") }, { term: byTerm("Flor") }, { term: byTerm("Sekt") }], all: wines, progress: p, rng: rngFrom(2), kb: { terms: idx } });
  let asked = 0;
  for (let q = s.next(); q; q = s.next()) { if (q.termId === t.id) asked++; s.answer(q.termId !== t.id); }
  assert.equal(asked, 2);
});
