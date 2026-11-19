// One wine search for every search box (the wine list, the maps, and in the app the search bar, the wine picker and
// Take off stock), so a guest's words find the wine wherever staff type them.
//
// - Capitals, accents and punctuation don't matter, and nor do small words: "cotes du rhone" is "Côtes du Rhône".
// - Every word typed must match, in any order and any field; a word may be the start of a longer one ("chateau").
//   Plurals match singulars ("cote" and "cotes"). Slips are forgiven by length: two swapped letters in a word of 4
//   ("nior"), one slip from 5 letters ("syarh"), two from 8 ("shardonay"). Sound-alikes too far off for that
//   ("bojolais") are listed in the Wine regions tab's Misspellings column. Words typed apart ("chateau neuf") are
//   also tried joined up.
// - Closer matches always rank first (exact, then the start of a word, then a slip), then by where the word was
//   found. When nothing matches, didYouMean() offers the nearest words on the list ("Did you mean chardonnay?").
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

// Edits between two words (a letter missing, extra, wrong, or two neighbours swapped), stopping past `max`.
export function distance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let low = i;
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      cur.push(d); low = Math.min(low, d);
    }
    if (low > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}
const slipsAllowed = n => (n >= 8 ? 2 : n >= 5 ? 1 : 0);
const swapped = (a, b) => a.length === b.length && distance(a, b, 1) === 1 && [...a].sort().join("") === [...b].sort().join("");

// How close one typed word is to one word of the wine: 4 exact, 3 the start of it, 2 a slip in the whole word
// (less for two), 1 a slip in a word still being typed, 0 not at all.
function wordMatch(q, w) {
  if (q === w) return 4;
  if (w.startsWith(q)) return 3;
  const max = slipsAllowed(q.length);
  if (!max) return q.length === 4 && swapped(q, w) ? 2 : 0;
  const d = distance(q, w, max);
  if (d <= max) return d === 1 ? 2 : 1.8;
  if (w.length > q.length && distance(q, w.slice(0, q.length), max) <= max) return 1;
  return 0;
}

const FIELDS = [
  { key: "name", weight: 10 }, { key: "grape", weight: 6 }, { key: "region", weight: 5 }, { key: "misspelling", weight: 5 }, { key: "regionAlias", weight: 4 },
  { key: "style", weight: 3 }, { key: "ifYouLike", weight: 2 }, { key: "flavour", weight: 1 }
];

// Builds what search looks at for each wine. `regions` is the Wine regions tab (ctx.regions), for the regions' other
// names. Rebuild when the wines change.
export function searchIndex(wines, regions = null) {
  const entries = wines.map(w => {
    const reg = regions && w.regionId ? regions.byId.get(w.regionId) : null;
    const grapes = String(w.grapes || "").split(/[,&+/]| and /).map(g => g.replace(/\(.*?\)/g, " ").trim()).filter(Boolean).concat(w.leadGrape || [], w.family || []);
    const parts = {
      name: [w.name, w.producer, w.cuvee, w.short, w.vintage],
      grape: grapes.flatMap(g => [g, ...grapeNames(g)]),
      region: [w.regionGroup, w.region, w.place, w.country, reg ? reg.name : ""],
      regionAlias: reg ? reg.aliases : [],
      misspelling: reg ? reg.misspellings || [] : [],
      style: [w.section, w.type],
      ifYouLike: w.ifYouLike || [],
      flavour: (w.flavours || []).concat(w.making || [])
    };
    const fields = FIELDS.map(f => ({ ...f, texts: parts[f.key].filter(Boolean), words: [...new Set(parts[f.key].flatMap(t => words(t, { joined: true })))] }));
    return { wine: w, fields, regionName: reg ? reg.name : w.regionGroup };
  });
  // The words on the list, as written, for "Did you mean…?" (misspellings are never offered).
  const vocab = new Map();
  entries.forEach(e => e.fields.filter(f => f.key !== "misspelling").forEach(f => f.texts.forEach(t => String(t).split(/[^\p{L}\p{N}'’]+/u).forEach(raw => {
    const k = words(raw)[0]; if (!k || k.length < 3) return;
    const v = vocab.get(k) || { word: raw.replace(/['’]s$/, ""), count: 0 }; v.count++; vocab.set(k, v);
  }))));
  entries.vocab = vocab;
  return entries;
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

// Returns [{ wine, score, why }], best first. A wine must match every word typed. If nothing does and two words
// typed apart make one on the list ("chateau neuf"), they are tried joined.
export function search(index, query, opts = {}) {
  const q = words(query), res = searchWords(index, q, opts);
  if (res.length || q.length < 2) return res;
  for (let i = 0; i < q.length - 1; i++) {
    const joined = q.slice(0, i).concat(q[i] + q[i + 1], q.slice(i + 2)), again = searchWords(index, joined, opts);
    if (again.length) return again;
  }
  return res;
}

function searchWords(index, q, { limit = 8, filter = null } = {}) {
  if (!q.length) return [];
  const out = [];
  for (const entry of index) {
    if (filter && !filter(entry.wine)) continue;
    let score = 0, weakest = null, ok = true;
    for (const t of q) {
      let best = 0, bestField = null;
      for (const f of entry.fields) {
        // closeness first, then where it was found: a slip on a wine's name never outranks an exact region
        for (const w of f.words) { const c = wordMatch(t, w); if (!c) continue; const m = c * 100 + f.weight; if (m > best) { best = m; bestField = f; } }
      }
      if (!best) { ok = false; break; }
      score += best;
      if (!weakest || bestField.weight < weakest.weight) weakest = bestField;
    }
    if (!ok) continue;
    // A typed phrase found whole, in order, in one field ranks above the same words scattered.
    const phrase = q.join(" ");
    if (entry.fields.some(f => f.texts.some(t => words(t).join(" ").includes(phrase)))) score += 50 * q.length;
    out.push({ wine: entry.wine, score, why: weakest && weakest.weight < 5 ? reason(weakest, q, entry) : "" });
  }
  out.sort((a, b) => b.score - a.score || String(a.wine.short || a.wine.s).localeCompare(String(b.wine.short || b.wine.s)));
  return limit ? out.slice(0, limit) : out;
}

// When a search finds nothing: the same words with each one that matches nothing swapped for the nearest word on
// the list, if that finds wines. "shardoney" gives "chardonnay"; "" when there is nothing close.
export function didYouMean(index, query) {
  const q = words(query);
  if (!q.length || !index.vocab) return "";
  const known = t => index.some(e => e.fields.some(f => f.words.some(w => wordMatch(t, w))));
  let changed = false;
  const fixed = q.map(t => {
    if (known(t)) return t;
    let best = null;
    for (const [k, v] of index.vocab) {
      const max = Math.max(1, Math.floor(t.length / 3)); // about one slip in three letters: close enough to be what was meant
      const d = distance(t, k, max);
      if (d <= max && (!best || d < best.d || (d === best.d && v.count > best.v.count))) best = { k, v, d };
    }
    if (!best) return t;
    changed = true; return best.v.word.toLowerCase();
  });
  if (!changed) return "";
  const out = fixed.join(" ");
  return search(index, out, { limit: 1 }).length ? out : "";
}
