// Parsing engine: parse objects, corpus codes -> parses, ambiguity, chapters, categories, drill items.
import { LEX, findLemma, dictForm } from "./data.js";
import { normalize } from "./greek.js";
import { PARADIGMS, cellsOf } from "./paradigms.js";

// A parse: { pos: noun|adj|art|pron|verb, case, number, gender, person, decl, tense, voice, mood, ptype, second, mi }

export const NAMES = {
  case: { N: "nominative", G: "genitive", D: "dative", A: "accusative", V: "vocative" },
  number: { S: "singular", P: "plural" },
  gender: { M: "masculine", F: "feminine", N: "neuter" },
  person: { 1: "1st", 2: "2nd", 3: "3rd" },
  tense: { P: "present", I: "imperfect", F: "future", A: "aorist", R: "perfect" },
  voice: { A: "active", M: "middle", P: "passive" },
  mood: { I: "indicative", S: "subjunctive", M: "imperative", N: "infinitive", P: "participle" },
  decl: { 1: "1st", 2: "2nd", 3: "3rd" },
};
export const SHORT = {
  case: { N: "Nom", G: "Gen", D: "Dat", A: "Acc" },
  number: { S: "Sing", P: "Plur" },
  gender: { M: "Masc", F: "Fem", N: "Neut" },
  person: { 1: "1st", 2: "2nd", 3: "3rd" },
  tense: { P: "Present", I: "Imperfect", F: "Future", A: "Aorist", R: "Perfect" },
  voice: { A: "Active", M: "Middle", P: "Passive" },
  mood: { I: "Indicative", S: "Subjunctive", M: "Imperative", N: "Infinitive", P: "Participle" },
  decl: { 1: "1st", 2: "2nd", 3: "3rd" },
};
export const DIM_LABEL = { case: "Case", number: "Number", gender: "Gender", person: "Person", tense: "Tense", voice: "Voice", mood: "Mood", decl: "Declension" };

/** Which dimensions identify this parse (verbs: simplified, no lexical form). */
export function dimsFor(p, { askDecl = false } = {}) {
  if (p.pos === "verb") {
    if (p.mood === "P") return ["tense", "voice", "mood", "case", "number", "gender"];
    if (p.mood === "N") return ["tense", "voice", "mood"];
    return ["tense", "voice", "mood", "person", "number"];
  }
  const d = ["case", "number"];
  d.push(p.gender ? "gender" : "person");
  if (askDecl && p.pos === "noun" && p.decl) d.push("decl");
  return d;
}

export const keyOf = (p, dims = dimsFor(p)) => dims.map((d) => d + "=" + (p[d] ?? "")).join(";");

export function matches(ans, p, opts) {
  return dimsFor(p, opts).every((d) => ans[d] === p[d]);
}

export function describe(p, { withGender = true } = {}) {
  const n = (dim) => NAMES[dim][p[dim]] || "";
  if (p.pos === "verb") {
    const voice = p.voice === "MP" ? "middle/passive" : n("voice");
    const tense = (p.second && p.tense === "A" ? "2nd " : "") + n("tense");
    const head = [tense, voice, n("mood")].filter(Boolean).join(" ");
    if (p.mood === "P") return `${head}, ${n("case")} ${n("number")} ${n("gender")}`;
    if (p.mood === "N") return head;
    return `${head}, ${n("person")} person ${n("number")}`;
  }
  const bits = [n("case"), n("number")];
  if (p.gender && withGender) bits.push(n("gender"));
  if (!p.gender && p.person) bits.unshift(n("person") + " person");
  return bits.filter(Boolean).join(" ");
}

/** Readable list of parses, merging middle+passive pairs into "middle/passive". */
export function describeAll(parses) {
  const out = [];
  const seen = new Set();
  for (const p of parses) {
    let q = p;
    if (p.pos === "verb" && (p.voice === "M" || p.voice === "P")) {
      const other = parses.find((x) => x !== p && x.voice === (p.voice === "M" ? "P" : "M") && dimsFor(x).every((d) => d === "voice" || x[d] === p[d]));
      if (other) q = { ...p, voice: "MP" };
    }
    const d = describe(q);
    if (!seen.has(d)) { seen.add(d); out.push(d); }
  }
  return out;
}

// ---------- corpus codes ----------
const VOICE_MAP = { A: ["A"], M: ["M"], P: ["P"], E: ["M", "P"], D: ["M"], O: ["P"], N: ["M", "P"] };

