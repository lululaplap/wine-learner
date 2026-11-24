// Question generators. Every question is made from the data, never written by hand. Wrong options are drawn from
// wines of the same type where possible, so they are plausible, and are chosen so that exactly one option is right.
// A generator returns null when the wine's data cannot support that kind of question.
import { money } from "../ui.js";
import { parseGrapes, canonGrape, vocabulary, fold } from "./answer.js";

export const TYPES = ["identify", "pickWine", "describe", "reverse", "price", "stepUp", "guestRequest", "headsUp", "oddOneOut", "match", "sayIt",
  "missingGrape", "typeGrape", "typeRegion", "typeWine", "typePrice", "pairWine", "pairDish"];
export const TYPE_NAMES = {
  identify: "Identify", pickWine: "Pick the wine", describe: "Describe", reverse: "Reverse", price: "Price",
  stepUp: "Step up", guestRequest: "Guest request", headsUp: "Heads-up", oddOneOut: "Odd one out", match: "Match", sayIt: "Say it",
  missingGrape: "Missing grape", typeGrape: "Name the grape", typeRegion: "Where from", typeWine: "Name the wine", typePrice: "Type the price",
  pairWine: "Pairing", pairDish: "Pairing"
};
// Typed questions test recall, so they wait until a wine has been met in multiple choice (left box 1).
export const TYPED = new Set(["missingGrape", "typeGrape", "typeRegion", "typeWine", "typePrice"]);
// Questions built on estimated fields say so on the answer screen until the wine is tasted.
const USES_ESTIMATES = new Set(["describe", "reverse", "guestRequest", "headsUp", "sayIt"]);

export function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Picks up to n items from pool (preferring the earlier pools) whose label is new.
function pickDistinct(pools, n, labelOf, taken, rng) {
  const out = [];
  for (const pool of pools) {
    for (const x of shuffle(pool, rng)) {
      if (out.length >= n) return out;
      const l = labelOf(x);
      if (l && !taken.has(l)) { taken.add(l); out.push(x); }
    }
  }
  return out;
}

function make(type, w, prompt, correctLabel, wrongLabels, rng, extra = {}) {
  if (wrongLabels.length < 3) return null;
  const options = shuffle([{ label: correctLabel, correct: true }, ...wrongLabels.slice(0, 3).map(label => ({ label, correct: false }))], rng);
  return { type, wineId: w.id, prompt, options, answer: correctLabel, estimate: USES_ESTIMATES.has(type) && !w.tasted, ...extra };
}

const sameType = (w, all) => all.filter(x => x.id !== w.id && x.type === w.type);
const others = (w, all) => all.filter(x => x.id !== w.id && x.type !== w.type);
const grapesOf = w => w.grapes || w.leadGrape;

// 1. Identify: "Bout d'Zan: which grapes, which region?"
function identify(w, all, rng) {
  const label = x => (grapesOf(x) && x.regionGroup ? `${grapesOf(x)} · ${x.regionGroup}` : "");
  if (!label(w)) return null;
  const wrong = pickDistinct([sameType(w, all), others(w, all)], 3, label, new Set([label(w)]), rng).map(label);
  return make("identify", w, `${w.short}: which grapes, and where from?`, label(w), wrong, rng);
}

// 4. Price: "Rosso per tutti by the glass: £15, £17, £19 or £22?"
function price(w, all, rng) {
  const byGlass = w.glass != null && (w.bottle == null || rng() < 0.6);
  const val = byGlass ? w.glass : w.bottle;
  if (val == null) return null;
  const pool = all.filter(x => x.id !== w.id).map(x => (byGlass ? x.glass : x.bottle)).filter(v => v != null && v !== val);
  // Prefer prices close to the right one, so the question tests memory rather than guessing the range.
  const near = [...new Set(pool)].sort((a, b) => Math.abs(a - val) - Math.abs(b - val));
  const wrong = shuffle(near.slice(0, 6), rng).slice(0, 3).map(money);
  const how = byGlass ? `by the glass${w.glassSize ? ` (${w.glassSize})` : ""}` : "by the bottle";
  return make("price", w, `${w.short} ${how}: how much?`, money(val), wrong, rng);
}

