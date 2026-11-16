// A lesson, Duolingo style: a progress bar, one question at a time, big answer buttons, and a feedback bar that
// slides up in green or red with the right answer, the wine's guest line and a comparator.
import { esc, glyph, money } from "../ui.js";
import { linkTerms } from "../glossary.js";
import { buildStages } from "../quiz/stages.js";
import { loadProgress, saveProgress, isDue } from "../quiz/progress.js";
import { planLesson, Session, LESSON_LENGTH, BEFORE_SERVICE_LENGTH } from "../quiz/session.js";
import { TYPE_NAMES, comparatorLine, shuffle } from "../quiz/questions.js";
import { vocabulary, suggest, checkTyped } from "../quiz/answer.js";
import { learner } from "./path.js";
import { store } from "../store.js";
import { termIndexFor, wordQuota, pickTerms, withTerms, TERM_TYPE_NAMES, shortDefinition } from "../quiz/terms.js";
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
  const terms = termIndexFor(ctx);
  if (id === "words") {
    // Wine words: ten questions on the glossary alone. Due terms first, then up to four new ones,
    // starting with the terms our wines use most.
    kind = "words"; title = "Wine words";
    const pool = terms ? terms.terms.slice().sort((a, b) => terms.byTerm.get(b.id).wines.length - terms.byTerm.get(a.id).wines.length) : [];
    plan = terms ? pickTerms(terms, p, { pool, n: LESSON_LENGTH, newMax: 4, now }).map(it => ({ term: it.term, hint: it.hint })) : [];
    // Short of due and new terms: practise the ones met most recently, so the lesson still has a few questions.
    if (plan.length < 4 && terms) pool.filter(t => p.terms[t.id] && p.terms[t.id].box < 5 && !plan.some(x => x.term.id === t.id)).sort((a, b) => p.terms[b.id].last - p.terms[a.id].last)
      .slice(0, 4 - plan.length).forEach(t => plan.push({ term: t }));
  } else if (id === "open") {
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
    if (terms) plan = withTerms(plan, pickTerms(terms, p, { wines: pool, n: wordQuota(p).n, newMax: 0, now }), LESSON_LENGTH);
  } else {
    const lesson = stages.flatMap(s => s.lessons).find(l => l.id === id);
    if (!lesson) return null;
    const stage = stages.find(s => s.id === lesson.stageId);
    title = `${stage.title} · Lesson ${lesson.n}`;
    plan = planLesson({ newWines: lesson.wines, wines: all, progress: p, now });
    allowEstimates = !tastedIn(stage.wines);
    tasteFrom = lesson.wines;
    // Wine words where they fit: terms the lesson's own wines use, due ones first. How many depends on how well
    // this person knows wine words (wordQuota): two while finding out, none for someone who knows them.
    if (terms) { const quota = wordQuota(p); plan = withTerms(plan, pickTerms(terms, p, { wines: lesson.wines, n: quota.n, newMax: quota.newMax, now }), LESSON_LENGTH); }
  }
  const session = new Session({ kind, lessonId: id, plan, all, progress: p, allowEstimates, kb: { regionsById: ctx.regions ? ctx.regions.byId : null, terms } });
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

const typeChip = q => `<span class="qtype">${esc(TYPE_NAMES[q.type] || TERM_TYPE_NAMES[q.type] || "")}</span>`;

function questionHTML(q, ctx) {
  const w = ctx.byId.get(q.wineId);
  if (q.type === "sayIt") {
    return `${typeChip(q)}<h1 class="qprompt">${esc(q.prompt)}</h1>
      <div class="saycard">${glyph(w.type, 28)}<div><p class="say-name">${esc(w.name)}</p><p class="say-meta">${esc([w.grapes || w.leadGrape, w.regionGroup, w.glass != null ? money(w.glass) + " a glass" : "", w.bottle != null ? money(w.bottle) + " a bottle" : ""].filter(Boolean).join(" · "))}</p></div></div>
      ${active.phase === "ask" ? '<button type="button" class="btn big reveal" data-reveal>Show the guest line</button>' : ""}`;
  }
  if (q.input) return typedHTML(q, ctx);
  if (q.type === "match" || q.type === "termMatch") return matchHTML(q);
  if (q.multi) return multiHTML(q);
  const opts = q.options.map((o, i) => {
    let cls = "opt";
    if (active.phase !== "ask") cls += o.correct ? " right" : active.picked === i ? " wrong" : " faded";
    return `<button type="button" class="${cls}" data-opt="${i}" ${active.phase !== "ask" ? "disabled" : ""}><span class="optkey" aria-hidden="true">${i + 1}</span><span>${esc(o.label)}</span></button>`;
  }).join("");
  return `${typeChip(q)}<h1 class="qprompt">${esc(q.prompt)}</h1><div class="opts${q.long ? " long" : ""}" role="group" aria-label="Answers">${opts}</div>`;
}

