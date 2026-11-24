// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toRows } from "../src/js/csv.js";
import { buildWines, buildPairings } from "../src/js/data.js";
import { buildStages } from "../src/js/quiz/stages.js";
import { grade, isDue, isKnown, emptyProgress, noteListChanges, stageProgress, lessonDone } from "../src/js/quiz/progress.js";
import { GENERATORS, TYPES, TYPED, questionFor, ladderOf, comparatorLine } from "../src/js/quiz/questions.js";
import { planLesson, Session, rngFrom } from "../src/js/quiz/session.js";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const { wines } = buildWines(toRows(read("sheets/wine.csv")), toRows(read("sheets/study.csv")));
const pairings = buildPairings(toRows(read("sheets/pairings.csv")), wines);
const stage = (stages, id) => stages.find(s => s.id === id);
const byId = new Map(wines.map(w => [w.id, w]));
const DAY = 86400000;

// ---------- stages ----------
test("every wine is in exactly one stage, in lessons of up to 4", () => {
  const stages = buildStages(wines);
  const all = stages.flatMap(s => s.wines.map(w => w.id));
  assert.equal(all.length, wines.length);
  assert.equal(new Set(all).size, wines.length);
  stages.forEach(s => s.lessons.forEach(l => assert.ok(l.wines.length >= 1 && l.wines.length <= 4)));
  assert.equal(stages[0].wines.length, 5);
  assert.deepEqual(stages[0].wines.map(w => w.short).sort(), ["Bout d'Zan", "Fronsac", "L'Oiseau", "Rosso per tutti", "Vézelay Galerne"]);
  // Then the tasting menu: every wine paired with a course that isn't an anchor (L'Oiseau and Fronsac are).
  const menu = stage(stages, "pairings");
  assert.equal(stages[1], menu);
  assert.deepEqual(menu.wines.map(w => w.short), ["Riesling+", "Du Grappin Mâcon", "Alquimia", "Horsmonden", "Pop Bianco", "Villo Grillo", "Garance", "Maury", "Banyuls Rimage", "Melsheimer Spätlese", "Szóló Dolce"]);
  assert.ok(menu.wines.every(w => w.pairings.length));
  assert.equal(stage(stages, "glass").wines.length, 9); // 24 glass wines, less 4 anchors and the 11 tasting-menu wines, all poured by the glass
  assert.ok(stage(stages, "glass").wines.every(w => w.glass != null));
  assert.ok(stage(stages, "under100").wines.every(w => w.bottle < 100));
});

test("a new wine by the glass joins stage 2 by itself", () => {
  const extra = { ...wines.find(w => w.glass == null && w.bottle > 200), id: "new-glass", glass: 25, anchor: false };
  assert.ok(stage(buildStages([...wines, extra]), "glass").wines.some(w => w.id === "new-glass"));
});

// ---------- scheduler ----------
test("five boxes: right moves up one, wrong goes back to box 1, with the spec's intervals", () => {
  const t = 1000;
  let r = grade(undefined, true, t);
  assert.deepEqual([r.box, r.due - t], [1, 0]); // a new wine answered right is "seen", asked again in the same session
  r = grade(r, true, t); assert.deepEqual([r.box, r.due - t], [2, 1 * DAY]);
  r = grade(r, true, t); assert.deepEqual([r.box, r.due - t], [3, 3 * DAY]);
  r = grade(r, true, t); assert.deepEqual([r.box, r.due - t], [4, 7 * DAY]); assert.ok(isKnown(r));
  r = grade(r, true, t); assert.deepEqual([r.box, r.due - t], [5, 21 * DAY]);
  r = grade(r, true, t); assert.equal(r.box, 5); // stays at the top
  r = grade(r, false, t); assert.deepEqual([r.box, r.due - t], [1, 0]); assert.ok(!isKnown(r));
  assert.deepEqual([r.seen, r.right, r.wrong], [7, 6, 1]);
  assert.ok(isDue(r, t) && !isDue(grade(r, true, t), t + DAY - 1) && isDue(grade(r, true, t), t + DAY));
});

