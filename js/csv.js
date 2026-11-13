// CSV reading, taken from parseCSV/toRows in apricity-mocks/src/menu.html so both sites read sheets the same way.
// Handles quoted commas, doubled quotes and line breaks inside quotes.
export function parseCSV(text) {
  var rows = [], row = [], cell = "", q = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Rows become objects keyed by the lower-case column heading. Blank rows are left out.
export function toRows(text) {
  var all = parseCSV(text.replace(/^﻿/, ""));
  var head = (all.shift() || []).map(function (h) { return h.trim().toLowerCase(); });
  return all.map(function (r) {
    var o = {};
    head.forEach(function (h, i) { o[h] = (r[i] || "").trim(); });
    return o;
  }).filter(function (o) {
    return Object.keys(o).some(function (k) { return o[k]; });
  });
}

// Reads a column by its heading, ignoring a trailing note in brackets: "Bottle Price (£)" is found as "bottle price".
export function col(row, name) {
  if (name in row) return row[name];
  for (var k in row) if (k.replace(/\s*\(.*\)\s*$/, "") === name) return row[k];
  return "";
}
