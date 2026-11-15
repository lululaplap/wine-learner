// Glossary links: wine jargon in the notes becomes a blue, Wikipedia-style link that shows a short definition
// on hover (mouse) or tap (iPad, phone). Terms and definitions come from the Wine glossary tab.
import { col } from "./csv.js";
import { esc } from "./ui.js";

const fold = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LETTER = /[\p{L}\p{N}]/u;

export function buildGlossary(rows) {
  const terms = [], forms = [];
  (rows || []).forEach(r => {
    const term = col(r, "term"), definition = col(r, "definition");
    if (!term || !definition) return;
    const t = { id: "g-" + terms.length, term, definition };
    terms.push(t);
    [term, ...String(col(r, "also matches") || "").split(";")].map(f => f.trim()).filter(Boolean)
      .forEach(f => forms.push({ key: fold(f).replace(/[\s-]+/g, " "), term: t }));
  });
  // Longest form first, so "blanc de noirs" wins over "noirs" and "no added sulfur" over "sulfur".
  forms.sort((a, b) => b.key.length - a.key.length);
  const seen = new Set();
  const unique = forms.filter(f => (seen.has(f.key) ? false : (seen.add(f.key), true)));
  return { terms, forms: unique, byId: new Map(terms.map(t => [t.id, t])) };
}

// Finds terms in plain text. Matching ignores case and accents, treats spaces and hyphens alike,
// and only takes whole words. Returns [{start, end, term}] with no overlaps, in text order.
export function findTerms(glossary, text) {
  if (!glossary || !glossary.forms.length || !text) return [];
  // Fold the text one character at a time so positions in the folded copy map back to the original.
  let folded = "";
  const map = [];
  for (let i = 0; i < text.length; i++) {
    let f = fold(text[i]);
    if (/[\s-]/.test(f)) f = " ";
    for (const ch of f) { folded += ch; map.push(i); }
  }
  map.push(text.length);
  const hits = [], taken = new Array(folded.length).fill(false);
  for (const form of glossary.forms) {
    let from = 0, at;
    while ((at = folded.indexOf(form.key, from)) !== -1) {
      const end = at + form.key.length;
      from = at + 1;
      if (at > 0 && LETTER.test(folded[at - 1])) continue;
      if (end < folded.length && LETTER.test(folded[end])) continue;
      let free = true;
      for (let k = at; k < end; k++) if (taken[k]) { free = false; break; }
      if (!free) continue;
      for (let k = at; k < end; k++) taken[k] = true;
      hits.push({ start: map[at], end: map[end], term: form.term });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

// Escapes text and links the first mention of each term. `used` is shared across one screen,
// so a term already linked higher up is left as plain text (as on Wikipedia).
export function linkTerms(glossary, text, used = new Set()) {
  const hits = findTerms(glossary, text);
  let out = "", pos = 0;
  for (const h of hits) {
    if (used.has(h.term.id)) continue;
    used.add(h.term.id);
    // Punctuation right after the term stays on its line (a button would otherwise allow a break before it).
    const punct = (text.slice(h.end).match(/^[.,;:!?)\]”’"']+/) || [""])[0];
    const btn = termButton(h.term, text.slice(h.start, h.end));
    out += esc(text.slice(pos, h.start)) + (punct ? `<span class="nb">${btn}${esc(punct)}</span>` : btn);
    pos = h.end + punct.length;
  }
  return out + esc(text.slice(pos));
}

export function termButton(term, label) {
  return `<button type="button" class="term" data-term="${term.id}" aria-expanded="false">${esc(label)}</button>`;
}

// ---------- the definition popover ----------
let pop = null, openBtn = null, hoverTimer = 0, closeTimer = 0, current = null, hoverOpenedAt = 0;

function ensurePop() {
  if (pop) return pop;
  pop = document.createElement("div");
  pop.id = "termpop";
  pop.className = "termpop";
  pop.setAttribute("role", "tooltip");
  pop.hidden = true;
  document.body.appendChild(pop);
  pop.addEventListener("pointerenter", () => clearTimeout(closeTimer));
  pop.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") scheduleClose(); });
  return pop;
}

function place(btn) {
  const r = btn.getBoundingClientRect(), p = pop.getBoundingClientRect(), gap = 8, edge = 12;
  const below = r.bottom + gap + p.height <= innerHeight - edge || r.top - gap - p.height < edge;
  const top = below ? r.bottom + gap : r.top - gap - p.height;
  const left = Math.max(edge, Math.min(r.left + r.width / 2 - p.width / 2, innerWidth - p.width - edge));
  pop.style.top = Math.round(top) + "px";
  pop.style.left = Math.round(left) + "px";
  pop.dataset.side = below ? "below" : "above";
}

export function openTerm(btn) {
  const term = current && current.byId.get(btn.dataset.term);
  if (!term) return;
  clearTimeout(closeTimer);
  if (openBtn && openBtn !== btn) closeTerm();
  ensurePop();
  pop.innerHTML = `<strong class="tp-term">${esc(term.term)}</strong><span class="tp-def">${esc(term.definition)}</span>`;
  pop.hidden = false;
  place(btn);
  openBtn = btn;
  btn.setAttribute("aria-expanded", "true");
  btn.setAttribute("aria-describedby", "termpop");
}

export function closeTerm() {
  clearTimeout(hoverTimer); clearTimeout(closeTimer);
  if (pop) pop.hidden = true;
  if (openBtn) { openBtn.setAttribute("aria-expanded", "false"); openBtn.removeAttribute("aria-describedby"); }
  openBtn = null;
}

function scheduleClose() {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(closeTerm, 200);
}

// Called once at start-up, and again whenever the glossary is reloaded.
export function useGlossary(glossary) {
  current = glossary;
  if (useGlossary.bound) return;
  useGlossary.bound = true;
  document.addEventListener("click", e => {
    const btn = e.target.closest("button.term");
    if (btn) {
      e.preventDefault(); e.stopPropagation();
      // A click just after the hover opened it (a trackpad on an iPad) keeps it open rather than closing it.
      if (openBtn === btn && Date.now() - hoverOpenedAt > 600) closeTerm(); else { clearTimeout(hoverTimer); openTerm(btn); }
      hoverOpenedAt = 0;
      return;
    }
    if (openBtn && !e.target.closest(".termpop")) closeTerm();
  }, true);
  document.addEventListener("pointerover", e => {
    if (e.pointerType !== "mouse") return;
    const btn = e.target.closest("button.term");
    if (!btn) return;
    clearTimeout(closeTimer); clearTimeout(hoverTimer);
    if (openBtn !== btn) hoverTimer = setTimeout(() => { openTerm(btn); hoverOpenedAt = Date.now(); }, 250);
  });
  document.addEventListener("pointerout", e => {
    if (e.pointerType !== "mouse") return;
    const btn = e.target.closest("button.term");
    if (!btn || btn.contains(e.relatedTarget)) return;
    clearTimeout(hoverTimer);
    if (openBtn === btn) scheduleClose();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && openBtn) { const b = openBtn; closeTerm(); b.focus(); }
  });
  addEventListener("hashchange", closeTerm);
  addEventListener("resize", () => { if (openBtn) place(openBtn); });
  // The popover is fixed to the screen: keep it beside its word when anything scrolls, and close it once the word scrolls away.
  addEventListener("scroll", () => {
    if (!openBtn) return;
    const r = openBtn.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || !openBtn.isConnected) closeTerm(); else place(openBtn);
  }, true);
}
