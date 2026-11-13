// Data check: what needs fixing in the sheets, in plain words, for whoever looks after them.
import { esc, wineRow, timeOf } from "../ui.js";

export function renderCheck(ctx) {
  const { report, wines } = ctx.data;
  const sources = ctx.sources;
  const block = (title, intro, body, count) => `<section class="checksec"><h2>${esc(title)} <span class="n">${count}</span></h2><p class="intro">${intro}</p>${count ? body : '<p class="ok">None.</p>'}</section>`;
  const tasted = wines.filter(w => w.tasted).length;
  return `<div class="checkview">
    <h1 class="viewtitle">Data check</h1>
    <p class="summary">${wines.length} wines on the list. ${wines.length - report.needsNotes.length} have study notes; ${tasted} of those are tasted by the team.</p>
    <ul class="sources">${sources.map(s => `<li><strong>${esc(s.label)}</strong>: ${s.fresh ? "loaded " + timeOf(s.at) : `<span class="stale">could not load (${esc(s.error)}); showing ${s.bundled ? "the copy built into the tool" : "the copy saved " + timeOf(s.at)}</span>`}${s.local ? " · local copy in sheets/" : ""}</li>`).join("")}</ul>
    ${block("On the list, no study notes", "These wines show with a “Needs notes” badge. Add a row for each in the study sheet, with its Key exactly as shown.",
      `<div class="rows">${report.needsNotes.map(w => `<div class="checkrow">${wineRow(w, { full: true })}<code class="key">${esc(w.key)}</code></div>`).join("")}</div>`, report.needsNotes.length)}
    ${block("Study rows that match no wine", "The wine may have left the list, or its name changed in the wine sheet. Fix the Key, or add the new spelling to Also matches.",
      `<ul class="plain">${report.unmatchedStudy.map(s => `<li><code>${esc(s.key)}</code>${s.name ? " · " + esc(s.name) : ""}</li>`).join("")}</ul>`, report.unmatchedStudy.length)}
    ${block("Compare links that point nowhere", "A Compare cell names a key that is not on the list.",
      `<ul class="plain">${report.brokenCompare.map(b => `<li>${esc(ctx.byId.get(b.wine).name)} → <code>${esc(b.key)}</code></li>`).join("")}</ul>`, report.brokenCompare.length)}
    ${block("Spellings used by two study rows", "Each spelling in Key or Also matches can belong to one study row only.",
      `<ul class="plain">${report.clashes.map(c => `<li><code>${esc(c.key)}</code>: ${esc(c.a)} and ${esc(c.b)}</li>`).join("")}</ul>`, report.clashes.length)}
    ${block("More than one row in the wine sheet", "Two bottle rows (or two glass rows) match the same wine. The tool uses the first.",
      `<div class="rows">${report.duplicates.map(w => wineRow(w, { full: true })).join("")}</div>`, report.duplicates.length)}
    ${block("Flagged “check with supplier”", "Questions to settle with the supplier, then clear the Check cell.",
      `<ul class="plain checks">${report.checks.map(w => `<li><a class="winelink" href="#/wine/${encodeURIComponent(w.id)}">${esc(w.name)}</a>: ${esc(w.check)}</li>`).join("")}</ul>`, report.checks.length)}
  </div>`;
}