// ---------- typed answers ----------
const vocabCache = new Map();
function wordsFor(q, ctx) {
  const key = q.suggestFrom;
  if (!key) return [];
  if (!vocabCache.has(key) || vocabCache.get(key).src !== ctx.data) {
    let list = vocabulary(ctx.data.wines, key);
    // Every region on the map is offered, not just ours, so a suggestion never gives the answer away.
    if (key === "region" && ctx.regions) list = [...new Set([...list, ...ctx.regions.regions.map(r => r.name)])].sort((a, b) => a.localeCompare(b));
    vocabCache.set(key, { src: ctx.data, list });
  }
  return vocabCache.get(key).list;
}
const suggestHTML = (list, typed) => suggest(list, typed).map(v => `<li><button type="button" class="sugg" data-sugg="${esc(v)}">${esc(v)}</button></li>`).join("");

function typedHTML(q, ctx) {
  const asking = active.phase === "ask", num = q.input === "number";
  const mark = !asking ? (active.result ? " right" : " wrong") : "";
  return `${typeChip(q)}<h1 class="qprompt">${esc(q.prompt)}</h1>
    <form class="typed" id="typedForm" autocomplete="off">
      <label class="visually-hidden" for="typedInput">Your answer</label>
      <div class="typedrow${mark}">${num ? '<span class="pound" aria-hidden="true">£</span>' : ""}
        <input id="typedInput" class="typedinput" ${num ? 'inputmode="decimal" pattern="[0-9.]*"' : 'autocapitalize="words"'} autocomplete="off" autocorrect="off" spellcheck="false"
          value="${esc(active.typed || "")}" ${asking ? "" : "readonly"} placeholder="${num ? "Price" : "Type your answer"}" aria-describedby="typedHelp"></div>
      <p id="typedHelp" class="typedhelp">${num ? "Just the number." : "Suggestions appear as you type. Spelling slips are forgiven."}</p>
      <ul class="suggest" id="suggest" aria-label="Suggestions">${asking ? suggestHTML(wordsFor(q, ctx), active.typed || "") : ""}</ul>
      ${asking ? '<button type="submit" class="btn big">Check</button>' : ""}
    </form>`;
}

export function onLessonInput(e, ctx) {
  if (!active || e.target.id !== "typedInput" || active.phase !== "ask") return;
  active.typed = e.target.value;
  const q = active.session.current, ul = document.getElementById("suggest");
  if (ul && q.suggestFrom) ul.innerHTML = suggestHTML(wordsFor(q, ctx), active.typed);
}

// Returns true when the screen should be drawn again.
export function onLessonSubmit(e) {
  if (e.target.id === "lessonNameForm") {
    e.preventDefault();
    const v = e.target.elements.name.value.trim();
    if (v) { store.set("learner", v.slice(0, 30)); active = null; }
    return !!v;
  }
  if (!active || e.target.id !== "typedForm" || active.phase !== "ask") return false;
  e.preventDefault();
  const q = active.session.current, typed = (document.getElementById("typedInput") || {}).value || "";
  if (!typed.trim()) return false;
  active.typed = typed;
  const c = checkTyped(typed, q.accept, { grapes: q.suggestFrom === "grape", numeric: q.input === "number" });
  active.result = c.ok; active.check = c;
  active.session.answer(c.ok); save();
  active.phase = "feedback";
  return true;
}

