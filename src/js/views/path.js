// The lesson path, Learn mode's home: one unit per stage, each a winding row of short lessons, Duolingo style.
// Nothing is locked: the next lesson is highlighted, but any lesson can be started.
import { esc, glyph, wineRow } from "../ui.js";
import { store } from "../store.js";
import { buildStages } from "../quiz/stages.js";
import { loadProgress, saveProgress, noteListChanges, stageProgress, lessonDone, isDue } from "../quiz/progress.js";
import { openExtras } from "../quiz/tasting.js";
import { termIndexFor, termStats, wordQuota } from "../quiz/terms.js";

export const learner = () => store.get("learner", "");

export function pathData(ctx) {
  const name = learner();
  const stages = buildStages(ctx.data.wines);
  const p = loadProgress(name);
  noteListChanges(p, ctx.data.wines);
  saveProgress(name, p);
  return { name, stages, p };
}

function namePicker(ctx) {
  const team = (ctx.lists && ctx.lists.Team) || [];
  return `<div class="namepick">
    <h1>Who's learning?</h1>
    <p class="intro">Your progress is kept on this device under your first name.</p>
    ${team.length ? `<div class="choices names">${team.map(n => `<button type="button" class="choice" data-name="${esc(n)}"><span class="c-title">${esc(n)}</span></button>`).join("")}</div><p class="intro">Not listed?</p>` : ""}
    <form class="nameform" id="nameForm"><label for="nameInput">First name</label>
      <div class="namerow"><input id="nameInput" name="name" autocomplete="given-name" maxlength="30" required><button type="submit" class="btn">Start</button></div></form>
  </div>`;
}

// Bottles open beyond the glass list today, and a lesson built from them: taste each, then questions.
function openSection(ctx) {
  const extras = openExtras(ctx.data.wines);
  if (!extras.length) return '<p class="opennote">Lessons offer to taste any wine that is open: the glass list, and any bottle marked <em>Open to taste today</em> on its card.</p>';
  return `<div class="openlist"><h2>Open to taste today</h2><div class="rows">${extras.map(w => wineRow(w)).join("")}</div>
    <p><a class="btn" href="#/lesson/open">Taste what's open, then questions</a></p></div>`;
}

// Wine words: the glossary as its own short lesson, with how many are due and learnt.
function wordsButton(ctx, p) {
  const idx = termIndexFor(ctx);
  if (!idx || !idx.terms.length) return "";
  const st = termStats(idx, p);
  const note = st.due ? `${st.due} due` : st.fresh ? `${st.learnt} of ${st.total} learnt` : "all learnt";
  // Someone who knows the words gets none in their lessons; say so, so it isn't a surprise.
  const quiet = wordQuota(p).n === 0 ? `<span class="n"> · you know these well, so lessons skip them</span>` : "";
  return `<a class="btn ghost" href="#/lesson/words">Wine words <span class="n">· ${note}</span>${quiet}</a>`;
}

const CROWN = learnt => `<svg class="crown${learnt ? " on" : ""}" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-10-4.6 4-2.8-6-2.8 6-4.6-4z"/></svg>`;
const OFFSETS = [0, 56, 84, 56, 0, -56, -84, -56]; // the path's winding, in pixels from the centre line

