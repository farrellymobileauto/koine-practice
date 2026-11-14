// Greek text helpers: normalization, typing, comparison, morphology decoding.

const COMBINING = /[̀-ͯ]/g;

/** Strip accents, breathings, iota subscripts, case and punctuation. Final sigma -> σ. */
export function normalize(s) {
  return (s || "")
    .normalize("NFD")
    .replace(COMBINING, "")
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/[^α-ω ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const hasGreek = (s) => /[Ͱ-Ͽἀ-῿]/.test(s || "");

/** Turn a final grave accent into acute (dictionary style). */
export function acute(s) {
  return (s || "").normalize("NFD").replace(/̀/g, "́").normalize("NFC");
}

// Latin -> Greek keyboard map (one key per letter so nothing is ambiguous).
export const TRANSLIT = {
  a: "α", b: "β", g: "γ", d: "δ", e: "ε", z: "ζ", h: "η", q: "θ", i: "ι", k: "κ", l: "λ", m: "μ",
  n: "ν", c: "ξ", o: "ο", p: "π", r: "ρ", s: "σ", t: "τ", u: "υ", f: "φ", x: "χ", y: "ψ", w: "ω",
};

const GK = "Ͱ-Ͽἀ-῿";
export function transliterate(text) {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const g = TRANSLIT[lower];
    out += g ? (ch === lower ? g : g.toUpperCase()) : ch;
  }
  out = fixSigma(out)
    // "ng", "nk", "nx", "nch" are spelled γγ, γκ, γξ, γχ (εὐαγγέλιον)
    .replace(/ν(?=[γκξχ])/g, "γ").replace(/Ν(?=[γκξχ])/g, "Γ")
    // a word-initial h before a vowel is the rough breathing: "hagios" -> ἁγιος
    .replace(new RegExp(`(^|[^${GK}])[ηΗ]([αεηιουωΑΕΗΙΟΥΩ])`, "g"), (m, pre, v) => pre + v + "̔");
  return out.normalize("NFC");
}

export function fixSigma(s) {
  return s.replace(/σ(?=$|[^Ͱ-Ͽἀ-῿])/g, "ς").replace(/ς(?=[Ͱ-Ͽἀ-῿])/g, "σ");
}

/** Make an <input> accept Latin keys as Greek letters (if enabled). Keeps caret position. */
export function greekInput(input, enabled = true) {
  input.setAttribute("lang", "el");
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");
  if (!enabled) return input;
  input.addEventListener("input", () => {
    const pos = input.selectionStart;
    const before = input.value;
    const v = transliterate(before);
    if (v !== before) {
      input.value = v;
      const p = Math.max(0, pos + (v.length - before.length));
      try { input.setSelectionRange(p, p); } catch {}
    }
  });
  return input;
}

const ARTICLES = new Set(["ο", "η", "το", "οι", "αι", "τα"]);

/**
 * The bare headword of a dictionary entry, normalized: "λόγος, -ου, ὁ", "λόγος -ου ὁ", "ὁ λόγος" -> "λογοσ".
 * Drops genitive endings ("-ου") and articles, but keeps a word that is itself an article or ἤ.
 */
export function headword(entry) {
  const seg = (entry || "").split(",")[0];
  const words = seg.split(/\s+/).filter((w) => w && !/^[-–—‐]/.test(w));
  const norm = words.map((w) => normalize(w)).filter(Boolean);
  const kept = norm.filter((w) => !ARTICLES.has(w));
  return (kept.length ? kept : norm.slice(0, 1)).join(" ");
}

/** All acceptable answers for a Greek headword like "λόγος, -ου, ὁ" or "ὁ λόγος" or "ἀγαπάω / ἀγαπῶ". */
export function headwordVariants(greek) {
  const first = (greek || "").split(",")[0];
  return first.split(/[\/;]| or /).map((v) => headword(v)).filter(Boolean);
}

/** Does a typed answer match the entry? Accents/breathings optional; the article and genitive may be included or left off. */
export function greekMatches(typed, greek) {
  if (!hasGreek(typed)) typed = transliterate(typed || "");
  const variants = [...new Set([...headwordVariants(greek), ...headwordVariants((greek || "").normalize("NFD").replace(/ͅ/g, "ι"))])];
  return (typed || "").split(/[\/;]/).some((part) => { const t = headword(part); return !!t && variants.some((v) => sameNorm(t, v)); });
}

// ---------- tolerant comparison of typed answers ----------
// People type Greek from Latin keys in different ways: this app's chart (q = θ, x = χ, h = η …) or the usual
// transliteration (th, ch, ph, ps, "ng" for γγ, h for the rough breathing). Both are accepted.

const TO_LATIN = Object.fromEntries(Object.entries(TRANSLIT).map(([l, g]) => [g, l]));
const LATIN_OPTIONS = {
  α: ["a"], β: ["b", "v"], γ: ["g"], δ: ["d"], ε: ["e"], ζ: ["z"], η: ["h"], θ: ["q", "th"], ι: ["i", "j"], κ: ["k"],
  λ: ["l"], μ: ["m"], ν: ["n"], ξ: ["c", "x", "ks"], ο: ["o"], π: ["p"], ρ: ["r", "rh"], σ: ["s"], τ: ["t"], υ: ["u", "y"],
  φ: ["f", "ph"], χ: ["x", "ch", "kh"], ψ: ["y", "ps"], ω: ["w"],
};

/** Could these Latin keystrokes spell this (normalized) Greek word? */
function latinSpells(latin, greek) {
  const memo = new Map();
  const go = (i, j) => {
    const k = i * 100 + j;
    if (memo.has(k)) return memo.get(k);
    let ok = false;
    if (j === greek.length) ok = i === latin.length;
    else {
      const g = greek[j];
      const opts = [...(LATIN_OPTIONS[g] || [g])];
      if (g === "γ" && "γκξχ".includes(greek[j + 1] || "")) opts.push("n");
      ok = opts.some((o) => latin.startsWith(o, i) && go(i + o.length, j + 1));
      // optional "h" for a rough breathing on the first letter (ἁγιος = hagios, ῥημα = rhema)
      if (!ok && j === 0 && i === 0 && latin[0] === "h" && "αεηιουωρ".includes(g)) ok = go(1, 0);
    }
    memo.set(k, ok);
    return ok;
  };
  return go(0, 0);
}

function sameWord(t, a) {
  if (t === a) return true;
  const latin = [...t].map((c) => TO_LATIN[c] || "").join("");
  return !!latin && latinSpells(latin, a);
}
/** Compare two normalized strings word by word, tolerating different ways of typing. */
function sameNorm(t, a) {
  const tw = t.split(" "), aw = a.split(" ");
  return tw.length === aw.length && tw.every((w, i) => sameWord(w, aw[i]));
}

/** Is a typed Greek form the same as the answer? (accents optional, either typing style) */
export function greekEqual(typed, answer) {
  if (!hasGreek(typed)) typed = transliterate(typed || "");
  const t = normalize(typed);
  return !!t && answerForms(answer).some((a) => sameNorm(t, a));
}

/** The normalized answer, plus a version with any iota subscript written as a full ι (λόγῳ = λογω or λογωι). */
function answerForms(answer) {
  const a = normalize(answer);
  const adscript = normalize((answer || "").normalize("NFD").replace(/ͅ/g, "ι"));
  return adscript !== a ? [a, adscript] : [a];
}

// ---------- Morphology (Robinson codes as used by STEPBible TAGNT) ----------

const CASE = { N: "nominative", G: "genitive", D: "dative", A: "accusative", V: "vocative" };
const NUM = { S: "singular", P: "plural" };
const GEN = { M: "masculine", F: "feminine", N: "neuter" };
const TENSE = { P: "present", I: "imperfect", F: "future", A: "aorist", R: "perfect", L: "pluperfect" };
const VOICE = { A: "active", M: "middle", P: "passive", E: "middle/passive", D: "middle (deponent)", O: "passive (deponent)", N: "middle/passive (deponent)" };
const MOOD = { I: "indicative", S: "subjunctive", O: "optative", M: "imperative", N: "infinitive", P: "participle" };
const PERSON = { 1: "1st", 2: "2nd", 3: "3rd" };

const POS_NAMES = {
  N: "noun", A: "adjective", T: "article", P: "personal pronoun", R: "relative pronoun", C: "reciprocal pronoun",
  D: "demonstrative pronoun", K: "correlative pronoun", I: "interrogative pronoun", X: "indefinite pronoun",
  Q: "correlative/interrogative pronoun", F: "reflexive pronoun", S: "possessive pronoun", V: "verb",
  PREP: "preposition", CONJ: "conjunction", COND: "conditional", ADV: "adverb", PRT: "particle", INJ: "interjection",
  ARAM: "Aramaic word", HEB: "Hebrew word",
};

function cng(s) {
  // e.g. "NSM", "GPF", or with person "1GS"
  const out = [];
  let rest = s;
  if (/^[123]/.test(rest)) { out.push(PERSON[rest[0]] + " person"); rest = rest.slice(1); }
  if (CASE[rest[0]]) out.push(CASE[rest[0]]);
  if (NUM[rest[1]]) out.push(NUM[rest[1]]);
  if (GEN[rest[2]]) out.push(GEN[rest[2]]);
  return out;
}

/** Decode a morphology code into { pos, parts: {...}, text } */
export function decodeMorph(code) {
  if (!code) return { pos: "", parts: {}, text: "" };
  const seg = code.split("-");
  const head = seg[0];
  const parts = {};
  let pieces = [];
  if (head === "V" && seg[1]) {
    let tvm = seg[1];
    let second = false;
    if (tvm[0] === "2") { second = true; tvm = tvm.slice(1); }
    parts.tense = tvm[0]; parts.voice = tvm[1]; parts.mood = tvm[2];
    pieces.push((second ? "2nd " : "") + (TENSE[tvm[0]] || ""), VOICE[tvm[1]] || "", MOOD[tvm[2]] || "");
    const pn = seg[2];
    if (pn) {
      if (/^[123][SP]$/.test(pn)) {
        parts.person = pn[0]; parts.number = pn[1];
        pieces.push(`${PERSON[pn[0]]} person ${NUM[pn[1]]}`);
      } else {
        parts.case = pn[0]; parts.number = pn[1]; parts.gender = pn[2];
        pieces.push(cng(pn).join(" "));
      }
    }
    return { pos: "verb", parts, text: pieces.filter(Boolean).join(" ") };
  }
  const posName = POS_NAMES[head] || head.toLowerCase();
  if (seg[1] && /^[123]?[NGDAV][SP][MFN]?/.test(seg[1])) {
    const c = seg[1];
    const off = /^[123]/.test(c) ? 1 : 0;
    if (off) parts.person = c[0];
    parts.case = c[off]; parts.number = c[off + 1]; parts.gender = c[off + 2];
    pieces = cng(c);
  } else if (seg[1] && head === "S") {
    // possessive pronoun e.g. S-1SNSM
    pieces = [];
  }
  const extra = [];
  if (seg.includes("P") && head === "N") extra.push("person's name");
  if (seg.includes("L") && head === "N") extra.push("place name");
  if (seg.includes("C")) extra.push("comparative");
  if (seg.includes("S") && head === "A") extra.push("superlative");
  if (seg.includes("N") && (head === "PRT" || head === "ADV")) extra.push("negative");
  return { pos: posName, parts, text: [posName, pieces.join(" "), extra.join(", ")].filter(Boolean).join(", ") };
}

// ---------- English keyword matching (used by the verse of the day check) ----------

const STOP = new Set("a an the of to in on at by for with from and or but is are was were be been being am it its he she they them his her their this that these those who whom which what as into upon so not no do does did has have had will shall would should may might can could let i you we me us my our your ye thee thou thy also then there here".split(" "));

export function stem(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ied")) w = w.slice(0, -3) + "y";
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

export function contentWords(text) {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z']+/)
    .map((w) => w.replace(/'s$/, "").replace(/'/g, ""))
    .filter((w) => w && !STOP.has(w));
}
