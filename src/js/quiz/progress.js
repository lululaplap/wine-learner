// Spaced repetition: a simple five-box system per wine and per person, saved on the device.
// A right answer moves a wine up one box; a wrong one sends it back to box 1. "Known" means box 4 or above.
import { store } from "../store.js";

const DAY = 24 * 60 * 60 * 1000;
export const BOXES = [
  null,
  { name: "New or just missed", after: 0 },
  { name: "Seen", after: 1 * DAY },
  { name: "Learning", after: 3 * DAY },
  { name: "Known", after: 7 * DAY },
  { name: "Solid", after: 21 * DAY }
];
export const KNOWN = 4;

export function grade(rec, correct, now = Date.now()) {
  const box = correct ? Math.min(5, (rec && rec.box ? rec.box : 0) + 1) : 1;
  return {
    box,
    due: now + BOXES[box].after,
    seen: (rec && rec.seen || 0) + 1,
    right: (rec && rec.right || 0) + (correct ? 1 : 0),
    wrong: (rec && rec.wrong || 0) + (correct ? 0 : 1),
    last: now
  };
}

export const isDue = (rec, now = Date.now()) => !!rec && rec.box > 0 && rec.due <= now;
export const isKnown = rec => !!rec && rec.box >= KNOWN;

export function emptyProgress() {
  return { wines: {}, terms: {}, termLog: [], sessions: [], sigs: null, changed: [] };
}

export function loadProgress(name) {
  const p = store.get("progress:" + name, null);
  return p && p.wines ? Object.assign(emptyProgress(), p, { terms: p.terms || {}, termLog: p.termLog || [] }) : emptyProgress();
}

export function saveProgress(name, p) {
  return store.set("progress:" + name, p);
}

// "New on the list": a wine whose vintage or price changed since this person last looked, or that is new to the
// list, goes back to box 1 and is shown at the top of the path. The first visit only records what is there.
export function noteListChanges(p, wines, now = Date.now()) {
  const sig = w => [w.vintage, w.bottle, w.glass].join("|");
  const current = Object.fromEntries(wines.map(w => [w.id, sig(w)]));
  if (!p.sigs) { p.sigs = current; return []; }
  const changed = wines.filter(w => p.sigs[w.id] !== current[w.id]).map(w => w.id);
  changed.forEach(id => { if (p.wines[id]) p.wines[id] = Object.assign({}, p.wines[id], { box: 1, due: now }); });
  p.changed = [...new Set([...changed, ...(p.changed || [])])].filter(id => current[id]).slice(0, 20);
  p.sigs = current;
  return changed;
}

export function stageProgress(stage, p) {
  const n = stage.wines.length || 1;
  const known = stage.wines.filter(w => isKnown(p.wines[w.id])).length;
  const seen = stage.wines.filter(w => p.wines[w.id]).length;
  return { known, seen, total: stage.wines.length, learnt: stage.wines.length > 0 && known / n >= 0.9, share: known / n };
}

// A lesson is done once every wine in it has been seen and answered right at least once.
export const lessonDone = (lesson, p) => lesson.wines.every(w => p.wines[w.id] && p.wines[w.id].right > 0);
