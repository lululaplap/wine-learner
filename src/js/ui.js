// Small pieces of markup shared by every screen.
import { TYPE_LABELS } from "./data.js";

export const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Wine type is shown by shape as well as colour: diamond sparkling, circle still, ring rosé, square orange, triangle sweet.
export function glyph(type, size = 18) {
  const h = size / 2, r = size * 0.36;
  const col = { sparkling: "var(--t-sparkling)", sweet: "var(--t-sweet)", red: "var(--t-red)", rose: "var(--t-red)", white: "var(--t-white)", orange: "var(--t-white)" }[type];
  let shape;
  if (type === "sparkling") shape = `<path d="M0 ${-r * 1.25}L${r * 1.05} 0L0 ${r * 1.25}L${-r * 1.05} 0Z" fill="${col}"/>`;
  else if (type === "orange") shape = `<rect x="${-r * 0.9}" y="${-r * 0.9}" width="${r * 1.8}" height="${r * 1.8}" fill="${col}"/>`;
  else if (type === "sweet") shape = `<path d="M0 ${-r * 1.15}L${r * 1.15} ${r * 0.85}L${-r * 1.15} ${r * 0.85}Z" fill="${col}"/>`;
  else if (type === "rose") shape = `<circle r="${r * 0.8}" fill="var(--surface)" stroke="${col}" stroke-width="${Math.max(2, size * 0.13)}"/>`;
  else shape = `<circle r="${r}" fill="${col}"/>`;
  return `<svg class="glyph" width="${size}" height="${size}" viewBox="${-h} ${-h} ${size} ${size}" aria-hidden="true">${shape}</svg>`;
}

export const typeLabel = t => TYPE_LABELS[t] || t;

export function money(n) {
  return n == null ? "" : "£" + (Number.isInteger(n) ? n : n.toFixed(2));
}

export function priceLine(w) {
  const parts = [];
  if (w.bottle != null) parts.push(`${money(w.bottle)} <span class="unit">bottle</span>`);
  if (w.glass != null) parts.push(`${money(w.glass)} <span class="unit">${w.glassSize ? esc(w.glassSize) + " glass" : "glass"}</span>`);
  return parts.join('<span class="sep" aria-hidden="true"> · </span>');
}

// Every wine name anywhere in the tool opens its wine card.
export function wineLink(w, text) {
  return `<a class="winelink" href="#/wine/${encodeURIComponent(w.id)}">${esc(text || w.name)}</a>`;
}

// A row used in lists: tap anywhere on it to open the card.
export function wineRow(w, opts = {}) {
  const prices = [w.glass != null ? money(w.glass) + " glass" : "", w.bottle != null ? money(w.bottle) : ""].filter(Boolean).join(" · ");
  return `<a class="winerow" href="#/wine/${encodeURIComponent(w.id)}">${glyph(w.type, 20)}<span class="wr-main"><span class="wr-name">${esc(opts.full ? w.name : w.short)}</span>`
    + `<span class="wr-sub">${esc([w.leadGrape, w.regionGroup].filter(Boolean).join(" · "))}</span></span>`
    + `<span class="wr-price">${prices}</span>${badges(w, { compact: true })}</a>`;
}

// The notes badge. Staff must tell at a glance what has been verified by tasting.
export function notesBadge(w) {
  if (!w.hasNotes) return '<span class="badge needs">Needs notes</span>';
  if (w.tasted) return '<span class="badge tasted">Tasted</span>';
  return '<span class="badge estimate">Estimate</span>';
}

export function badges(w, { compact = false, service = false } = {}) {
  if (compact) return `<span class="wr-badges">${notesBadge(w)}</span>`;
  return [
    `<span class="badge plain">${glyph(w.type, 16)}${esc(w.section || typeLabel(w.type))}</span>`,
    notesBadge(w),
    w.glass != null ? '<span class="badge plain">By the glass</span>' : "",
    w.unique ? '<span class="badge plain">♢ Unique expression</span>' : "",
    w.anchor && !service ? '<span class="badge plain">Anchor</span>' : "",
    w.check && !service ? '<span class="badge warn">Check with supplier</span>' : ""
  ].join("");
}

export function timeOf(ms) {
  const d = new Date(ms), today = new Date();
  const t = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === today.toDateString() ? t : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " + t;
}