test("a stage is learnt at 90% known; a lesson is done when each wine has been answered right", () => {
  const stage = buildStages(wines)[0], p = emptyProgress();
  stage.wines.slice(0, 4).forEach(w => (p.wines[w.id] = { box: 4, right: 3 }));
  assert.equal(stageProgress(stage, p).learnt, false); // 4 of 5 is 80%
  p.wines[stage.wines[4].id] = { box: 5, right: 4 };
  assert.equal(stageProgress(stage, p).learnt, true);
  assert.equal(lessonDone(stage.lessons[0], p), true);
  assert.equal(lessonDone(stage.lessons[1], emptyProgress()), false);
});

test("a changed price or vintage puts a wine back in box 1 and on the New on the list shelf", () => {
  const p = emptyProgress();
  assert.deepEqual(noteListChanges(p, wines, 1), []); // first visit just records
  const w = wines[3];
  p.wines[w.id] = { box: 4, due: 999999, right: 3 };
  const changed = wines.map(x => (x.id === w.id ? { ...x, bottle: x.bottle + 5 } : x));
  assert.deepEqual(noteListChanges(p, changed, 50), [w.id]);
  assert.deepEqual([p.wines[w.id].box, p.wines[w.id].due], [1, 50]);
  assert.deepEqual(p.changed, [w.id]);
});

// ---------- question generators ----------
const SEEDS = 12;
function everyQuestion(type) {
  const out = [];
  wines.forEach(w => { for (let s = 0; s < SEEDS; s++) { const q = GENERATORS[type](w, wines, rngFrom(s * 997 + w.id.length)); if (q) out.push([w, q]); } });
  return out;
}
const correctOf = q => q.options.filter(o => o.correct);

for (const type of TYPES.filter(t => t !== "sayIt" && t !== "match" && !TYPED.has(t))) {
  test(`${type}: four different options, exactly one right`, () => {
    const qs = everyQuestion(type);
    assert.ok(qs.length > 0, "no questions made");
    qs.forEach(([w, q]) => {
      assert.equal(q.options.length, 4, `${w.id}: ${q.prompt}`);
      assert.equal(new Set(q.options.map(o => o.label)).size, 4, `${w.id}: repeated option in ${q.prompt}`);
      assert.equal(correctOf(q).length, 1);
      assert.equal(correctOf(q)[0].label, q.answer);
      assert.ok(q.prompt.length > 10);
    });
  });
}

test("Identify and Price can be asked about every wine with notes", () => {
  wines.filter(w => w.hasNotes).forEach(w => {
    assert.ok(GENERATORS.identify(w, wines, rngFrom(1)), "identify " + w.id);
    assert.ok(GENERATORS.price(w, wines, rngFrom(1)), "price " + w.id);
  });
});

test("Describe: the right wine really is the extreme, by at least 2 steps", () => {
  everyQuestion("describe").forEach(([w, q]) => {
    const names = new Map(wines.map(x => [x.short, x]));
    const v = w.scores[q.dim];
    q.options.filter(o => !o.correct).forEach(o => {
      const x = names.get(o.label);
      assert.ok(v >= 4 ? x.scores[q.dim] <= v - 2 : x.scores[q.dim] >= v + 2, `${q.prompt} ${o.label}`);
    });
  });
});

test("Reverse: no wrong option matches every clue", () => {
  const names = new Map(wines.map(x => [x.short, x]));
  everyQuestion("reverse").forEach(([w, q]) => q.options.filter(o => !o.correct).forEach(o => {
    const x = names.get(o.label);
    const fits = w.flavours.slice(0, 4).every(f => x.flavours.includes(f)) && w.making.slice(0, 2).every(m => x.making.includes(m));
    assert.ok(!fits, `${q.prompt} also fits ${o.label}`);
  }));
});

test("Step up: the answer is the next bottle up the same family; no wrong option is", () => {
  const names = new Map(wines.map(x => [x.short, x]));
  const qs = everyQuestion("stepUp");
  assert.ok(qs.length >= 20);
  qs.forEach(([w, q]) => {
    const ladder = ladderOf(w, wines), up = ladder[ladder.findIndex(x => x.id === w.id) + 1];
    assert.equal(q.answer, up.short);
    q.options.filter(o => !o.correct).forEach(o => {
      const x = names.get(o.label);
      assert.ok(!(ladder.includes(x) && x.bottle > w.bottle), `${o.label} is also a step up from ${w.short}`);
    });
  });
});

test("Guest request: only the right wine lists the guest's usual style", () => {
  const names = new Map(wines.map(x => [x.short, x]));
  everyQuestion("guestRequest").forEach(([, q]) => {
    q.options.forEach(o => assert.equal(names.get(o.label).ifYouLike.includes(q.style), o.correct, `${q.prompt} ${o.label}`));
  });
});

