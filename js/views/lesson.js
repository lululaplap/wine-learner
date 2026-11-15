// A lesson, Duolingo style: a progress bar, one question at a time, big answer buttons, and a feedback bar that
// slides up in green or red with the right answer, the wine's guest line and a comparator.
import { esc, glyph, money } from "../ui.js";
import { linkTerms } from "../glossary.js";
import { buildStages } from "../quiz/stages.js";
import { loadProgress, saveProgress, isDue } from "../quiz/progress.js";
import { planLesson, Session, LESSON_LENGTH, BEFORE_SERVICE_LENGTH } from "../quiz/session.js";
import { TYPE_NAMES, comparatorLine, shuffle } from "../quiz/questions.js";
import { learner } from "./path.js";

let active = null; // { id, session, name, phase: "ask" | "feedback" | "end", picked, result }

function start(id, ctx) {
  const name = learner();
  if (!name) return null;
  const all = ctx.data.wines, p = loadProgress(name), now = Date.now();
  const stages = buildStages(all);
  const tastedIn = list => list.some(w => w.tasted);
  let plan, title, allowEstimates = !tastedIn(all), kind = "lesson";
  if (id === "service") {
    kind = "service"; title = "Before service";
    const glass = shuffle(all.filter(w => w.glass != null), Math.random).slice(0, BEFORE_SERVICE_LENGTH);
    plan = glass.map(w => ({ wine: w, prefer: shuffle(["price", "guestRequest", "identify", "sayIt"], Math.random).slice(0, 2) }));
  } else if (id.startsWith("review")) {
    kind = "review";
    const stage = stages.find(s => "review-" + s.id === id);
    const pool = stage ? stage.wines : all;
    title = stage ? `Review: ${stage.title}` : "Review";
    plan = planLesson({ newWines: [], wines: pool, progress: p, now, length: LESSON_LENGTH });
    if (stage) allowEstimates = !tastedIn(stage.wines);
  } else {
    const lesson = stages.flatMap(s => s.lessons).find(l => l.id === id);
    if (!lesson) return null;
    const stage = stages.find(s => s.id === lesson.stageId);
    title = `${stage.title} · Lesson ${lesson.n}`;
    plan = planLesson({ newWines: lesson.wines, wines: all, progress: p, now });
    allowEstimates = !tastedIn(stage.wines);
  }
  const session = new Session({ kind, lessonId: id, plan, all, progress: p, allowEstimates });
  session.next();
  return { id, name, title, session, phase: session.current ? "ask" : "empty", picked: null, result: null };
}

const typeChip = q => `<span class="qtype">${esc(TYPE_NAMES[q.type])}</span>`;

function questionHTML(q, ctx) {
  const w = ctx.byId.get(q.wineId);
  if (q.type === "sayIt") {
    return `${typeChip(q)}<h1 class="qprompt">${esc(q.prompt)}</h1>
      <div class="saycard">${glyph(w.type, 28)}<div><p class="say-name">${esc(w.name)}</p><p class="say-meta">${esc([w.grapes || w.leadGrape, w.regionGroup, w.glass != null ? money(w.glass) + " a glass" : "", w.bottle != null ? money(w.bottle) + " a bottle" : ""].filter(Boolean).join(" · "))}</p></div></div>
      ${active.phase === "ask" ? '<button type="button" class="btn big reveal" data-reveal>Show the guest line</button>' : ""}`;
  }
  const opts = q.options.map((o, i) => {
    let cls = "opt";
    if (active.phase !== "ask") cls += o.correct ? " right" : active.picked === i ? " wrong" : " faded";
    return `<button type="button" class="${cls}" data-opt="${i}" ${active.phase !== "ask" ? "disabled" : ""}><span class="optkey" aria-hidden="true">${i + 1}</span><span>${esc(o.label)}</span></button>`;
  }).join("");
  return `${typeChip(q)}<h1 class="qprompt">${esc(q.prompt)}</h1><div class="opts" role="group" aria-label="Answers">${opts}</div>`;
}

function feedbackHTML(q, ctx) {
  const w = ctx.byId.get(q.wineId), ok = active.result;
  const used = new Set();
  const isSay = q.type === "sayIt";
  const head = isSay ? "The guest line" : ok ? "Correct!" : "Not quite";
  const answer = isSay ? "" : ok ? "" : `<p class="fb-answer">The answer: <strong>${esc(q.answer)}</strong></p>`;
  const cmp = comparatorLine(w, ctx.byId);
  return `<div class="feedback ${isSay ? "say" : ok ? "ok" : "no"}" role="status">
    <div class="fb-inner">
      <p class="fb-head">${head}</p>${answer}
      ${w.guestLine ? `<p class="fb-guest">“${linkTerms(ctx.glossary, w.guestLine, used)}”</p>` : ""}
      ${cmp ? `<p class="fb-cmp">${esc(cmp)} <a class="winelink" href="#/wine/${encodeURIComponent(w.id)}">${esc(w.short)}: open the card</a></p>` : `<p class="fb-cmp"><a class="winelink" href="#/wine/${encodeURIComponent(w.id)}">${esc(w.short)}: open the card</a></p>`}
      ${q.estimate ? '<p class="fb-est">Based on estimated notes, not yet tasted by the team.</p>' : ""}
      <div class="fb-actions">${isSay && active.phase === "feedback" && active.result == null
        ? '<button type="button" class="btn big" data-self="1">I said something like it</button><button type="button" class="btn ghost big" data-self="0">Not yet</button>'
        : '<button type="button" class="btn big" data-continue>Continue</button>'}</div>
    </div>
  </div>`;
}

