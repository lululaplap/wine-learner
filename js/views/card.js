// The wine card. Learn mode shows everything; Service mode hides the internal fields (Check, Source, Story),
// so the tablet can be turned towards a guest.
import { esc, priceLine, badges, glyph, money } from "../ui.js";
import { SCORES } from "../data.js";

const SCALE = {
  sweetness: ["Dry", "Off-dry", "Medium", "Sweet", "Luscious"],
  acidity: ["Low", "Medium minus", "Medium", "Medium plus", "High"],
  tannin: ["Low", "Medium minus", "Medium", "Medium plus", "High"],
  body: ["Low", "Medium minus", "Medium", "Medium plus", "High"],
  oak: ["None", "Subtle", "Noticeable", "Pronounced", "Dominant"],
  wildness: ["Clean and classic", "Mostly classic", "Some natural character", "Clearly natural, may be cloudy or funky", "Divisive; warn the guest"]
};
const NAMES = { sweetness: "Sweetness", acidity: "Acidity", tannin: "Tannin", body: "Body", oak: "Oak", wildness: "Wildness" };

function scoresBlock(w) {
  if (!w.scores) return "";
  const rows = SCORES.filter(n => w.scores[n]).map(n => {
    const v = w.scores[n];
    const dots = [1, 2, 3, 4, 5].map(i => `<span class="dot${i <= v ? " on" : ""}"></span>`).join("");
    return `<div class="score"><span class="sc-name">${NAMES[n]}</span><span class="dots" aria-hidden="true">${dots}</span><span class="sc-word">${v} · ${esc(SCALE[n][v - 1])}</span></div>`;
  }).join("");
  return `<h3>Taste profile</h3><div class="scores">${rows}</div>`;
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
  const tagRow = (label, list) => list.length ? `<p class="tags"><span class="tag-label">${label}</span> ${list.map(t => `<span class="tag">${esc(t)}</span>`).join(" ")}</p>` : "";
  return `<article class="card" aria-labelledby="card-title">
    <p class="back"><button type="button" class="btn ghost" data-back>← Back</button></p>
    <div class="badges">${badges(w, { service })}</div>
    <h2 id="card-title">${esc(w.name)}${w.vintage ? ` <span class="vintage">${esc(w.vintage)}</span>` : ""}</h2>
    ${w.pronunciation ? `<p class="say">Say it: <strong>${esc(w.pronunciation)}</strong></p>` : ""}
    <p class="meta">${esc(meta)}</p>
    <p class="prices">${priceLine(w)}</p>
    ${w.guestLine ? `<h3>To the guest</h3><p class="guestline">“${esc(w.guestLine)}”</p>` : ""}
    ${scoresBlock(w)}
    ${w.note ? `<h3>Style</h3><p class="note">${esc(w.note)}</p>` : ""}
    ${tagRow("Flavours", w.flavours)}${tagRow("Making", w.making)}${tagRow("If they like", w.ifYouLike)}
    ${w.serve ? `<h3>Serve</h3><p>${esc(w.serve)}</p>` : ""}
    ${!service && w.story ? `<h3>Story</h3><p>${esc(w.story)}</p>` : ""}
    ${cmp.length ? `<h3>Compare with</h3><div class="cmp">${cmp.map(c => `<a class="cmpbtn" href="#/wine/${encodeURIComponent(c.id)}">${glyph(c.type, 20)}<span><span class="nm">${esc(c.short)}</span><span class="ds">${esc([c.leadGrape, c.regionGroup, c.bottle != null ? money(c.bottle) : money(c.glass) + " glass"].filter(Boolean).join(" · "))}</span></span></a>`).join("")}</div>` : ""}
    ${!service && w.check ? `<h3>Check with the supplier</h3><p class="checkq">${esc(w.check)}</p>` : ""}
    ${!service ? `<p class="source">${sourceLine(w)}</p>` : (!w.tasted && w.hasNotes ? '<p class="source">Estimated notes, not yet tasted by the team.</p>' : "")}
    <p class="listline">On the list as: ${esc(w.producer)}, ${esc(w.cuvee)} · ${esc(w.section)}</p>
  </article>`;
}
