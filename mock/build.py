# Builds the clickable mock of the combined app into one HTML file: mock/dist/wine-app.html.
# It reuses the study tool's real code (src/js), bundled with esbuild, and generates the example wine list
# from sheets/. Run from anywhere:  python3 mock/build.py   (needs Node 20+ and `npm install` once for esbuild)
import re, json, sys, shutil, subprocess, tempfile
from pathlib import Path
M = Path(__file__).resolve().parent; R = M.parent
B = str(M)
def esbuild():
    tmp = Path(tempfile.mkdtemp())
    shutil.copytree(R / "src/js", tmp / "js"); shutil.copytree(R / "vendor", tmp / "vendor")
    shutil.copy(M / "study-entry.js", tmp / "js/entry.js")
    subprocess.run([sys.executable, str(M / "study-patches.py")], cwd=tmp, check=True)
    exe = R / "node_modules/.bin/esbuild"
    cmd = [str(exe)] if exe.exists() else ["npx", "--yes", "esbuild@0.24.0"]
    subprocess.run(cmd + [str(tmp / "js/entry.js"), "--bundle", "--format=iife", "--minify", "--log-level=warning", "--outfile=" + str(tmp / "study.js")], check=True)
    js = (tmp / "study.js").read_text()
    data = subprocess.run(["node", str(M / "wine-data.cjs"), str(tmp / "study.js"), str(R / "sheets")], check=True, capture_output=True, text=True).stdout
    shutil.rmtree(tmp)
    return js, data
STUDY_JS, WINE_DATA = esbuild()
src=open(B+"/base.html").read()
def rep(old,new,count=1):
    global src
    assert src.count(old)==count,(old[:80],src.count(old)); src=src.replace(old,new)
# 1. the frame
a=src.index("// ======================================================================\n// Screens"); b=src.index("function officeToday() {")
src=src[:a]+open(B+"/app.js").read()+"\n"+src[b:]
# 2. title, brand, tokens, markup
rep("<title>Apricity Wine Office</title>","<title>Apricity Wine</title>")
rep('<div class="brand">Apricity Wine Office<small>Mock for feedback · example data</small></div>','<div class="brand">Apricity Wine<small>Mock for feedback · example data</small></div>')
rep('<div class="mbrand"><b>Apricity Wine Office</b>','<div class="mbrand"><b>Apricity Wine</b>')
rep('''      <span class="example">Mock with example stock and sales</span>''','''      <div class="gsearch" role="search"><input id="gq" type="search" placeholder="Find a wine, grape or region" autocomplete="off" aria-label="Find a wine"><ul class="gres" id="gres" hidden></ul></div>
      <span class="example">Mock with example data</span>''')
rep('<div id="overlay"></div>','<nav class="tabbar" id="tabbar" aria-label="Areas"></nav>\n<div id="overlay"></div>')
rep("--t-sparkling:#2a6fc4; --t-white:#d99400; --t-red:#d23c3b; --t-sweet:#15936a;\n","--t-sparkling:#2a6fc4; --t-white:#d99400; --t-red:#d23c3b; --t-sweet:#15936a;\n  --sea:#dfe8ec; --land:#f3f1ea; --landline:#b9bfb8;\n")
rep("--t-sparkling:#4a93ea; --t-white:#d79a1c; --t-red:#ea5a59; --t-sweet:#28b585; color-scheme:dark","--t-sparkling:#4a93ea; --t-white:#d79a1c; --t-red:#ea5a59; --t-sweet:#28b585; --sea:#0d1418; --land:#262b27; --landline:#4a524c; color-scheme:dark",2)
# 3. the study tool's styles, without its own header and page frame
css=open(str(R)+"/src/index.html").read(); css=css[css.index("<style>")+7:css.index("</style>")]
start=css.index(".btn{display:inline-flex")
css=css[start:]
for pat in [r"main\{max-width:1280px[^}]*\}\n", r"\.loading,\.intro\{[^}]*\}\n", r"\.errorbox[^{]*\{[^}]*\}\n", r"body\.fullmap main\{[^}]*\}\n",
            r"body:has\(main\[data-view=\"lesson\"\]\) \.top\{[^}]*\}\n", r"  \.brand\{font-size:18px\}\n", r"\.choose[^{]*\{[^}]*\}\n"]:
    css,n=re.subn(pat,"",css); assert n>=1,pat
