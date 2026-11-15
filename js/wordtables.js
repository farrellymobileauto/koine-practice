// Full paradigm tables for one word (Lexicon): NT forms, filled in with generated forms where the
// word follows the regular patterns. Nothing is filled in by a pattern that doesn't reproduce every
// NT form of that word.
import { normalize, fixSigma, formKey } from "./greek.js";
import * as M from "./morph.js";
import { formsByParse, parseKey, withBreathing } from "./generate.js";

const n = (s) => formKey(s);
const CASE_ROWS = [["N", "S", "Nom sg"], ["G", "S", "Gen sg"], ["D", "S", "Dat sg"], ["A", "S", "Acc sg"], ["N", "P", "Nom pl"], ["G", "P", "Gen pl"], ["D", "P", "Dat pl"], ["A", "P", "Acc pl"]];
const PN_ROWS = [["1", "S", "1 sg"], ["2", "S", "2 sg"], ["3", "S", "3 sg"], ["1", "P", "1 pl"], ["2", "P", "2 pl"], ["3", "P", "3 pl"]];
const IMP_ROWS = [["2", "S", "2 sg"], ["3", "S", "3 sg"], ["2", "P", "2 pl"], ["3", "P", "3 pl"]];

/** NT forms of a word: Map(parseKey -> [{form, attested:true}]) */
function attestedMap(lex) {
  const out = new Map();
  for (const [form, li, codes, count] of M.rawForms() || []) {
    if (li !== lex.i) continue;
    for (const p of codes.flatMap((c) => M.codeToParses(c, lex))) {
      const k = parseKey(p);
      if (!out.has(k)) out.set(k, []);
      if (!out.get(k).some((x) => n(x.form) === n(form))) out.get(k).push({ form, attested: true, count });
    }
  }
  for (const list of out.values()) list.sort((a, b) => b.count - a.count); // most common spelling first (ἐγώ before κἀγώ)
  return out;
}

function merge(a, b) {
  const out = new Map(a);
  for (const [k, list] of b || []) {
    const cur = out.get(k) || [];
    for (const x of list) if (!cur.some((y) => n(y.form) === n(x.form))) cur.push(x);
    out.set(k, cur);
  }
  // NT spellings first, most common first
  for (const list of out.values()) list.sort((x, y) => (y.attested ? 1 : 0) - (x.attested ? 1 : 0) || (y.count || 0) - (x.count || 0));
  return out;
}

// ---------- nouns & adjectives: regular 1st/2nd declension endings ----------
const E = {
  o2: ["ος", "ου", "ῳ", "ον", "οι", "ων", "οις", "ους"],
  on2: ["ον", "ου", "ῳ", "ον", "α", "ων", "οις", "α"],
  h1: ["η", "ης", "ῃ", "ην", "αι", "ων", "αις", "ας"],
  apure1: ["α", "ας", "ᾳ", "αν", "αι", "ων", "αις", "ας"],
  amixed1: ["α", "ης", "ῃ", "αν", "αι", "ων", "αις", "ας"],
  hs1: ["ης", "ου", "ῃ", "ην", "αι", "ων", "αις", "ας"],
  as1: ["ας", "ου", "ᾳ", "αν", "αι", "ων", "αις", "ας"],
};

/** Try a set of ending patterns for each gender; keep one only if it reproduces every NT form of that gender. */
function nominalGenerated(lex, attested, pos) {
  const g = n(lex.g);
  const gen = n((lex.h || "").split(",")[0]);
  const plans = []; // [gender, pattern, stem]
  if (pos === "noun") {
    const x = lex.x || "M";
    if (/ος$/.test(g.replace(/σ$/, "ς")) || /οσ$/.test(g)) plans.push([x, "o2", g.slice(0, -2)]);
    if (/ον$/.test(g)) plans.push([x, "on2", g.slice(0, -2)]);
    if (/η$/.test(g)) plans.push([x, "h1", g.slice(0, -1)]);
    if (/α$/.test(g)) plans.push([x, /ησ$/.test(gen) ? "amixed1" : "apure1", g.slice(0, -1)]);
    if (/ησ$/.test(g) && /ου$/.test(gen)) plans.push([x, "hs1", g.slice(0, -2)]);
    if (/ασ$/.test(g) && /ου$/.test(gen)) plans.push([x, "as1", g.slice(0, -2)]);
  } else if (pos === "adjective" && /οσ$/.test(g)) {
    const stem = g.slice(0, -2);
    plans.push(["M", "o2", stem], ["N", "on2", stem]);
    // feminine: -α after ε, ι, ρ; otherwise -η; or 2-2 adjectives whose feminine looks masculine (αἰώνιος)
    plans.push(["F", /[ειρ]$/.test(stem) ? "apure1" : "h1", stem], ["F", "o2", stem]);
  }
  const out = new Map();
  const done = new Set();
  for (const [gender, pat, stem] of plans) {
    if (!stem || done.has(gender)) continue;
    const cells = CASE_ROWS.map(([c, num], i) => ({ p: { pos: pos === "noun" ? "noun" : "adj", case: c, number: num, gender }, f: stem + E[pat][i] }));
    const mine = [...attested.entries()].filter(([k]) => k.includes(`gender=${gender}`) && !k.includes("case=V"));
    const ok = mine.every(([k, list]) => {
      const cell = cells.find((c) => parseKey(c.p) === k);
      return !cell || list.some((x) => n(x.form) === n(cell.f));
    }) && mine.length > 0;
    if (!ok) continue;
    done.add(gender);
    for (const c of cells) out.set(parseKey(c.p), [{ form: withBreathing(fixSigma(c.f), lex.g), attested: false }]);
  }
  return out;
}

