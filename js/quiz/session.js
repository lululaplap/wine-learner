// A lesson: 10 questions, about three minutes. Up to 4 new wines from the chosen lesson, mixed with reviews that
// are due. A wine answered wrong comes back later in the same lesson (as on Duolingo). A wine's box moves on its
// first answer in the lesson; later answers are practice.
import { questionFor } from "./questions.js";
import { grade, isDue } from "./progress.js";

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
  constructor({ kind, lessonId, plan, all, progress, rng = Math.random, now = () => Date.now(), allowEstimates = true }) {
    Object.assign(this, { kind, lessonId, all, progress, rng, now, allowEstimates });
    this.queue = plan.slice();
    this.index = 0;
    this.extra = 0;
    this.graded = new Map();   // wine id -> was its first answer right
    this.startBox = new Map(); // wine id -> box before this lesson
    this.lastType = null;
    this.current = null;
    this.answered = 0;
  }
  get total() { return this.queue.length; }
  get done() { return this.index >= this.queue.length; }

  next() {
    while (!this.done) {
      const item = this.queue[this.index];
      const prefer = item.prefer || (item.first ? ["identify", "sayIt"] : []);
      const q = questionFor(item.wine, this.all, this.rng, { prefer, avoid: this.lastType, allowEstimates: this.allowEstimates });
      if (q) { this.current = { ...q, gradeId: item.wine.id }; this.lastType = q.type; return this.current; }
      this.queue.splice(this.index, 1); // no question possible for this wine: drop it
    }
    this.current = null;
    return null;
  }

  // Records an answer to the current question. For Say it, `correct` is the learner's own grade.
  answer(correct) {
    const q = this.current, id = q.gradeId, now = this.now();
    if (!this.startBox.has(id)) this.startBox.set(id, (this.progress.wines[id] || {}).box || 0);
    if (!this.graded.has(id)) {
      this.graded.set(id, !!correct);
      this.progress.wines[id] = grade(this.progress.wines[id], !!correct, now);
    } else if (correct) {
      // Practice: a later right answer counts towards finishing the lesson, but does not move the box.
      this.progress.wines[id] = Object.assign({}, this.progress.wines[id], { right: (this.progress.wines[id].right || 0) + 1 });
    }
    if (!correct && this.extra < MAX_EXTRA) {
      this.extra++;
      const at = Math.min(this.queue.length, this.index + 3); // a few questions later
      this.queue.splice(at, 0, { wine: this.queue[this.index].wine });
    }
    this.answered++;
    this.index++;
    return { correct: !!correct };
  }

  summary() {
    const firstRight = [...this.graded.values()].filter(Boolean).length;
    const movedUp = [...this.graded.entries()].filter(([id, ok]) => ok && (this.progress.wines[id].box > (this.startBox.get(id) || 0))).map(([id]) => id);
    const missed = [...this.graded.entries()].filter(([, ok]) => !ok).map(([id]) => id);
    return { wines: this.graded.size, firstRight, movedUp, missed, questions: this.answered };
  }
}