// 2. Describe: "Which of these four is the leanest white?"
const DIMS = {
  body: { high: "the fullest-bodied", low: "the lightest-bodied" },
  acidity: { high: "the freshest (highest acidity)", low: "the softest (lowest acidity)" },
  tannin: { high: "the most tannic", low: "the softest tannins" },
  oak: { high: "the oakiest", low: null },
  wildness: { high: "the wildest", low: "the most classic" }
};
const TYPE_WORDS = { sparkling: "sparkling wine", white: "white", rose: "rosé", orange: "orange wine", red: "red", sweet: "sweet wine" };
function describe(w, all, rng) {
  if (!w.scores) return null;
  const dims = Object.keys(DIMS).filter(d => w.scores[d] != null && !(d === "tannin" && !["red", "orange"].includes(w.type)));
  for (const d of shuffle(dims, rng)) {
    const v = w.scores[d];
    const dir = v >= 4 ? "high" : v <= 2 ? "low" : null;
    if (!dir || !DIMS[d][dir]) continue;
    // Every wrong option must be clearly on the other side: at least 2 steps less (or more) on the same scale.
    const ok = x => x.scores && x.scores[d] != null && (dir === "high" ? x.scores[d] <= v - 2 : x.scores[d] >= v + 2);
    const wrong = pickDistinct([sameType(w, all).filter(ok)], 3, x => x.short, new Set([w.short]), rng);
    if (wrong.length < 3) continue;
    return make("describe", w, `Which of these is ${DIMS[d][dir]} ${TYPE_WORDS[w.type]}?`, w.short, wrong.map(x => x.short), rng, { dim: d });
  }
  return null;
}

// 3. Reverse: "Meaty, herbal, smoky, no added sulfur. Which wine?"
function reverse(w, all, rng) {
  if (w.flavours.length < 2) return null;
  const clues = w.flavours.slice(0, 4).concat(w.making.slice(0, 2));
  const fits = x => w.flavours.slice(0, 4).every(f => x.flavours.includes(f)) && w.making.slice(0, 2).every(m => x.making.includes(m));
  const wrong = pickDistinct([sameType(w, all).filter(x => x.flavours.length && !fits(x))], 3, x => x.short, new Set([w.short]), rng);
  const desc = clues.join(", ");
  return make("reverse", w, `${desc[0].toUpperCase() + desc.slice(1)}. A ${TYPE_WORDS[w.type]}. Which wine?`, w.short, wrong.map(x => x.short), rng);
}

// 5. Step up: "A guest enjoyed Fanny Sabre. What is the step up?" The next bottle up the same family, by price.
export function ladderOf(w, all) {
  const fam = (w.family || w.leadGrape || "").toLowerCase();
  if (!fam) return [];
  return all.filter(x => x.bottle != null && (x.family || x.leadGrape || "").toLowerCase() === fam).sort((a, b) => a.bottle - b.bottle || a.id.localeCompare(b.id));
}
function stepUp(w, all, rng) {
  if (w.bottle == null) return null;
  const ladder = ladderOf(w, all), i = ladder.findIndex(x => x.id === w.id);
  if (i < 0 || i === ladder.length - 1) return null;
  const up = ladder[i + 1];
  if (up.bottle === w.bottle) return null;
  // Wrong: cheaper wines of the same family, and pricier wines of other families.
  const pool1 = ladder.slice(0, i), pool2 = all.filter(x => x.type === w.type && x.bottle != null && x.bottle > w.bottle && !ladder.includes(x));
  const wrong = pickDistinct([pool1, pool2], 3, x => x.short, new Set([up.short, w.short]), rng);
  return make("stepUp", up, `A guest enjoyed ${w.short} (${money(w.bottle)}). What is the next step up in ${w.family || w.leadGrape}?`,
    up.short, wrong.map(x => x.short), rng, { from: w.id, about: w.id });
}

