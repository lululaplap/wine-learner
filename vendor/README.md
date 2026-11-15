# Vendored code

`d3-map.js` bundles only the D3 modules the map uses (d3-selection 3.0.0, d3-zoom 3.0.0, d3-force 3.0.0,
d3-hierarchy 3.1.2, d3-shape 3.2.0, d3-transition 3.0.1, d3-geo 3.1.1, topojson-client 3.1.0 and their dependencies), built with esbuild as an ES module.
D3 is © Mike Bostock and contributors, released under the ISC licence: https://github.com/d3/d3/blob/main/LICENSE

`world-50m.json` is the country outlines from world-atlas 2.0.2 (`countries-50m.json`), made from Natural Earth
1:50m Admin 0 data, which is in the public domain: https://www.naturalearthdata.com/about/terms-of-use/
It was simplified with topojson-simplify 3.0.3 (keeping 30% of points) and quantized to 10,000 steps.
D3-geo and topojson-client are © Mike Bostock (ISC licence).
