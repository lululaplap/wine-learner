// The whole list in the order the wine sheet gives it: by the glass first, then bottles by style.
// Type chips narrow it with one tap; no typing needed.
import { esc, wineRow, glyph, typeLabel } from "../ui.js";
import { searchIndex, search, didYouMean } from "../search.js";

const TYPES = ["sparkling", "white", "rose", "orange", "red", "sweet"];

// The search box at the top: the shared wine search, kept per load of the data.
let finder = null;
const finderFor = ctx => (finder && finder.data === ctx.data && finder.n === ctx.data.wines.length && finder.pairings === ctx.pairings ? finder.idx : (finder = { data: ctx.data, n: ctx.data.wines.length, pairings: ctx.pairings, idx: searchIndex(ctx.data.wines, ctx.regions) }).idx);
export function listMatches(ctx, state) {
  const on = state.types || new Set();
  return search(finderFor(ctx), state.q || "", { limit: 0, filter: w => !on.size || on.has(w.type) });
}
export function matchesHTML(ctx, state) {
  const found = listMatches(ctx, state);
  if (!found.length) {
    const dym = didYouMean(finderFor(ctx), state.q || "");
    return `<p class="intro">No wine matches “${esc(state.q)}”.${dym ? ` <button type="button" class="linkbtn" data-dym="${esc(dym)}">Did you mean “${esc(dym)}”?</button>` : " Try a grape, a region or a style a guest mentions."}</p>`;
  }
  return `<section class="listsec" aria-labelledby="sec-found"><h2 id="sec-found">Matches <span class="n">${found.length}</span></h2><div class="rows">${found.map(x => `<div class="found">${wineRow(x.wine)}${x.why ? `<p class="why">${esc(x.why)}</p>` : ""}</div>`).join("")}</div></section>`;
}

export function renderList(ctx, state) {
  const { wines, sections } = ctx.data;
  const on = state.types || new Set();
  const keep = w => !on.size || on.has(w.type);
  const glass = wines.filter(w => w.glass != null && keep(w)).sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || a.glass - b.glass);
  const groups = sections.map(s => ({ name: s, wines: wines.filter(w => w.section === s && w.bottle != null && keep(w)).sort((a, b) => a.bottle - b.bottle) }))
    .filter(g => g.wines.length);
  const chips = TYPES.filter(t => wines.some(w => w.type === t)).map(t =>
    `<button type="button" class="chip" data-type="${t}" aria-pressed="${on.has(t)}">${glyph(t, 16)}${typeLabel(t)}</button>`).join("")
    + (on.size ? '<button type="button" class="chip clear" data-clear>Clear</button>' : "");
  const section = (title, list, id) => `<section class="listsec" aria-labelledby="${id}"><h2 id="${id}">${esc(title)} <span class="n">${list.length}</span></h2><div class="rows">${list.map(w => wineRow(w)).join("")}</div></section>`;
  const q = (state.q || "").trim();
  return `<div class="listview">
    <div class="listsearch" role="search"><input id="listq" type="search" value="${esc(state.q || "")}" placeholder="Find a wine, grape, region or style" autocomplete="off" aria-label="Find a wine, grape, region or style" aria-controls="listbody"></div>
    <div class="chips" role="group" aria-label="Show only">${chips}</div>
    <div id="listbody" aria-live="polite">${q ? matchesHTML(ctx, state) : `${glass.length ? section("By the glass", glass, "sec-glass") : ""}
    ${groups.map((g, i) => section(g.name, g.wines, "sec-" + i)).join("")}`}</div>
  </div>`;
}

export function toggleType(state, button) {
  if (button.dataset.clear != null) state.types.clear();
  else state.types.has(button.dataset.type) ? state.types.delete(button.dataset.type) : state.types.add(button.dataset.type);
}
