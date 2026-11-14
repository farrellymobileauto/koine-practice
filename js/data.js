// Static Greek data built by tools/build_data.py from STEPBible (CC BY 4.0).
import { normalize, headword } from "./greek.js";

export let LEX = [];            // [{id,g,e,p,f,h,x,pn}] sorted by frequency (index = rank)
export const LEX_BY_ID = new Map();
export const ALIAS = new Map();      // old duplicate id -> merged id
const BY_NORM = new Map();      // normalized lemma -> [lexicon index]
export let TOTAL_TOKENS = 0;
let ntPromise = null;
let placementPromise = null;

export async function loadLexicon() {
  const res = await fetch("data/lexicon.json");
  LEX = await res.json();
  LEX.forEach((l, i) => {
    l.i = i;
    LEX_BY_ID.set(l.id, l);
    for (const a of l.a || []) { LEX_BY_ID.set(a, l); ALIAS.set(a, l.id); } // merged duplicate entries
    const n = normalize(l.g);
    if (!BY_NORM.has(n)) BY_NORM.set(n, []);
    BY_NORM.get(n).push(i);
    TOTAL_TOKENS += l.f;
  });
}

/** Find the most frequent lexicon entry whose lemma matches (accent-insensitive). */
export function findLemma(greek) {
  const hits = BY_NORM.get(headword(greek));
  return hits ? LEX[hits[0]] : null;
}

/** Full dictionary form, e.g. "λόγος, -ου, ὁ" */
export function dictForm(l) {
  if (!l) return "";
  return l.h ? `${l.g}, ${l.h}` : l.g;
}

export function loadNT() {
  if (!ntPromise) ntPromise = fetch("data/nt.json").then((r) => r.json());
  return ntPromise;
}

export function loadPlacement() {
  if (!placementPromise) placementPromise = fetch("data/placement.json").then((r) => r.json());
  return placementPromise;
}

export function refLabel(nt, bi, c, v) {
  return `${nt.books[bi].n} ${c}:${v}`;
}

/** Parse "Jhn.3.16" into a readable label without needing nt.json. */
const BOOK_NAMES = { Mat: "Matthew", Mrk: "Mark", Luk: "Luke", Jhn: "John", Act: "Acts", Rom: "Romans", "1Co": "1 Corinthians", "2Co": "2 Corinthians", Gal: "Galatians", Eph: "Ephesians", Php: "Philippians", Col: "Colossians", "1Th": "1 Thessalonians", "2Th": "2 Thessalonians", "1Ti": "1 Timothy", "2Ti": "2 Timothy", Tit: "Titus", Phm: "Philemon", Heb: "Hebrews", Jas: "James", "1Pe": "1 Peter", "2Pe": "2 Peter", "1Jn": "1 John", "2Jn": "2 John", "3Jn": "3 John", Jud: "Jude", Rev: "Revelation" };
export function prettyRef(r) {
  const [b, c, v] = (r || "").split(".");
  return BOOK_NAMES[b] ? `${BOOK_NAMES[b]} ${c}:${v}` : r;
}

export const MOUNCE = [
  [1, "The Greek language"], [2, "Learning Greek"], [3, "The alphabet & pronunciation"], [4, "Punctuation & syllabification"],
  [5, "Introduction to English nouns"], [6, "Introduction to Greek nouns"], [7, "Nominative & accusative; article"],
  [8, "Genitive & dative"], [9, "Prepositions & εἰμί"], [10, "Adjectives"], [11, "Third declension"],
  [12, "1st & 2nd person personal pronouns"], [13, "αὐτός"], [14, "Demonstrative pronouns/adjectives"],
  [15, "Relative pronoun"], [16, "Introduction to verbs"], [17, "Present active indicative"], [18, "Contract verbs"],
  [19, "Present middle/passive indicative"], [20, "Future active/middle indicative"], [21, "Verbal roots"],
  [22, "Imperfect indicative"], [23, "Second aorist"], [24, "First aorist"], [25, "Aorist & future passive"],
  [26, "Perfect indicative"], [27, "Introduction to participles"], [28, "Present (adverbial) participles"],
  [29, "Aorist (adverbial) participles"], [30, "Adjectival participles"], [31, "Subjunctive"], [32, "Infinitive"],
  [33, "Imperative"], [34, "Indicative of δίδωμι"], [35, "Other μι verbs"], [36, "Nonindicative μι verbs"],
];
export const mounceTitle = (ch) => (MOUNCE.find((m) => m[0] === ch) || [0, ""])[1];