// 6. Guest request: "They usually drink Sancerre. Which of these would suit them?"
function guestRequest(w, all, rng) {
  if (!w.ifYouLike.length) return null;
  const style = w.ifYouLike[Math.floor(rng() * w.ifYouLike.length)];
  const wrong = pickDistinct([all.filter(x => x.id !== w.id && x.ifYouLike.length && !x.ifYouLike.includes(style))], 3, x => x.short, new Set([w.short]), rng);
  return make("guestRequest", w, `A guest usually drinks ${style}. Which of these would suit them?`, w.short, wrong.map(x => x.short), rng, { style });
}

// 7. Heads-up: "Which of these should you warn a guest about before pouring?"
function headsUp(w, all, rng) {
  if (!w.scores || !(w.scores.wildness >= 4)) return null;
  const calm = x => x.scores && x.scores.wildness != null && x.scores.wildness <= 2;
  const wrong = pickDistinct([sameType(w, all).filter(calm), others(w, all).filter(calm)], 3, x => x.short, new Set([w.short]), rng);
  return make("headsUp", w, "Which of these should you warn a guest about before pouring?", w.short, wrong.map(x => x.short), rng);
}

// 8. Say it: the learner says their pitch aloud, reveals the guest line, and grades themselves.
function sayIt(w) {
  if (!w.guestLine) return null;
  return { type: "sayIt", wineId: w.id, prompt: `Pitch ${w.short} to a guest, out loud, in one sentence.`, answer: w.guestLine, options: [], estimate: !w.tasted };
}

// ---------- the other way round: facts first, pick the wine ----------
const factsLabel = x => (grapesOf(x) && x.regionGroup ? `${grapesOf(x)} · ${x.regionGroup}` : "");
const andList = list => (list.length > 1 ? list.slice(0, -1).join(", ") + " and " + list[list.length - 1] : list[0] || "");

// "Grenache and Syrah, from the Rhône & Ardèche. A red. Which wine?"
function pickWine(w, all, rng) {
  const grapes = parseGrapes(w.grapes);
  if (!grapes.length || !w.regionGroup) return null;
  const mine = factsLabel(w);
  const pool = [sameType(w, all), others(w, all)].map(list => list.filter(x => factsLabel(x) !== mine));
  const wrong = pickDistinct(pool, 3, x => x.short, new Set([w.short]), rng);
  return make("pickWine", w, `${andList(grapes)}, from ${w.regionGroup}. A ${TYPE_WORDS[w.type]}. Which wine?`, w.short, wrong.map(x => x.short), rng);
}

// "Which of these is not from Burgundy?" or "Which of these is not a Pinot Noir?"
function oddOneOut(w, all, rng) {
  const ways = shuffle([
    { key: x => x.regionGroup, say: v => `Which of these is not from ${v}?` },
    { key: x => canonGrape(x.leadGrape || ""), say: v => `Which of these is not a ${v}?`, ok: x => parseGrapes(x.grapes).length <= 1 }
  ], rng);
  for (const way of ways) {
    const v = way.key(w);
    if (!v || (way.ok && !way.ok(w))) continue;
    const fits = x => way.key(x) === v && (!way.ok || way.ok(x));
    const insiders = pickDistinct([all.filter(x => x.id !== w.id && fits(x))], 2, x => x.short, new Set([w.short]), rng);
    if (insiders.length < 2) continue;
    const odd = pickDistinct([sameType(w, all).filter(x => !fits(x) && x.regionGroup !== v), others(w, all).filter(x => !fits(x))], 1, x => x.short, new Set([w.short, ...insiders.map(x => x.short)]), rng)[0];
    if (!odd) continue;
    const options = shuffle([{ label: odd.short, correct: true }, { label: w.short, correct: false }, ...insiders.map(x => ({ label: x.short, correct: false }))], rng);
    return { type: "oddOneOut", wineId: w.id, prompt: way.say(v), options, answer: odd.short, estimate: false, oddId: odd.id };
  }
  return null;
}

