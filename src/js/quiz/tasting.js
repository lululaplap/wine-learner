// Taste first: which wines are open to taste on this device today, the learner's own assessment of a wine,
// and how it compares with the notes. Wines by the glass are open by default; any bottle can be opened (or a
// glass wine closed) for the day. The marks clear at 4am, the start of the next service day.
import { store } from "../store.js";
import { SCORES } from "../data.js";

// The service day: before 4am still counts as the previous day.
export function serviceDay(now = Date.now()) {
  const d = new Date(now - 4 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function marks(now) {
  const m = store.get("open", null);
  return m && m.day === serviceDay(now) ? m : { day: serviceDay(now), open: [], closed: [], noAsk: false };
}

export function isOpen(w, now = Date.now()) {
  const m = marks(now);
  if (m.closed.includes(w.id)) return false;
  return w.glass != null || m.open.includes(w.id);
}

export function setOpen(w, open, now = Date.now()) {
  const m = marks(now);
  m.open = m.open.filter(id => id !== w.id);
  m.closed = m.closed.filter(id => id !== w.id);
  if (open && w.glass == null) m.open.push(w.id);
  if (!open && w.glass != null) m.closed.push(w.id);
  store.set("open", m);
}

// Bottles opened today beyond the glass list.
export const openExtras = (wines, now = Date.now()) => { const m = marks(now); return wines.filter(w => w.glass == null && m.open.includes(w.id)); };

export const askToday = (now = Date.now()) => !marks(now).noAsk;
export function dontAskToday(now = Date.now()) { const m = marks(now); m.noAsk = true; store.set("open", m); }

// The grid's scales, as on the wine card.
export const SCALE_WORDS = {
  sweetness: ["Dry", "Off-dry", "Medium", "Sweet", "Luscious"],
  acidity: ["Low", "Med −", "Medium", "Med +", "High"],
  tannin: ["Low", "Med −", "Medium", "Med +", "High"],
  body: ["Light", "Med −", "Medium", "Med +", "Full"],
  oak: ["None", "Subtle", "Noticeable", "Pronounced", "Dominant"],
  wildness: ["Classic", "Mostly classic", "Some natural", "Clearly natural", "Divisive"]
};
export const SCORE_NAMES = { sweetness: "Sweetness", acidity: "Acidity", tannin: "Tannin", body: "Body", oak: "Oak", wildness: "Wildness" };
export const gridScores = w => SCORES.filter(n => n !== "tannin" || w.type === "red" || w.type === "orange");

// Lines up an assessment with the notes: a row per score both have, and the flavours in common.
export function compareTasting(a, w) {
  const rows = gridScores(w).filter(n => a.scores && a.scores[n] != null).map(n => {
    const mine = a.scores[n], notes = w.scores ? w.scores[n] : null;
    const gap = notes == null ? null : Math.abs(mine - notes);
    return { name: n, mine, notes, verdict: gap == null ? "none" : gap === 0 ? "match" : gap === 1 ? "close" : "apart" };
  });
  const flavours = a.flavours || [];
  const shared = flavours.filter(f => w.flavours.includes(f));
  const matched = rows.filter(r => r.verdict === "match" || r.verdict === "close").length;
  return { rows, shared, onlyMine: flavours.filter(f => !w.flavours.includes(f)), onlyNotes: w.flavours.filter(f => !flavours.includes(f)), matched, compared: rows.filter(r => r.verdict !== "none").length };
}

// Plain text for "Copy my notes", ready to send to the wine lead.
export function tastingText(a, w, who, at = Date.now()) {
  const d = new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const lines = [`${w.name}${w.vintage ? " " + w.vintage : ""}, tasted by ${who}, ${d}`];
  gridScores(w).forEach(n => {
    if (a.scores && a.scores[n] != null) {
      const notes = w.scores && w.scores[n] != null ? ` (notes say ${w.scores[n]})` : "";
      lines.push(`${SCORE_NAMES[n]}: ${a.scores[n]} ${SCALE_WORDS[n][a.scores[n] - 1]}${notes}`);
    }
  });
  if (a.flavours && a.flavours.length) lines.push(`Flavours: ${a.flavours.join(", ")}`);
  if (a.note) lines.push(`Note: ${a.note}`);
  return lines.join("\n");
}

export function saveTasting(p, w, a, at = Date.now()) {
  p.tastings = p.tastings || {};
  p.tastings[w.id] = (p.tastings[w.id] || []).concat({ at, scores: a.scores || {}, flavours: a.flavours || [], note: a.note || "" }).slice(-5);
}
export const latestTasting = (p, id) => (p && p.tastings && p.tastings[id] ? p.tastings[id][p.tastings[id].length - 1] : null);