function endHTML(ctx) {
  const s = active.session.summary();
  const names = ids => ids.map(id => ctx.byId.get(id)).filter(Boolean).map(w => `<a class="winelink" href="#/wine/${encodeURIComponent(w.id)}">${esc(w.short)}</a>`).join(", ");
  return `<div class="lessonend">
    <h1>Lesson complete</h1>
    <p class="endscore"><strong>${s.firstRight} of ${s.wines}</strong> wines right first time</p>
    ${s.movedUp.length ? `<p>Moving up: ${names(s.movedUp)}</p>` : ""}
    ${s.missed.length ? `<p>To practise: ${names(s.missed)}. They come back first next time.</p>` : ""}
    <p><a class="btn big" href="#/learn" data-finish>Back to the path</a></p>
  </div>`;
}

export function renderLesson(id, ctx) {
  // A lesson already finished and shown starts afresh when opened again.
  if (!active || active.id !== id || active.name !== learner() || (active.phase === "end" && active.endShown)) active = start(id, ctx);
  if (!active) return `<div class="errorbox"><h1>Lesson not found</h1><p><a href="#/learn">Back to the path</a></p></div>`;
  const s = active.session;
  const pct = Math.round((s.index / Math.max(1, s.total)) * 100);
  const top = `<div class="lessontop"><a class="closebtn" href="#/learn" aria-label="Leave the lesson">×</a>
    <div class="bar lessonbar" role="progressbar" aria-label="Lesson progress" aria-valuemin="0" aria-valuemax="${s.total}" aria-valuenow="${s.index}"><span style="width:${pct}%"></span></div></div>`;
  if (active.phase === "empty") return `<div class="lessonview">${top}<div class="lessonend"><h1>Nothing to review</h1><p>No wines are due yet. Try the next lesson on the path.</p><p><a class="btn big" href="#/learn">Back to the path</a></p></div></div>`;
  if (active.phase === "end") { active.endShown = true; return `<div class="lessonview">${top}${endHTML(ctx)}</div>`; }
  const q = s.current;
  return `<div class="lessonview"><p class="lessontitle">${esc(active.title)}</p>${top}
    <div class="question">${questionHTML(q, ctx)}</div>
    ${active.phase === "feedback" ? feedbackHTML(q, ctx) : ""}</div>`;
}

function save() {
  saveProgress(active.name, active.session.progress);
}

// Returns true when the screen should be drawn again.
export function onLessonClick(e, ctx) {
  if (!active) return false;
  const t = e.target, s = active.session;
  if (t.closest(".term")) return false;
  const opt = t.closest("[data-opt]");
  if (opt && active.phase === "ask") {
    const i = +opt.dataset.opt;
    active.picked = i;
    active.result = s.current.options[i].correct;
    s.answer(active.result);
    save();
    active.phase = "feedback";
    return true;
  }
  if (t.closest("[data-reveal]") && active.phase === "ask") { active.phase = "feedback"; active.result = null; return true; }
  const self = t.closest("[data-self]");
  if (self && active.phase === "feedback") { active.result = self.dataset.self === "1"; s.answer(active.result); save(); return true; }
  if (t.closest("[data-continue]") && active.phase === "feedback") { advance(); return true; }
  return false;
}

function advance() {
  const s = active.session;
  active.picked = null; active.result = null;
  if (s.next()) { active.phase = "ask"; return; }
  active.phase = "end";
  const sum = s.summary();
  s.progress.sessions = (s.progress.sessions || []).concat({ at: Date.now(), kind: s.kind, lesson: active.id, right: sum.firstRight, wines: sum.wines }).slice(-200);
  save();
}

// Keys: 1 to 4 answer, Enter or Space continues.
export function onLessonKey(e) {
  if (!active || e.target.closest("input, textarea")) return null;
  if (active.phase === "ask" && /^[1-4]$/.test(e.key)) return `[data-opt="${+e.key - 1}"]`;
  if (active.phase === "feedback" && (e.key === "Enter" || e.key === " ")) return "[data-continue]";
  return null;
}

export const lessonActive = () => active;