test("Heads-up: the right wine scores 4 or 5 for wildness, the others 2 or less", () => {
  const names = new Map(wines.map(x => [x.short, x]));
  const qs = everyQuestion("headsUp");
  assert.ok(qs.length >= 10);
  qs.forEach(([, q]) => q.options.forEach(o => {
    const s = names.get(o.label).scores.wildness;
    assert.ok(o.correct ? s >= 4 : s <= 2);
  }));
});

test("Say it: reveals the guest line; skipped when there is none", () => {
  const w = wines.find(x => x.guestLine);
  const q = GENERATORS.sayIt(w, wines, rngFrom(1));
  assert.deepEqual([q.type, q.answer], ["sayIt", w.guestLine]);
  assert.equal(GENERATORS.sayIt({ ...w, guestLine: "" }, wines, rngFrom(1)), null);
});

test("questions on estimated fields say so; tasted-only mode skips them", () => {
  const w = wines.find(x => x.scores && x.scores.wildness >= 4);
  assert.equal(GENERATORS.headsUp(w, wines, rngFrom(2)).estimate, true);
  assert.equal(GENERATORS.headsUp({ ...w, tasted: true }, wines, rngFrom(2)).estimate, false);
  for (let s = 0; s < 30; s++) {
    const q = questionFor(w, wines, rngFrom(s), { allowEstimates: false });
    assert.ok(!["describe", "reverse", "headsUp"].includes(q.type));
  }
});

test("every wine with notes can be asked about, and a new wine starts with Identify", () => {
  wines.filter(w => w.hasNotes).forEach(w => assert.equal(questionFor(w, wines, rngFrom(3), { prefer: ["identify"], recall: false }).type, "identify"));
});

test("the answer screen's comparator line", () => {
  const galerne = wines.find(w => w.key === "montanetthoden vezelay galerne");
  assert.match(comparatorLine(galerne, byId), /^(Lighter|Fuller|Fresher|Softer) than |^Compare it with /);
});

// ---------- lessons ----------
test("a lesson has 10 questions, at most 4 new wines, and reviews that are due", () => {
  const stages = buildStages(wines), p = emptyProgress(), now = 10 * DAY;
  const lesson = stage(stages, "under100").lessons[0];
  const rest = wines.filter(w => !lesson.wines.includes(w));
  rest.slice(40, 50).forEach(w => (p.wines[w.id] = { box: 2, due: now - 1, right: 1 }));
  rest.slice(50, 60).forEach(w => (p.wines[w.id] = { box: 3, due: now + DAY, right: 2 }));
  const plan = planLesson({ newWines: lesson.wines, wines, progress: p, now });
  assert.equal(plan.length, 10);
  const ids = plan.map(x => x.wine.id);
  assert.ok(new Set(ids.filter(id => !p.wines[id])).size <= 4);
  assert.ok(ids.some(id => p.wines[id] && p.wines[id].due < now)); // due reviews are in
  assert.ok(!ids.some(id => p.wines[id] && p.wines[id].due > now)); // not-yet-due are not
});

test("running a lesson: first answers move boxes, wrong answers come back later", () => {
  const stages = buildStages(wines), p = emptyProgress();
  const plan = planLesson({ newWines: stages[0].lessons[0].wines, wines, progress: p, now: 0 });
  const s = new Session({ kind: "lesson", plan, all: wines, progress: p, rng: rngFrom(7), now: () => 0 });
  const first = s.next();
  const missed = first.gradeId;
  s.answer(false);
  let asked = 1, cameBack = false;
  while (s.next()) { if (s.current.gradeId === missed && asked > 0) cameBack = true; s.answer(true); asked++; }
  assert.ok(cameBack, "missed wine was asked again");
  assert.equal(p.wines[missed].box, 1); // its first answer was wrong; the later right answer is practice
  assert.ok(p.wines[missed].right >= 1); // ...but it counts towards finishing the lesson
  assert.ok(lessonDone(stages[0].lessons[0], p));
  assert.ok(asked > 10 && asked <= 14);
  const sum = s.summary();
  assert.ok(sum.missed.includes(missed));
  assert.ok(sum.movedUp.length >= 3);
  Object.values(p.wines).forEach(r => assert.ok(r.box >= 1 && r.box <= 2));
});
