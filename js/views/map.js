// The wine map, ported from docs/wine-study/prototype-wine-map.html onto the live data.
// D3 is loaded only when the map opens (vendor/d3-map.js holds just the modules it uses).
import { esc, glyph, money, notesBadge, typeLabel } from "../ui.js";
import { store } from "../store.js";
import { linkTerms } from "../glossary.js";

const SHAPES = { sparkling: "symbolDiamond", white: "symbolCircle", rose: "symbolCircle", orange: "symbolSquare", red: "symbolCircle", sweet: "symbolTriangle" };
const TYPES = ["sparkling", "white", "rose", "orange", "red", "sweet"];
const BAND_ORDER = ["Glass only", "Under £80", "£80 to £99", "£100 to £129", "£130 to £179", "£180 to £259", "£260 and over"];
function band(p) {
  if (p == null) return "Glass only"; if (p < 80) return "Under £80"; if (p < 100) return "£80 to £99"; if (p < 130) return "£100 to £129";
  if (p < 180) return "£130 to £179"; if (p < 260) return "£180 to £259"; return "£260 and over";
}
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let d3p = null;
const loadD3 = () => (d3p = d3p || import(new URL("../../vendor/d3-map.js", import.meta.url).href));

export function renderMapShell() {
  return `<div class="mapview">
    <div class="mapbar">
      <div class="row"><span class="rowlabel" id="grp-label">Group by</span><div class="seg" id="modes" role="group" aria-labelledby="grp-label"></div></div>
      <div class="row"><span class="rowlabel" id="show-label">Show</span><div class="key" id="key" role="group" aria-labelledby="show-label"></div>
        <label class="toggle"><input type="checkbox" id="linksToggle" checked> Comparison lines</label>
        <div class="search"><input id="q" type="search" placeholder="Find a wine, grape or region" autocomplete="off" aria-label="Find a wine, grape or region"><div class="results" id="results"></div></div>
      </div>
    </div>
    <div class="mapbody">
      <div class="stage" id="stage">
        <svg id="map" role="img" aria-label="Map of the wine list. Each mark is a wine; lines join wines worth comparing. The same wines are in the Wine list."></svg>
        <div class="zoomctl">
          <button type="button" id="zin" aria-label="Zoom in">+</button>
          <button type="button" id="zout" aria-label="Zoom out">−</button>
          <button type="button" id="zfit" class="fit" aria-label="Show the whole map">All</button>
        </div>
        <div class="legendnote" aria-hidden="true"><span>Bigger = pricier</span><span><svg width="18" height="18" viewBox="-9 -9 18 18"><circle r="3.5" fill="var(--ink-3)"/><circle r="7" fill="none" stroke="var(--ink)" stroke-width="1.5"/></svg>by the glass</span></div>
        <p class="maploading" id="maploading">Loading the map…</p>
      </div>
      <aside class="mappanel" id="panel" aria-live="polite"></aside>
    </div>
  </div>`;
}