css=css.replace(".intro{","").replace("/* ---------- choose a mode ---------- */","")
css+="\n.intro{color:var(--ink-2)}\n.errorbox{max-width:640px;margin:40px auto;padding:20px;border:1px solid var(--line);border-radius:16px;background:var(--surface)}\n"
rep("@media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important}}\n</style>",
    "/* ---------- the study tool's own styles ---------- */\n"+css+"\n"+open(B+"/app.css").read()+"\n@media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important}}\n</style>")
# 4. office Today: learning beside stock
rep('''<span class="small muted">last sale 6 minutes ago · last night's check fixed 2</span></div>
  </div>''','''<span class="small muted">last sale 6 minutes ago · last night's check fixed 2</span></div>
    ${isWineLead() ? `<a class="panel kpi kpilink" href="#tastings"><span class="muted">Tasting notes waiting</span><b>${state.inbox.length}</b><span class="small muted">from tonight's staff tasting</span></a>` : ""}
    <a class="panel kpi kpilink" href="#team"><span class="muted">Nobody's sure of</span><b>${ctx.data.wines.filter(s => PEOPLE.every(n => !Study.isKnown(Study.loadProgress(n).wines[s.id]))).length}</b><span class="small muted">wines yet: see Team learning</span></a>
  </div>''')
# 5. the drawer links to the one wine card
rep('''      ${canEdit() ? `<a class="btn ghost" href="#edit-wine" data-close data-editwine="${id}">Edit wine</a>` : ""}
    </div>''','''      ${canEdit() ? `<a class="btn ghost" href="#edit-wine" data-close data-editwine="${id}">Edit wine</a>` : ""}
      ${sw(id) ? `<a class="btn ghost" href="#/wine/${encodeURIComponent(id)}" data-close>Wine card</a>` : ""}
    </div>''')
# 6. take off: the tablet asks every time; a staff tasting opens the bottle in everyone's lessons
rep('''  if (state.role === "floor") { state.who = null; tk.step = 0; } else tk.step = 1;
  render();
  toast(`${esc(w.s)}: ${tk.amount === "bottle" ? "1 bottle" : Math.abs(amt) + " ml"} taken off (${esc(reason)})`, () => { state.stock[w.id] = before.stock; state.open[w.id] = before.open; state.moves.splice(state.moves.indexOf(m), 1); });''',
'''  if (isTablet()) { state.who = null; tk.step = 0; } else tk.step = 1;
  const opened = reason === "Staff tasting" && tk.amount === "bottle" && w.gl == null && !state.tasteOpen.has(w.id);
  if (opened) state.tasteOpen.add(w.id);
  render();
  toast(`${esc(w.s)}: ${tk.amount === "bottle" ? "1 bottle" : Math.abs(amt) + " ml"} taken off (${esc(reason)})${opened ? ". Lessons now offer it to taste" : ""}`, () => { state.stock[w.id] = before.stock; state.open[w.id] = before.open; if (opened) state.tasteOpen.delete(w.id); state.moves.splice(state.moves.indexOf(m), 1); });''')
rep('''if (t.closest("[data-back]")) { tk.step = Math.max(state.role === "floor" ? 0 : 1, tk.step - 1);''','''if (t.closest("[data-back]")) { tk.step = Math.max(isTablet() ? 0 : 1, tk.step - 1);''')
# 7. publishing a wine also gives it study notes, so it joins the lessons
rep('''      state.added.push(w); byId.set(id, w);''','''      state.added.push(w); byId.set(id, w);
      const sc = Object.fromEntries(Object.entries(ed.scores).filter(([, x]) => x != null).map(([k, x]) => [k.toLowerCase(), x]));
      const s = { id, key: id, sheetKeys: [], producer: w.p, cuvee: w.c, name: w.n, short: w.s, vintage: w.v, grapes: w.gr, region: w.rg, regionGroup: w.rg, country: "", place: v("fPlace"),
        lat: null, lon: null, leadGrape: (w.gr.split(/[,&+]/)[0] || "").trim(), family: (w.gr.split(/[,&+]/)[0] || "").trim(), section: w.sec, type: w.t, bottle: w.b, glass: w.gl, glassSize: ed.glass ? v("fGlassSize") : "",
        unique: false, hasNotes: true, pronunciation: "", scores: Object.keys(sc).length ? sc : null, flavours: ed.flavours.slice(), making: ed.making.slice(), note: v("fNote"), guestLine: v("fGuest"),
        ifYouLike: [], compareKeys: [], compare: [], anchor: false, serve: "", story: "", pairsWith: [], source: "estimate", tasted: false, check: "", duplicateRows: false };
      ctx.data.wines.push(s); ctx.byId.set(id, s); state.newIds.add(id);''')
