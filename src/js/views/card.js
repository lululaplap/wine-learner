// The wine card. Learn mode shows everything; Service mode hides the internal fields (Check, Source, Story),
// so the tablet can be turned towards a guest.
import { esc, priceLine, badges, glyph, money } from "../ui.js";
import { SCORES } from "../data.js";
import { linkTerms } from "../glossary.js";
import { isOpen, latestTasting, SCALE_WORDS, SCORE_NAMES, gridScores } from "../quiz/tasting.js";
import { loadProgress } from "../quiz/progress.js";
import { store } from "../store.js";

const SCALE = {
  sweetness: ["Dry", "Off-dry", "Medium", "Sweet", "Luscious"],
  acidity: ["Low", "Medium minus", "Medium", "Medium plus", "High"],
  tannin: ["Low", "Medium minus", "Medium", "Medium plus", "High"],
  body: ["Low", "Medium minus", "Medium", "Medium plus", "High"],
  oak: ["None", "Subtle", "Noticeable", "Pronounced", "Dominant"],
  wildness: ["Clean and classic", "Mostly classic", "Some natural character", "Clearly natural, may be cloudy or funky", "Divisive; warn the guest"]
};
const NAMES = { sweetness: "Sweetness", acidity: "Acidity", tannin: "Tannin", body: "Body", oak: "Oak", wildness: "Wildness" };

function scoresBlock(w, L) {
  if (!w.scores) return "";
  const rows = SCORES.filter(n => w.scores[n]).map(n => {
    const v = w.scores[n];
    const dots = [1, 2, 3, 4, 5].map(i => `<span class="dot${i <= v ? " on" : ""}"></span>`).join("");
    return `<div class="score"><span class="sc-name">${L(NAMES[n])}</span><span class="dots" aria-hidden="true">${dots}</span><span class="sc-word">${v} · ${esc(SCALE[n][v - 1])}</span></div>`;
  }).join("");
  return `<h3>Taste profile</h3><div class="scores">${rows}</div>`;
}

// Open to taste today: wines by the glass are open unless marked otherwise; any other bottle can be opened for the day.
function openBlock(w) {
  const open = isOpen(w);
  const label = w.glass != null ? (open ? "Open (by the glass)" : "Not open today") : (open ? "Open to taste today" : "Not open");
  const action = w.glass != null ? (open ? "Mark as not open today" : "Mark as open again") : (open ? "Mark as closed" : "Open to taste today");
  return `<p class="openline"><span class="openstate${open ? " on" : ""}">${label}</span> <button type="button" class="btn ghost small" data-open-toggle aria-pressed="${open}">${action}</button></p>`;
}

// Taste it: straight to the tasting grid for this wine, then the notes beside the learner's own.
function tasteButton(w) {
  const name = store.get("learner", "");
  const again = name && latestTasting(loadProgress(name), w.id);
  return `<p class="tasteline"><a class="btn" href="#/lesson/taste-${encodeURIComponent(w.id)}~${Date.now().toString(36)}" data-taste-it>${again ? "Taste it again" : "Taste it"}</a> <span class="muted small">Your own notes first, then see how they compare</span></p>`;
}

