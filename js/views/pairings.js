// The tasting menu, course by course: each dish, the wine that goes with it and the script to say at the table.
// One screen to look at before service, and to check during it. A dish served with either of two wines (the
// cheese: the Maury or the Banyuls, whichever is on) lists both. The app adds stock to each wine through
// globalThis.studyHooks.pairingExtra (off tonight, glasses left), when it has stock to add.
import { esc, wineRow } from "../ui.js";
import { linkTerms } from "../glossary.js";

export function renderPairings(ctx) {
  const P = ctx.pairings;
  if (!P || !P.courses.length) return `<div class="pairingsview"><h1 class="viewtitle">Tasting menu pairings</h1><p class="intro">No pairings yet. They come from the Wine pairings tab.</p></div>`;
  const used = new Set(), L = t => linkTerms(ctx.glossary, t, used), extra = (globalThis.studyHooks || {}).pairingExtra;
  const dish = d => {
    // Pairings that share a script (the Maury with the cheese and the mousse) show their script once per wine.
    const wines = d.pairings.map(p => `<div class="pp-wine">${p.wine ? wineRow(p.wine) : `<p class="pp-missing">Not on the list: <code>${esc(p.key)}</code></p>`}
      ${p.wine && extra ? extra(p.wine) : ""}
      ${p.why ? `<p class="pair-why"><strong>Why it works:</strong> ${L(p.why)}</p>` : ""}
      ${p.script ? `<details class="script"><summary>Script for the table</summary><p>${L(p.script)}</p></details>` : ""}</div>`).join(d.pairings.length > 1 ? '<p class="pp-or">or</p>' : "");
    const note = d.pairings.map(p => p.note).find(Boolean);
    return `<li class="pp-dish"><h3 class="pp-name">${esc(d.dish)}${d.detail ? ` <span class="pp-detail">${esc(d.detail)}</span>` : ""}</h3>${note ? `<p class="pp-note">${esc(note)}</p>` : ""}${wines}</li>`;
  };
  return `<div class="pairingsview">
    <h1 class="viewtitle">Tasting menu pairings</h1>
    <p class="intro">Course by course: each dish, its wine, and what to say at the table. Tap a wine for its card.</p>
    <nav class="pp-jump" aria-label="Courses">${P.courses.map((c, i) => `<button type="button" class="chip" data-pp-jump="pp-${i}">${esc(c.course)}</button>`).join("")}</nav>
    ${P.courses.map((c, i) => `<section class="pp-course" id="pp-${i}" aria-labelledby="pp-h-${i}">
      <h2 id="pp-h-${i}">${esc(c.course)}${c.choose ? ' <span class="pair-choose">choose one</span>' : ""}</h2>
      <ul class="pp-dishes">${c.dishes.map(dish).join("")}</ul></section>`).join("")}
  </div>`;
}

// The course buttons scroll to their course. They are buttons, not #links, because the address's # is the screen.
if (typeof document !== "undefined") document.addEventListener("click", e => {
  const b = e.target.closest("[data-pp-jump]");
  if (!b) return;
  const el = document.getElementById(b.dataset.ppJump);
  if (el) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
});