// ---------- match ----------
function matchState(q) {
  if (!active.match || active.match.q !== q) {
    active.match = { q, rights: shuffle(q.pairs.map((p, i) => i), Math.random), done: new Set(), selL: null, selR: null, mistakes: 0, flash: null };
  }
  return active.match;
}
function matchHTML(q) {
  const m = matchState(q);
  const btn = (side, i, label) => {
    const done = m.done.has(i), sel = side === "L" ? m.selL === i : m.selR === i, flash = m.flash && m.flash[side] === i;
    return `<button type="button" class="mbtn${done ? " done" : ""}${sel ? " sel" : ""}${flash ? " miss" : ""}" data-m="${side}${i}" ${done || active.phase !== "ask" ? "disabled" : ""} aria-pressed="${sel}">${esc(label)}</button>`;
  };
  return `${typeChip(q)}<h1 class="qprompt">${esc(q.prompt)}</h1>
    <div class="matchgrid${q.type === "termMatch" ? " terms" : ""}" role="group" aria-label="Tap a ${esc(q.leftWord || "wine")}, then its ${esc(q.by)}">
      <div class="mcol">${q.pairs.map((p, i) => btn("L", i, p.left)).join("")}</div>
      <div class="mcol">${m.rights.map(i => btn("R", i, q.pairs[i].right)).join("")}</div>
    </div>
    ${m.mistakes ? `<p class="typedhelp">${m.mistakes} mismatch${m.mistakes > 1 ? "es" : ""} so far</p>` : ""}`;
}
function onMatchTap(code) {
  const q = active.session.current, m = matchState(q), side = code[0], i = +code.slice(1);
  m.flash = null;
  if (side === "L") m.selL = m.selL === i ? null : i; else m.selR = m.selR === i ? null : i;
  if (m.selL == null || m.selR == null) return;
  if (m.selL === m.selR) m.done.add(m.selL);
  else { m.mistakes++; m.flash = { L: m.selL, R: m.selR }; }
  m.selL = m.selR = null;
  if (m.done.size === q.pairs.length) {
    active.result = m.mistakes === 0;
    active.session.answer(active.result); save();
    active.phase = "feedback";
  }
}

// Find them all: tap every wine that fits, then Check. Right only if exactly the right wines are chosen.
function multiHTML(q) {
  const sel = active.multi || (active.multi = new Set()), asking = active.phase === "ask";
  const opts = q.options.map((o, i) => {
    let cls = "opt pick";
    if (!asking) cls += o.correct ? (sel.has(i) ? " right" : " missed") : sel.has(i) ? " wrong" : " faded";
    return `<button type="button" class="${cls}" data-multi="${i}" aria-pressed="${sel.has(i)}" ${asking ? "" : "disabled"}><span class="optkey" aria-hidden="true">${sel.has(i) ? "✓" : ""}</span><span>${esc(o.label)}</span></button>`;
  }).join("");
  return `${typeChip(q)}<h1 class="qprompt">${esc(q.prompt)}</h1><div class="opts" role="group" aria-label="Wines: tap each one that fits">${opts}</div>
    ${asking ? `<p class="typedhelp">${sel.size} chosen</p><button type="button" class="btn big" data-check-multi ${sel.size ? "" : "disabled"}>Check</button>` : ""}`;
}

// The answer screen for a wine word: the term and its meaning, and the wine it was about, if any.
function termFeedbackHTML(q, ctx) {
  const ok = active.result, t = ctx.glossary.byId.get(q.termId), w = q.wineId ? ctx.byId.get(q.wineId) : null;
  let answer = ok ? "" : `<p class="fb-answer">The answer: <strong>${esc(q.answer)}</strong></p>`;
  if (q.type === "termMatch") answer = ok ? "" : `<p class="fb-answer">${active.match.mistakes} mismatch${active.match.mistakes > 1 ? "es" : ""}.</p>`;
  if (q.multi && !ok) answer = `<p class="fb-answer">The ${q.options.filter(o => o.correct).length}: <strong>${esc(q.answer)}</strong></p>`;
  return `<div class="feedback ${ok ? "ok" : "no"}" role="status"><div class="fb-inner">
      <p class="fb-head">${ok ? "Correct!" : "Not quite"}</p>${answer}
      ${t ? `<p class="fb-guest"><strong>${esc(t.term)}</strong>: ${esc(t.definition)}</p>` : ""}
      ${w ? `<p class="fb-cmp"><a class="winelink" href="#/wine/${encodeURIComponent(w.id)}">${esc(w.short)}: open the card</a></p>` : ""}
      <div class="fb-actions"><button type="button" class="btn big" data-continue>Continue</button></div>
    </div></div>`;
}

