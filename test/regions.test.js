// Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toRows } from "../src/js/csv.js";
import { buildWines, buildRegions } from "../src/js/data.js";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const REGIONS = toRows(read("sheets/regions.csv"));
const real = () => {
  const { wines } = buildWines(toRows(read("sheets/wine.csv")), toRows(read("sheets/study.csv")));
  return { wines, ...buildRegions(REGIONS, wines) };
};
const HEAD = "Section,Subsection,Unique Expression (♢),Vintage,Producer,Cuvée,Grape Varieties,Region,Bottle Price (£),Glass Price (£),Glass Size\n";

test("every region row has a name, a valid position and a line about it", () => {
  REGIONS.forEach(r => {
    assert.ok(r.region && r.country, JSON.stringify(r));
    assert.ok(Math.abs(+r.latitude) <= 90 && Math.abs(+r.longitude) <= 180 && r.latitude !== "" && r.longitude !== "", r.region);
    assert.ok(r["known for"].length > 20, r.region);
  });
  assert.equal(buildRegions(REGIONS, []).regions.length, REGIONS.length);
});

test("every wine on the list is placed on the map", () => {
  const { wines, unplaced, regions } = real();
  assert.deepEqual(unplaced.map(w => w.name), []);
  assert.ok(wines.every(w => w.pin && w.regionId));
  assert.equal(regions.filter(r => r.wines.length).length, 41);
  assert.equal(regions.reduce((n, r) => n + r.wines.length, 0), wines.length);
});

test("a wine with a place is pinned there; one without sits at its region", () => {
  const { wines, byId } = real();
  const fronsac = wines.find(w => w.key === "matthieu cosse fronsac");
  assert.deepEqual([fronsac.place, fronsac.pin.exact, fronsac.pin.lat], ["Fronsac", true, 44.92]);
  const graf = wines.find(w => w.key === "maria sepp muster graf");
  const styria = byId.get(graf.regionId);
  assert.equal(styria.name, "Styria");
  assert.deepEqual([graf.pin.exact, graf.pin.lat, graf.pin.lon], [false, styria.lat, styria.lon]);
});

test("each pinned wine's place is near its region's centre", () => {
  const { wines, byId } = real();
  wines.filter(w => w.pin.exact).forEach(w => {
    const r = byId.get(w.regionId);
    const km = 111 * Math.hypot(w.pin.lat - r.lat, (w.pin.lon - r.lon) * Math.cos(r.lat * Math.PI / 180));
    assert.ok(km < 400, `${w.name} is ${Math.round(km)} km from ${r.name}`);
  });
});

test("a new wine with no notes finds its region from the wine sheet, misspellings and appellations included", () => {
  const rows = toRows(HEAD +
    'Bottles,White — Aromatic & Fresh,,2023,Somebody,Something,Chardonnay,"Chablis, FR",60,,\n' +
    'Bottles,Red — Soft & Juicy,,2023,Someone,Else,Nebbiolo,"Piemonte, IT",60,,\n' +
    'Bottles,White — Aromatic & Fresh,,2023,Another,One,Grillo,"Silicy, IT",60,,\n' +
    'Bottles,Red — Soft & Juicy,,2023,Lost,Wine,Grape,"Atlantis, XX",60,,\n');
  const { wines } = buildWines(rows, []);
  const { byId, unplaced } = buildRegions(REGIONS, wines);
  assert.deepEqual(wines.slice(0, 3).map(w => byId.get(w.regionId).name), ["Burgundy", "Piedmont", "Sicily"]);
  assert.deepEqual(unplaced.map(w => w.cuvee), ["Wine"]);
});

test("the map shows regions we don't pour from too", () => {
  const { regions } = real();
  const others = regions.filter(r => !r.wines.length).map(r => r.name);
  ["Napa Valley", "Barossa Valley", "Douro", "Marlborough", "Mendoza"].forEach(n => assert.ok(others.includes(n), n));
});
