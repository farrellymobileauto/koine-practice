// Two-column CSV: english, greek
import { hasGreek } from "./greek.js";

export function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/)[0] || "";
  const delim = [",", ";", "\t"].sort((a, b) => count(firstLine, b) - count(firstLine, a))[0];
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}
const count = (s, ch) => s.split(ch).length - 1;

/** Returns [{english, greek}] — tolerates a header row and swapped columns. */
export function rowsToPairs(rows) {
  if (!rows.length) return [];
  if (/english/i.test(rows[0].join(" ")) || /greek/i.test(rows[0].join(" "))) rows = rows.slice(1);
  return rows
    .map((r) => {
      // If more than 2 columns, the greek may contain unquoted commas ("λόγος, -ου, ὁ").
      let english = r[0] || "", greek = r.slice(1).join(", ");
      if (hasGreek(english) && !hasGreek(greek)) { const g = english; english = r.slice(1).join(", "); greek = g; }
      return { english: english.trim(), greek: greek.trim() };
    })
    .filter((p) => p.greek && p.english);
}

const esc = (s) => (/[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
export function toCSV(pairs) {
  return "﻿" + ["english,greek", ...pairs.map((p) => esc(p.english) + "," + esc(p.greek))].join("\r\n") + "\r\n";
}
