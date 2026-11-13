// Prepositions by case (standard first-year meanings, as taught in Mounce ch. 9 and onward).
// Each entry: lemma -> { case: meaning }. Cases: G genitive, D dative, A accusative.
import { LEX_BY_ID, findLemma } from "./data.js";

export const PREPOSITIONS = [
  ["ἐν", { D: "in, on, among" }],
  ["εἰς", { A: "into, in, among" }],
  ["ἐκ", { G: "from, out of" }],
  ["ἐπί", { G: "on, over, when", D: "on the basis of, at", A: "on, to, against" }],
  ["πρός", { A: "to, toward, with" }],
  ["διά", { G: "through", A: "on account of, because of" }],
  ["ἀπό", { G: "(away) from" }],
  ["κατά", { G: "down from, against", A: "according to, throughout, during" }],
  ["μετά", { G: "with", A: "after" }],
  ["περί", { G: "concerning, about", A: "around" }],
  ["παρά", { G: "from", D: "beside, in the presence of", A: "alongside" }],
  ["ὑπό", { G: "by", A: "under" }],
  ["ὑπέρ", { G: "on behalf of", A: "above" }],
  ["σύν", { D: "with" }],
  ["πρό", { G: "before" }],
  ["ἀντί", { G: "instead of, for" }],
  // "improper" prepositions (adverbs used as prepositions), all with the genitive
  ["ἕως", { G: "until, as far as" }],
  ["ἐνώπιον", { G: "before, in the presence of" }],
  ["ἔξω", { G: "outside" }],
  ["ἔμπροσθεν", { G: "in front of, before" }],
  ["ὀπίσω", { G: "behind, after" }],
  ["χωρίς", { G: "without, apart from" }],
  ["ἄχρι", { G: "until, as far as" }],
];

export const CASE_NAME = { G: "genitive", D: "dative", A: "accusative" };
export const CASE_ABBR = { G: "gen.", D: "dat.", A: "acc." };

let built = null;
/** [{ id: "P:<lemmaId>:<case>", lex, lemma, case, meaning }] in frequency order */
export function prepCards() {
  if (built) return built;
  built = [];
  for (const [g, cases] of PREPOSITIONS) {
    const lex = findLemma(g);
    if (!lex) continue;
    for (const [c, meaning] of Object.entries(cases)) built.push({ id: `P:${lex.id}:${c}`, lex, lemma: g, case: c, meaning });
  }
  built.sort((a, b) => b.lex.f - a.lex.f);
  return built;
}

/** Virtual vocab word for a "P:" id. */
export function prepWord(id) {
  const [, lid, c] = id.split(":");
  const lex = LEX_BY_ID.get(lid);
  const entry = PREPOSITIONS.find(([g]) => lex && findLemma(g)?.id === lid);
  if (!lex || !entry || !entry[1][c]) return null;
  return { id, lemma: lex.id, greek: `${lex.g} + ${CASE_NAME[c]}`, english: entry[1][c], pos: "preposition", freq: lex.f, lex, prepCase: c };
}

/** Meanings by case for a lexicon entry (or null if it isn't one of the prepositions above). */
export function meaningsFor(lex) {
  if (!lex) return null;
  const e = PREPOSITIONS.find(([g]) => findLemma(g)?.id === lex.id);
  return e ? e[1] : null;
}

/** Better one-line glosses for tap-to-gloss and grading (replaces the lexicon's short gloss). */
export function applyPrepGlosses() {
  for (const [g, cases] of PREPOSITIONS) {
    const lex = findLemma(g);
    if (!lex) continue;
    lex.e = Object.entries(cases).map(([c, m]) => (Object.keys(cases).length > 1 ? `${m} (+${CASE_ABBR[c]})` : m)).join("; ");
    lex.prep = cases;
  }
}
