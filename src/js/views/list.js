// The whole list in the order the wine sheet gives it: by the glass first, then bottles by style.
// Type chips narrow it with one tap; no typing needed.
import { esc, wineRow, glyph, typeLabel } from "../ui.js";

const TYPES = ["sparkling", "white", "rose", "orange", "red", "sweet"];

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
  return `<div class="listview">
    <div class="chips" role="group" aria-label="Show only">${chips}</div>
    ${glass.length ? section("By the glass", glass, "sec-glass") : ""}
    ${groups.map((g, i) => section(g.name, g.wines, "sec-" + i)).join("")}
  </div>`;
}

export function toggleType(state, button) {
  if (button.dataset.clear != null) state.types.clear();
  else state.types.has(button.dataset.type) ? state.types.delete(button.dataset.type) : state.types.add(button.dataset.type);
}