export function codeToParses(code, lex) {
  const seg = code.split("-");
  const head = seg[0];
  const lemmaG = lex?.g || "";
  if (head === "V") {
    let tvm = seg[1] || "";
    const second = tvm.startsWith("2");
    if (second) tvm = tvm.slice(1);
    const [t, v, m] = tvm;
    if (!NAMES.tense[t] || !NAMES.mood[m] || !VOICE_MAP[v]) return []; // skips pluperfect, optative
    let voices = VOICE_MAP[v];
    if (["P", "I", "R"].includes(t) && voices.length === 1 && voices[0] !== "A") voices = ["M", "P"]; // same forms
    const rest = seg[2] || "";
    const out = [];
    for (const voice of voices) {
      const p = { pos: "verb", tense: t, voice, mood: m, second: second || undefined, mi: /μι$/.test(lemmaG) || undefined };
      if (m === "P") { if (!/^[NGDA][SP][MFN]$/.test(rest)) continue; Object.assign(p, { case: rest[0], number: rest[1], gender: rest[2] }); }
      else if (m !== "N") { if (!/^[123][SP]$/.test(rest)) continue; Object.assign(p, { person: rest[0], number: rest[1] }); }
      out.push(p);
    }
    return out;
  }
  const c = seg[1] || "";
  const POS = { N: "noun", A: "adj", T: "art", P: "pron", D: "pron", R: "pron", I: "pron" };
  const pos = POS[head];
  if (!pos) return [];
  if (seg.slice(2).some((s) => /^(P|L|PG|LG|T|K)$/.test(s)) && head === "N") return []; // proper names
  let m;
  if (head === "P" && (m = c.match(/^([12])([NGDA])([SP])$/))) return [{ pos, ptype: "pers", person: m[1], case: m[2], number: m[3] }];
  if (!(m = c.match(/^([NGDA])([SP])([MFN])$/))) return [];
  const p = { pos, case: m[1], number: m[2], gender: m[3] };
  if (pos === "noun" && lex?.d) p.decl = lex.d;
  if (head === "P") p.ptype = "autos";
  if (head === "D") p.ptype = "dem";
  if (head === "R") p.ptype = "rel";
  if (head === "I") p.ptype = "int";
  return [p];
}

/** Add parses that are always identical in form (neuter nom = acc; present 2nd pl indicative = imperative). */
export function expandAmbiguity(parses) {
  const out = [...parses];
  for (const p of parses) {
    if (p.gender === "N" && (p.case === "N" || p.case === "A")) out.push({ ...p, case: p.case === "N" ? "A" : "N" });
    // Adjectives, article, pronouns and participles: masculine = neuter in the genitive and dative.
    if (p.pos !== "noun" && (p.gender === "M" || p.gender === "N") && (p.case === "G" || p.case === "D")) out.push({ ...p, gender: p.gender === "M" ? "N" : "M" });
    if (p.pos === "verb" && p.tense === "P" && p.person === "2" && p.number === "P" && (p.mood === "I" || p.mood === "M")) out.push({ ...p, mood: p.mood === "I" ? "M" : "I" });
  }
  return dedupe(out);
}
function dedupe(ps) {
  const seen = new Set();
  return ps.filter((p) => { const k = keyOf(p, ["pos", ...dimsFor(p, { askDecl: true })]); if (seen.has(k)) return false; seen.add(k); return true; });
}

// ---------- chapters & categories ----------
const isContract = (g) => /(άω|έω|όω)$/.test(g || "");

export function chapterFor(p, lemmaG = "") {
  switch (p.pos) {
    case "art": return 7;
    case "noun": return p.decl === 3 ? 11 : p.case === "G" || p.case === "D" ? 8 : 7;
    case "adj": return 10;
    case "pron": return { pers: 12, autos: 13, dem: 14, rel: 15, int: 15 }[p.ptype] || 15;
  }
  const g = lemmaG;
  if (normalize(g) === "ειμι") return p.mood !== "I" ? 31 : p.tense === "P" ? 9 : p.tense === "I" ? 22 : 20;
  if (p.mi || /μι$/.test(g)) return p.mood === "I" ? (normalize(g) === "διδωμι" ? 34 : 35) : 36;
  if (p.mood === "I") {
    if (p.tense === "P") return p.voice === "A" ? (isContract(g) ? 18 : 17) : 19;
    if (p.tense === "F") return p.voice === "P" ? 25 : 20;
    if (p.tense === "I") return 22;
    if (p.tense === "A") return p.voice === "P" ? 25 : p.second ? 23 : 24;
    if (p.tense === "R") return 26;
  }
  if (p.mood === "P") return p.tense === "P" ? 28 : p.tense === "A" ? 29 : 30;
  return { S: 31, N: 32, M: 33 }[p.mood] || 31;
}

