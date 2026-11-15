// The regions map: a real map of the wine world. Shows the major wine regions in general, marks the ones we pour
// from, and pins each of our wines at its village or appellation (or at its region's centre when no place is known).
// D3 and the Natural Earth country outlines load only when this screen opens.
import { esc, glyph, money, notesBadge, typeLabel, wineRow } from "../ui.js";
import { linkTerms } from "../glossary.js";
import { store } from "../store.js";

const EUROPE = [[-11, 35], [31, 59.5]]; // lon/lat corners of the default view, where nearly all our wines are
const PIN_ZOOM = 2.2;                   // wines are pinned once zoomed in this far past the Europe view
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let d3p = null, worldp = null;
const loadD3 = () => (d3p = d3p || import(new URL("../../vendor/d3-map.js", import.meta.url).href));
const loadWorld = () => (worldp = worldp || fetch(new URL("../../vendor/world-50m.json", import.meta.url)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));

export function renderRegionsShell() {
  return `<div class="mapview regionsview">
    <div class="mapbar">
      <div class="row">
        <span class="rowlabel" id="view-label">Show</span>
        <div class="seg" role="group" aria-labelledby="view-label">
          <button type="button" data-fit="europe" aria-pressed="false">Europe</button>
          <button type="button" data-fit="world" aria-pressed="false">World</button>
        </div>
        <label class="toggle"><input type="checkbox" id="allRegions"> Regions we don't pour</label>
      </div>
    </div>
    <div class="mapbody">
      <div class="stage" id="stage">
        <svg id="geo" role="img" aria-label="Map of wine regions. Filled circles are regions we pour wines from; tap one to see its wines. The same wines are in the Wine list."></svg>
        <div class="zoomctl">
          <button type="button" id="zin" aria-label="Zoom in">+</button>
          <button type="button" id="zout" aria-label="Zoom out">−</button>
        </div>
        <div class="legendnote" aria-hidden="true"><span><svg width="18" height="18" viewBox="-9 -9 18 18"><circle r="6" fill="var(--accent)" fill-opacity=".85"/></svg>our regions</span><span><svg width="18" height="18" viewBox="-9 -9 18 18"><circle r="4" fill="var(--surface)" stroke="var(--ink-3)" stroke-width="1.5"/></svg>other regions</span><span class="zoomhint" id="zoomhint">Zoom in to see each wine</span></div>
        <p class="maploading" id="maploading">Loading the map…</p>
      </div>
      <aside class="mappanel" id="panel" aria-live="polite"></aside>
    </div>
  </div>`;
}

