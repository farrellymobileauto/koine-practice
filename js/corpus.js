// Verses from the THGNT (with BSB English) and Brenton's Septuagint (Greek + English), in one shape.
import { LEX, loadNT } from "./data.js";
import { normalize } from "./greek.js";
import { profile } from "./store.js";

// Deuterocanonical / apocryphal books (Profile → "Include apocrypha").
// Deuterocanonical books of the Catholic Old Testament. (Books outside the Catholic canon are not in the data at all.)
export const APOCRYPHA = new Set(["Tob", "Jdt", "1Macc", "2Macc", "Wis", "Sir", "Bar", "EpJer", "Sus", "Bel"]);
export const apocryphaOn = () => profile().apocrypha !== false;
/** LXX books the user wants to see (with at least one usable verse). */
export function lxxBooksVisible() {
  return (LXX?.books || []).filter((b) => b.kept > 0 && (apocryphaOn() || !APOCRYPHA.has(b.id)));
}

// Septuagint: Brenton's Greek text with Brenton's English.
// verse = { id, corpus: "nt"|"lxx", book, bookName, c, v, label, toks: [{ w, lx, ll, m, g, pn }], en }

let enNT = null;
export function loadEnNT() { return (enNT ||= fetch("data/en-nt.json").then((r) => r.json())); }

let lxxIndex = null;
export let LXX = null; // { books, m, lex: [[g, e, f, ntIndex, pn]] }
export function loadLXXIndex() {
  return (lxxIndex ||= fetch("data/lxx/index.json").then((r) => r.json()).then((d) => (LXX = d)));
}
const lxxBooks = new Map();
export function loadLXXBook(id) {
  if (!lxxBooks.has(id)) lxxBooks.set(id, Promise.all([loadLXXIndex(), fetch(`data/lxx/${encodeURIComponent(id)}.json`).then((r) => r.json())]).then(([, b]) => b));
  return lxxBooks.get(id);
}

const LXX_LABEL = { Ps: "Psalm" };
export function lxxBookName(id) { return LXX?.books.find((b) => b.id === id)?.n || id; }

function ntVerse(nt, en, bi, c, v) {
  const b = nt.books[bi];
  const toks = b.c[c - 1]?.[v - 1];
  if (!toks?.length) return null;
  return {
    id: `nt:${b.b}.${c}.${v}`, corpus: "nt", book: b.b, bookName: b.n, c, v, label: `${b.n} ${c}:${v}`,
    toks: toks.map((t) => ({ w: t[0], lx: t[1], ll: -1, m: nt.m[t[2]], g: nt.g[t[3]] || "", pn: LEX[t[1]].pn })),
    en: en?.[b.b]?.[c - 1]?.[v - 1] || "",
  };
}

function lxxVerse(bookId, data, c, v) {
  const toks = data.c[c - 1]?.[v - 1];
  if (!toks) return null;
  const name = lxxBookName(bookId);
  return {
    id: `lxx:${bookId}.${c}.${v}`, corpus: "lxx", book: bookId, bookName: name, c, v, label: `${LXX_LABEL[bookId] || name} ${c}:${v} (LXX)`,
    toks: toks.map((t) => {
      const l = LXX.lex[t[1]];
      return { w: t[0], lx: l[3], ll: t[1], m: LXX.m[t[2]], g: l[3] >= 0 ? LEX[l[3]].e : l[1], pn: l[4] || (l[3] >= 0 && LEX[l[3]].pn) ? 1 : 0 };
    }),
    en: data.en[c - 1]?.[v - 1] || "",
  };
}

/** Load one verse by id ("nt:Jhn.3.16" or "lxx:Ps.22.1"). */
export async function getVerse(id) {
  const [corpus, ref] = id.split(":");
  const [book, c, v] = ref.split(".");
  if (corpus === "nt") {
    const [nt, en] = await Promise.all([loadNT(), loadEnNT()]);
    const bi = nt.books.findIndex((b) => b.b === book);
    return bi < 0 ? null : ntVerse(nt, en, bi, +c, +v);
  }
  const data = await loadLXXBook(book);
  return lxxVerse(book, data, +c, +v);
}

/** Share of the non-name words the user knows. */
export function coverage(verse, known) {
  let k = 0, n = 0;
  for (const t of verse.toks) {
    if (t.pn) continue;
    n++;
    if (t.lx >= 0 && known.has(LEX[t.lx].id)) k++;
  }
  return n ? k / n : 0;
}

export const LEVELS = { easy: [0.9, 1.01], medium: [0.75, 0.9], hard: [0, 0.75], any: [0, 1.01] };
export const LENGTHS = { short: [3, 10], medium: [11, 20], long: [21, 999], any: [3, 999] };

