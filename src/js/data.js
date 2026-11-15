// Joins the wine sheet (what is on the list, prices, vintages) with the study sheet (everything the tool adds).
// The wine sheet is the source of truth for what exists: every row in it becomes a wine, with or without notes.
import { col } from "./csv.js";
import { wineKey, keyList, slug, normalise } from "./key.js";

export const SCORES = ["sweetness", "acidity", "tannin", "body", "oak", "wildness"];
export const TYPE_LABELS = { sparkling: "Sparkling", white: "White", rose: "Rosé", orange: "Orange", red: "Red", sweet: "Sweet" };

const COUNTRIES = { FR: "France", IT: "Italy", ESP: "Spain", ES: "Spain", ENG: "England", UK: "England", GER: "Germany", DE: "Germany",
  AUT: "Austria", AT: "Austria", PT: "Portugal", GR: "Greece", GRE: "Greece", SK: "Slovakia", CZ: "Czechia", HUN: "Hungary",
  SUI: "Switzerland", CH: "Switzerland", NZ: "New Zealand", US: "USA", USA: "USA", AUS: "Australia", SA: "South Africa" };

// The wine's type comes from the sheet's subsection, so a new subsection still lands in the right colour and shape.
export function typeOf(subsection) {
  const s = normalise(subsection);
  if (/\b(sweet|afters|dessert|fortified)\b/.test(s)) return "sweet";
  if (/\b(champagne|sparkling|fizz|petnat)\b/.test(s)) return "sparkling";
  if (/\b(orange|skin)\b/.test(s)) return "orange";
  if (/\brose\b/.test(s)) return "rose";
  if (/\bred\b/.test(s)) return "red";
  return "white";
}

export function price(s) {
  const n = parseFloat(String(s || "").replace(/[^0-9.]/g, ""));
  return isFinite(n) ? n : null;
}

const isGlassRow = r => /glass/i.test(col(r, "section"));

// Study rows indexed by their Key and every Also matches spelling.
function indexStudy(studyRows) {
  const idx = new Map(), clashes = [];
  studyRows.forEach(s => {
    const own = keyList(col(s, "key"))[0];
    if (!own) return;
    s._key = own;
    [own, ...keyList(col(s, "also matches"))].forEach(k => {
      if (idx.has(k) && idx.get(k) !== s) clashes.push({ key: k, a: idx.get(k)._key, b: own });
      else idx.set(k, s);
    });
  });
  return { idx, clashes };
}

function tasteScores(s) {
  const out = {};
  let any = false;
  SCORES.forEach(n => {
    const v = parseInt(col(s, n), 10);
    if (v >= 1 && v <= 5) { out[n] = v; any = true; }
  });
  return any ? out : null;
}

const coord = (v, max) => { const n = parseFloat(String(v || "").replace(",", ".")); return isFinite(n) && Math.abs(n) <= max ? n : null; };

const tags = cell => String(cell || "").split(/[;,\n]/).map(t => t.trim()).filter(Boolean);

