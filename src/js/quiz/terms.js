// Wine words: the glossary in the lessons. Each term has its own five boxes per person, like a wine, so a term
// answered right on separate days comes round less and less often; once it reaches box 5 it is learnt and is no
// longer asked. Questions go both ways (term to meaning, meaning to term), match terms to meanings, and tie a term
// to our wines ("“Chalky”: which of these wines does that describe?", "Find the 3 wines with “biodynamic” in
// their notes").
import { findTerms } from "../glossary.js";
import { isDue } from "./progress.js";
import { shuffle } from "./questions.js";

export const TERM_TYPES = ["termDefine", "termName", "termMatch", "termWine", "termPickAll"];
export const TERM_TYPE_NAMES = { termDefine: "What it means", termName: "Name the term", termMatch: "Match the meanings", termWine: "Which wine", termPickAll: "Find them all" };
export const TERM_LEARNT = 5;         // box 5: learnt, no longer asked
export const TERMS_PER_LESSON = 2;    // in a 10-question lesson, at most
export const FIRST_RIGHT_BOX = 4;     // a word answered right the first time it is met is already known: next asked in 7 days
const LOG_SIZE = 12;                  // how many recent first answers to words judge how well someone knows them
const WIDE = 0.4;                     // a term in more than 40% of the wines says little about any one of them

const termKey = t => "term:" + t.id;
export const termRecord = (p, t) => (p.terms || {})[t.id];
export const isLearnt = rec => !!rec && rec.box >= TERM_LEARNT;

// The text a term can appear in: the notes the team reads on the card.
const wineText = w => [w.note, w.guestLine, w.making.join(". "), w.flavours.join(". "), w.serve, w.story].filter(Boolean).join(" \n ");

// The index for the loaded data, worked out once per load.
let cache = null;
export function termIndexFor(ctx) {
  if (!ctx.glossary || !ctx.data) return null;
  if (!cache || cache.data !== ctx.data || cache.glossary !== ctx.glossary) cache = { data: ctx.data, glossary: ctx.glossary, idx: buildTermIndex(ctx.glossary, ctx.data.wines) };
  return cache.idx;
}

// Which wines use each term, and the word as it appears ("chalky" for the term Chalk).
export function buildTermIndex(glossary, wines) {
  const byTerm = new Map((glossary ? glossary.terms : []).map(t => [t.id, { term: t, wines: [], forms: new Map() }]));
  wines.forEach(w => {
    const text = wineText(w), seen = new Set();
    findTerms(glossary, text).forEach(h => {
      const e = byTerm.get(h.term.id);
      if (!e || seen.has(h.term.id)) return;
      seen.add(h.term.id); e.wines.push(w.id); e.forms.set(w.id, text.slice(h.start, h.end));
    });
  });
  const termsOf = w => [...byTerm.values()].filter(e => e.wines.includes(w.id)).map(e => e.term);
  return { glossary, byTerm, terms: [...byTerm.values()].map(e => e.term), termsOf, count: wines.length };
}

// The first sentence of a definition, cut to a readable length, with the term itself hidden so it gives nothing away.
export function shortDefinition(t, max = 120) {
  let s = (t.definition.match(/^.*?[.!?](?=\s|$)/) || [t.definition])[0].trim();
  if (s.length > max) s = s.slice(0, s.lastIndexOf(" ", max - 1)).replace(/[,;:]$/, "") + "…";
  return s;
}
// Hides the term (and its other spellings) inside a definition, using the glossary's own matching.
function masked(idx, t, text) {
  let out = "", pos = 0;
  findTerms(idx.glossary, text).filter(h => h.term.id === t.id).forEach(h => { out += text.slice(pos, h.start) + "___"; pos = h.end; });
  return out + text.slice(pos);
}