function rng(seed) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1e6) / 1e6; };
}

/**
 * Pick a verse. opts: { corpus: "nt"|"lxx"|"both", book, level, length, known (Set), exclude (Set of ids), seed }
 * Falls back to looser settings when nothing matches.
 */
export async function pickVerse(opts) {
  const rand = opts.seed != null ? rng(opts.seed) : Math.random;
  const corpus = opts.corpus === "both" ? (rand() < 0.5 ? "nt" : "lxx") : opts.corpus || "nt";
  const tries = [
    [opts.level, opts.length], [opts.level, "any"], ["any", opts.length], ["any", "any"],
  ];
  for (const [level, length] of tries) {
    const v = corpus === "nt" ? await pickNT(opts, level, length, rand) : await pickLXX(opts, level, length, rand);
    if (v) return { verse: v, relaxed: level !== opts.level || length !== opts.length };
  }
  return { verse: null };
}

function fits(verse, opts, level, length) {
  if (opts.exclude?.has(verse.id)) return false;
  const [lmin, lmax] = LENGTHS[length || "any"];
  if (verse.toks.length < lmin || verse.toks.length > lmax) return false;
  const names = verse.toks.filter((t) => t.pn).length;
  if (verse.toks.length - names < 4 || names / verse.toks.length > 0.3) return false; // skip name lists
  const [cmin, cmax] = LEVELS[level || "any"];
  const cov = coverage(verse, opts.known);
  return cov >= cmin && cov < cmax;
}

async function pickNT(opts, level, length, rand) {
  const [nt, en] = await Promise.all([loadNT(), loadEnNT()]);
  const pool = [];
  nt.books.forEach((b, bi) => {
    if (opts.book && opts.book !== b.b) return;
    b.c.forEach((vs, ci) => vs.forEach((toks, vi) => {
      if (!toks?.length) return;
      const v = { id: `nt:${b.b}.${ci + 1}.${vi + 1}`, toks: toks.map((t) => ({ lx: t[1], pn: LEX[t[1]].pn })) };
      if (fits(v, opts, level, length)) pool.push([bi, ci + 1, vi + 1]);
    }));
  });
  if (!pool.length) return null;
  const [bi, c, v] = pool[Math.floor(rand() * pool.length)];
  return ntVerse(nt, en, bi, c, v);
}

async function pickLXX(opts, level, length, rand) {
  await loadLXXIndex();
  let books = opts.book ? LXX.books.filter((b) => b.id === opts.book) : lxxBooksVisible();
  for (let attempt = 0; attempt < 6 && books.length; attempt++) {
    // weight books by how many usable verses they have
    const total = books.reduce((s, b) => s + b.kept, 0);
    let r = rand() * total, pick = books[0];
    for (const b of books) { r -= b.kept; if (r <= 0) { pick = b; break; } }
    const data = await loadLXXBook(pick.id);
    const pool = [];
    data.c.forEach((vs, ci) => vs.forEach((toks, vi) => {
      if (!toks) return;
      const v = { id: `lxx:${pick.id}.${ci + 1}.${vi + 1}`, toks: toks.map((t) => ({ lx: LXX.lex[t[1]][3], pn: LXX.lex[t[1]][4] })) };
      if (fits(v, opts, level, length)) pool.push([ci + 1, vi + 1]);
    }));
    if (pool.length) {
      const [c, v] = pool[Math.floor(rand() * pool.length)];
      return lxxVerse(pick.id, data, c, v);
    }
    books = books.filter((b) => b !== pick);
  }
  return null;
}

export async function bookOptions(corpus) {
  const out = [];
  if (corpus !== "lxx") { const nt = await loadNT(); out.push(["NT", nt.books.map((b) => ["nt:" + b.b, b.n])]); }
  if (corpus !== "nt") {
    await loadLXXIndex();
    const vis = lxxBooksVisible();
    out.push(["Septuagint", vis.filter((b) => !APOCRYPHA.has(b.id)).map((b) => ["lxx:" + b.id, b.n])]);
    const ap = vis.filter((b) => APOCRYPHA.has(b.id));
    if (ap.length) out.push(["Apocrypha", ap.map((b) => ["lxx:" + b.id, b.n])]);
  }
  return out;
}

/** Stable key for a token's lemma (for learned synonyms). */
export function lemmaKey(t) {
  if (t.lx >= 0) return LEX[t.lx].id;
  return "lxx:" + normalize(LXX?.lex[t.ll]?.[0] || t.w);
}