export function buildWines(wineRows, studyRows) {
  const { idx, clashes } = indexStudy(studyRows || []);
  const groups = new Map(); // group key -> { study, bottle: [rows], glass: [rows] }
  const order = [];
  wineRows.forEach(r => {
    const k = wineKey(col(r, "producer"), col(r, "cuvée") || col(r, "cuvee"));
    if (!k) return;
    const s = idx.get(k);
    const g = s ? s._key : k;
    if (!groups.has(g)) { groups.set(g, { key: g, study: s || null, bottle: [], glass: [], sheetKeys: new Set() }); order.push(g); }
    const grp = groups.get(g);
    grp.sheetKeys.add(k);
    (isGlassRow(r) ? grp.glass : grp.bottle).push(r);
  });

  // Styles in the order the bottles appear in the wine sheet, then any style only sold by the glass.
  const sections = [];
  const addSection = r => { const sub = col(r, "subsection"); if (sub && !sections.includes(sub)) sections.push(sub); };
  wineRows.filter(r => !isGlassRow(r)).forEach(addSection);
  const wines = order.map(g => {
    const grp = groups.get(g), s = grp.study;
    const main = grp.bottle[0] || grp.glass[0];
    const glassRow = grp.glass[0];
    const subsection = col(main, "subsection");
    if (!grp.bottle.length) addSection(main);
    // A By the Glass row keeps the glass price in its Bottle Price column; a bottle row with a Glass Price is sold by the glass too.
    let glass = null, glassSize = "";
    if (glassRow) { glass = price(col(glassRow, "glass price")) ?? price(col(glassRow, "bottle price")); glassSize = col(glassRow, "glass size"); }
    else if (grp.bottle[0] && price(col(grp.bottle[0], "glass price")) != null) { glass = price(col(grp.bottle[0], "glass price")); glassSize = col(grp.bottle[0], "glass size"); }
    const bottle = grp.bottle[0] ? price(col(grp.bottle[0], "bottle price")) : null;
    const producer = col(main, "producer"), cuvee = col(main, "cuvée") || col(main, "cuvee");
    const regionRaw = col(main, "region");
    const [regionPart, code] = regionRaw.split(",").map(x => x.trim());
    const grapes = col(main, "grape varieties");
    const sv = n => (s ? col(s, n) : "");
    const source = sv("source");
    return {
      id: slug(g),
      key: g,
      sheetKeys: [...grp.sheetKeys],
      producer, cuvee,
      name: sv("display name") || producer + ", " + cuvee,
      short: sv("short name") || cuvee || producer,
      vintage: col(main, "vintage"),
      grapes,
      region: regionRaw,
      regionGroup: sv("region group") || regionPart || "",
      country: sv("country") || COUNTRIES[(code || "").toUpperCase()] || code || "",
      place: sv("place"),
      lat: coord(sv("latitude"), 90),
      lon: coord(sv("longitude"), 180),
      leadGrape: sv("lead grape") || (grapes.split(/[,&+]/)[0] || "").trim(),
      family: sv("grape family") || sv("lead grape") || (grapes.split(/[,&+]/)[0] || "").trim(),
      section: subsection,
      type: typeOf(subsection || col(main, "section")),
      bottle, glass, glassSize,
      unique: /^(yes|y|true|♢)$/i.test(col(main, "unique expression")),
      hasNotes: !!s,
      pronunciation: sv("pronunciation"),
      scores: s ? tasteScores(s) : null,
      flavours: tags(sv("flavours")),
      making: tags(sv("making")),
      note: sv("style note"),
      guestLine: sv("guest line"),
      ifYouLike: tags(sv("if you like")),
      compareKeys: s ? keyList(col(s, "compare")) : [],
      anchor: /^(yes|y|true)$/i.test(sv("anchor")),
      serve: sv("serve"),
      story: sv("story"),
      pairsWith: tags(sv("pairs with")),
      source,
      tasted: /^tasted/i.test(source),
      check: sv("check"),
      duplicateRows: grp.bottle.length > 1 || grp.glass.length > 1
    };
  });

  // Compare links point at study keys or sheet spellings; resolve both to wines.
  const byKey = new Map();
  wines.forEach(w => w.sheetKeys.concat(w.key).forEach(k => byKey.set(k, w)));
  const brokenCompare = [];
  wines.forEach(w => {
    w.compare = [];
    w.compareKeys.forEach(k => {
      const t = byKey.get(k) || (idx.get(k) && byKey.get(idx.get(k)._key));
      if (t && t !== w) { if (!w.compare.includes(t.id)) w.compare.push(t.id); }
      else if (!t) brokenCompare.push({ wine: w.id, key: k });
    });
  });
  const seen = new Set(), links = [];
  wines.forEach(w => w.compare.forEach(id => {
    const pair = [w.id, id].sort().join("|");
    if (!seen.has(pair)) { seen.add(pair); links.push([w.id, id]); }
  }));

  const matched = new Set(wines.filter(w => w.hasNotes).map(w => w.key));
  const unmatchedStudy = (studyRows || []).filter(s => s._key && !matched.has(s._key))
    .map(s => ({ key: s._key, name: col(s, "display name") }));

  return {
    wines, links, sections,
    report: {
      needsNotes: wines.filter(w => !w.hasNotes),
      unmatchedStudy,
      checks: wines.filter(w => w.check),
      duplicates: wines.filter(w => w.duplicateRows),
      brokenCompare,
      clashes
    }
  };
}

// ---------- wine regions ----------
// The Wine regions tab: the major regions of the world, with or without wines of ours. Each wine joins a region
// through its Region group (or, for a wine with no notes, the region named in the wine sheet).
export function buildRegions(regionRows, wines) {
  const regions = [], index = new Map();
  (regionRows || []).forEach(r => {
    const name = col(r, "region"), lat = coord(col(r, "latitude"), 90), lon = coord(col(r, "longitude"), 180);
    if (!name || lat == null || lon == null) return;
    const reg = { id: "r-" + slugify(name), name, country: col(r, "country"), lat, lon,
      knownFor: col(r, "known for"), grapes: col(r, "grapes"), wines: [] };
    regions.push(reg);
    [name, ...String(col(r, "also matches") || "").split(";")].map(normalise).filter(Boolean)
      .forEach(k => { if (!index.has(k)) index.set(k, reg); });
  });
  const unplaced = [];
  wines.forEach(w => {
    const sheetRegion = (w.region || "").split(",")[0];
    const reg = index.get(normalise(w.regionGroup)) || index.get(normalise(sheetRegion)) || null;
    w.regionId = reg ? reg.id : null;
    if (reg) reg.wines.push(w);
    if (w.lat != null && w.lon != null) w.pin = { lat: w.lat, lon: w.lon, exact: true };
    else if (reg) w.pin = { lat: reg.lat, lon: reg.lon, exact: false };
    else { w.pin = null; unplaced.push(w); }
  });
  return { regions, byId: new Map(regions.map(r => [r.id, r])), unplaced };
}

const slugify = s => normalise(s).replace(/ /g, "-");