export async function mountRegions(root, ctx, focus) {
  const loading = root.querySelector("#maploading");
  let d3, world;
  try { [d3, world] = await Promise.all([loadD3(), loadWorld()]); }
  catch (e) { loading.textContent = "The map could not load. Check the connection; the Wine list has every wine."; return () => {}; }
  if (!root.isConnected) return () => {};
  loading.remove();

  const { regions, byId: regionById } = ctx.regions;
  const wines = ctx.data.wines.filter(w => w.pin);
  const ours = regions.filter(r => r.wines.length);
  const state = { showAll: store.get("regions:all", true), sel: null };
  root.querySelector("#allRegions").checked = state.showAll;

  const stage = root.querySelector("#stage"), panel = root.querySelector("#panel");
  const svg = d3.select(root.querySelector("#geo"));
  const g0 = svg.append("g");
  const gLand = g0.append("g"), gRegions = g0.append("g"), gLabels = g0.append("g"), gPins = g0.append("g"), gPinLabels = g0.append("g");
  const land = d3.feature(world, world.objects.countries);
  land.features = land.features.filter(f => f.properties.name !== "Antarctica");
  const borders = d3.mesh(world, world.objects.countries, (a, b) => a !== b);

  const size = () => { const r = stage.getBoundingClientRect(); return { w: Math.max(200, r.width), h: Math.max(200, r.height) }; };
  let S = size();
  const projection = d3.geoNaturalEarth1();
  const path = d3.geoPath(projection);
  let K = 1, europeK = 1;

  const zoom = d3.zoom().scaleExtent([0.8, 120])
    .extent(() => { const s = size(); return [[0, 0], [s.w, s.h]]; })
    .on("zoom", e => {
      g0.attr("transform", e.transform); K = e.transform.k; onZoom();
      if (e.sourceEvent) root.querySelectorAll("[data-fit]").forEach(b => b.setAttribute("aria-pressed", "false")); // moved by hand
    });
  svg.call(zoom).on("dblclick.zoom", null);
  svg.on("click", e => { if (e.target === svg.node() || e.target.classList.contains("country")) select(null); });

  // Region and wine marks are drawn once in projected coordinates; their size is kept constant on screen in onZoom().
  const countries = gLand.selectAll("path").data(land.features).join("path").attr("class", "country");
  const borderPath = gLand.append("path").datum(borders).attr("class", "border");
  const regionSel = gRegions.selectAll("g").data(regions, r => r.id).join("g")
    .attr("class", r => "region" + (r.wines.length ? " ours" : " other"))
    .on("click", (e, r) => { e.stopPropagation(); select({ region: r.id }, true); });
  regionSel.append("circle").attr("class", "hit");
  regionSel.append("circle").attr("class", "dot");
  const maxCount = Math.max(1, ...ours.map(r => r.wines.length));
  const regionR = r => (r.wines.length ? 5 + 9 * Math.sqrt(r.wines.length / maxCount) : 4);

  // Wines sharing a spot are spread on a small sunflower spiral around it, a fixed number of pixels apart.
  const spots = new Map();
  wines.forEach(w => { const k = w.pin.lat.toFixed(3) + "," + w.pin.lon.toFixed(3); if (!spots.has(k)) spots.set(k, []); spots.get(k).push(w); });
  spots.forEach(list => list.sort((a, b) => a.type.localeCompare(b.type) || (a.bottle || 0) - (b.bottle || 0))
    .forEach((w, i) => { const a = i * 2.39996, d = list.length > 1 ? 9 * Math.sqrt(i + 0.6) : 0; w._dx = Math.cos(a) * d; w._dy = Math.sin(a) * d; }));
  const pinSel = gPins.selectAll("g").data(wines, w => w.id).join("g")
    .attr("class", w => "pin t-" + w.type + (w.pin.exact ? " exact" : " approx"))
    .on("click", (e, w) => { e.stopPropagation(); select({ wine: w.id }, false); });
  pinSel.append("circle").attr("class", "hit").attr("r", 11);
  pinSel.append("g").attr("class", "g").html(w => glyph(w.type, 16).replace(/^<svg[^>]*>|<\/svg>$/g, ""));
  const pinLabelSel = gPinLabels.selectAll("text").data(wines, w => w.id).join("text").attr("class", "plabel").text(w => w.short)
    .on("click", (e, w) => { e.stopPropagation(); select({ wine: w.id }, false); });
  const labelSel = gLabels.selectAll("text").data(regions, r => r.id).join("text")
    .attr("class", r => "rlabel" + (r.wines.length ? " ours" : " other")).text(r => r.name)
    .on("click", (e, r) => { e.stopPropagation(); select({ region: r.id }, true); });

  function project() {
    S = size();
    projection.fitExtent([[8, 8], [S.w - 8, S.h - 8]], land);
    countries.attr("d", path);
    borderPath.attr("d", path);
    regions.forEach(r => { [r.x, r.y] = projection([r.lon, r.lat]); });
    wines.forEach(w => { [w._x, w._y] = projection([w.pin.lon, w.pin.lat]); });
    const [[x0, y0], [x1, y1]] = [projection([EUROPE[0][0], EUROPE[1][1]]), projection([EUROPE[1][0], EUROPE[0][1]])];
    europeK = Math.min(S.w / (x1 - x0), S.h / (y1 - y0));
  }

  function onZoom() {
    const showPins = K >= europeK * PIN_ZOOM;
    regionSel.attr("transform", r => `translate(${r.x},${r.y}) scale(${1 / K})`)
      .style("display", r => (r.wines.length || state.showAll ? null : "none"))
      .classed("sel", r => state.sel && state.sel.region === r.id);
    regionSel.select(".dot").attr("r", r => regionR(r) * (showPins && r.wines.length ? 0.55 : 1));
    regionSel.select(".hit").attr("r", r => Math.max(16, regionR(r) + 6));
    regionSel.classed("faded", r => showPins && r.wines.length > 0);
    pinSel.style("display", showPins ? null : "none")
      .attr("transform", w => `translate(${w._x},${w._y}) scale(${1 / K}) translate(${w._dx},${w._dy})`)
      .classed("sel", w => state.sel && state.sel.wine === w.id)
      .classed("dim", w => state.sel && state.sel.region && w.regionId !== state.sel.region);
    root.querySelector("#zoomhint").style.display = showPins ? "none" : "";
    // Wine names: the selected wine always, and every wine once zoomed in far, skipping any that would overlap.
    const pinBoxes = [], named = new Set(), selId = state.sel && state.sel.wine;
    const dots = showPins ? wines.map(w => { const sx = w._x * K + w._dx, sy = w._y * K + w._dy; return { id: w.id, box: [sx - 8, sy - 8, sx + 8, sy + 8] }; }) : [];
    const pinOrder = showPins ? [...wines].sort((a, b) => (b.id === selId) - (a.id === selId)) : [];
    pinOrder.forEach(w => {
      if (w.id !== selId && K < europeK * 5) return;
      const sx = w._x * K + w._dx, sy = w._y * K + w._dy, half = w.short.length * 3.9 + 4;
      const box = [sx - half, sy + 9, sx + half, sy + 27];
      const hit = b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1];
      if (w.id !== selId && (pinBoxes.some(hit) || dots.some(d => d.id !== w.id && hit(d.box)))) return;
      pinBoxes.push(box); named.add(w.id);
    });
    pinLabelSel.style("display", w => (named.has(w.id) ? null : "none"))
      .attr("transform", w => `translate(${w._x},${w._y}) scale(${1 / K}) translate(${w._dx},${w._dy + 22})`)
      .classed("sel", w => w.id === selId);
    // Region labels: our regions first, then the others; skip any that would overlap a wine or a label already placed.
    const placed = pinBoxes.slice();
    if (showPins) wines.forEach(w => { const sx = w._x * K + w._dx, sy = w._y * K + w._dy; placed.push([sx - 9, sy - 9, sx + 9, sy + 9]); });
    const order = [...regions].sort((a, b) => (b.wines.length - a.wines.length) || a.name.localeCompare(b.name));
    const visible = new Set();
    order.forEach(r => {
      if (!r.wines.length && (!state.showAll || K < europeK * 1.3)) return;
      const sx = r.x * K, sy = r.y * K, w = r.name.length * 7.6 + 6, h = 18, off = regionR(r) + 4;
      const box = [sx - w / 2, sy - off - h, sx + w / 2, sy - off];
      if (placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) return;
      placed.push(box); visible.add(r.id);
    });
    labelSel.style("display", r => (visible.has(r.id) ? null : "none"))
      .attr("x", r => r.x).attr("y", r => r.y - (regionR(r) + 6) / K)
      .style("font-size", (14 / K) + "px").style("stroke-width", (3.5 / K) + "px");
  }

  function fitBox(x0, y0, x1, y1, animate, maxK = 60) {
    const s = size(), pad = 24;
    const k = Math.min(maxK, (s.w - pad * 2) / Math.max(1, x1 - x0), (s.h - pad * 2) / Math.max(1, y1 - y0));
    const t = d3.zoomIdentity.translate(s.w / 2 - k * (x0 + x1) / 2, s.h / 2 - k * (y0 + y1) / 2).scale(k);
    (animate && !reduced() ? svg.transition().duration(200) : svg).call(zoom.transform, t);
  }
  function fitLonLat([[lon0, lat0], [lon1, lat1]], animate) {
    const a = projection([lon0, lat1]), b = projection([lon1, lat0]);
    fitBox(a[0], a[1], b[0], b[1], animate);
  }
  const fitWorld = animate => fitBox(0, 0, S.w, S.h, animate);
  function fitRegion(r) {
    const pts = r.wines.length ? r.wines.map(w => [w._x, w._y]).concat([[r.x, r.y]]) : [[r.x, r.y]];
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const padPx = 1.2; // in projected units, roughly 50 km at this scale
    fitBox(Math.min(...xs) - padPx, Math.min(...ys) - padPx, Math.max(...xs) + padPx, Math.max(...ys) + padPx, true, europeK * 9);
  }
  function setScope(scope, animate) {
    store.set("regions:scope", scope);
    root.querySelectorAll("[data-fit]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.fit === scope)));
    if (scope === "world") fitWorld(animate); else fitLonLat(EUROPE, animate);
  }

  // ---------- panel ----------
  const wineBtn = w => `<button type="button" class="cmpbtn" data-wine="${w.id}">${glyph(w.type, 20)}<span><span class="nm">${esc(w.short)}</span><span class="ds">${esc([w.place || w.regionGroup, w.bottle != null ? money(w.bottle) : money(w.glass) + " glass"].filter(Boolean).join(" · "))}</span></span></button>`;
  function renderPanel() {
    const sel = state.sel;
    if (sel && sel.wine) {
      const w = ctx.byId.get(sel.wine), r = regionById.get(w.regionId);
      panel.innerHTML = `<button type="button" class="close" aria-label="Close">×</button>
        <div class="badges"><span class="badge plain">${glyph(w.type, 16)}${esc(w.section || typeLabel(w.type))}</span>${notesBadge(w)}</div>
        <h2><a class="winelink" href="#/wine/${encodeURIComponent(w.id)}">${esc(w.name)}</a></h2>
        <p class="meta">${esc(whereLine(w, r))}</p>
        ${w.pin.exact ? "" : `<p class="approxnote">No village or appellation recorded yet, so it is pinned at the centre of ${esc(r ? r.name : "its region")}.</p>`}
        ${w.note ? `<p class="note">${linkTerms(ctx.glossary, w.note)}</p>` : ""}
        <p><a class="btn" href="#/wine/${encodeURIComponent(w.id)}">Open the wine card</a></p>
        ${r ? `<p><button type="button" class="btn ghost" data-region="${r.id}">All our wines from ${esc(r.name)}</button></p>` : ""}`;
      return;
    }
    if (sel && sel.region) {
      const r = regionById.get(sel.region), used = new Set();
      const list = [...r.wines].sort((a, b) => a.type.localeCompare(b.type) || (a.bottle ?? a.glass * 5) - (b.bottle ?? b.glass * 5));
      panel.innerHTML = `<button type="button" class="close" aria-label="Close">×</button>
        <h2>${esc(r.name)}</h2>
        <p class="meta">${esc(r.country)}${r.wines.length ? ` · ${r.wines.length} of our wine${r.wines.length > 1 ? "s" : ""}` : " · none on our list"}</p>
        ${r.knownFor ? `<p class="note">${linkTerms(ctx.glossary, r.knownFor, used)}</p>` : ""}
        ${r.grapes ? `<p class="tags"><span class="tag-label">Grapes</span> ${esc(r.grapes)}</p>` : ""}
        ${list.length ? `<h3>Our wines from here</h3><div class="rows">${list.map(w => wineRow(w)).join("")}</div>` : ""}`;
      return;
    }
    const byCountry = new Map();
    ours.forEach(r => byCountry.set(r.country, (byCountry.get(r.country) || 0) + r.wines.length));
    const countries = [...byCountry].sort((a, b) => b[1] - a[1]);
    panel.innerHTML = `<div class="intro"><p><strong>Tap a region</strong> to see what it is known for and our wines from it. Zoom in to see where each wine comes from.</p>
      <h3>Where our wines come from</h3>
      <p class="countries">${countries.map(([c, n]) => `${esc(c)} <span class="n">${n}</span>`).join(" · ")}</p>
      <div class="cmp regionlist">${[...ours].sort((a, b) => b.wines.length - a.wines.length).map(r => `<button type="button" class="cmpbtn" data-region="${r.id}"><span class="regiondot" aria-hidden="true"></span><span><span class="nm">${esc(r.name)}</span><span class="ds">${esc(r.country)} · ${r.wines.length} wine${r.wines.length > 1 ? "s" : ""}</span></span></button>`).join("")}</div></div>`;
  }
  function whereLine(w, r) {
    return [w.place, r ? r.name : w.regionGroup, w.country].filter((x, i, a) => x && a.indexOf(x) === i).join(", ");
  }

  function select(sel, zoomTo) {
    state.sel = sel;
    renderPanel(); onZoom(); panel.scrollTop = 0;
    if (sel && sel.region && zoomTo) fitRegion(regionById.get(sel.region));
    if (sel && sel.wine && zoomTo) {
      const w = ctx.byId.get(sel.wine);
      fitBox(w._x - 0.6, w._y - 0.6, w._x + 0.6, w._y + 0.6, true, europeK * 12);
    }
  }
  panel.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || b.classList.contains("term")) return;
    if (b.classList.contains("close")) return select(null);
    if (b.dataset.region) return select({ region: b.dataset.region }, true);
    if (b.dataset.wine) return select({ wine: b.dataset.wine }, true);
  });
  root.querySelectorAll("[data-fit]").forEach(b => b.addEventListener("click", () => setScope(b.dataset.fit, true)));
  root.querySelector("#allRegions").addEventListener("change", e => { state.showAll = e.target.checked; store.set("regions:all", state.showAll); onZoom(); });
  root.querySelector("#zin").addEventListener("click", () => svg.transition().duration(reduced() ? 0 : 200).call(zoom.scaleBy, 1.8));
  root.querySelector("#zout").addEventListener("click", () => svg.transition().duration(reduced() ? 0 : 200).call(zoom.scaleBy, 1 / 1.8));

  project();
  setScope(store.get("regions:scope", "europe"), false);
  renderPanel();
  // Opened from a wine card ("Show on the map") or a region link.
  if (focus && focus.wine && ctx.byId.get(focus.wine) && ctx.byId.get(focus.wine).pin) select({ wine: focus.wine }, true);
  else if (focus && focus.region && regionById.get(focus.region)) select({ region: focus.region }, true);

  let rt;
  const ro = new ResizeObserver(() => {
    clearTimeout(rt);
    rt = setTimeout(() => { const s = size(); if (Math.abs(s.w - S.w) > 40 || Math.abs(s.h - S.h) > 40) { project(); setScope(store.get("regions:scope", "europe"), false); } }, 200);
  });
  ro.observe(stage);
  return () => { ro.disconnect(); };
}
