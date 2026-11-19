// One wine search for every search box (the wine list, the maps, and in the app the search bar, the wine picker and
// Take off stock), so a guest's words find the wine wherever staff type them.
//
// - Capitals, accents and punctuation don't matter, and nor do small words: "cotes du rhone" is "Côtes du Rhône".
// - Every word typed must match, in any order and any field; a word may be the start of a longer one ("chateau").
//   Plurals match singulars ("cote" and "cotes"), and a word of 5 letters or more may have one slip ("grenach", "syarh").
// - It looks at the wine's own names first, then grapes (under any of their names: Garnacha finds Grenache), the
//   region (and the region's other names from the Wine regions tab: Côtes du Rhône, Châteauneuf-du-Pape, Cornas),
//   the style, then the *If you like* styles and flavours. Matches from those last fields rank lower and say why:
//   "For guests who like Côtes du Rhône".
import { grapeNames } from "./quiz/answer.js";

const STOP = new Set(["du", "de", "des", "la", "le", "les", "l", "d", "di", "del", "della", "dei", "da", "do", "dos", "das", "y", "e", "et", "and", "the", "of", "von", "vom", "am", "an", "a", "en"]);
const fold = s => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/œ/g, "oe").replace(/æ/g, "ae");
const stem = t => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t);

// Words of a text: folded, split on anything that isn't a letter or digit, small words dropped, plurals trimmed.
// A word written with an apostrophe or hyphen also counts joined up, so "Bout d'Zan" is found by "dzan" and
// "Roc'Ambulle" by "rocambulle".
export function words(text, { joined = false } = {}) {
  const f = fold(text), out = f.split(/[^a-z0-9]+/).filter(t => t && !STOP.has(t)).map(stem);
  if (joined) f.split(/[^a-z0-9'’\-]+/).filter(t => /['’\-]/.test(t)).forEach(t => { const j = t.replace(/['’\-]/g, ""); if (j.length > 2) out.push(stem(j)); });
  return out;
}

// One edit apart (a letter missing, extra, wrong or two swapped), for words of 5 letters or more.
function near(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return true;
  const rest = (x, y) => x.slice(i + 1) === y.slice(i + 1);
  return rest(a, b) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
}

// How well one typed word matches one word of the wine: 1 exact, 0.8 a beginning, 0.6 one slip, 0 not at all.
function wordMatch(q, w) {
  if (q === w) return 1;
  if (w.startsWith(q)) return 0.8;
  if (q.length >= 5 && near(q, w)) return 0.6;
  if (q.length >= 5 && w.length > q.length && near(q, w.slice(0, q.length))) return 0.5; // a slip in a word still being typed
  return 0;
}

const FIELDS = [
  { key: "name", weight: 10 }, { key: "grape", weight: 6 }, { key: "region", weight: 5 }, { key: "regionAlias", weight: 4 },
  { key: "style", weight: 3 }, { key: "ifYouLike", weight: 2 }, { key: "flavour", weight: 1 }
];

// Builds what search looks at for each wine. `regions` is the Wine regions tab (ctx.regions), for the regions' other
// names. Rebuild when the wines change.
export function searchIndex(wines, regions = null) {
  return wines.map(w => {
    const reg = regions && w.regionId ? regions.byId.get(w.regionId) : null;
    const grapes = String(w.grapes || "").split(/[,&+/]| and /).map(g => g.replace(/\(.*?\)/g, " ").trim()).filter(Boolean).concat(w.leadGrape || [], w.family || []);
    const parts = {
      name: [w.name, w.producer, w.cuvee, w.short, w.vintage],
      grape: grapes.flatMap(g => [g, ...grapeNames(g)]),
      region: [w.regionGroup, w.region, w.place, w.country, reg ? reg.name : ""],
      regionAlias: reg ? reg.aliases : [],
      style: [w.section, w.type],
      ifYouLike: w.ifYouLike || [],
      flavour: (w.flavours || []).concat(w.making || [])
    };
    const fields = FIELDS.map(f => ({ ...f, texts: parts[f.key].filter(Boolean), words: [...new Set(parts[f.key].flatMap(t => words(t, { joined: true })))] }));
    return { wine: w, fields, regionName: reg ? reg.name : w.regionGroup };
  });
}

// Why a wine matched, when it wasn't by its name, grape or region.
function reason(field, q, entry) {
  const hit = field.texts.find(t => q.every(x => words(t).some(w => wordMatch(x, w)))) || field.texts.find(t => q.some(x => words(t).some(w => wordMatch(x, w))));
  if (!hit) return "";
  if (field.key === "regionAlias") return `From ${entry.regionName}, which includes ${hit}`;
  if (field.key === "ifYouLike") return `For guests who like ${hit}`;
  if (field.key === "flavour") return `Notes: ${hit}`;
  return "";
}

// Returns [{ wine, score, why }], best first. A wine must match every word typed.
export function search(index, query, { limit = 8, filter = null } = {}) {
  const q = words(query);
  if (!q.length) return [];
  const out = [];
  for (const entry of index) {
    if (filter && !filter(entry.wine)) continue;
    let score = 0, weakest = null, ok = true;
    for (const t of q) {
      let best = 0, bestField = null;
      for (const f of entry.fields) {
        for (const w of f.words) { const m = wordMatch(t, w) * f.weight; if (m > best) { best = m; bestField = f; } }
      }
      if (!best) { ok = false; break; }
      score += best;
      if (!weakest || bestField.weight < weakest.weight) weakest = bestField;
    }
    if (!ok) continue;
    // A typed phrase found whole, in order, in one field ranks above the same words scattered.
    const phrase = q.join(" ");
    if (entry.fields.some(f => f.texts.some(t => words(t).join(" ").includes(phrase)))) score += 3 * q.length;
    out.push({ wine: entry.wine, score, why: weakest && weakest.weight < 5 ? reason(weakest, q, entry) : "" });
  }
  out.sort((a, b) => b.score - a.score || String(a.wine.short || a.wine.s).localeCompare(String(b.wine.short || b.wine.s)));
  return limit ? out.slice(0, limit) : out;
}