export const NOUN_CATS = [["art", "Article"], ["n1", "1st declension"], ["n2", "2nd declension"], ["n3", "3rd declension"], ["adj", "Adjectives"], ["pron", "Pronouns"]];
export const TENSE_CATS = [["P", "Present"], ["I", "Imperfect"], ["F", "Future"], ["A", "Aorist"], ["R", "Perfect"]];
export const MOOD_CATS = [["I", "Indicative"], ["S", "Subjunctive"], ["M", "Imperative"], ["N", "Infinitive"], ["P", "Participle"]];

export function nounCat(p) {
  if (p.pos === "noun") return "n" + (p.decl || 2);
  return p.pos;
}
export function categoryLabel(p) {
  if (p.pos === "verb") return `${NAMES.tense[p.tense]} ${NAMES.mood[p.mood]}`;
  return { art: "the article", n1: "1st declension", n2: "2nd declension", n3: "3rd declension", adj: "adjectives", pron: "pronouns" }[nounCat(p)];
}

// ---------- form index (corpus + paradigms) ----------
let FORMS = null;      // raw forms.json
let INDEX = null;      // "normform|normlemma" -> parses[]
let REVERSE = null;    // "normlemma|parseKey" -> Set(display forms)
let loading = null;

const stripNu = (s) => s.replace("(ν)", "");
const lemmaKey = (g) => normalize(g).replace(/ /g, "");

function addIndex(form, lemmaG, parses) {
  const k = normalize(form) + "|" + lemmaKey(lemmaG);
  const cur = INDEX.get(k) || [];
  INDEX.set(k, dedupe([...cur, ...parses]));
}
function addReverse(lemmaG, p, display) {
  const k = lemmaKey(lemmaG) + "|" + keyOf(p, dimsFor(p, { askDecl: false }));
  if (!REVERSE.has(k)) REVERSE.set(k, new Set());
  REVERSE.get(k).add(display);
}

export function loadForms() {
  if (!loading) loading = fetch("data/forms.json").then((r) => r.json()).then((f) => { FORMS = f; buildIndex(); return FORMS; });
  return loading;
}

function buildIndex() {
  INDEX = new Map();
  REVERSE = new Map();
  for (const [form, li, codes] of FORMS) {
    const lex = LEX[li];
    const ps = expandAmbiguity(codes.flatMap((c) => codeToParses(c, lex)));
    if (!ps.length) continue;
    addIndex(form, lex.g, ps);
    for (const p of ps) addReverse(lex.g, p, form);
  }
  for (const t of PARADIGMS) for (const cell of cellsOf(t)) {
    for (const v of cell.variants) {
      addIndex(v, cell.lemma, expandAmbiguity(cell.parses));
      for (const p of cell.parses) addReverse(cell.lemma, p, v);
    }
  }
}

export function validParses(form, lemmaG) {
  return INDEX?.get(normalize(form) + "|" + lemmaKey(lemmaG)) || [];
}
export function formsFor(lemmaG, p) {
  if (p.voice === "MP") return [...new Set([...formsFor(lemmaG, { ...p, voice: "M" }), ...formsFor(lemmaG, { ...p, voice: "P" })])];
  return [...(REVERSE?.get(lemmaKey(lemmaG) + "|" + keyOf(p, dimsFor(p))) || [])];
}

/** For production prompts: merge a middle+passive pair into one "middle/passive" target. */
export function productionTarget(parses) {
  const p = parses[0];
  if (p.pos === "verb" && p.voice !== "A" && ["P", "I", "R"].includes(p.tense)) return { ...p, voice: "MP" };
  return p;
}

// ---------- drill items ----------
// item: { form, lemma (greek), lex (lexicon entry or null), parses[], ref?, source: "paradigm"|"real", table? }

export function paradigmItems() {
  const items = [];
  for (const t of PARADIGMS) for (const cell of cellsOf(t)) {
    const v = cell.variants[Math.floor(Math.random() * cell.variants.length)];
    const target = cell.parses.length > 1 ? { ...cell.parses[0], voice: "MP" } : cell.parses[0];
    items.push({ form: v, lemma: cell.lemma, lex: findLemma(cell.lemma), parses: validParses(v, cell.lemma), target, source: "paradigm", table: t, answers: cell.variants });
  }
  return items;
}