rep('''toast(`${esc(w.s)} published: on the menu, in stock and in the study tool`);''','''toast(`${esc(w.s)} published: on the menu, in stock, and in everyone's lessons under New on the list`);''')
# 8. events
rep('''  if (as) { state.role = as.dataset.as; state.who = ROLES[state.role].who; state.picking = false; tk.step = 0; tk.wine = null; overlay.innerHTML = ""; toast(`Signed in as ${ROLES[state.role].label}`); if (location.hash === "#today") render(); else location.hash = "#today"; return; }
  if (t.closest("[data-logout]")) { state.role = "guest"; state.who = null; overlay.innerHTML = ""; toast("Logged out"); if (location.hash === "#guest-menu") render(); else location.hash = "#guest-menu"; return; }
  if (state.picking && !t.closest(".picker")) { state.picking = false; render(); }''',
'''  if (as) { state.acct = as.dataset.as; const a = ACCOUNTS[state.acct]; Object.assign(state, { roles: a.roles, role: ["manager", "sommelier", "floor"].find(r => a.roles.includes(r)), who: a.who, picking: false }); tk.step = 0; tk.wine = null; overlay.innerHTML = "";
    if (a.who && a.device !== "tablet") Study.store.set("learner", a.who); else Study.store.remove("learner");
    toast(`Signed in as ${esc(a.label)}`); go(linkFor(home())); return; }
  if (t.closest("[data-logout]")) { Object.assign(state, { role: "guest", roles: ["guest"], acct: null, who: null }); Study.store.remove("learner"); overlay.innerHTML = ""; toast("Logged out"); go("#guest-menu"); return; }
  if (state.picking && !t.closest(".picker")) { state.picking = false; render(); }
  if (t.closest(".term")) return;
  const c = cur();
  if (STUDY_VIEWS.has(c.id) && view.contains(t) && studyClick(e, c)) return;
  const pfl = t.closest("[data-prefill]"); if (pfl && !t.closest("[data-close]")) { tk.wine = pfl.dataset.prefill; tk.step = state.who ? 2 : 0; }
  const ew0 = t.closest("[data-editwine]"); if (ew0 && !t.closest("[data-close]")) { ed.editId = ew0.dataset.editwine; ed.wine = null; ed.mode = ""; }
  const cr = t.closest("tr[data-card]"); if (cr) { go("#/wine/" + encodeURIComponent(cr.dataset.card)); return; }
  const lg = t.closest("[data-ledger]"); if (lg) { openWine(lg.dataset.ledger); return; }
  const mt = t.closest("[data-marktasted]"); if (mt) { const id = mt.dataset.marktasted, s = sw(id), list = state.inbox.filter(x => x.id === id);
    Study.gridScores(s).forEach(n => { const v = list.map(x => x.scores[n]).filter(x => x != null); if (v.length) s.scores[n] = Math.round(v.reduce((a, b) => a + b, 0) / v.length); });
    s.tasted = true; s.source = "Tasted by the team, " + NOW.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    state.inbox = state.inbox.filter(x => x.id !== id); toast(`${esc(s.short)} marked as tasted. The badge has changed on every card and in every lesson`); render(); return; }
  const kn = t.closest("[data-keepnotes]"); if (kn) { state.inbox = state.inbox.filter(x => x.id !== kn.dataset.keepnotes); toast("Notes kept as they are. The tastings stay in each person's history"); render(); return; }
  const ot = t.closest("[data-opentaste]"); if (ot) { const id = ot.dataset.opentaste, w = byId.get(id); if (!state.stock[id]) { toast("None in stock to open"); return; }
    state.stock[id]--; record(id, "manual", -1, "Staff tasting"); state.tasteOpen.add(id); toast(`${esc(w.s)}: a bottle taken off as a staff tasting. Lessons now offer it to taste`); render(); return; }
  if (t.closest("[data-resetdemo]")) { if (confirm("Reset all the example learning progress in this browser?")) { Study.store.resetProgress(); Study.store.remove("mockseed"); location.reload(); } return; }''')
