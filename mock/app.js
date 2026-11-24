// ======================================================================
// The study tool, running on the same wine records
// ======================================================================
// Progress is saved per person. Where the browser keeps nothing (a private window), it lives for this visit only.
if (!Study.store.available) { const mem = new Map(); Object.assign(Study.store, { get: (k, f = null) => (mem.has(k) ? JSON.parse(mem.get(k)) : f), set: (k, v) => (mem.set(k, JSON.stringify(v)), true), remove: k => mem.delete(k), resetProgress: () => mem.clear() }); }
const ctx = (() => {
  const rows = t => Study.toRows(t);
  const c = { mode: "learn", sources: [{ label: "Wine records", fresh: true, at: Date.now() }] };
  c.glossary = Study.buildGlossary(rows(SHEETS.glossary)); Study.useGlossary(c.glossary);
  c.data = Study.buildWines(rows(SHEETS.wine), rows(SHEETS.study));
  c.byId = new Map(c.data.wines.map(w => [w.id, w]));
  c.lists = {}; rows(SHEETS.lists).forEach(r => { if (r.list && r.value) (c.lists[r.list] = c.lists[r.list] || []).push(r.value); });
  c.lists.Team = PEOPLE.slice();
  c.regions = Study.buildRegions(rows(SHEETS.regions), c.data.wines);
  c.pairings = Study.buildPairings(rows(SHEETS.pairings), c.data.wines);
  return c;
})();
const sw = id => ctx.byId.get(id); // the study side of a wine: notes, scores, comparisons
const listState = { types: new Set() };

// The examples the mock tells its story with.
const OFF_EXAMPLE = "gili-villo", NEW_EXAMPLE = "montanetthoden-garance", TASTE_EXAMPLE = "envinate-palo-blanco";
Object.assign(state, {
  acct: null,                         // which example account is signed in
  area: "guest",                      // service, learn, office or me
  tasteOpen: new Set([TASTE_EXAMPLE]), // bottles opened for a staff tasting today
  newIds: new Set([NEW_EXAMPLE]),      // new on the list this week
  inbox: []                            // tasting notes waiting for the sommelier
});
state.off.add(OFF_EXAMPLE);
state.moves.unshift({ id: TASTE_EXAMPLE, kind: "manual", amt: -1, why: "Staff tasting", who: "Sommelier", at: new Date(NOW - 95 * 60000) });
state.stock[TASTE_EXAMPLE] = Math.max(0, state.stock[TASTE_EXAMPLE] - 1);
(function seedInbox() {
  const base = sw(TASTE_EXAMPLE).scores, nudge = (s, k, d) => Object.assign({}, s, { [k]: Math.max(1, Math.min(5, s[k] + d)) });
  state.inbox.push(
    { id: TASTE_EXAMPLE, who: "Kai", at: new Date(NOW - 70 * 60000), scores: nudge(nudge(base, "oak", -1), "body", 0), flavours: ["lemon", "salt", "herbs"], note: "Less oak than I expected. Very salty finish." },
    { id: TASTE_EXAMPLE, who: "Jo", at: new Date(NOW - 64 * 60000), scores: nudge(base, "oak", -1), flavours: ["lemon", "smoke", "flint"], note: "" },
    { id: TASTE_EXAMPLE, who: "Ana", at: new Date(NOW - 61 * 60000), scores: nudge(base, "acidity", 1), flavours: ["lemon", "grapefruit", "salt"], note: "Sharper than the note says." });
})();

// Example learning progress for the team, so the path and the team overview have something to show.
(function seedProgress() {
  const S = Study.store, VERSION = 6;
  if (S.get("mockseed", 0) === VERSION) return;
  const order = Study.buildStages(ctx.data.wines).flatMap(s => s.lessons).flatMap(l => l.wines);
  const sig = w => [w.vintage, w.bottle, w.glass].join("|");
  const sigs = Object.fromEntries(ctx.data.wines.map(w => [w.id, sig(w)]));
  const now = Date.now(), DAY = 864e5;
  const plan = { Sam: 18, Ana: 46, Kai: 26, Jo: 8, Priya: 62, Sommelier: 136, Manager: 30, Robin: 120 };
  Object.entries(plan).forEach(([name, n]) => {
    const p = Study.emptyProgress();
    order.filter(w => w.id !== NEW_EXAMPLE).slice(0, n).forEach((w, i) => {
      const h = hash(name + w.id);
      const box = name === "Sommelier" ? 5 : i < n * 0.6 ? 4 + (h > 0.6 ? 1 : 0) : 1 + Math.floor(h * 3);
      p.wines[w.id] = { box, due: now + (h < 0.15 ? -DAY : (box * 2 + 1) * DAY), seen: box + 1, right: box, wrong: h < 0.3 ? 1 : 0, last: now - Math.floor(h * 6) * DAY };
    });
    p.sigs = sigs; p.changed = [NEW_EXAMPLE];
    p.sessions = Array.from({ length: Math.max(1, Math.round(n / 9)) }, (_, j) => ({ at: now - (j + 0.3) * DAY * 0.8, kind: "lesson", lesson: "", right: 3, wines: 4 }));
    S.set("progress:" + name, p);
  });
  S.set("mockseed", VERSION);
})();

