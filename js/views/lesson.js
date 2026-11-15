// A lesson, Duolingo style: a progress bar, one question at a time, big answer buttons, and a feedback bar that
// slides up in green or red with the right answer, the wine's guest line and a comparator.
import { esc, glyph, money } from "../ui.js";
import { linkTerms } from "../glossary.js";
import { buildStages } from "../quiz/stages.js";
import { loadProgress, saveProgress, isDue } from "../quiz/progress.js";
import { planLesson, Session, LESSON_LENGTH, BEFORE_SERVICE_LENGTH } from "../quiz/session.js";
import { TYPE_NAMES, comparatorLine, shuffle } from "../quiz/questions.js";
import { learner } from "./path.js";
import { isOpen, openExtras, askToday, dontAskToday, SCALE_WORDS, SCORE_NAMES, gridScores, compareTasting, tastingText, saveTasting } from "../quiz/tasting.js";

const MAX_TASTE = 4;

let active = null; // { id, session, name, phase: "ask" | "feedback" | "end", picked, result }

function start(id, ctx) {
  const name = learner();
  if (!name) return null;
  const all = ctx.data.wines, p = loadProgress(name), now = Date.now();
  const stages = buildStages(all);
  const tastedIn = list => list.some(w => w.tasted);
  let plan, title, allowEstimates = !tastedIn(all), kind = "lesson";
  let tasteFrom = []; // the wines this lesson offers to taste first, if they are open
  if (id === "open") {
    kind = "open"; title = "Taste what's open";
    const extras = openExtras(all, now).slice(0, MAX_TASTE);
    if (!extras.length) return null;
    plan = planLesson({ newWines: extras, wines: extras, progress: p, now });
    tasteFrom = extras;
  } else if (id === "service") {
    kind = "service"; title = "Before service";
    const glass = shuffle(all.filter(w => w.glass != null), Math.random).slice(0, BEFORE_SERVICE_LENGTH);
    plan = glass.map(w => ({ wine: w, prefer: shuffle(["price", "guestRequest", "identify", "sayIt"], Math.random).slice(0, 2) }));
    tasteFrom = glass;
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
    tasteFrom = lesson.wines;
  }
  const session = new Session({ kind, lessonId: id, plan, all, progress: p, allowEstimates });
  session.next();
  const toTaste = tasteFrom.filter(w => isOpen(w, now)).slice(0, MAX_TASTE);
  const ask = toTaste.length && session.current && (id === "open" || askToday(now));
  return { id, name, title, session, phase: !session.current ? "empty" : ask ? "tasteAsk" : "ask", picked: null, result: null,
    taste: { list: toTaste, i: 0, draft: newDraft() } };
}

const newDraft = () => ({ scores: {}, flavours: [], note: "" });
const MARKS = { match: ["✓", "Match"], close: ["≈", "One step out"], apart: ["✗", "Further apart"], none: ["–", "No note yet"] };

// ---------- taste first ----------
function tasteAskHTML(ctx) {
  const list = active.taste.list;
  return `<div class="tasteask">
    <h1 class="qprompt">${list.length > 1 ? "Some of these are open." : `${esc(list[0].short)} is open.`} Taste ${list.length > 1 ? "them" : "it"} first?</h1>
    <p class="intro">Make your own assessment before the questions, then see how it compares with the notes. Nothing is marked.</p>
    <div class="rows">${list.map(w => `<div class="tasterow">${glyph(w.type, 22)}<span class="nm">${esc(w.short)}</span><span class="ds">${esc([w.leadGrape, w.regionGroup].filter(Boolean).join(" · "))}</span></div>`).join("")}</div>
    <div class="fb-actions"><button type="button" class="btn big" data-taste-start>Taste first</button><button type="button" class="btn ghost big" data-taste-none>Just the questions</button></div>
    ${active.id !== "open" ? '<p><button type="button" class="linkbtn" data-taste-never>Don\'t ask again today</button></p>' : ""}
  </div>`;
}

function gridHTML(ctx) {
  const t = active.taste, w = t.list[t.i], d = t.draft;
  const flav = (ctx.lists && ctx.lists.Flavours) || [];
  const rows = gridScores(w).map(n => `<fieldset class="gridrow"><legend>${linkTerms(ctx.glossary, SCORE_NAMES[n])}</legend><div class="gridchips">${SCALE_WORDS[n].map((word, i) =>
    `<button type="button" class="gchip" data-score="${n}" data-v="${i + 1}" aria-pressed="${d.scores[n] === i + 1}"><span class="gnum">${i + 1}</span>${esc(word)}</button>`).join("")}</div></fieldset>`).join("");
  const chips = flav.map(f => `<button type="button" class="gchip flav" data-flav="${esc(f)}" aria-pressed="${d.flavours.includes(f)}"${!d.flavours.includes(f) && d.flavours.length >= 4 ? " disabled" : ""}>${esc(f)}</button>`).join("");
  return `<div class="tastegrid">
    <p class="qtype">Taste first · ${t.i + 1} of ${t.list.length}</p>
    <h1 class="qprompt">${glyph(w.type, 26)} ${esc(w.name)}${w.vintage ? ` <span class="vintage">${esc(w.vintage)}</span>` : ""}</h1>
    <p class="intro">Pour a taste. Pick what you find; leave out anything you're unsure of.</p>
    ${rows}
    <fieldset class="gridrow"><legend>Flavours <span class="n">(up to 4)</span></legend><div class="gridchips flavs">${chips}</div></fieldset>
    <label class="notelabel" for="tasteNote">Anything else <span class="n">(optional)</span></label>
    <textarea id="tasteNote" rows="2" maxlength="300">${esc(d.note)}</textarea>
    <div class="fb-actions"><button type="button" class="btn big" data-taste-done>Compare with the notes</button><button type="button" class="btn ghost big" data-taste-skip>Skip this wine</button></div>
  </div>`;
}

