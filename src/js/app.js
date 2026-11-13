// Starts the tool: loads both sheets, joins them, and shows the screen named in the address (#/map, #/list, #/check, #/wine/<id>).
import { SHEETS, localCopy } from "./config.js";
import { loadSheet } from "./load.js";
import { toRows } from "./csv.js";
import { buildWines } from "./data.js";
import { store } from "./store.js";
import { esc, timeOf } from "./ui.js";
import { renderCard } from "./views/card.js";
import { renderList, toggleType } from "./views/list.js";
import { renderCheck } from "./views/check.js";
import { renderMapShell, mountMap } from "./views/map.js";
import { buildGlossary, useGlossary } from "./glossary.js";

const MODES = {
  learn: { label: "Learn", home: "map", theme: "auto" },
  service: { label: "Service", home: "list", theme: "dark" }
};
const VIEWS = { map: "Map", list: "Wine list", check: "Data check" };
const REFRESH_AFTER = 5 * 60 * 1000; // re-read the sheets when the tool comes back after five minutes

const main = document.getElementById("main");
const ctx = { mode: store.get("mode", null), data: null, byId: new Map(), sources: [] };
const listState = { types: new Set() };
let unmount = () => {};
let lastScroll = new Map();

// ---------- theme ----------
function applyTheme() {
  const chosen = store.get("theme:" + ctx.mode, null) || (ctx.mode ? MODES[ctx.mode].theme : "auto");
  if (chosen === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", chosen);
  const dark = chosen === "dark" || (chosen === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const btn = document.getElementById("themeBtn");
  btn.textContent = dark ? "Light" : "Dark";
  btn.setAttribute("aria-label", dark ? "Switch to the light theme" : "Switch to the dark theme");
}
document.getElementById("themeBtn").addEventListener("click", () => {
  const dark = document.documentElement.getAttribute("data-theme") === "dark" ||
    (!document.documentElement.hasAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
  store.set("theme:" + ctx.mode, dark ? "light" : "dark");
  applyTheme();
});

// ---------- mode ----------
function setMode(mode, goHome) {
  ctx.mode = mode;
  store.set("mode", mode);
  document.body.dataset.mode = mode;
  document.querySelectorAll("#modeSwitch button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  applyTheme();
  if (goHome) go("#/" + (store.get("view:" + mode, null) || MODES[mode].home));
  else route();
}
document.getElementById("modeSwitch").addEventListener("click", e => {
  const b = e.target.closest("button[data-mode]");
  if (b) setMode(b.dataset.mode, true);
});

function go(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

// ---------- loading ----------
async function load() {
  const names = [["wine", "Wine sheet"], ["study", "Study sheet"], ["glossary", "Glossary"]];
  const local = new URLSearchParams(location.search).has("local");
  const url = n => (local ? localCopy(n) : SHEETS[n]);
  const results = await Promise.allSettled(names.map(([n]) => loadSheet(n, url(n), localCopy(n))));
  const failed = results.find(r => r.status === "rejected");
  if (results[0].status === "rejected") throw results[0].reason;
  ctx.sources = results.map((r, i) => r.status === "fulfilled"
    ? Object.assign({ label: names[i][1], local: !/^https?:/.test(url(names[i][0])) }, r.value)
    : { label: names[i][1], fresh: false, at: Date.now(), error: String(r.reason.message || r.reason), missing: true });
  const wineRows = toRows(results[0].value.text);
  const studyRows = results[1].status === "fulfilled" ? toRows(results[1].value.text) : [];
  ctx.glossary = buildGlossary(results[2].status === "fulfilled" ? toRows(results[2].value.text) : []);
  useGlossary(ctx.glossary);
  ctx.data = buildWines(wineRows, studyRows);
  ctx.byId = new Map(ctx.data.wines.map(w => [w.id, w]));
  ctx.loadedAt = Date.now();
  renderStatus(failed);
}

function renderStatus() {
  const el = document.getElementById("status");
  const wine = ctx.sources[0];
  const stale = ctx.sources.filter(s => !s.fresh);
  const asOf = wine.bundled ? "built-in copy" : timeOf(wine.at);
  el.innerHTML = `<button type="button" class="asof" id="reloadBtn" aria-label="List as of ${asOf}. Reload the sheets"><span class="asof-label">List as of</span> ${asOf} <span aria-hidden="true">↻</span></button>`
    + (stale.length ? `<span class="stale" role="status">${stale.map(s => s.missing
        ? esc(s.label) + " could not load: notes are missing"
        : esc(s.label) + " may be out of date (" + (s.bundled ? "the copy built into the tool" : "saved " + timeOf(s.at)) + ")").join("; ")}</span>` : "");
  document.getElementById("reloadBtn").addEventListener("click", () => refreshData());
}

async function refreshData() {
  try { await load(); route(); } catch (err) { showError(err); }
}

function showError(err) {
  main.innerHTML = `<div class="errorbox" role="alert"><h1>The wine list could not load</h1><p>${esc(err.message || err)}</p><p>Check the connection and try again.</p><p><button type="button" class="btn" id="retry">Try again</button></p></div>`;
  document.getElementById("retry").addEventListener("click", start);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && ctx.data && Date.now() - ctx.loadedAt > REFRESH_AFTER) refreshData();
});

// ---------- routing ----------
function navLinks(current) {
  document.getElementById("nav").innerHTML = Object.entries(VIEWS).map(([id, label]) =>
    `<a href="#/${id}"${current === id ? ' aria-current="page"' : ""}>${label}</a>`).join("");
}

function chooseMode() {
  unmount(); unmount = () => {};
  document.body.dataset.mode = "";
  navLinks(null);
  main.innerHTML = `<div class="choose"><h1>How are you using it?</h1>
    <div class="choices">
      <button type="button" class="choice" data-pick="learn"><span class="c-title">Learn</span><span class="c-sub">Study the list: the map, the wine cards, the notes. For your phone, away from the floor.</span></button>
      <button type="button" class="choice" data-pick="service"><span class="c-title">Service</span><span class="c-sub">Find a wine for a guest fast. Dark screen for the dining room.</span></button>
    </div><p class="intro">You can switch at any time from the top of the screen.</p></div>`;
  main.querySelectorAll("[data-pick]").forEach(b => b.addEventListener("click", () => setMode(b.dataset.pick, true)));
}

function route() {
  if (!ctx.data) return;
  if (!ctx.mode) return chooseMode();
  const [, view, arg] = (location.hash.match(/^#\/([a-z]+)(?:\/(.+))?/) || []);
  const prev = main.dataset.view;
  if (prev && prev !== "wine") lastScroll.set(prev, window.scrollY);
  unmount(); unmount = () => {};
  document.body.classList.toggle("fullmap", view === "map");

  if (view === "wine") {
    const w = ctx.byId.get(decodeURIComponent(arg || ""));
    navLinks(null);
    main.dataset.view = "wine";
    main.innerHTML = w ? renderCard(w, ctx) : `<div class="errorbox"><h1>Wine not found</h1><p>It may have left the list. <a href="#/list">Open the wine list</a></p></div>`;
    const back = main.querySelector("[data-back]");
    if (back) back.addEventListener("click", () => (history.length > 1 ? history.back() : go("#/" + MODES[ctx.mode].home)));
    window.scrollTo(0, 0);
    const h = main.querySelector("h2"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    document.title = (w ? w.short + " · " : "") + "Apricity Wines";
    return;
  }
  const v = VIEWS[view] ? view : MODES[ctx.mode].home;
  if (!VIEWS[view]) { history.replaceState(null, "", "#/" + v); }
  store.set("view:" + ctx.mode, v);
  navLinks(v);
  main.dataset.view = v;
  document.title = VIEWS[v] + " · Apricity Wines";
  if (v === "map") {
    main.innerHTML = renderMapShell();
    let cleanup = null, gone = false;
    mountMap(main, ctx).then(fn => { if (gone) fn(); else cleanup = fn; });
    unmount = () => { gone = true; if (cleanup) cleanup(); };
  } else if (v === "list") {
    main.innerHTML = renderList(ctx, listState);
  } else {
    main.innerHTML = renderCheck(ctx);
  }
  if (prev === "wine" && lastScroll.has(v)) window.scrollTo(0, lastScroll.get(v));
}
addEventListener("hashchange", route);

// Type chips on the wine list: one listener for the life of the page.
main.addEventListener("click", e => {
  const b = main.dataset.view === "list" && e.target.closest("button.chip");
  if (!b) return;
  toggleType(listState, b);
  main.innerHTML = renderList(ctx, listState);
  const again = main.querySelector(`button.chip[data-type="${b.dataset.type}"]`) || main.querySelector("button.chip");
  if (again) again.focus();
});

async function start() {
  main.innerHTML = '<p class="loading" role="status">Loading the wine list…</p>';
  try {
    await load();
    if (ctx.mode && MODES[ctx.mode]) { document.body.dataset.mode = ctx.mode; setMode(ctx.mode, !location.hash); }
    else { ctx.mode = null; applyTheme(); route(); }
  } catch (err) { showError(err); }
}
start();
