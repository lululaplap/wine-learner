// Makes the mock's wine list (WINES, SECTIONS) from the sheets, through the study tool's own join.
globalThis.localStorage = undefined;
require(process.argv[2]);
const fs = require("fs"), d = process.argv[3];
const r = n => Study.toRows(fs.readFileSync(d + "/" + n + ".csv", "utf8"));
const data = Study.buildWines(r("wine"), r("study"));
const WINES = data.wines.map(w => ({ id: w.id, p: w.producer, c: w.cuvee, n: w.name, s: w.short, v: w.vintage, sec: w.section, t: w.type, gr: w.grapes || w.leadGrape, rg: w.regionGroup, co: w.country, pl: w.place,
  b: w.bottle, gl: w.glass, gs: w.glassSize, u: w.unique, note: w.note, gu: w.guestLine, fl: w.flavours, mk: w.making, sc: w.scores, an: w.anchor, ck: w.check }));
process.stdout.write("const WINES=" + JSON.stringify(WINES) + ";\nconst SECTIONS=" + JSON.stringify(data.sections) + ";\n");