const label = t => t.term;
const mcq = (type, t, prompt, correct, wrong, rng, extra = {}) => {
  if (wrong.length < 3) return null;
  const options = shuffle([{ label: correct, correct: true }, ...wrong.slice(0, 3).map(l => ({ label: l, correct: false }))], rng);
  return { type, termId: t.id, gradeId: termKey(t), prompt, options, answer: correct, estimate: false, ...extra };
};
const otherTerms = (t, idx) => idx.terms.filter(x => x.id !== t.id);
const distinct = (list, key, n) => { const seen = new Set(), out = []; for (const x of list) { const k = key(x); if (k && !seen.has(k)) { seen.add(k); out.push(x); } if (out.length >= n) break; } return out; };

// "What does “pét-nat” mean?" Four meanings.
function termDefine(t, idx, rng) {
  const wrong = distinct(shuffle(otherTerms(t, idx), rng), x => shortDefinition(x), 3).map(x => masked(idx, x, shortDefinition(x)));
  return mcq("termDefine", t, `What does “${t.term}” mean?`, masked(idx, t, shortDefinition(t)), wrong, rng, { long: true });
}

// "“Fermented and aged in barrels, which adds texture…” Which term is that?" Four terms.
function termName(t, idx, rng) {
  const wrong = distinct(shuffle(otherTerms(t, idx), rng), label, 3).map(label);
  return mcq("termName", t, `“${masked(idx, t, shortDefinition(t))}” Which term is that?`, t.term, wrong, rng);
}

// Tap pairs: four terms and their meanings.
function termMatch(t, idx, rng) {
  const rest = distinct(shuffle(otherTerms(t, idx), rng), label, 3);
  if (rest.length < 3) return null;
  const set = [t, ...rest];
  return { type: "termMatch", termId: t.id, gradeId: termKey(t), prompt: "Match each term to its meaning.", by: "meaning", leftWord: "term",
    pairs: set.map(x => ({ left: x.term, right: masked(idx, x, shortDefinition(x, 90)) })), answer: set.map(x => `${x.term}: ${shortDefinition(x, 90)}`).join(" · "), estimate: false };
}

// "“Chalky”: which of these wines does that describe?" One wine whose notes use the term, three that don't.
function termWine(t, idx, rng, { all, hint } = {}) {
  const e = idx.byTerm.get(t.id);
  if (!e || !e.wines.length || e.wines.length > idx.count * WIDE) return null;
  const right = all.find(w => w.id === (hint && e.wines.includes(hint) ? hint : e.wines[Math.floor(rng() * e.wines.length)]));
  if (!right) return null;
  const without = all.filter(w => !e.wines.includes(w.id));
  const wrong = distinct(shuffle(without.filter(w => w.type === right.type), rng).concat(shuffle(without, rng)), w => w.short, 3).map(w => w.short);
  const form = e.forms.get(right.id) || t.term;
  return mcq("termWine", t, `“${form[0].toUpperCase() + form.slice(1)}”: which of these wines does that describe?`, right.short, wrong, rng, { wineId: right.id });
}

// "Find the 3 wines with “biodynamic” in their notes." Six wines, two to four of them right.
function termPickAll(t, idx, rng, { all } = {}) {
  const e = idx.byTerm.get(t.id);
  if (!e || e.wines.length < 2 || e.wines.length > idx.count * WIDE) return null;
  const n = Math.min(4, e.wines.length);
  const rightW = shuffle(all.filter(w => e.wines.includes(w.id)), rng).slice(0, n);
  const wrongW = distinct(shuffle(all.filter(w => !e.wines.includes(w.id)), rng), w => w.short, 6 - n);
  if (wrongW.length < 6 - n || new Set(rightW.map(w => w.short)).size < n) return null;
  const options = shuffle([...rightW.map(w => ({ label: w.short, correct: true, wineId: w.id })), ...wrongW.map(w => ({ label: w.short, correct: false, wineId: w.id }))], rng);
  return { type: "termPickAll", termId: t.id, gradeId: termKey(t), prompt: `Find the ${n} wines with “${t.term.toLowerCase()}” in their notes.`, options, multi: true,
    answer: rightW.map(w => w.short).join(", "), estimate: false };
}