// Match: tap pairs. Four wines and their grape (or region), all different, Duolingo style.
function match(w, all, rng) {
  const by = rng() < 0.6 ? "grape" : "region";
  const right = x => (by === "grape" ? (parseGrapes(x.grapes).length === 1 ? parseGrapes(x.grapes)[0] : "") : x.regionGroup);
  if (!right(w)) return null;
  const used = new Set([fold(right(w))]);
  const rest = pickDistinct([sameType(w, all), others(w, all)], 3, x => { const r = right(x); return r && !used.has(fold(r)) ? (used.add(fold(r)), x.short) : ""; }, new Set([w.short]), rng);
  if (rest.length < 3) return null;
  const set = [w, ...rest];
  return { type: "match", wineId: w.id, prompt: `Match each wine to its ${by}.`, by,
    pairs: set.map(x => ({ left: x.short, right: right(x) })), answer: set.map(x => `${x.short}: ${right(x)}`).join(" · "), estimate: false };
}

// ---------- typed answers ----------
// "Bout d'Zan is Grenache and …?"
function missingGrape(w, all, rng) {
  const grapes = parseGrapes(w.grapes);
  if (grapes.length < 2 || new Set(grapes.map(fold)).size !== grapes.length) return null;
  // Skip lists where one name contains another (Garnacha Blanca and Garnacha): the shown one would give it away.
  if (grapes.some((g, i) => grapes.some((h, j) => i !== j && fold(h).includes(fold(g))))) return null;
  const hide = Math.floor(rng() * grapes.length);
  const shown = grapes.map((g, i) => (i === hide ? "___" : g));
  return { type: "missingGrape", wineId: w.id, prompt: `${w.short} is made from ${andList(shown)}. Which grape is missing?`, input: "text",
    accept: [grapes[hide]], answer: grapes[hide], suggestFrom: "grape", estimate: false };
}

// "What grape is Monfarina made from?"
function typeGrape(w) {
  const grapes = parseGrapes(w.grapes);
  if (grapes.length !== 1) return null;
  return { type: "typeGrape", wineId: w.id, prompt: `What grape is ${w.short} made from?`, input: "text", accept: grapes, answer: grapes[0], suggestFrom: "grape", estimate: false };
}

// "Where is Ye-Ye from?" The region, or the place, or another name for the region.
function typeRegion(w, all, rng, kb = {}) {
  if (!w.regionGroup) return null;
  const reg = kb.regionsById && w.regionId ? kb.regionsById.get(w.regionId) : null;
  const accept = [w.regionGroup, w.place, ...(reg ? [reg.name, ...(reg.aliases || [])] : [])].filter(Boolean);
  return { type: "typeRegion", wineId: w.id, prompt: `Where is ${w.short} from? Name the region.`, input: "text", accept, answer: w.regionGroup, suggestFrom: "region", estimate: false };
}

// "Xinomavro from Northern Greece. A red. Which wine?" Only when those facts point to one wine alone.
function typeWine(w, all) {
  const grapes = parseGrapes(w.grapes);
  if (!grapes.length || !w.regionGroup) return null;
  const same = all.filter(x => x.id !== w.id && factsLabel(x) === factsLabel(w));
  let prompt = `${andList(grapes)} from ${w.regionGroup}. A ${TYPE_WORDS[w.type]}.`;
  if (same.length) {
    const p = w.bottle != null ? money(w.bottle) + " a bottle" : money(w.glass) + " a glass";
    if (same.some(x => (x.bottle != null ? money(x.bottle) + " a bottle" : money(x.glass) + " a glass") === p)) return null;
    prompt += ` ${p}.`;
  }
  return { type: "typeWine", wineId: w.id, prompt: `${prompt} Which wine?`, input: "text", accept: [w.short, w.cuvee, w.name].filter(Boolean), answer: w.short, suggestFrom: "wine", estimate: false };
}