function feedbackHTML(q, ctx) {
  if (q.termId) return termFeedbackHTML(q, ctx);
  const w = ctx.byId.get(q.wineId), ok = active.result;
  const used = new Set();
  const isSay = q.type === "sayIt";
  const head = isSay ? "The guest line" : ok ? "Correct!" : "Not quite";
  let answer = isSay ? "" : ok ? "" : `<p class="fb-answer">The answer: <strong>${esc(q.answer)}</strong></p>`;
  if (q.input && ok && active.check && !active.check.exact) answer = `<p class="fb-answer">Watch the spelling: <strong>${esc(active.check.matched)}</strong></p>`;
  if (q.input && ok && active.check && active.check.exact && active.check.matched && q.accept[0] !== active.check.matched) answer = `<p class="fb-answer">Also called <strong>${esc(q.accept[0])}</strong>.</p>`;
  if (q.input && !ok) answer = `<p class="fb-answer">You typed <strong>${esc(active.typed)}</strong>. The answer: <strong>${esc(q.answer)}</strong></p>`;
  if (q.type === "match") answer = ok ? "" : `<p class="fb-answer">${active.match.mistakes} mismatch${active.match.mistakes > 1 ? "es" : ""}. ${esc(q.answer)}</p>`;
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
    <h1>${active.session.kind === "words" ? "Wine words done" : "Lesson complete"}</h1>
    ${s.wines ? `<p class="endscore"><strong>${s.firstRight} of ${s.wines}</strong> wines right first time</p>` : ""}
    ${s.terms ? `<p class="endscore"><strong>${s.termsRight} of ${s.terms}</strong> wine words right first time</p>` : ""}
    ${s.termsLearnt.length ? `<p>Learnt, and no longer asked: ${esc(s.termsLearnt.map(id => (ctx.glossary.byId.get(id) || {}).term).filter(Boolean).join(", "))}</p>` : ""}
    ${s.termsMissed.length ? `<p>Words to practise: ${esc(s.termsMissed.map(id => (ctx.glossary.byId.get(id) || {}).term).filter(Boolean).join(", "))}. They come back first next time.</p>` : ""}
    ${s.movedUp.length ? `<p>Moving up: ${names(s.movedUp)}</p>` : ""}
    ${s.missed.length ? `<p>To practise: ${names(s.missed)}. They come back first next time.</p>` : ""}
    <p><a class="btn big" href="#/learn" data-finish>Back to the path</a></p>
  </div>`;
}

// A lesson started with nobody chosen as the learner (the shared tablet, or a link opened on a new device)
// asks who is learning, then starts, rather than failing.
function whoHTML(id, ctx) {
  const team = (ctx.lists && ctx.lists.Team) || [];
  return `<div class="namepick"><h1>Who's learning?</h1>
    <p class="intro">Pick your name and ${id === "service" ? "Before service" : "the lesson"} starts, with your own progress.</p>
    ${team.length ? `<div class="choices names">${team.map(n => `<button type="button" class="choice" data-learner-name="${esc(n)}"><span class="c-title">${esc(n)}</span></button>`).join("")}</div>` : ""}
    <form class="nameform" id="lessonNameForm"><label for="lessonName">${team.length ? "Not listed? Your first name" : "Your first name"}</label>
      <div class="namerow"><input id="lessonName" name="name" autocomplete="given-name" maxlength="30" required><button type="submit" class="btn">Start</button></div></form>
  </div>`;
}

export function renderLesson(id, ctx) {
  if (!learner()) { active = null; return whoHTML(id, ctx); }
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
  if (active.phase === "empty") return `<div class="lessonview">${top}<div class="lessonend"><h1>Nothing to review</h1><p>${active.id === "words" ? "No wine words are due. The ones you have met are resting until their next review, and the rest are learnt." : "No wines are due yet. Try the next lesson on the path."}</p><p><a class="btn big" href="#/learn">Back to the path</a></p></div></div>`;
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
  const who = e.target.closest("[data-learner-name]");
  if (who) { store.set("learner", who.dataset.learnerName); active = null; return true; }
  if (!active) return false;
  const t = e.target, s = active.session;
  if (t.closest(".term")) return false;
  const ta = document.getElementById("tasteNote");
  if (ta && active.taste) active.taste.draft.note = ta.value; // keep the typed note across redraws
  if (active.phase.startsWith("taste")) return onTasteClick(t);
  const sugg = t.closest("[data-sugg]");
  if (sugg && active.phase === "ask") {
    const input = document.getElementById("typedInput");
    if (input) { input.value = sugg.dataset.sugg; active.typed = input.value; input.focus(); }
    const ul = document.getElementById("suggest"); if (ul) ul.innerHTML = "";
    return false;
  }
  const mu = t.closest("[data-multi]");
  if (mu && active.phase === "ask") { const i = +mu.dataset.multi, sel = active.multi || (active.multi = new Set()); sel.has(i) ? sel.delete(i) : sel.add(i); return true; }
  if (t.closest("[data-check-multi]") && active.phase === "ask") {
    const sel = active.multi || new Set(), q = s.current;
    active.result = q.options.every((o, i) => o.correct === sel.has(i));
    s.answer(active.result); save(); active.phase = "feedback"; return true;
  }
  const mb = t.closest("[data-m]");
  if (mb && active.phase === "ask") { onMatchTap(mb.dataset.m); return true; }
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
  active.picked = null; active.result = null; active.typed = ""; active.check = null; active.match = null; active.multi = null;
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