rep('''  const off = t.closest("[data-offtonight]"); if (off) { const id = off.dataset.offtonight; state.off.has(id) ? state.off.delete(id) : state.off.add(id); toast(state.off.has(id) ? "Off tonight: hidden from the guest menu until 4am" : "Back on the menu"); render(); openWine(id); return; }''',
'''  const off = t.closest("[data-offtonight]"); if (off) { const id = off.dataset.offtonight, inDrawer = !!off.closest(".drawer"); state.off.has(id) ? state.off.delete(id) : state.off.add(id); toast(state.off.has(id) ? "Off tonight: hidden from the guest menu and skipped in Before service until 4am" : "Back on the menu"); render(); if (inDrawer) openWine(id); return; }''')
rep('''document.addEventListener("input", e => { if (e.target.closest(".parts")) editorChecks(); });''',
'''document.addEventListener("input", e => { if (e.target.closest(".parts")) editorChecks(); if (e.target.id === "gq") searchWines(e.target.value); if (cur().id === "lesson") Study.onLessonInput(e, ctx); });
document.addEventListener("submit", e => { if (cur().id === "lesson" && Study.onLessonSubmit(e)) { view.innerHTML = Study.renderLesson(cur().arg, ctx); focusQuestion(); } });
// The search at the top of every staff screen: any wine by producer, cuvée, grape or region.
function searchWines(q) {
  const ul = document.getElementById("gres");
  if (!q.trim()) { ul.hidden = true; ul.innerHTML = ""; return; }
  const hits = Study.search(finderIdx(), q, { limit: 8 });
  ul.innerHTML = hits.length ? hits.map(({ wine: s, why }) => `<li><a href="#/wine/${encodeURIComponent(s.id)}">${Study.glyph(s.type, 16)}<span><span>${esc(s.name)}</span><br><span class="sub">${esc(why || [s.grapes, s.regionGroup].filter(Boolean).join(" · "))}</span></span></a></li>`).join("") : '<li class="sub" style="padding:10px">No wine matches. Try a grape, a region or a style.</li>';
  ul.hidden = false;
}
document.addEventListener("click", e => { if (e.target.closest("#gres a") || !e.target.closest(".gsearch")) { const ul = document.getElementById("gres"); if (!ul.hidden) { ul.hidden = true; if (e.target.closest("#gres a")) document.getElementById("gq").value = ""; } } });
function studyClick(e, c) {
  const t = e.target;
  if (c.id === "lesson") { if (Study.onLessonClick(e, ctx)) { view.innerHTML = Study.renderLesson(c.arg, ctx); focusQuestion(); } return !t.closest("a"); }
  if (c.id === "path") { Study.onPathClick(e, ctx, () => render()); return !!t.closest("[data-name],[data-switch],[data-reset],[data-clear-new]"); }
  if (c.id === "list") { const b = t.closest("button.chip"); if (!b) return false; Study.toggleType(listState, b); render(); const k = view.querySelector(`button.chip[data-type="${b.dataset.type}"]`) || view.querySelector("button.chip"); if (k) k.focus(); return true; }
  if (c.id === "wine" && t.closest(".card [data-back]")) { if (history.length > 1) history.back(); else go(linkFor(areaHome(state.area))); return true; }
  return false;
}
const go = h => { if (location.hash === h) render(); else location.hash = h; };''')
rep('''document.addEventListener("keydown", e => { if (e.key === "Escape" && overlay.innerHTML) overlay.innerHTML = ""; });''',
'''document.addEventListener("keydown", e => { if (e.key === "Escape" && overlay.innerHTML) overlay.innerHTML = "";
  if (cur().id !== "lesson") return; const sel = Study.onLessonKey(e), b = sel && view.querySelector(sel); if (b) { e.preventDefault(); b.click(); } });''')