export const TERM_GENERATORS = { termDefine, termName, termMatch, termWine, termPickAll };

// One question about term t. A term met for the first time starts with its meaning; after that any type,
// leaving out the one just asked.
export function termQuestionFor(t, idx, all, rng, { rec = null, avoid = null, hint = null } = {}) {
  const first = !rec;
  const order = first ? ["termDefine", "termName"] : shuffle(TERM_TYPES, rng).filter(x => x !== avoid);
  for (const type of order) {
    const q = TERM_GENERATORS[type](t, idx, rng, { all, hint });
    if (q) return q;
  }
  return null;
}

// Which terms a lesson asks about: those due for review first, then new ones from the lesson's own wines.
// Learnt terms (box 5) are left out, and terms seen but not yet due wait, so the spacing holds.
export function pickTerms(idx, progress, { wines = [], n = TERMS_PER_LESSON, newMax = 1, now = Date.now(), pool = null } = {}) {
  const terms = progress.terms || {};
  const candidates = pool || [...new Set(wines.flatMap(w => idx.termsOf(w)))];
  const due = candidates.filter(t => terms[t.id] && !isLearnt(terms[t.id]) && isDue(terms[t.id], now)).sort((a, b) => terms[a.id].due - terms[b.id].due);
  const fresh = candidates.filter(t => !terms[t.id]);
  const out = due.slice(0, n);
  fresh.slice(0, Math.min(newMax, n - out.length)).forEach(t => out.push(t));
  return out.map(t => ({ term: t, hint: (wines.find(w => idx.byTerm.get(t.id).wines.includes(w.id)) || {}).id || null }));
}

// Mixes term items into a lesson plan: one after the third question, one after the seventh, keeping its length.
export function withTerms(plan, items, length) {
  const out = plan.slice();
  items.forEach((it, i) => out.splice(Math.min(out.length, 3 + i * 4), 0, { term: it.term, hint: it.hint }));
  // Keep the lesson the same length by dropping trailing practice (wines already asked earlier in the lesson).
  for (let i = out.length - 1; out.length > length && i >= 0; i--) {
    const it = out[i];
    if (it.wine && out.findIndex(x => x.wine && x.wine.id === it.wine.id) < i) out.splice(i, 1);
  }
  return out;
}

// How well someone knows wine words: the share of their recent first answers to word questions that were right.
// Null until there are 4, so the first lessons find out.
export function termFluency(progress) {
  const log = (progress.termLog || []).slice(-LOG_SIZE);
  return log.length < 4 ? null : log.filter(Boolean).length / log.length;
}

// How many word questions a lesson gets, and how many of them may be new words. The better someone knows the
// words, the fewer: an expert learning the list's new wines soon sees none.
export function wordQuota(progress) {
  const f = termFluency(progress);
  if (f == null) return { n: 2, newMax: 2, level: "finding out" }; // two new words a lesson, so it knows within two lessons
  if (f >= 0.9) return { n: 0, newMax: 0, level: "known" };
  if (f >= 0.75) return { n: 1, newMax: 0, level: "mostly known" };
  if (f >= 0.5) return { n: 1, newMax: 1, level: "learning" };
  return { n: 2, newMax: 1, level: "new" };
}
export function logTermAnswer(progress, correct) {
  progress.termLog = (progress.termLog || []).concat(!!correct).slice(-LOG_SIZE);
}

export function termStats(idx, progress) {
  const terms = progress.terms || {};
  const learnt = idx.terms.filter(t => isLearnt(terms[t.id])).length;
  const due = idx.terms.filter(t => terms[t.id] && !isLearnt(terms[t.id]) && isDue(terms[t.id])).length;
  const met = idx.terms.filter(t => terms[t.id]).length;
  return { total: idx.terms.length, learnt, due, met, fresh: idx.terms.length - met };
}