// The learner's own latest tasting of this wine, beside the notes (both modes: they may have just tasted it).
function yourTasting(w) {
  const name = store.get("learner", "");
  const t = name ? latestTasting(loadProgress(name), w.id) : null;
  if (!t) return "";
  const scores = gridScores(w).filter(n => t.scores[n] != null).map(n => `${SCORE_NAMES[n]} ${t.scores[n]} (${esc(SCALE_WORDS[n][t.scores[n] - 1])})`);
  const when = new Date(t.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `<h3>Your tasting, ${esc(when)}</h3><p class="yourtaste">${esc([scores.join(", "), t.flavours.length ? "Flavours: " + t.flavours.join(", ") : "", t.note].filter(Boolean).join(". "))}</p>`;
}

// Where the wine comes from, with a link to its spot on the regions map.
function whereBlock(w, ctx) {
  const r = ctx.regions && w.regionId ? ctx.regions.byId.get(w.regionId) : null;
  const parts = [w.place, r ? r.name : w.regionGroup, w.country].filter((x, i, a) => x && a.indexOf(x) === i);
  if (!parts.length) return "";
  const link = w.pin ? ` <a class="maplink" href="#/regions/w:${encodeURIComponent(w.id)}">Show on the map</a>` : "";
  return `<p class="where"><span class="where-label">From</span> ${esc(parts.join(", "))}${w.pin && !w.pin.exact ? ' <span class="approx">(region only)</span>' : ""}${link}</p>`;
}

// The tasting menu: which course and dish the wine goes with, why it works, and the script to say at the table (folded away).
// Dishes that share a script (the ox terrine and the carrot) show together.
function pairingBlock(w, L) {
  if (!w.pairings || !w.pairings.length) return "";
  const groups = [];
  w.pairings.forEach(p => { const g = groups.find(x => x.script === p.script); if (g) g.list.push(p); else groups.push({ script: p.script, list: [p] }); });
  return `<h3>On the tasting menu</h3>${groups.map(g => `<div class="pairing">
    ${g.list.map(p => `<p class="pair-dish"><strong>${esc(p.course)}</strong>${p.choose ? ' <span class="pair-choose">choose one</span>' : ""}: ${esc(p.dish)}${p.detail ? ` <span class="pair-detail">· ${esc(p.detail)}</span>` : ""}</p>${p.why ? `<p class="pair-why"><strong>Why it works:</strong> ${L(p.why)}</p>` : ""}`).join("")}
    ${g.list[0].note ? `<p class="pair-note">${esc(g.list[0].note)}</p>` : ""}
    ${g.script ? `<details class="script"><summary>Script for the table</summary><p>${L(g.script)}</p></details>` : ""}</div>`).join("")}`;
}

function sourceLine(w) {
  if (!w.hasNotes) return "This wine is on the list but has no study notes yet. Add a row for it in the study sheet.";
  if (w.tasted) return "Tasted by the team: " + esc(w.source.replace(/^tasted[,:\s]*/i, ""));
  return "Estimate: written from what this producer, grape and region normally give, not from tasting this bottle.";
}

export function renderCard(w, ctx) {
  const service = ctx.mode === "service";
  const byId = ctx.byId;
  const cmp = w.compare.map(id => byId.get(id)).filter(Boolean);
  const meta = [w.grapes || w.leadGrape, [w.regionGroup, w.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  // Jargon becomes a glossary link; only its first mention on the card is linked, top to bottom.
  const used = new Set(), L = text => linkTerms(ctx.glossary, text, used);
  const tagRow = (label, list) => list.length ? `<p class="tags"><span class="tag-label">${label}</span> ${list.map(t => `<span class="tag">${L(t)}</span>`).join(" ")}</p>` : "";
  return `<article class="card" aria-labelledby="card-title">
    <p class="back"><button type="button" class="btn ghost" data-back>← Back</button></p>
    <div class="badges">${badges(w, { service })}</div>
    <h2 id="card-title">${esc(w.name)}${w.vintage ? ` <span class="vintage">${esc(w.vintage)}</span>` : ""}</h2>
    ${w.pronunciation ? `<p class="say">Say it: <strong>${esc(w.pronunciation)}</strong></p>` : ""}
    <p class="meta">${esc(meta)}</p>
    <p class="prices">${priceLine(w)}</p>
    ${whereBlock(w, ctx)}
    ${openBlock(w)}
    ${tasteButton(w)}
    ${w.guestLine ? `<h3>To the guest</h3><p class="guestline">“${L(w.guestLine)}”</p>` : ""}
    ${pairingBlock(w, L)}
    ${scoresBlock(w, L)}
    ${w.note ? `<h3>Style</h3><p class="note">${L(w.note)}</p>` : ""}
    ${tagRow("Flavours", w.flavours)}${tagRow("Making", w.making)}${tagRow("If they like", w.ifYouLike)}
    ${w.serve ? `<h3>Serve</h3><p>${L(w.serve)}</p>` : ""}
    ${!service && w.story ? `<h3>Story</h3><p>${L(w.story)}</p>` : ""}
    ${yourTasting(w)}
    ${cmp.length ? `<h3>Compare with</h3><div class="cmp">${cmp.map(c => `<a class="cmpbtn" href="#/wine/${encodeURIComponent(c.id)}">${glyph(c.type, 20)}<span><span class="nm">${esc(c.short)}</span><span class="ds">${esc([c.leadGrape, c.regionGroup, c.bottle != null ? money(c.bottle) : money(c.glass) + " glass"].filter(Boolean).join(" · "))}</span></span></a>`).join("")}</div>` : ""}
    ${!service && w.check ? `<h3>Check with the supplier</h3><p class="checkq">${L(w.check)}</p>` : ""}
    ${!service ? `<p class="source">${sourceLine(w)}</p>` : (!w.tasted && w.hasNotes ? '<p class="source">Estimated notes, not yet tasted by the team.</p>' : "")}
    <p class="listline">On the list as: ${esc(w.producer)}, ${esc(w.cuvee)} · ${esc(w.section)}</p>
  </article>`;
}
