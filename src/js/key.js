// The wine key: producer plus cuvée, lower-cased, accents and punctuation removed, spaces collapsed.
// Vintage is not part of it, so notes survive a vintage change. Must match key() in tools/seed-to-study.py.
export function wineKey(producer, cuvee) {
  return normalise((producer || "") + " " + (cuvee || ""));
}

export function normalise(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// A list of keys in one study-sheet cell, separated by semicolons, commas or line breaks.
// Each is normalised the same way as a key, so capitals and accents typed by hand still match.
export function keyList(cell) {
  return String(cell || "").split(/[;,\n]/).map(normalise).filter(Boolean);
}

export function slug(key) {
  return key.replace(/ /g, "-");
}