// ---------- how stock and learning feed each other ----------
const glassMl = w => parseInt(w.gs) || 125;
const glassesLeft = id => Math.floor(totalMl(id) / glassMl(byId.get(id)));
const isOut = id => totalBottles(id) === 0 && !(state.open[id] > 0);
const offNow = id => state.off.has(id) || isOut(id);
const wineLinkM = w => `<a class="winelink" href="#/wine/${encodeURIComponent(w.id)}">${esc(w.s)}</a>`;
// What to offer instead: the wine's own comparisons that are in stock, glass wines first for a glass wine.
function swaps(id, n = 2) {
  const w = byId.get(id), s = sw(id);
  const ok = x => x && x.id !== id && !offNow(x.id) && status(x.id) !== "low";
  let list = (s ? s.compare : []).map(x => byId.get(x)).filter(ok);
  if (w.gl != null) list = WINES.filter(x => x.gl != null && list.includes(x)).concat(WINES.filter(x => x.gl != null && x.t === w.t && ok(x)), list);
  return [...new Set(list)].slice(0, n);
}
globalThis.studyHooks = {
  isOpen: s => !offNow(s.id) && (s.glass != null || state.tasteOpen.has(s.id)),
  openExtras: wines => wines.filter(s => s.glass == null && state.tasteOpen.has(s.id) && !offNow(s.id)),
  isOff: s => offNow(s.id),
  cardExtra: s => cardStock(s),
  cardFoot: s => cardFoot(s),
  // The Pairings screen: whether each paired wine is there to pour tonight, and what to offer if not.
  pairingExtra: s => {
    const id = s.id, w = byId.get(id); if (!w) return "";
    const off = state.off.has(id) || isOut(id), st = status(id), alt = off || st !== "ok" ? swaps(id) : [];
    return `<p class="pp-stock">${off ? '<span class="badge out">Off tonight</span>' : st === "low" ? '<span class="badge low">Running low</span>' : '<span class="badge ok">On tonight</span>'}
      <span class="num">${w.gl != null ? `about ${glassesLeft(id)} glasses` : stockText(id)}</span>${alt.length ? `<span class="swap">Offer ${alt.map(wineLinkM).join(" or ")} instead, and tell the guest.</span>` : ""}</p>`;
  },
  sendTasting: (s, d, who) => { state.inbox.unshift({ id: s.id, who, at: new Date(), scores: Object.assign({}, d.scores), flavours: d.flavours.slice(), note: d.note }); }
};
// The wine card's stock part, which depends on where it was opened.
function cardStock(s) {
  const id = s.id, w = byId.get(id) || state.added.find(x => x.id === id);
  if (!w) return "";
  const open = studyHooks.isOpen(s);
  if (state.area === "learn") return `<p class="openline"><span class="openstate${open ? " on" : ""}">${open ? (s.glass != null ? "Open: poured by the glass tonight" : "Open: opened for a staff tasting") : offNow(id) ? "Not open: off tonight" : "Not open today"}</span></p>`;
  const st = status(id), off = state.off.has(id), alt = off || st !== "ok" ? swaps(id) : [];
  return `<div class="stockbox">
    <p class="stocknow"><b class="num">${stockText(id)}</b>${w.gl != null ? `<span class="num">about ${glassesLeft(id)} glasses</span>` : ""}
      ${off ? '<span class="badge out">Off tonight</span>' : st === "out" ? '<span class="badge out">Out</span>' : st === "low" ? '<span class="badge low">Running low</span>' : ""}${open ? '<span class="badge ok">Open to taste</span>' : ""}</p>
    ${alt.length ? `<p class="swap">${off || st === "out" ? "Off tonight" : "Nearly out"}: offer ${alt.map(wineLinkM).join(" or ")} instead.</p>` : ""}
    <div class="row"><a class="btn" href="#take-off" data-prefill="${id}">Take off stock</a><button type="button" class="btn ghost" data-offtonight="${id}">${off ? "Back on tonight" : "Off tonight"}</button>
      ${state.area === "office" ? `<button type="button" class="btn ghost" data-ledger="${id}">History${canEdit() ? " and costs" : ""}</button>` : ""}
      ${state.area === "office" && isWineLead() ? `<a class="btn ghost" href="#edit-wine" data-editwine="${id}">Edit wine</a>` : ""}</div></div>`;
}
const BOX_NAMES = ["", "New or just missed", "Seen", "Learning", "Known", "Solid"];
function cardFoot(s) {
  const name = Study.store.get("learner", "");
  if (state.area !== "learn" || !name) return "";
  const r = Study.loadProgress(name).wines[s.id];
  return `<h3>Your progress</h3><p class="note">${r ? `Box ${r.box} of 5: ${BOX_NAMES[r.box]}.${Study.isDue(r) ? " Due for review." : ""}` : "Not met yet. It comes up in its lesson on the path."}</p>`;
}