// "How much is a glass of Fronsac?"
function typePrice(w, all, rng) {
  const byGlass = w.glass != null && (w.bottle == null || rng() < 0.6);
  const val = byGlass ? w.glass : w.bottle;
  if (val == null) return null;
  return { type: "typePrice", wineId: w.id, prompt: byGlass ? `How much is a glass of ${w.short}${w.glassSize ? ` (${w.glassSize})` : ""}?` : `How much is a bottle of ${w.short}?`,
    input: "number", accept: [String(val)], answer: money(val), estimate: false };
}

// ---------- the tasting menu ----------
// Pairings come from the pairing bible, so they are never estimates. A dish served with either of two wines (the
// mousse: Maury or Banyuls) never offers the other one as a wrong answer.
const menuPairings = all => all.flatMap(x => (x.pairings || []).map(p => ({ p, wine: x })));
const dishLabel = p => (p.dish.toLowerCase() === p.course.toLowerCase() ? p.dish : `${p.dish} (${p.course.toLowerCase()})`);

// "Venison (main): which wine is it paired with?"
function pairWine(w, all, rng) {
  if (!w.pairings || !w.pairings.length) return null;
  const p = w.pairings[Math.floor(rng() * w.pairings.length)];
  const menu = menuPairings(all), alsoRight = new Set(menu.filter(x => x.p.dish === p.dish && x.p.course === p.course).map(x => x.wine.short));
  const wrong = shuffle([...new Set(menu.map(x => x.wine.short))].filter(s => !alsoRight.has(s)), rng);
  return make("pairWine", w, `${dishLabel(p)}: which wine is it paired with on the tasting menu?`, w.short, wrong, rng, { dish: p.dish });
}

// "Garance: which dish is it paired with on the tasting menu?"
function pairDish(w, all, rng) {
  if (!w.pairings || !w.pairings.length) return null;
  const p = w.pairings[Math.floor(rng() * w.pairings.length)], mine = new Set(w.pairings.map(x => x.dish));
  const wrong = shuffle([...new Set(menuPairings(all).map(x => x.p.dish))].filter(d => !mine.has(d)), rng);
  return make("pairDish", w, `${w.short}: which dish is it paired with on the tasting menu?`, p.dish, wrong, rng);
}

export const GENERATORS = { identify, pickWine, describe, reverse, price, stepUp, guestRequest, headsUp, oddOneOut, match, sayIt,
  missingGrape, typeGrape, typeRegion, typeWine, typePrice, pairWine, pairDish };
export { vocabulary };

// Builds one question about wine w. `prefer` puts some types first (a new wine starts with Identify);
// `avoid` skips the type just asked. `allowEstimates` false keeps Describe, Reverse and Heads-up to tasted wines.
export function questionFor(w, all, rng, { prefer = [], avoid = null, allowEstimates = true, recall = true, kb = {} } = {}) {
  const rest = shuffle(TYPES.filter(t => !prefer.includes(t)), rng);
  const order = [...prefer, ...rest].filter(t => t !== avoid);
  for (const t of order) {
    if (!allowEstimates && !w.tasted && (t === "describe" || t === "reverse" || t === "headsUp")) continue;
    if (!recall && TYPED.has(t)) continue;
    const q = GENERATORS[t](w, all, rng, kb);
    if (q) return q;
  }
  return null;
}

// One line comparing a wine with its first comparator, for the answer screen: "lighter than Bout d'Zan".
export function comparatorLine(w, byId) {
  const c = (w.compare || []).map(id => byId.get(id)).find(Boolean);
  if (!c) return "";
  const a = w.scores && w.scores.body, b = c.scores && c.scores.body;
  if (a != null && b != null && a !== b) return `${a < b ? "Lighter" : "Fuller"} than ${c.short}.`;
  const x = w.scores && w.scores.acidity, y = c.scores && c.scores.acidity;
  if (x != null && y != null && x !== y) return `${x > y ? "Fresher" : "Softer"} than ${c.short}.`;
  return `Compare it with ${c.short}.`;
}