# roles add up
rep('  role: "guest",   // signed out: the public guest menu','  role: "guest",   // signed out: the public guest menu\n  roles: ["guest"], // every role the signed-in person holds')
rep('''      ${canEdit() ? `<a class="btn ghost" href="#edit-wine" data-close data-editwine="${id}">Edit wine</a>` : ""}''','''      ${isWineLead() ? `<a class="btn ghost" href="#edit-wine" data-close data-editwine="${id}">Edit wine</a>` : ""}''')
rep('''const team = [["Manager", "Manager"], ["Sommelier", "Sommelier / wine lead"], ...PEOPLE.map(p => [p, "Floor staff"])];''',
'''const team = [["Robin", ["manager", "sommelier"]], ["Manager", ["manager"]], ["Sommelier", ["sommelier"]], ...PEOPLE.map(p => [p, []])];''')
rep('''<thead><tr><th>Name</th><th>Role</th><th>Signs in with</th></tr></thead><tbody>
    ${team.map(([n, r], i) => `<tr><td class="wname">${esc(n)}</td><td><select class="input" aria-label="Role for ${esc(n)}">${["Manager", "Sommelier / wine lead", "Floor staff"].map(x => `<option${x === r ? " selected" : ""}>${x}</option>`).join("")}</select></td>''',
'''<thead><tr><th>Name</th><th>Wine lead</th><th>Manager</th><th>Signs in with</th></tr></thead><tbody>
    ${team.map(([n, r], i) => `<tr><td class="wname">${esc(n)}</td>${["sommelier", "manager"].map(k => `<td><label class="switch"><input type="checkbox" ${r.includes(k) ? "checked" : ""} aria-label="${esc(n)}: ${k === "sommelier" ? "wine lead" : "manager"}"><span></span></label></td>`).join("")}''')
rep('''<tr><td class="muted">Service tablet</td><td>Floor staff (shared)</td>''','''<tr><td class="muted">Service tablet</td><td colspan="2">Floor staff only (shared)</td>''')
rep('''<p><button type="button" class="btn ghost" data-invite>Invite someone</button></p></div>''','''<p class="hint">Everyone on the team has the floor screens. Wine lead and manager each add their own screens, and one person can hold both.</p>
    <p><button type="button" class="btn ghost" data-invite>Invite someone</button></p></div>''')
rep('${i < 2 ? "Google account" : "Email code"}', '${i < 3 ? "Google account" : "Email code"}')
# the public list: no clipping box (tall clipped boxes stop drawing on phones), and no empty sections
rep(".guestpage{max-width:560px;margin:0 auto;background:#f9c6ba;border-radius:20px;overflow:hidden;color:#111}",".guestpage{max-width:560px;margin:0 auto;background:#f9c6ba;border-radius:20px;color:#111}")
rep("    ${secs.map(x => `${f.headings","    ${secs.filter(x => x.list.length).map(x => `${f.headings")
# venue: service hours
rep('''<div class="field"><label for="dayend">Service day ends</label>''','''<div class="field"><label for="shours">Service hours (the app opens on Service)</label><select class="input" id="shours"><option>5pm to 1am</option><option>6pm to midnight</option></select></div>
      <div class="field"><label for="dayend">Service day ends</label>''')
assert "ROLES" not in src.replace("ROLE_LABEL",""), [m.start() for m in re.finditer("ROLES", src)]
# assemble: the sheets, the world outlines, the example wine list and the study bundle, in one page
sheets={n: open(f"{R}/sheets/{n}.csv").read() for n in ["wine","study","glossary","regions","lists"]}
data="window.WORLD="+open(f"{R}/vendor/world-50m.json").read().strip()+";\n"
data+="const SHEETS="+json.dumps(sheets, ensure_ascii=False)+";\n"
data+=WINE_DATA+"\n</script>\n<script>\n"+STUDY_JS.replace("</script","<\\/script")
out=src.replace("/*__DATA__*/", data)
assert out.count("/*__DATA__*/")==0
page='<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"></head><body>\n'+out+"\n</body></html>\n"
(M/"dist").mkdir(exist_ok=True)
open(M/"dist/wine-app.html","w").write(page)
print("mock/dist/wine-app.html", len(page)//1024, "KB")