// ======================================================================
// Accounts, areas and screens
// ======================================================================
const ACCOUNTS = {
  sam: { label: "Sam", roles: ["floor"], who: "Sam", device: "phone", note: "Floor staff, on their own phone" },
  tablet: { label: "Service tablet", roles: ["floor"], who: null, device: "tablet", note: "Shared at the bar: asks who for each change, and who is learning" },
  sommelier: { label: "Sommelier", roles: ["floor", "sommelier"], who: "Sommelier", device: "phone", note: "Wine lead: wines, tastings, stock, menus" },
  manager: { label: "Manager", roles: ["floor", "manager"], who: "Manager", device: "laptop", note: "Runs the venue: stock, people, settings" },
  both: { label: "Manager and wine lead", roles: ["floor", "manager", "sommelier"], who: "Robin", device: "phone", note: "Holds both roles, so sees both sets of screens" }
};
// Roles add up: everyone on the team has the floor screens; wine lead and manager each add their own, and one person can hold both.
const ROLE_LABEL = { floor: "Floor staff", sommelier: "Wine lead", manager: "Manager" };
const hasRole = r => state.roles.includes(r);
const canSee = s => s.roles.some(hasRole);
const isWineLead = () => hasRole("sommelier");
const rolesText = () => state.roles.filter(r => r !== "floor").map((r, i) => (i ? ROLE_LABEL[r].toLowerCase() : ROLE_LABEL[r])).join(" and ") || "Floor staff";
const acct = () => ACCOUNTS[state.acct] || { label: "Guest", device: "" };
const isTablet = () => acct().device === "tablet";
const ALL = ["manager", "sommelier", "floor"], OFFICE = ["manager", "sommelier"], WINELEAD = ["sommelier"];
const AREAS = { service: "Service", learn: "Learn", office: "Office" };
const SCREENS = [
  { id: "guest-menu", label: "Wine list", roles: ["guest"] },
  { id: "tonight", label: "Tonight", area: "service", roles: ALL },
  { id: "list", label: "Wine list", area: "service", roles: ALL, href: "#/list" },
  { id: "take-off", label: "Take off stock", area: "service", roles: ALL },
  { id: "menu-pairings", label: "Pairings", area: "service", roles: ALL, href: "#/pairings" },
  { id: "path", label: "Lessons", area: "learn", roles: ALL, href: "#/learn" },
  { id: "before", label: "Before service", area: "learn", roles: ALL, href: "#/lesson/service" },
  { id: "regions", label: "Regions map", area: "learn", roles: ALL, href: "#/regions" },
  { id: "connections", label: "Connections map", area: "learn", roles: ALL, href: "#/map" },
  { id: "glossary", label: "Glossary", area: "learn", roles: ALL },
  { id: "today", label: "Today", area: "office", roles: OFFICE },
  { id: "stock", label: "Stock", area: "office", roles: ALL, grp: "Stock" },
  { id: "delivery", label: "Book in a delivery", area: "office", roles: OFFICE },
  { id: "stock-take", label: "Stock take", area: "office", roles: ALL },
  { id: "add-wine", label: "Add a wine", area: "office", roles: WINELEAD, grp: "Wines" },
  { id: "edit-wine", label: "Edit a wine", area: "office", roles: WINELEAD },
  { id: "tastings", label: "Tasting notes", area: "office", roles: WINELEAD },
  { id: "check", label: "Data check", area: "office", roles: WINELEAD },
  { id: "team", label: "Team learning", area: "office", roles: OFFICE, grp: "Team" },
  { id: "pairings", label: "Pairing pours", area: "office", roles: ALL },
  { id: "lightspeed", label: "Lightspeed", area: "office", roles: OFFICE, grp: "Set-up" },
  { id: "menus", label: "Guest menus", area: "office", roles: OFFICE },
  { id: "venue", label: "Venue and people", area: "office", roles: ["manager"] },
  { id: "me", label: "Me", area: "me", roles: ALL },
  { id: "lesson", label: "Lesson", area: "learn", roles: ALL, hidden: true },
  { id: "wine", label: "Wine", roles: ALL, hidden: true }
];
const STUDY_VIEWS = new Set(["list", "path", "lesson", "wine", "regions", "connections", "check", "menu-pairings"]);
const view = document.getElementById("view"), overlay = document.getElementById("overlay");
const inService = () => { const h = NOW.getHours(); return h >= 17 || h < 1; };
const home = () => (state.role === "guest" ? "guest-menu" : state.role === "floor" ? (inService() ? "tonight" : "path") : "today");
// state.role is the person's widest role, for the few places that need one word; screens check every role they hold.
const areaHome = a => ({ service: "tonight", learn: "path", office: state.role === "floor" ? "stock" : "today", me: "me" }[a]);
const linkFor = id => { const s = SCREENS.find(x => x.id === id); return s.href || "#" + s.id; };
function parseHash() {
  const h = location.hash; let m;
  if ((m = h.match(/^#\/lesson\/(.+)/))) return { id: "lesson", arg: decodeURIComponent(m[1]) };
  if ((m = h.match(/^#\/wine\/(.+)/))) return { id: "wine", arg: decodeURIComponent(m[1]) };
  if ((m = h.match(/^#\/regions(?:\/(.+))?$/))) return { id: "regions", arg: m[1] ? decodeURIComponent(m[1]) : "" };
  const alias = { "#/learn": "path", "#/map": "connections", "#/list": "list", "#/check": "check", "#/pairings": "menu-pairings" };
  if (h === "#before") return { id: "lesson", arg: "service" };
  return { id: alias[h] || h.replace("#", ""), arg: "" };
}
function cur() {
  const h = parseHash(), s = SCREENS.find(x => x.id === h.id && canSee(x));
  if (s && !(s.id === "wine" && !sw(h.arg))) return Object.assign(h, { s });
  return { id: home(), arg: "", s: SCREENS.find(x => x.id === home()) };
}
const current = () => cur().id;
const isCurrent = (s, c) => (c.id === "lesson" ? s.id === (c.arg === "service" ? "before" : "path") : s.id === c.id);
function accountHTML() {
  if (state.role === "guest") return `<button type="button" class="btn" data-signin aria-expanded="${!!state.picking}">Sign in</button>${state.picking ? `<div class="picker" role="dialog" aria-label="Sign in as"><p>Mock sign-in: pick who you are. The real thing uses an email code or a Google account.</p>${Object.entries(ACCOUNTS).map(([k, a]) => `<button type="button" data-as="${k}"><b>${esc(a.label)}</b><span>${esc(a.note)}</span></button>`).join("")}</div>` : ""}`;
  const a = acct();
  return `<div class="who"><small>${a.device === "tablet" ? "Shared, floor staff" : "Signed in as"}</small><b>${esc(a.label)}</b></div><button type="button" class="btn ghost" data-logout>Log out</button>`;
}
function navHTML(c) {
  const vis = SCREENS.filter(s => canSee(s) && !s.hidden && AREAS[s.area]);
  const low = WINES.filter(w => status(w.id) !== "ok").length;
  let out = "";
  Object.entries(AREAS).forEach(([a, label]) => {
    const list = vis.filter(s => s.area === a);
    if (!list.length) return;
    out += `<div class="areahead${state.area === a ? " on" : ""}">${label}</div>`;
    list.forEach(s => { out += `${s.grp ? `<div class="grp">${s.grp}</div>` : ""}<a href="${linkFor(s.id)}"${isCurrent(s, c) ? ' aria-current="page"' : ""}>${esc(s.label)}${s.id === "stock" ? `<span class="count num">${low} low</span>` : s.id === "tastings" && state.inbox.length ? `<span class="count num">${state.inbox.length} new</span>` : ""}</a>`; });
  });
  return out + `<div class="areahead">You</div><a href="#me"${c.id === "me" ? ' aria-current="page"' : ""}>${esc(acct().label)}</a>`;
}
// On phones: the current area's screens as a row of chips, and the areas as a bar at the bottom.
const mnavHTML = c => SCREENS.filter(s => canSee(s) && !s.hidden && s.area === state.area && AREAS[s.area])
  .map(s => `<a href="${linkFor(s.id)}"${isCurrent(s, c) ? ' aria-current="page"' : ""}>${esc(s.label)}</a>`).join("");
const tabbarHTML = () => ["service", "learn", "office", "me"].filter(a => SCREENS.some(s => s.area === a && !s.hidden && canSee(s)))
  .map(a => `<a href="${linkFor(areaHome(a))}"${state.area === a ? ' aria-current="page"' : ""}>${a === "me" ? "Me" : AREAS[a]}</a>`).join("");

// A typed count is saved when its box loses focus, which can happen while the page is being redrawn: never redraw inside a redraw.
let rendering = false, again = false;
function render() {
  if (rendering) { again = true; return; } // redraw once the current draw finishes
  rendering = true;
  try { let n = 0; do { again = false; draw(); } while (again && ++n < 5); } finally { rendering = false; }
}
let unmount = () => {}, mounted = "";
function draw() {
  const c = cur(), s = c.s, key = c.id + "|" + c.arg;
  state.area = c.id === "wine" ? (["service", "learn", "office"].includes(state.area) ? state.area : "service") : s.area || "guest";
  // The shared tablet hands back once someone leaves Learn, so nobody carries on in another person's lessons.
  if (isTablet() && state.area !== "learn" && c.id !== "wine") Study.store.remove("learner");
  if (state.area === "service") document.documentElement.setAttribute("data-theme", "dark"); else document.documentElement.removeAttribute("data-theme");
  Object.assign(document.body.dataset, { role: state.role, device: acct().device || "", mode: state.area === "service" ? "service" : "learn", area: state.area });
  // Any lesson drops the page title; a lesson from the path also drops the menus on phones, to give the questions the
  // screen. Before service keeps them, as it is started from Tonight in the middle of getting ready.
  document.body.classList.toggle("lessonpage", c.id === "lesson");
  document.body.classList.toggle("inlesson", c.id === "lesson" && c.arg !== "service");
  document.body.classList.toggle("fullmap", c.id === "regions" || c.id === "connections");
  document.getElementById("nav").innerHTML = navHTML(c);
  document.getElementById("mnav").innerHTML = mnavHTML(c);
  document.getElementById("tabbar").innerHTML = tabbarHTML();
  document.getElementById("account").innerHTML = accountHTML();
  document.getElementById("title").textContent = c.id === "wine" ? sw(c.arg).short : c.id === "lesson" ? (c.arg === "service" ? "Before service" : "Lesson") : s.label;
  view.classList.toggle("study", STUDY_VIEWS.has(c.id));
  if ((c.id === "regions" || c.id === "connections") && key === mounted && view.querySelector(".mapview")) return; // keep a map that is already drawn
  unmount(); unmount = () => {}; mounted = key;
  view.innerHTML = RENDER[c.id](c);
  if (AFTER[c.id]) AFTER[c.id](c);
}
const questions = () => ""; // feedback questions are asked in person
const canEdit = () => hasRole("manager") || hasRole("sommelier");
function toast(msg, undo) {
  const box = document.getElementById("toastbox");
  box.innerHTML = `<div class="toast" role="status"><span>${msg}</span>${undo ? '<button type="button" id="undoBtn">Undo</button>' : ""}</div>`;
  clearTimeout(toast.t);
  if (undo) document.getElementById("undoBtn").onclick = () => { undo(); box.innerHTML = ""; render(); toast("Undone"); };
  toast.t = setTimeout(() => { box.innerHTML = ""; }, undo ? 10000 : 3500);
}
function record(id, kind, amt, why) {
  const m = { id, kind, amt, why, who: state.who || acct().label, at: new Date() };
  state.moves.unshift(m);
  return m;
}
const wineRowCells = w => `<div class="row" style="gap:8px;flex-wrap:nowrap">${glyph(w.t)}<div style="min-width:0"><div class="wname">${esc(w.s)} <span class="muted num">${esc(w.v)}</span></div><div class="wsub">${esc(w.p)} · ${esc(w.sec)}</div></div></div>`;
const RENDER = {}, AFTER = {};

// ---------- Service: Tonight ----------
RENDER.tonight = () => {
  const glass = WINES.filter(w => w.gl != null);
  const offs = WINES.concat(state.added).filter(w => state.off.has(w.id) || (w.gl != null && isOut(w.id)));
  const lowGlass = glass.filter(w => !offNow(w.id) && status(w.id) === "low");
  const fresh = [...state.newIds].map(id => byId.get(id)).filter(Boolean);
  const extras = WINES.filter(w => w.gl == null && state.tasteOpen.has(w.id) && !offNow(w.id));
  const taken = state.moves.filter(m => ["manual", "pairing"].includes(m.kind)).slice(0, 5);
  const onGlass = glass.filter(w => !offNow(w.id)).length;
  const hi = state.who && !isTablet() ? `Evening, ${esc(state.who)}. ` : "";
  return `<p class="brief">${hi}${onGlass} wines by the glass tonight${offs.length ? `, ${offs.length} off` : ""}${fresh.length ? `, ${fresh.length} new on the list` : ""}.</p>
  <div class="row" style="margin-bottom:16px"><a class="btn big" href="#/lesson/service">Before service: 5 questions</a><a class="btn ghost big" href="#take-off">Take off stock</a></div>
  <div class="grid cols-2" style="align-items:start">
    <div class="panel"><h2>By the glass tonight</h2><div class="scroll"><table class="table"><thead><tr><th>Wine</th><th class="r">Left</th><th></th></tr></thead><tbody>
      ${glass.map(w => `<tr class="clickable" data-card="${w.id}"><td>${wineRowCells(w)}</td><td class="r num"><b class="nw">${glassesLeft(w.id)} glasses</b><div class="wsub nw">${stockText(w.id)}</div></td><td class="r">${state.off.has(w.id) ? '<span class="badge out">Off tonight</span>' : isOut(w.id) ? '<span class="badge out">Out</span>' : status(w.id) === "low" ? '<span class="badge low">Low</span>' : ""}</td></tr>`).join("")}
    </tbody></table></div><p class="hint">Tap a wine for its card: what to say, what is left, and Take off stock.</p></div>
    <div class="grid" style="gap:16px">
      <div class="panel"><h2>Off tonight</h2>${offs.length ? `<ul class="plainlist">${offs.map(w => { const a = swaps(w.id); return `<li>${wineLinkM(w)} <span class="badge out">${state.off.has(w.id) ? "Off tonight" : "Sold out"}</span>${a.length ? `<div class="small">Offer ${a.map(wineLinkM).join(" or ")} instead.</div>` : ""}</li>`; }).join("")}</ul>` : '<p class="muted">Everything on the list is available.</p>'}<p class="hint">Hidden from the guest menu and skipped in Before service until 4am.</p></div>
      ${lowGlass.length ? `<div class="panel"><h2>Running low</h2><ul class="plainlist">${lowGlass.map(w => { const a = swaps(w.id, 1); return `<li>${wineLinkM(w)}: about ${glassesLeft(w.id)} glasses left.${a.length ? ` Then offer ${a.map(wineLinkM).join("")}.` : ""}</li>`; }).join("")}</ul></div>` : ""}
      ${fresh.length ? `<div class="panel"><h2>New on the list</h2><ul class="plainlist">${fresh.map(w => `<li>${wineLinkM(w)} <span class="muted">${esc(w.sec)}</span>${sw(w.id) && sw(w.id).guestLine ? `<div class="small">“${esc(sw(w.id).guestLine)}”</div>` : ""}</li>`).join("")}</ul><p><a class="btn ghost" href="#/learn">In everyone's lessons: New on the list</a></p></div>` : ""}
      ${(() => { const hit = (ctx.pairings ? ctx.pairings.pairings : []).filter(p => p.wine && offNow(p.wine.id));
        return `<div class="panel"><h2>Tasting menu</h2>${hit.length ? `<ul class="plainlist">${hit.map(p => { const w = byId.get(p.wine.id), a = swaps(p.wine.id); return `<li><b>${esc(p.dish)}</b> (${esc(p.course.toLowerCase())}): ${wineLinkM(w)} <span class="badge out">Off tonight</span>${a.length ? `<div class="small">Offer ${a.map(wineLinkM).join(" or ")} instead, and tell the guest.</div>` : ""}</li>`; }).join("")}</ul>` : '<p class="muted">Every pairing is on tonight.</p>'}<p><a class="btn ghost" href="#/pairings">All the pairings, with scripts</a></p></div>`; })()}
      <div class="panel"><h2>Open to taste</h2><p class="small">Every wine by the glass${extras.length ? ", plus:" : "."}</p>${extras.length ? `<ul class="plainlist">${extras.map(w => `<li>${wineLinkM(w)} <span class="muted">opened for a staff tasting</span></li>`).join("")}</ul><p><a class="btn ghost" href="#/lesson/open">Taste what's open</a></p>` : ""}</div>
      <div class="panel"><h2>Taken off tonight</h2>${taken.length ? `<ul class="ledger">${taken.map(ledgerItem).join("")}</ul>` : '<p class="muted">Nothing yet.</p>'}</div>
    </div></div>`;
};

// ---------- the study tool's screens ----------
RENDER["menu-pairings"] = () => Study.renderPairings(ctx);
RENDER.list = () => `<p class="muted" style="margin-top:0">Every wine on the list. Tap one for what to say and what is left. The search at the top finds any wine.</p>${Study.renderList(ctx, listState)}`;
RENDER.path = () => Study.renderPath(ctx);
RENDER.lesson = c => Study.renderLesson(c.arg, ctx);
AFTER.lesson = () => focusQuestion();
RENDER.wine = c => Study.renderCard(sw(c.arg), Object.assign({}, ctx, { mode: state.area === "service" ? "service" : "learn" }));
AFTER.wine = () => scrollTo(0, 0);
RENDER.check = () => Study.renderCheck(ctx);
RENDER.regions = () => Study.renderRegionsShell();
AFTER.regions = c => { const a = c.arg || ""; mountGeo(Study.mountRegions, a.startsWith("w:") ? { wine: a.slice(2) } : a ? { region: a } : null); };
RENDER.connections = () => Study.renderMapShell();
AFTER.connections = () => mountGeo(Study.mountMap);
function mountGeo(fn, focus) {
  const tb = document.getElementById("tabbar"), bottom = getComputedStyle(tb).display !== "none" ? tb.offsetHeight : 0;
  document.documentElement.style.setProperty("--top-h", Math.round(view.getBoundingClientRect().top + scrollY + bottom + 12) + "px");
  let cleanup = null, gone = false;
  fn(view.firstElementChild, ctx, focus).then(f => { if (gone) f(); else cleanup = f; });
  unmount = () => { gone = true; if (cleanup) cleanup(); };
}
// After each step of a lesson, put focus where the learner acts next.
function focusQuestion() {
  const target = ["#typedInput:not([readonly])", ".feedback .btn", ".lessonend .btn", ".qprompt"].map(s => view.querySelector(s)).find(Boolean);
  if (target) { if (target.classList.contains("qprompt")) target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
}
RENDER.glossary = () => {
  const terms = ctx.glossary.terms.slice().sort((a, b) => a.term.localeCompare(b.term));
  return `<div class="panel"><p class="muted" style="margin-top:0">The ${terms.length} terms behind the blue links in every note. The sommelier edits them in Office.</p>
    <dl class="gloss">${terms.map(t => `<div><dt>${esc(t.term)}</dt><dd>${esc(t.definition)}</dd></div>`).join("")}</dl></div>`;
};

// ---------- Office: tasting notes from the team ----------
RENDER.tastings = () => {
  const ids = [...new Set(state.inbox.map(e => e.id))];
  if (!ids.length) return '<div class="panel"><p class="muted">No tasting notes waiting. When the team tastes an open bottle in a lesson and sends their notes, they arrive here.</p></div>';
  return `<p class="muted" style="margin-top:0">Sent from lessons with an open bottle. Each sits beside the current notes, with the team's average.</p>` + ids.map(id => {
    const s = sw(id), list = state.inbox.filter(e => e.id === id), w = byId.get(id);
    const avg = n => { const v = list.map(e => e.scores[n]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    const word = (n, v) => (v == null ? "–" : `${v} · ${esc(Study.SCALE_WORDS[n][v - 1])}`);
    const rows = Study.gridScores(s).map(n => { const a = avg(n), off = s.scores && a != null && Math.abs(a - s.scores[n]) >= 1;
      return `<tr><th scope="row">${esc(Study.SCORE_NAMES[n])}</th><td>${word(n, s.scores && s.scores[n])}</td>${list.map(e => `<td>${word(n, e.scores[n])}</td>`).join("")}<td${off ? ' class="diffcell"' : ""}><b>${word(n, a)}</b></td></tr>`; }).join("");
    return `<section class="panel" style="margin-bottom:16px"><div class="row" style="justify-content:space-between"><h2 style="margin:0">${glyph(w.t, 18)} ${esc(s.name)} <span class="muted num">${esc(s.vintage)}</span></h2><span class="badge ${s.tasted ? "ok" : "est"}">${s.tasted ? "Tasted" : "Estimate"}</span></div>
      <div class="scroll"><table class="table" style="margin-top:8px"><thead><tr><th></th><th>Current notes</th>${list.map(e => `<th>${esc(e.who)}</th>`).join("")}<th>Team</th></tr></thead><tbody>${rows}
        <tr><th scope="row">Flavours</th><td>${esc(s.flavours.join(", "))}</td>${list.map(e => `<td>${esc(e.flavours.join(", "))}</td>`).join("")}<td></td></tr></tbody></table></div>
      ${list.filter(e => e.note).map(e => `<p class="small"><b>${esc(e.who)}:</b> “${esc(e.note)}”</p>`).join("")}
      <div class="row"><button type="button" class="btn" data-marktasted="${id}">Use the team's scores and mark as tasted</button><button type="button" class="btn ghost" data-keepnotes="${id}">Keep the current notes</button><a class="btn ghost" href="#/wine/${encodeURIComponent(id)}">Open the card</a></div></section>`;
  }).join("");
};

// ---------- Office: how the team is learning (team totals only) ----------
RENDER.team = () => {
  const ps = PEOPLE.map(n => Study.loadProgress(n)), wines = ctx.data.wines, now = Date.now();
  const per = wines.map(w => { const recs = ps.map(p => p.wines[w.id]); return { w, known: recs.filter(Study.isKnown).length, learning: recs.filter(r => r && !Study.isKnown(r)).length }; });
  const share = Math.round(per.reduce((a, x) => a + x.known, 0) / (wines.length * PEOPLE.length) * 100);
  const week = ps.reduce((a, p) => a + p.sessions.filter(s => s.at >= now - 7 * 864e5).length, 0);
  const stages = Study.buildStages(wines).filter(s => s.wines.length);
  const stageShare = s => Math.round(per.filter(x => s.wines.includes(x.w)).reduce((a, x) => a + x.known, 0) / (s.wines.length * PEOPLE.length) * 100);
  const unsure = per.filter(x => x.known === 0 && byId.get(x.w.id) && !offNow(x.w.id)).sort((a, b) => (b.w.glass != null) - (a.w.glass != null) || (a.w.bottle || 0) - (b.w.bottle || 0)).slice(0, 8);
  const fresh = per.filter(x => state.newIds.has(x.w.id));
  const line = x => `<tr><td>${Study.glyph(x.w.type, 16)} <a class="winelink" href="#/wine/${encodeURIComponent(x.w.id)}">${esc(x.w.short)}</a>${x.w.glass != null ? ' <span class="badge">By the glass</span>' : ""}</td><td class="r num small">${x.known ? x.known + " know it · " : ""}${x.learning} learning<br>${PEOPLE.length - x.known - x.learning} not met</td>
    <td class="r">${state.tasteOpen.has(x.w.id) ? '<span class="badge ok">Open to taste</span>' : `<button type="button" class="btn ghost" data-opentaste="${x.w.id}">Open for a tasting</button>`}</td></tr>`;
  return `<div class="grid cols-3">
    <div class="panel kpi"><span class="muted">The team knows well</span><b>${share}%</b><span class="small muted">of the list, across ${PEOPLE.length} floor staff</span></div>
    <div class="panel kpi"><span class="muted">Lessons in the last 7 days</span><b>${week}</b><span class="small muted">team total</span></div>
    <div class="panel kpi"><span class="muted">Tasting notes waiting</span><b>${state.inbox.length}</b><span class="small muted">${isWineLead() ? '<a href="#tastings">Open Tasting notes</a>' : "for the wine lead"}</span></div>
  </div>
  <div class="grid cols-2" style="margin-top:16px;align-items:start">
    <div class="panel"><h2>By unit</h2><table class="table"><tbody>${stages.map(s => `<tr><td>${esc(s.title)}</td><td style="width:40%"><div class="bar"><span style="width:${stageShare(s)}%"></span></div></td><td class="r num">${stageShare(s)}%</td></tr>`).join("")}</tbody></table>
      <p class="hint">How much of each unit the team knows well (box 4 or 5), on average. Team totals only: no one's own scores are shown here.</p></div>
    <div class="panel team"><h2>Nobody's sure of these yet</h2><div class="scroll"><table class="table"><tbody>${unsure.map(line).join("")}</tbody></table></div>
      <p class="hint">Glass wines first. Opening a bottle takes it off stock as a staff tasting, and lessons offer it to everyone tonight.</p>
      ${fresh.length ? `<h3>New and not yet learned</h3><div class="scroll"><table class="table"><tbody>${fresh.map(line).join("")}</tbody></table></div>` : ""}</div>
  </div>`;
};

// ---------- Me ----------
RENDER.me = () => {
  const a = acct(), name = isTablet() ? "" : a.who;
  const p = name ? Study.loadProgress(name) : null, now = Date.now();
  const known = p ? Object.values(p.wines).filter(Study.isKnown).length : 0, due = p ? Object.values(p.wines).filter(r => Study.isDue(r, now)).length : 0;
  const week = p ? p.sessions.filter(s => s.at >= now - 7 * 864e5).length : 0;
  return `<div class="grid cols-2" style="align-items:start">
    <div class="panel"><h2>${esc(a.label)}</h2><p>${esc(rolesText())} at Apricity${isTablet() ? ". This is the shared tablet: stock changes ask who you are, and Learn asks who is learning." : `. Signed in on ${a.device === "laptop" ? "a laptop" : "their own phone"}, and stays signed in.`}</p>
      <div class="row"><button type="button" class="btn ghost" data-logout>Log out</button></div></div>
    ${p ? `<div class="panel"><h2>Your learning</h2><div class="grid cols-3"><div class="kpi"><b>${known}</b><span class="small muted">of ${ctx.data.wines.length} wines known</span></div><div class="kpi"><b>${due}</b><span class="small muted">due for review</span></div><div class="kpi"><b>${week}</b><span class="small muted">lessons this week</span></div></div>
      <p class="hint">Saved to your account, so it follows you from the tablet to your phone. Only you see your own scores.</p>
      <div class="row"><a class="btn" href="#/learn">Open my lessons</a></div></div>` : ""}
    <div class="panel"><h2>About this mock</h2><p class="small">Example people, stock and sales. Changes last until the page is reloaded; learning progress is kept in this browser.</p><button type="button" class="btn ghost" data-resetdemo>Reset the example data</button></div>
  </div>`;
};
RENDER.today = () => officeToday();

// ---------- the wine picker: search, never a dropdown of every wine ----------
// Wherever someone chooses a wine, they type any part of the producer, wine, grape, region or vintage.
// Capitals and accents don't matter, every word typed must match, and up to 8 results show with their stock.
// Before anything is typed, a picker can offer a few suggestions (a wine's comparisons, tonight's glass list).
// Every search box in the app uses the study tool's one wine search (src/js/search.js): accents, small words and
// plurals don't matter, grapes match under any name, regions under their other names (Côtes du Rhône), and a
// guest's style (If you like) finds wines too, with the reason shown.
let finder = null;
const finderIdx = () => (finder && finder.n === ctx.data.wines.length ? finder.idx : (finder = { n: ctx.data.wines.length, idx: Study.searchIndex(ctx.data.wines, ctx.regions) }).idx);
const findHits = (q, n = 8) => Study.search(finderIdx(), q, { limit: n }).map(x => ({ w: byId.get(x.wine.id) || state.added.find(a => a.id === x.wine.id), why: x.why })).filter(x => x.w);
const findWines = (q, n = 8) => findHits(q, n).map(x => x.w);
// "Did you mean “chardonnay”?" when a search finds nothing; data-dym-for names which box it fills.
const dymButton = (q, box) => { const d = Study.didYouMean(finderIdx(), q); return d ? ` <button type="button" class="linkbtn" data-dym="${esc(d)}" data-dym-for="${esc(box)}">Did you mean “${esc(d)}”?</button>` : ""; };
document.addEventListener("click", e => {
  const b = e.target.closest("[data-dym-for]"); if (!b) return;
  const box = b.dataset.dymFor, q = b.dataset.dym;
  if (box === "gq") { const el = document.getElementById("gq"); el.value = q; searchWines(q); el.focus(); }
  else if (box === "tk") { tk.q = q; render(); const el = document.getElementById("tkSearch"); if (el) { el.focus(); el.setSelectionRange(q.length, q.length); } }
  else if (picks[box]) { picks[box].q = q; const el = view.querySelector(`[data-wpick-q="${box}"]`); if (el) { el.value = q; el.focus(); } document.getElementById("wpl-" + box).innerHTML = wpickItems(box); }
});
const picks = {}; // picker id -> { q, open, onPick, suggest, none }
function winePicker(id, { value = null, onPick, label = "Wine", suggest = [], q = "", disabled = false, none = "", keepOpen = false } = {}) {
  const p = picks[id] = picks[id] || { q, open: !value };
  Object.assign(p, { onPick, suggest, none, keepOpen });
  const w = value && (byId.get(value) || state.added.find(x => x.id === value));
  if (w && !p.open) return `<div class="wpick chosen">${glyph(w.t)}<span class="wpick-name"><b>${esc(w.s)}</b> <span class="muted num">${esc(w.v)}</span><span class="wsub">${esc(w.p)} · ${esc(w.sec)}</span></span>
    ${disabled ? "" : `<button type="button" class="btn ghost" data-wpick-change="${id}" aria-label="Change ${esc(label)}">Change</button>`}</div>`;
  return `<div class="wpick"><input class="input" type="search" data-wpick-q="${id}" value="${esc(p.q)}" placeholder="Search: producer, wine, grape or region" aria-label="${esc(label)}: type to search" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="wpl-${id}" aria-expanded="true">
    <ul class="wpick-list" id="wpl-${id}" role="listbox" aria-label="Matching wines">${wpickItems(id)}</ul></div>`;
}
function wpickItems(id) {
  const p = picks[id], typed = p.q.trim();
  const found = typed ? findHits(p.q) : p.suggest.map(x => ({ w: byId.get(x) || state.added.find(a => a.id === x) })).filter(x => x.w).slice(0, 6);
  const hits = found.map(x => x.w), why = new Map(found.map(x => [x.w.id, x.why]));
  if (!hits.length) return typed ? `<li class="wpick-none">No wine matches “${esc(typed)}”.${dymButton(typed, id) || (p.none ? " " + p.none : "")}</li>` : "";
  return (typed ? "" : '<li class="wpick-head">Suggested</li>') + hits.map(w => `<li role="option" aria-selected="false"><button type="button" data-wpick-opt="${id}" data-id="${w.id}">${glyph(w.t)}<span><b>${esc(w.s)}</b> <span class="muted num">${esc(w.v)}</span><span class="wsub">${esc(w.p)} · ${esc(w.sec)} · ${stockText(w.id)}</span>${why.get(w.id) ? `<span class="wsub why">${esc(why.get(w.id))}</span>` : ""}</span></button></li>`).join("");
}
function choosePick(id, wineId) {
  const p = picks[id];
  p.q = ""; p.open = !!p.keepOpen;
  if (p.onPick) p.onPick(wineId);
  if (p.keepOpen) { const n = view.querySelector(`[data-wpick-q="${id}"]`); if (n) n.focus(); }
}
document.addEventListener("input", e => {
  const inp = e.target.closest("[data-wpick-q]"); if (!inp) return;
  const id = inp.dataset.wpickQ; picks[id].q = inp.value;
  document.getElementById("wpl-" + id).innerHTML = wpickItems(id);
});
document.addEventListener("click", e => {
  const opt = e.target.closest("[data-wpick-opt]"); if (opt) { choosePick(opt.dataset.wpickOpt, opt.dataset.id); return; }
  const ch = e.target.closest("[data-wpick-change]");
  if (ch) { const id = ch.dataset.wpickChange; picks[id].open = true; picks[id].reopened = true; render(); const n = view.querySelector(`[data-wpick-q="${id}"]`); if (n) n.focus(); }
});
// Keys: Enter takes the first match; the arrows move through the matches; Escape keeps the wine already chosen.
document.addEventListener("keydown", e => {
  const inp = e.target.closest("[data-wpick-q]"), opt = e.target.closest("[data-wpick-opt]");
  const id = inp ? inp.dataset.wpickQ : opt ? opt.dataset.wpickOpt : null; if (!id) return;
  const opts = [...document.querySelectorAll(`#wpl-${id} [data-wpick-opt]`)], i = opts.indexOf(e.target);
  if (e.key === "Enter" && inp) { e.preventDefault(); if (opts[0]) opts[0].click(); }
  else if (e.key === "ArrowDown") { e.preventDefault(); (opts[i + 1] || opts[0] || {}).focus?.(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); if (i > 0) opts[i - 1].focus(); else if (inp || i === 0) view.querySelector(`[data-wpick-q="${id}"]`).focus(); }
  else if (e.key === "Escape" && picks[id].reopened) { picks[id].open = false; picks[id].reopened = false; picks[id].q = ""; render(); }
});