// ---------- table builders ----------
const cell = (map, p) => (p.voice === "MP" ? [...(map.get(parseKey({ ...p, voice: "M" })) || []), ...(map.get(parseKey({ ...p, voice: "P" })) || [])] : map.get(parseKey(p)) || [])
  .filter((x, i, arr) => arr.findIndex((y) => n(y.form) === n(x.form)) === i);

function table(title, rows, cols, map, base, rowParse, group) {
  const cells = rows.map((r) => cols.map((c) => cell(map, { pos: "verb", ...base, ...rowParse(r), ...c.p })));
  if (!cells.some((r) => r.some((c) => c.length))) return null;
  const keep = cols.map((_, ci) => cells.some((r) => r[ci].length));
  return { title, group, rows: rows.map((r) => r[r.length - 1]), cols: cols.filter((_, i) => keep[i]).map((c) => c.label), cells: cells.map((r) => r.filter((_, i) => keep[i])) };
}

const V = (label, p) => ({ label, p });
const TENSE_NAME = { P: "Present", I: "Imperfect", F: "Future", A: "Aorist", R: "Perfect" };

export function verbTables(lex) {
  const map = merge(attestedMap(lex), formsByParse(lex.g));
  const pn = (r) => ({ person: r[0], number: r[1] });
  const out = [];
  for (const [t, cols] of [
    ["P", [V("Active", { voice: "A" }), V("Middle/Passive", { voice: "MP" })]],
    ["I", [V("Active", { voice: "A" }), V("Middle/Passive", { voice: "MP" })]],
    ["F", [V("Active", { voice: "A" }), V("Middle", { voice: "M" }), V("Passive", { voice: "P" })]],
    ["A", [V("Active", { voice: "A" }), V("Middle", { voice: "M" }), V("Passive", { voice: "P" })]],
    ["R", [V("Active", { voice: "A" }), V("Middle/Passive", { voice: "MP" })]],
  ]) out.push(table(`${TENSE_NAME[t]} indicative`, PN_ROWS, cols, map, { tense: t, mood: "I" }, pn, "Indicative"));
  const subjCols = [V("Pres. act.", { tense: "P", voice: "A" }), V("Pres. mid/pass.", { tense: "P", voice: "MP" }), V("Aor. act.", { tense: "A", voice: "A" }), V("Aor. mid.", { tense: "A", voice: "M" }), V("Aor. pass.", { tense: "A", voice: "P" })];
  out.push(table("Subjunctive", PN_ROWS, subjCols, map, { mood: "S" }, pn, "Subjunctive"));
  out.push(table("Imperative", IMP_ROWS, subjCols, map, { mood: "M" }, pn, "Imperative"));
  out.push(table("Infinitives", [["P", "Present"], ["F", "Future"], ["A", "Aorist"], ["R", "Perfect"]],
    [V("Active", { voice: "A" }), V("Middle", { voice: "M" }), V("Passive", { voice: "P" })], map, { mood: "N" }, (r) => ({ tense: r[0] }), "Infinitives"));
  for (const [t, v, label] of [["P", "A", "Present active"], ["P", "MP", "Present middle/passive"], ["F", "A", "Future active"], ["A", "A", "Aorist active"], ["A", "M", "Aorist middle"], ["A", "P", "Aorist passive"], ["R", "A", "Perfect active"], ["R", "MP", "Perfect middle/passive"]]) {
    out.push(table(`${label} participle`, CASE_ROWS, [V("Masc", { gender: "M" }), V("Fem", { gender: "F" }), V("Neut", { gender: "N" })], map,
      { tense: t, voice: v, mood: "P" }, (r) => ({ case: r[0], number: r[1] }), "Participles"));
  }
  return out.filter(Boolean);
}

export function nominalTables(lex) {
  const attested = attestedMap(lex);
  const pos = lex.p === "noun" ? "noun" : lex.p === "adjective" ? "adjective" : null;
  const map = pos ? merge(attested, nominalGenerated(lex, attested, pos)) : attested;
  const genders = ["M", "F", "N"].filter((g) => [...map.keys()].some((k) => k.includes(`gender=${g}`)));
  const persons = !genders.length && [...map.keys()].some((k) => /person=[12]/.test(k));
  const cols = genders.length ? genders.map((g) => ({ label: { M: "Masc", F: "Fem", N: "Neut" }[g], g })) : [{ label: lex.g, g: null }];
  const cells = CASE_ROWS.map(([c, num]) => cols.map((col) => {
    const out = [];
    for (const [k, list] of map) {
      if (!k.includes(`case=${c};`) || !k.includes(`number=${num}`)) continue;
      if (col.g && !k.includes(`gender=${col.g}`)) continue;
      for (const x of list) if (!out.some((y) => n(y.form) === n(x.form))) out.push(x);
    }
    return out.sort((x, y) => (y.attested ? 1 : 0) - (x.attested ? 1 : 0) || (y.count || 0) - (x.count || 0));
  }));
  if (!cells.some((r) => r.some((c) => c.length))) return [];
  return [{ title: persons ? "Forms" : "Declension", group: "Declension", rows: CASE_ROWS.map((r) => r[2]), cols: cols.map((c) => c.label), cells }];
}
