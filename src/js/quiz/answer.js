// Typed answers: tidying grape names, accepting synonyms and small slips, and suggesting words as you type.

export const fold = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[’'`]/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

// Spellings in the wine sheet that are slips or variants of one grape: shown and taught as the right-hand name.
const CANON = {
  "aligote": "Aligoté", "blaufrankisch": "Blaufränkisch", "frankovka blaufrankisch": "Frankovka", "cataratto": "Catarratto",
  "garanacha": "Garnacha", "listan bianco palomino": "Listán Blanco", "maccabeu": "Macabeo", "roussane": "Roussanne",
  "romarantin": "Romorantin", "mencia": "Mencía", "negrette": "Négrette", "melon blanc": "Melon", "cinsaut": "Cinsault",
  "muscat di alexandria": "Muscat of Alexandria", "xarel lo": "Xarel·lo", "jacquere": "Jacquère", "gewurztraminer": "Gewürztraminer"
};
// Names that mean the same grape. Typing any name in a group counts for any other.
const SYNONYMS = [
  ["Grenache", "Garnacha", "Garnatxa", "Cannonau"], ["Grenache Blanc", "Garnacha Blanca"], ["Carignan", "Mazuelo", "Cariñena", "Carignano"],
  ["Blaufränkisch", "Frankovka", "Kékfrankos", "Lemberger"], ["Macabeo", "Viura", "Maccabeu"], ["Schiava", "Vernatsch", "Trollinger"],
  ["Friulano", "Tocai Friulano", "Sauvignonasse"], ["Listán Blanco", "Palomino"], ["Cinsault", "Cinsaut"], ["Syrah", "Shiraz"],
  ["Pinot Gris", "Pinot Grigio", "Grauburgunder"], ["Pinot Blanc", "Pinot Bianco", "Weissburgunder"], ["Pinot Noir", "Spätburgunder", "Pinot Nero"],
  ["Pinot Meunier", "Meunier"], ["Malbec", "Cot", "Côt"], ["Mourvèdre", "Monastrell", "Mataro"], ["Tempranillo", "Tinta Roriz", "Tinto Fino"],
  ["Vermentino", "Pigato", "Rolle"], ["Melon", "Melon de Bourgogne"], ["Furmint", "Šipon"], ["Muscat", "Moscato", "Muskateller"]
];
const SYN = new Map();
SYNONYMS.forEach(group => group.forEach(n => SYN.set(fold(n), group.map(fold))));

const NOT_GRAPES = new Set(["field blend", "native varieties", "others", "rosa"]);

export const canonGrape = g => CANON[fold(g)] || String(g).replace(/\s*\(.*\)\s*$/, "").trim();

// "Grenache & Syrah", "Clairette, Grenache Gris, Grenache Blanc & Bourboulenc", "Bacchus, Ortega+" -> clean names.
export function parseGrapes(text) {
  return String(text || "").split(/,|&|\band\b|\+/).map(t => canonGrape(t.trim())).filter(t => t && !NOT_GRAPES.has(fold(t)));
}

// The words a learner may type: every grape and region on the list, and the wine names. Used for suggestions.
export function vocabulary(wines, kind) {
  const set = new Map();
  const add = v => { const k = fold(v); if (k && !set.has(k)) set.set(k, v); };
  wines.forEach(w => {
    if (kind === "grape") { parseGrapes(w.grapes).forEach(add); if (w.leadGrape && !NOT_GRAPES.has(fold(w.leadGrape))) add(canonGrape(w.leadGrape)); }
    if (kind === "region") add(w.regionGroup);
    if (kind === "wine") add(w.short);
  });
  return [...set.values()].sort((a, b) => a.localeCompare(b));
}

export function suggest(list, typed, n = 5) {
  const t = fold(typed);
  if (!t) return [];
  const starts = list.filter(v => fold(v).startsWith(t));
  const words = list.filter(v => !starts.includes(v) && fold(v).split(" ").some(w => w.startsWith(t)));
  const inside = list.filter(v => !starts.includes(v) && !words.includes(v) && t.length >= 3 && fold(v).includes(t));
  return [...starts, ...words, ...inside].slice(0, n);
}

export function distance(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// How many slipped letters a word of this length may have and still count.
const allowance = len => (len >= 10 ? 2 : len >= 6 ? 1 : 0);

// Checks a typed answer against the accepted answers (synonyms included for grapes).
// Returns { ok, exact, matched } where matched is the accepted answer it was taken as.
export function checkTyped(typed, accept, { grapes = false, numeric = false } = {}) {
  if (numeric) {
    const v = parseFloat(String(typed).replace(/[^0-9.]/g, ""));
    const hit = accept.find(a => parseFloat(a) === v);
    return { ok: !!hit, exact: !!hit, matched: hit || null };
  }
  const t = fold(typed);
  if (!t) return { ok: false, exact: false, matched: null };
  const forms = [];
  accept.forEach(a => { forms.push([fold(a), a]); if (grapes) (SYN.get(fold(a)) || []).forEach(s => forms.push([s, a])); });
  const exact = forms.find(([f]) => f === t);
  if (exact) return { ok: true, exact: true, matched: exact[1] };
  const near = forms.find(([f]) => distance(f, t) <= allowance(f.length));
  return near ? { ok: true, exact: false, matched: near[1] } : { ok: false, exact: false, matched: null };
}