export async function mountMap(root, ctx) {
  const d3 = await loadD3().catch(() => null);
  const loading = root.querySelector("#maploading");
  if (!d3) { loading.textContent = "The map could not load. The Wine list has every wine."; return () => {}; }
  if (!root.isConnected) return () => {}; // the screen changed while D3 was loading
  loading.remove();

  const wines = ctx.data.wines.map(w => Object.assign(Object.create(w), { x: undefined, y: undefined }));
  const byId = new Map(wines.map(w => [w.id, w]));
  const nbrs = new Map(wines.map(w => [w.id, new Set()]));
  const links = ctx.data.links.filter(([a, b]) => byId.has(a) && byId.has(b)).map(([a, b]) => {
    nbrs.get(a).add(b); nbrs.get(b).add(a); return { source: byId.get(a), target: byId.get(b) };
  });
  const prodCount = new Map();
  wines.forEach(w => prodCount.set(w.producer, (prodCount.get(w.producer) || 0) + 1));
  const prices = wines.map(w => w.bottle || w.glass * 5 || 70);
  const lo = Math.log(Math.min(...prices)), hi = Math.log(Math.max(...prices));
  wines.forEach(w => {
    const t = hi > lo ? Math.max(0, Math.min(1, (Math.log(w.bottle || 70) - lo) / (hi - lo))) : 0.5;
    w.sizeF = 0.8 + 0.5 * t;
    w.hay = norm([w.name, w.producer, w.cuvee, w.grapes, w.leadGrape, w.regionGroup, w.region, w.country, w.section].join(" "));
  });

  const MODES = [
    { id: "links", label: "Connections" },
    { id: "style", label: "Style", key: w => w.section, order: ctx.data.sections },
    { id: "grape", label: "Grape", key: w => w.leadGrape, other: "One-off grapes" },
    { id: "region", label: "Region", key: w => w.regionGroup, other: "One-off regions" },
    { id: "country", label: "Country", key: w => w.country },
    { id: "producer", label: "Producer", key: w => w.producer, other: "One wine each" },
    { id: "price", label: "Price", key: w => band(w.bottle), order: BAND_ORDER }
  ];
  const state = { mode: store.get("mapBy", "style"), sel: null, hidden: new Set(), showLinks: true, query: "" };
  if (!MODES.some(m => m.id === state.mode)) state.mode = "style";

  const stage = root.querySelector("#stage"), panel = root.querySelector("#panel");
  const svg = d3.select(root.querySelector("#map")), g0 = svg.append("g");
  const gGroups = g0.append("g"), gLinks = g0.append("g").attr("class", "links"), gNodes = g0.append("g"), gLabels = g0.append("g");
  let K = 1, VW = 900, VH = 700, groups = [], lastW = 0;
  // The zoom's extent comes from the stage's size, not the SVG's, which cannot be read once the map is off screen.
  const zoom = d3.zoom().scaleExtent([0.25, 10]).extent(() => { const r = stage.getBoundingClientRect(); return [[0, 0], [Math.max(1, r.width), Math.max(1, r.height)]]; }).on("zoom", e => { g0.attr("transform", e.transform); K = e.transform.k; onZoom(); });
  svg.call(zoom).on("dblclick.zoom", null);
  svg.on("click", e => { if (e.target === svg.node()) select(null); });

  const linkSel = gLinks.selectAll("line").data(links).join("line").attr("class", "link");
  const nodeSel = gNodes.selectAll("g").data(wines, d => d.id).join("g")
    .attr("class", d => "node t-" + d.type)
    .on("click", (e, d) => { e.stopPropagation(); select(d.id, false); });
  nodeSel.append("circle").attr("class", "hit");
  nodeSel.filter(d => d.glass != null).append("circle").attr("class", "glassring");
  nodeSel.append("path").attr("class", "mark");
  nodeSel.append("text").attr("class", "nlabel").text(d => d.short);
  const sim = d3.forceSimulation(wines).stop();

  const measure = () => { const r = stage.getBoundingClientRect(); return { w: Math.max(200, r.width), h: Math.max(200, r.height) }; };
  const dmin = (a, f) => Math.min(...a.map(f)), dmax = (a, f) => Math.max(...a.map(f));

  function computeGroups(mode) {
    const m = new Map();
    wines.forEach(w => { const k = mode.key(w) || "Unknown"; if (!m.has(k)) m.set(k, []); m.get(k).push(w); });
    let list = [];
    if (mode.other) {
      const rest = [];
      m.forEach((arr, k) => { if (arr.length > 1) list.push({ name: k, members: arr }); else rest.push(arr[0]); });
      list.sort((a, b) => b.members.length - a.members.length || a.name.localeCompare(b.name));
      if (rest.length) list.push({ name: mode.other, members: rest });
    } else {
      m.forEach((arr, k) => list.push({ name: k, members: arr }));
      if (mode.order) list.sort((a, b) => mode.order.indexOf(a.name) - mode.order.indexOf(b.name));
      else list.sort((a, b) => b.members.length - a.members.length || a.name.localeCompare(b.name));
    }
    return list;
  }

  function layout(animate) {
    const s = measure(); lastW = s.w;
    VW = Math.max(s.w, 820); VH = VW * Math.max(0.55, Math.min(1.5, s.h / s.w));
    const mode = MODES.find(m => m.id === state.mode);
    let base;
    if (mode.id === "links") {
      groups = []; base = 9.5;
      wines.forEach(w => { w.g = null; w.r = base * w.sizeF; });
      sim.force("x", d3.forceX(VW / 2).strength(0.045)).force("y", d3.forceY(VH / 2).strength(0.045 * VW / VH))
        .force("link", d3.forceLink(links).distance(44).strength(0.4))
        .force("charge", d3.forceManyBody().strength(-150).distanceMax(340))
        .force("collide", d3.forceCollide(d => d.r + 4).iterations(2));
    } else {
      groups = computeGroups(mode);
      const h = d3.hierarchy({ children: groups.map(g => ({ g, value: g.members.length + 0.8 })) }).sum(d => d.value || 0);
      d3.pack().size([VW, VH]).padding(Math.max(16, VW * 0.03))(h);
      h.children.forEach(c => { const g = c.data.g; g.x = c.x; g.y = c.y; g.r = c.r; });
      base = Math.min(15, 0.6 * dmin(groups, g => g.r / Math.sqrt(g.members.length)));
      groups.forEach(g => g.members.forEach(w => { w.g = g; w.r = base * w.sizeF; }));
      sim.force("link", null).force("charge", null)
        .force("x", d3.forceX(d => d.g.x).strength(0.22)).force("y", d3.forceY(d => d.g.y).strength(0.22))
        .force("collide", d3.forceCollide(d => d.r + Math.max(1.5, base * 0.16)).strength(0.9).iterations(3));
    }
    wines.forEach(w => {
      if (w.x == null || !animate) {
        const cx = w.g ? w.g.x : VW / 2, cy = w.g ? w.g.y : VH / 2, rr = w.g ? w.g.r * 0.6 : Math.min(VW, VH) * 0.3, a = Math.random() * 6.283, q = Math.sqrt(Math.random()) * rr;
        w.x = cx + Math.cos(a) * q; w.y = cy + Math.sin(a) * q; w.vx = 0; w.vy = 0;
      }
    });
    nodeSel.select(".mark").attr("d", d => d3.symbol().type(d3[SHAPES[d.type]]).size(Math.PI * d.r * d.r * (d.type === "rose" ? 0.7 : 1))());
    nodeSel.select(".hit").attr("r", d => d.r + 7);
    nodeSel.select(".glassring").attr("r", d => d.r + Math.max(2.5, d.r * 0.38));
    gGroups.selectAll("circle").data(groups, g => g.name).join("circle").attr("class", "gcirc")
      .attr("cx", g => g.x).attr("cy", g => g.y).attr("r", g => g.r)
      .on("click", (e, g) => { e.stopPropagation(); select(null); zoomToGroup(g); });
    gLabels.selectAll("text").data(groups, g => g.name).join("text").attr("class", "glabel")
      .on("click", (e, g) => { e.stopPropagation(); zoomToGroup(g); })
      .html(g => esc(g.name) + ' <tspan class="n">' + g.members.length + "</tspan>");
    gLinks.classed("strong", mode.id === "links");
    root.querySelectorAll("#modes button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode)));
    sim.on("tick", null).on("end", null);
    if (animate && !reduced()) {
      sim.alpha(0.9).alphaDecay(0.045).on("tick", draw).on("end", () => { if (state.mode === "links") fit(true); }).restart();
      if (state.mode !== "links") fit(true);
    } else {
      sim.alpha(1).alphaDecay(0.03);
      for (let i = 0; i < 280; i++) sim.tick();
      draw(); fit(false);
    }
    onZoom();
  }
  function draw() {
    nodeSel.attr("transform", d => "translate(" + d.x.toFixed(1) + "," + d.y.toFixed(1) + ")");
    linkSel.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
  }
  function bounds() {
    if (state.mode !== "links") return [0, 0, VW, VH];
    return [dmin(wines, w => w.x - w.r), dmin(wines, w => w.y - w.r), dmax(wines, w => w.x + w.r), dmax(wines, w => w.y + w.r)];
  }
  function fitBox(b, animate, maxK) {
    const s = measure(), pad = 18, w = b[2] - b[0], h = b[3] - b[1];
    const k = Math.min(maxK || 6, (s.w - pad * 2) / w, (s.h - pad * 2) / h);
    const t = d3.zoomIdentity.translate(s.w / 2 - k * (b[0] + w / 2), s.h / 2 - k * (b[1] + h / 2)).scale(k);
    (animate && !reduced() ? svg.transition().duration(200) : svg).call(zoom.transform, t);
  }
  const fit = animate => fitBox(bounds(), animate, 1.6);
  const zoomToGroup = g => fitBox([g.x - g.r, g.y - g.r - g.r * 0.12, g.x + g.r, g.y + g.r], true, 5);
  function centreOn(w) {
    const set = [w, ...[...nbrs.get(w.id)].map(i => byId.get(i)).filter(x => !x.isOff)], pad = w.r * 3;
    fitBox([dmin(set, d => d.x) - pad, dmin(set, d => d.y) - pad, dmax(set, d => d.x) + pad, dmax(set, d => d.y) + pad * 1.5], true, 13 / w.r);
  }
  function onZoom() {
    const sel = state.sel, nb = sel ? nbrs.get(sel) : null;
    nodeSel.select(".nlabel")
      .style("font-size", (13 / K) + "px").style("stroke-width", (3 / K) + "px").attr("y", d => d.r + 14 / K)
      .style("display", d => {
        if (d.isOff) return "none";
        if (sel) return (d.id === sel || nb.has(d.id)) ? null : "none";
        return (d.r * K >= 10 && !d.isDim) ? null : "none";
      });
    const kept = [], vis = new Set();
    [...groups].sort((a, b) => b.members.length - a.members.length).forEach(g => {
      const w = (g.name.length + 3) * 8.6, cx = g.x * K, y = (g.y - g.r) * K - 5, box = [cx - w / 2, y - 16, cx + w / 2, y + 4];
      if (!kept.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) { kept.push(box); vis.add(g.name); }
    });
    gLabels.selectAll("text").style("font-size", (15 / K) + "px").style("stroke-width", (3.5 / K) + "px")
      .attr("x", g => g.x).attr("y", g => g.y - g.r - 5 / K).style("display", g => vis.has(g.name) ? null : "none");
  }
  function refresh() {
    const sel = state.sel, nb = sel ? nbrs.get(sel) : null, q = state.query;
    wines.forEach(w => {
      w.isOff = state.hidden.has(w.type);
      w.isDim = !w.isOff && ((sel && w.id !== sel && !nb.has(w.id)) || (!sel && q && !w.hay.includes(q)));
    });
    nodeSel.classed("off", d => d.isOff).classed("dim", d => d.isDim).classed("sel", d => d.id === sel);
    gLinks.classed("off", !state.showLinks && !sel).classed("hassel", !!sel);
    linkSel.classed("on", d => sel && (d.source.id === sel || d.target.id === sel) && !d.source.isOff && !d.target.isOff);
    if (sel) nodeSel.filter(d => d.id === sel || nb.has(d.id)).raise();
    onZoom();
  }
  function select(id, move) {
    state.sel = id; refresh(); renderPanel();
    if (id && move !== false) centreOn(byId.get(id));
    panel.scrollTop = 0;
  }

  const wineButton = w => `<button type="button" class="cmpbtn" data-wine="${w.id}">${glyph(w.type, 20)}<span><span class="nm">${esc(w.short)}</span><span class="ds">${esc([w.leadGrape, w.regionGroup, w.bottle != null ? money(w.bottle) : money(w.glass) + " glass"].filter(Boolean).join(" · "))}</span></span></button>`;
  function renderPanel() {
    const w = state.sel ? byId.get(state.sel) : null;
    if (!w) {
      const anchors = wines.filter(x => x.anchor).map(wineButton).join("");
      panel.innerHTML = `<div class="intro"><p><strong>Tap a wine</strong> to see its note and light up the wines to compare it with. Tap a group to zoom in.</p>`
        + (anchors ? `<h3>Start with the anchors</h3><div class="cmp anchors">${anchors}</div>` : "")
        + `<p class="foot">Notes marked “Estimate” describe what the producer, grape and region normally give. They have not been tasted yet.</p></div>`;
      return;
    }
    const cmp = [...nbrs.get(w.id)].map(id => byId.get(id)).sort((a, b) => (w.compare.includes(b.id) - w.compare.includes(a.id)) || (a.bottle || 0) - (b.bottle || 0));
    const chip = (mode, label, val) => val ? `<button type="button" class="chip" data-group="${mode}">${label}: <b>${esc(val)}</b></button>` : "";
    panel.innerHTML = `<button type="button" class="close" aria-label="Close">×</button>
      <div class="badges"><span class="badge plain">${glyph(w.type, 16)}${esc(w.section || typeLabel(w.type))}</span>${notesBadge(w)}${w.glass != null ? '<span class="badge plain">By the glass</span>' : ""}</div>
      <h2><a class="winelink" href="#/wine/${encodeURIComponent(w.id)}">${esc(w.name)}</a>${w.vintage ? " " + esc(w.vintage) : ""}</h2>
      <p class="meta">${esc([w.grapes || w.leadGrape, [w.regionGroup, w.country].filter(Boolean).join(", ")].filter(Boolean).join(" · "))}</p>
      <p class="prices">${[w.bottle != null ? money(w.bottle) + ' <span class="unit">bottle</span>' : "", w.glass != null ? money(w.glass) + ' <span class="unit">glass</span>' : ""].filter(Boolean).join(" · ")}</p>
      ${w.note ? `<p class="note">${linkTerms(ctx.glossary, w.note)}</p>` : ""}
      <p><a class="btn" href="#/wine/${encodeURIComponent(w.id)}">Open the wine card</a></p>
      ${cmp.length ? `<h3>Compare with</h3><div class="cmp">${cmp.map(wineButton).join("")}</div>` : ""}
      <h3>See its group</h3><div class="chips">${chip("grape", "Grape", w.leadGrape)}${chip("region", "Region", w.regionGroup)}${prodCount.get(w.producer) > 1 ? chip("producer", "Producer", w.producer) : ""}${chip("price", "Price", band(w.bottle))}</div>`;
  }
  panel.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.classList.contains("close")) return select(null);
    if (b.dataset.wine) return select(b.dataset.wine);
    if (b.dataset.group) {
      const keep = byId.get(state.sel); setMode(b.dataset.group);
      if (keep && keep.g) setTimeout(() => zoomToGroup(keep.g), reduced() ? 0 : 250);
    }
  });

  function setMode(id) {
    if (id === state.mode) return;
    state.mode = id; store.set("mapBy", id); layout(true);
  }
  const modesEl = root.querySelector("#modes");
  modesEl.innerHTML = MODES.map(m => `<button type="button" data-mode="${m.id}" aria-pressed="false">${m.label}</button>`).join("");
  modesEl.addEventListener("click", e => { const b = e.target.closest("button"); if (b) setMode(b.dataset.mode); });
  const keyEl = root.querySelector("#key");
  keyEl.innerHTML = TYPES.filter(t => wines.some(w => w.type === t)).map(t => `<button type="button" data-type="${t}" aria-pressed="true">${glyph(t, 16)}${typeLabel(t)}</button>`).join("");
  keyEl.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const t = b.dataset.type; state.hidden.has(t) ? state.hidden.delete(t) : state.hidden.add(t);
    b.setAttribute("aria-pressed", String(!state.hidden.has(t))); refresh();
  });
  root.querySelector("#linksToggle").addEventListener("change", e => { state.showLinks = e.target.checked; refresh(); });
  root.querySelector("#zin").addEventListener("click", () => svg.transition().duration(reduced() ? 0 : 200).call(zoom.scaleBy, 1.6));
  root.querySelector("#zout").addEventListener("click", () => svg.transition().duration(reduced() ? 0 : 200).call(zoom.scaleBy, 1 / 1.6));
  root.querySelector("#zfit").addEventListener("click", () => fit(true));

  const qEl = root.querySelector("#q"), resEl = root.querySelector("#results");
  qEl.addEventListener("input", () => {
    state.query = norm(qEl.value);
    if (state.sel) { state.sel = null; renderPanel(); }
    refresh();
    if (!state.query) { resEl.classList.remove("open"); return; }
    const hits = wines.filter(w => w.hay.includes(state.query));
    resEl.innerHTML = hits.length ? hits.slice(0, 8).map(w => `<button type="button" data-wine="${w.id}">${glyph(w.type, 16)}<span>${esc(w.name)}<br><span class="sub">${esc(w.leadGrape)} · ${esc(w.regionGroup)}</span></span></button>`).join("")
      + (hits.length > 8 ? `<div class="none">${hits.length - 8} more are highlighted on the map</div>` : "")
      : `<div class="none">No wine matches “${esc(qEl.value)}”. Try a grape or a region.</div>`;
    const r = qEl.getBoundingClientRect();
    resEl.style.top = (r.bottom + 4) + "px";
    resEl.style.left = Math.max(16, Math.min(r.left, innerWidth - resEl.offsetWidth - 16, innerWidth - 376)) + "px";
    resEl.classList.add("open");
  });
  resEl.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    resEl.classList.remove("open"); qEl.value = ""; state.query = ""; qEl.blur(); select(b.dataset.wine);
  });
  const outside = e => { if (!e.target.closest(".search")) resEl.classList.remove("open"); };
  document.addEventListener("click", outside);
  qEl.addEventListener("keydown", e => {
    if (e.key === "Enter") { const b = resEl.querySelector("button"); if (b) b.click(); }
    if (e.key === "Escape") { qEl.value = ""; qEl.dispatchEvent(new Event("input")); }
  });

  renderPanel();
  requestAnimationFrame(() => { layout(false); refresh(); });
  let rt;
  const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(measure().w - lastW) > 40) { layout(false); refresh(); } }, 200); });
  ro.observe(stage);
  return () => { ro.disconnect(); sim.stop(); document.removeEventListener("click", outside); };
}
