// A lesson: 10 questions, about three minutes. Up to 4 new wines from the chosen lesson, mixed with reviews that
// are due. A wine answered wrong comes back later in the same lesson (as on Duolingo). A wine's box moves on its
// first answer in the lesson; later answers are practice.
import { questionFor } from "./questions.js";
import { termQuestionFor, logTermAnswer, FIRST_RIGHT_BOX } from "./terms.js";
import { grade, isDue, BOXES } from "./progress.js";

export const LESSON_LENGTH = 10;
export const BEFORE_SERVICE_LENGTH = 5;
const MAX_EXTRA = 4; // how many re-asks a lesson may add after wrong answers

export function rngFrom(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Plans which wine each question is about. New wines get two questions each (Identify first), reviews one each.
export function planLesson({ newWines, wines, progress, now = Date.now(), length = LESSON_LENGTH }) {
  const fresh = newWines.slice(0, 4);
  const freshIds = new Set(fresh.map(w => w.id));
  const due = wines.filter(w => !freshIds.has(w.id) && isDue(progress.wines[w.id], now))
    .sort((a, b) => progress.wines[a.id].due - progress.wines[b.id].due);
  const plan = [];
  fresh.forEach(w => plan.push({ wine: w, first: true }));
  const reviews = due.slice(0, Math.max(0, length - fresh.length * 2));
  reviews.forEach((w, i) => plan.splice(Math.min(plan.length, 1 + i * 2), 0, { wine: w }));
  fresh.forEach(w => plan.push({ wine: w }));
  // Still short (few reviews due): more practice on the lesson's own wines. Wines not yet due are left alone,
  // so the spacing between reviews holds.
  for (let i = 0; plan.length < length && fresh.length && i < 40; i++) plan.push({ wine: fresh[i % fresh.length] });
  return plan.slice(0, length);
}

export class Session {
  constructor({ kind, lessonId, plan, all, progress, rng = Math.random, now = () => Date.now(), allowEstimates = true, kb = {} }) {
    Object.assign(this, { kind, lessonId, all, progress, rng, now, allowEstimates, kb });
    this.queue = plan.slice();
    this.index = 0;
    this.extra = 0;
    this.reasked = new Set(); // words already asked again in this lesson
    this.graded = new Map();   // wine id -> was its first answer right
    this.startBox = new Map(); // wine id -> box before this lesson
    this.lastType = null;
    this.current = null;
    this.answered = 0;
  }
  get total() { return this.queue.length; }
  get done() { return this.index >= this.queue.length; }

  // Progress records: a wine's under progress.wines, a term's (gradeId "term:<id>") under progress.terms.
  rec(gradeId) { return gradeId.startsWith("term:") ? this.progress.terms[gradeId.slice(5)] : this.progress.wines[gradeId]; }
  setRec(gradeId, r) { if (gradeId.startsWith("term:")) this.progress.terms[gradeId.slice(5)] = r; else this.progress.wines[gradeId] = r; }

  next() {
    while (!this.done) {
      const item = this.queue[this.index];
      if (item.term) {
        const gid = "term:" + item.term.id;
        const q = this.kb.terms ? termQuestionFor(item.term, this.kb.terms, this.all, this.rng, { rec: this.rec(gid), avoid: this.lastType, hint: item.hint }) : null;
        if (q) { this.current = { ...q, gradeId: gid }; this.lastType = q.type; return this.current; }
        this.queue.splice(this.index, 1);
        continue;
      }
      const prefer = item.prefer || (item.first ? ["identify", "sayIt"] : []);
      // Recall (typed answers) only once the wine has left box 1, i.e. was answered right on an earlier day.
      const id = item.wine.id, rec = this.progress.wines[id];
      const boxBefore = this.startBox.has(id) ? this.startBox.get(id) : rec ? rec.box : 0;
      const recall = boxBefore >= 2;
      const q = questionFor(item.wine, this.all, this.rng, { prefer, avoid: this.lastType, allowEstimates: this.allowEstimates, recall, kb: this.kb });
      if (q) { this.current = { ...q, gradeId: item.wine.id }; this.lastType = q.type; return this.current; }
      this.queue.splice(this.index, 1); // no question possible for this wine: drop it
    }
    this.current = null;
    return null;
  }

  // Records an answer to the current question. For Say it, `correct` is the learner's own grade.
  answer(correct) {
    const q = this.current, id = q.gradeId, now = this.now();
    if (!this.startBox.has(id)) this.startBox.set(id, (this.rec(id) || {}).box || 0);
    if (!this.graded.has(id)) {
      this.graded.set(id, !!correct);
      const before = this.rec(id), rec = grade(before, !!correct, now);
      if (id.startsWith("term:")) {
        // A word answered right the first time it is met is already known: it skips to box 4, so one more right
        // answer, a week on, retires it. Every first answer to a word feeds how many words later lessons ask.
        if (!before && correct) Object.assign(rec, { box: FIRST_RIGHT_BOX, due: now + BOXES[FIRST_RIGHT_BOX].after });
        logTermAnswer(this.progress, correct);
      }
      this.setRec(id, rec);
    } else if (correct) {
      // Practice: a later right answer counts towards finishing the lesson, but does not move the box.
      this.setRec(id, Object.assign({}, this.rec(id), { right: (this.rec(id).right || 0) + 1 }));
    }
    // A missed wine comes back later in the lesson; a missed word comes back once at most, so words never crowd out the wines.
    const again = !correct && this.extra < MAX_EXTRA && !(id.startsWith("term:") && this.reasked.has(id));
    if (again) {
      this.extra++;
      if (id.startsWith("term:")) this.reasked.add(id);
      const at = Math.min(this.queue.length, this.index + 3); // a few questions later
      const { wine, term, hint } = this.queue[this.index];
      this.queue.splice(at, 0, term ? { term, hint } : { wine });
    }
    this.answered++;
    this.index++;
    return { correct: !!correct };
  }

  // Wines and terms are counted apart: "3 of 4 wines right first time", "2 wine words practised".
  summary() {
    const entries = [...this.graded.entries()], wineE = entries.filter(([id]) => !id.startsWith("term:")), termE = entries.filter(([id]) => id.startsWith("term:"));
    const up = ([id, ok]) => ok && this.rec(id).box > (this.startBox.get(id) || 0);
    return { wines: wineE.length, firstRight: wineE.filter(([, ok]) => ok).length, movedUp: wineE.filter(up).map(([id]) => id), missed: wineE.filter(([, ok]) => !ok).map(([id]) => id),
      terms: termE.length, termsRight: termE.filter(([, ok]) => ok).length, termsMissed: termE.filter(([, ok]) => !ok).map(([id]) => id.slice(5)),
      termsLearnt: termE.filter(([id]) => this.rec(id).box >= 5 && (this.startBox.get(id) || 0) < 5).map(([id]) => id.slice(5)), questions: this.answered };
  }
}