export function realItems({ minLemmaFreq = 10 } = {}) {
  const items = [];
  for (const [form, li, codes, count, ref] of FORMS) {
    const lex = LEX[li];
    if (lex.pn || lex.f < minLemmaFreq) continue;
    const parses = validParses(form, lex.g);
    if (!parses.length) continue;
    const own = expandAmbiguity(codes.flatMap((c) => codeToParses(c, lex)));
    if (!own.length) continue;
    items.push({ form, lemma: lex.g, lex, parses, target: own[0], source: "real", ref, count });
  }
  return items;
}

/** Filter items by mode ("nouns"|"verbs"), chapter limit, and category selections. */
export function filterItems(items, { mode, maxCh = 36, nounCats = null, tenses = null, moods = null }) {
  return items.filter((it) => {
    // only the readings taught by this chapter count
    const ps = it.parses.filter((p) => (mode === "verbs" ? p.pos === "verb" : p.pos !== "verb") && chapterFor(p, it.lemma) <= maxCh);
    if (!ps.length) return false;
    if (mode === "verbs") {
      // every reading must fit the selected tenses/moods, so e.g. λύσω (future or aorist subjunctive)
      // doesn't appear when aorist is switched off
      return ps.every((p) => (!tenses || tenses.includes(p.tense)) && (!moods || moods.includes(p.mood)));
    }
    return ps.some((p) => !nounCats || nounCats.includes(nounCat(p)));
  });
}

/** Pick n items, mixing sources and favouring common forms. */
export function sample(items, n) {
  const pool = items.map((it) => ({ it, w: Math.random() ** (1 / Math.sqrt((it.count || 4) + 1)) }));
  pool.sort((a, b) => b.w - a.w);
  const seen = new Set();
  const out = [];
  for (const { it } of pool) {
    const k = normalize(it.form) + it.lemma;
    if (seen.has(k)) continue;
    seen.add(k); out.push(it);
    if (out.length >= n) break;
  }
  return out;
}

let ARTICLE = null;
/** The article form that goes with a noun/adjective parse (e.g. G S M -> τοῦ), or null. */
export function articleFor(p) {
  if (!p || !p.gender || !p.case || !p.number || !["noun", "adj"].includes(p.pos)) return null;
  if (!ARTICLE) {
    ARTICLE = {};
    for (const c of cellsOf(PARADIGMS.find((t) => t.id === "article"))) { const q = c.parses[0]; ARTICLE[q.case + q.number + q.gender] = c.display; }
  }
  const a = ARTICLE[p.case + p.number + p.gender];
  // before a noun, an acute on the article becomes grave (τόν -> τὸν); circumflexes stay (τῆς)
  return a ? a.normalize("NFD").replace(/́/g, "̀").normalize("NFC") : null;
}

/** Best paradigm table to show for a parse. */
export function paradigmFor(p, lemmaG) {
  const fits = (t) => {
    const tp = t.parse;
    if (tp.pos !== p.pos) return false;
    for (const k of ["tense", "mood", "decl", "ptype"]) if (tp[k] && p[k] && tp[k] !== p[k]) return false;
    if (tp.gender && p.gender && p.pos === "noun" && tp.gender !== p.gender) return false;
    if (p.pos === "verb") {
      const cols = t.cols.map((c) => c.parse);
      if (!cols.some((c) => (!c.tense || c.tense === p.tense) && (!c.voice || c.voice === p.voice || c.voice === "MP" && p.voice !== "A"))) return false;
    }
    return true;
  };
  const lk = lemmaKey(lemmaG);
  if (p.pos === "noun") {
    // prefer a model noun with the same ending (πίστις -> πόλις)
    const same = PARADIGMS.filter(fits).sort((a, b) => common(lemmaKey(b.lemma), lk) - common(lemmaKey(a.lemma), lk));
    if (same.length) return same[0];
  }
  return PARADIGMS.find((t) => fits(t) && [t.lemma, ...t.cols.map((c) => c.lemma)].some((l) => l && lemmaKey(l) === lk))
    || PARADIGMS.find((t) => fits(t) && (p.pos !== "verb" || t.lemma === "λύω" || p.mi && /μι$/.test(t.lemma)))
    || PARADIGMS.find(fits) || null;
}

function common(a, b) { let n = 0; while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++; return n; }

export { dictForm };