function resultHTML(ctx) {
  const t = active.taste, w = t.list[t.i], c = compareTasting(t.draft, w), last = t.i === t.list.length - 1;
  const rows = c.rows.map(r => `<tr><th scope="row">${esc(SCORE_NAMES[r.name])}</th><td><span class="nw">${r.mine} · ${esc(SCALE_WORDS[r.name][r.mine - 1])}</span></td>
    <td>${r.notes != null ? `<span class="nw">${r.notes} · ${esc(SCALE_WORDS[r.name][r.notes - 1])}</span>` : "–"}</td><td class="v-${r.verdict}"><span aria-hidden="true">${MARKS[r.verdict][0]}</span> ${MARKS[r.verdict][1]}</td></tr>`).join("");
  const words = list => list.map(esc).join(", ");
  return `<div class="tasteresult">
    <p class="qtype">Your tasting · ${t.i + 1} of ${t.list.length}</p>
    <h1 class="qprompt">${esc(w.short)}: you and the notes</h1>
    ${c.compared ? `<p class="endscore">${c.matched} of ${c.compared} within a step of the notes</p>` : ""}
    ${rows ? `<table class="cmptable"><thead><tr><th scope="col"></th><th scope="col">You</th><th scope="col">Notes</th><th scope="col"></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="intro">You left the scores blank, so there is nothing to compare.</p>'}
    ${(t.draft.flavours.length || w.flavours.length) ? `<p class="flavcmp">${c.shared.length ? `<strong>You both found:</strong> ${words(c.shared)}. ` : ""}${c.onlyMine.length ? `<strong>Only you:</strong> ${words(c.onlyMine)}. ` : ""}${c.onlyNotes.length ? `<strong>Only the notes:</strong> ${words(c.onlyNotes)}.` : ""}</p>` : ""}
    ${w.note ? `<p class="note"><strong>The notes say:</strong> ${linkTerms(ctx.glossary, w.note)}</p>` : ""}
    ${!w.tasted ? '<p class="fb-est">These notes are estimates, not yet tasted by the team. If you are confident they are wrong, send your notes to the wine lead.</p>' : ""}
    <div class="fb-actions"><button type="button" class="btn ghost big" data-copy>Copy my notes</button><button type="button" class="btn big" data-taste-next>${last ? "Start the questions" : "Next wine"}</button></div>
    <p class="copied" role="status"></p>
  </div>`;
}

function nextTaste() {
  const t = active.taste;
  t.i++; t.draft = newDraft();
  active.phase = t.i < t.list.length ? "taste" : "ask";
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
  if (active.phase.startsWith("taste")) {
    const body = active.phase === "tasteAsk" ? tasteAskHTML(ctx) : active.phase === "taste" ? gridHTML(ctx) : resultHTML(ctx);
    return `<div class="lessonview tasting"><p class="lessontitle">${esc(active.title)}</p><div class="lessontop"><a class="closebtn" href="#/learn" aria-label="Leave the lesson">×</a></div>${body}</div>`;
  }
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
  const ta = document.getElementById("tasteNote");
  if (ta && active.taste) active.taste.draft.note = ta.value; // keep the typed note across redraws
  if (active.phase.startsWith("taste")) return onTasteClick(t);
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

function onTasteClick(t) {
  const tt = active.taste, w = tt.list[tt.i];
  if (t.closest("[data-taste-start]")) { active.phase = "taste"; return true; }
  if (t.closest("[data-taste-none]")) { active.phase = "ask"; return true; }
  if (t.closest("[data-taste-never]")) { dontAskToday(); active.phase = "ask"; return true; }
  const sc = t.closest("[data-score]");
  if (sc) { const n = sc.dataset.score, v = +sc.dataset.v; tt.draft.scores[n] = tt.draft.scores[n] === v ? undefined : v; if (tt.draft.scores[n] === undefined) delete tt.draft.scores[n]; return true; }
  const fl = t.closest("[data-flav]");
  if (fl) { const f = fl.dataset.flav, list = tt.draft.flavours; const i = list.indexOf(f); if (i >= 0) list.splice(i, 1); else if (list.length < 4) list.push(f); return true; }
  if (t.closest("[data-taste-skip]")) { nextTaste(); return true; }
  if (t.closest("[data-taste-done]")) {
    if (Object.keys(tt.draft.scores).length || tt.draft.flavours.length || tt.draft.note.trim()) { saveTasting(active.session.progress, w, tt.draft); save(); }
    active.phase = "tasteResult"; return true;
  }
  if (t.closest("[data-taste-next]")) { nextTaste(); return true; }
  const copy = t.closest("[data-copy]");
  if (copy) {
    const text = tastingText(tt.draft, w, active.name), done = msg => { const el = document.querySelector(".copied"); if (el) el.textContent = msg; };
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => done("Copied. Paste it into a message to the wine lead."), () => done(text));
    return false;
  }
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