export function renderPath(ctx) {
  const name = learner();
  if (!name) return namePicker(ctx);
  const { stages, p } = pathData(ctx);
  const now = Date.now();
  const due = ctx.data.wines.filter(w => isDue(p.wines[w.id], now));
  // The next lesson: the first one not yet done, walking the path in order.
  const next = stages.flatMap(s => s.lessons).find(l => !lessonDone(l, p));
  const changed = (p.changed || []).map(id => ctx.byId.get(id)).filter(Boolean);
  const today = new Date().toDateString(), weekAgo = now - 7 * 864e5;
  const sessToday = p.sessions.filter(s => new Date(s.at).toDateString() === today).length;
  const sessWeek = p.sessions.filter(s => s.at >= weekAgo).length;
  let k = 0;
  const units = stages.filter(s => s.lessons.length).map(s => {
    const sp = stageProgress(s, p);
    const dueHere = s.wines.filter(w => isDue(p.wines[w.id], now)).length;
    const nodes = s.lessons.map(l => {
      const done = lessonDone(l, p), isNext = next && next.id === l.id;
      const off = OFFSETS[k++ % OFFSETS.length];
      return `<li class="node${done ? " done" : ""}${isNext ? " next" : ""}" style="--off:${off}px">
        <a class="nodebtn" href="#/lesson/${l.id}" aria-label="${esc(s.title)}, lesson ${l.n} of ${s.lessons.length}${done ? ", done" : isNext ? ", next" : ""}: ${esc(l.wines.map(w => w.short).join(", "))}">
          ${done ? '<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' : `<span>${l.n}</span>`}
        </a>
        ${isNext ? '<span class="startbubble" aria-hidden="true">Start</span>' : ""}
        <span class="nodewines">${l.wines.map(w => glyph(w.type, 14)).join("")} ${esc(l.wines.map(w => w.short).join(" · "))}</span>
      </li>`;
    }).join("");
    return `<section class="unit" aria-labelledby="unit-${s.id}">
      <header class="unithead">
        <div class="uh-text"><p class="uh-n">Unit ${s.n}</p><h2 id="unit-${s.id}">${esc(s.title)}</h2><p class="uh-blurb">${esc(s.blurb)}</p></div>
        <div class="uh-side">${CROWN(sp.learnt)}<span class="uh-count">${sp.known}/${sp.total} known</span></div>
        <div class="bar" role="progressbar" aria-label="${esc(s.title)}: ${sp.known} of ${sp.total} wines known" aria-valuemin="0" aria-valuemax="${sp.total}" aria-valuenow="${sp.known}"><span style="width:${Math.round(sp.share * 100)}%"></span></div>
        ${dueHere ? `<a class="btn ghost small duebtn" href="#/lesson/review-${s.id}">Review ${dueHere} due</a>` : ""}
      </header>
      <ol class="nodes">${nodes}</ol>
    </section>`;
  }).join("");
  return `<div class="pathview">
    <div class="pathtop">
      <p class="hello">Hi ${esc(name)} <button type="button" class="linkbtn" data-switch>Not you?</button></p>
      <div class="pathactions">
        ${next ? `<a class="btn big" href="#/lesson/${next.id}">Start today's lesson</a>` : ""}
        <a class="btn ghost" href="#/lesson/service">Before service: the glass list and the tasting menu</a>
        ${due.length ? `<a class="btn ghost" href="#/lesson/review">Review ${due.length} due</a>` : ""}
        ${wordsButton(ctx, p)}
      </div>
      ${openSection(ctx)}
      ${changed.length ? `<div class="newlist"><h2>New on the list</h2><p class="intro">New wines, or a new vintage or price. They are back at the start of their reviews.</p><div class="rows">${changed.map(w => wineRow(w)).join("")}</div><button type="button" class="linkbtn" data-clear-new>Clear this list</button></div>` : ""}
    </div>
    ${units}
    <footer class="pathfoot">
      <p>Lessons on this device: ${sessToday} today, ${sessWeek} in the last 7 days.</p>
      <button type="button" class="btn ghost small" data-reset>Reset my progress</button>
    </footer>
  </div>`;
}

export function onPathClick(e, ctx, rerender) {
  const t = e.target;
  const pick = t.closest("[data-name]");
  if (pick) { store.set("learner", pick.dataset.name); return rerender(); }
  if (t.closest("[data-switch]")) { store.remove("learner"); return rerender(); }
  if (t.closest("[data-clear-new]")) { const name = learner(), p = loadProgress(name); p.changed = []; saveProgress(name, p); return rerender(); }
  if (t.closest("[data-reset]")) {
    if (confirm(`Reset all of ${learner()}'s progress on this device? This cannot be undone.`)) { store.remove("progress:" + learner()); rerender(); }
  }
}

export function onPathSubmit(e, rerender) {
  if (e.target.id !== "nameForm") return;
  e.preventDefault();
  const v = e.target.elements.name.value.trim();
  if (v) { store.set("learner", v.slice(0, 30)); rerender(); }
}
