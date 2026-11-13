// Keyword grading for translations: does each important Greek word's meaning show up in the English?
import { LEX } from "./data.js";
import { stem, contentWords } from "./greek.js";
import { lemmaKey } from "./corpus.js";

// Groups of words that count as the same meaning. Each word is stemmed when the map is built.
const GROUPS = [
  "all every everyone everything whoever whole any anyone each", "thus so likewise way manner", "god lord deity", "lord master sir owner",
  "servant slave bondservant", "say said says saying tell told speak spoke spoken talk declare reply answer", "word message saying",
  "go went gone come came depart leave", "come came arrive approach", "see saw seen behold look perceive notice watch", "behold look lo see",
  "know knew known understand recognize", "give gave given grant offer", "make made create created do did done", "holy sacred saint",
  "man person human people men mankind", "woman wife", "husband man", "brother brothers brethren sibling", "sin sins sinned wrongdoing",
  "heaven heavens sky", "earth land ground world", "world earth", "glory honor splendor", "love loved beloved", "dear beloved",
  "life live living alive", "die died death dead perish", "kill slay murder", "king ruler", "kingdom reign", "city town",
  "house home household family", "son child", "child children kid", "father dad", "mother", "daughter girl", "boy lad young",
  "spirit wind breath", "heart mind", "soul life self", "flesh body", "blood", "faith belief trust believe", "believe trust",
  "hope expect", "grace favor kindness", "peace", "mercy compassion pity", "righteous just upright", "righteousness justice",
  "wicked evil bad", "good kind fine noble", "great big large mighty", "small little least", "many much numerous",
  "fear afraid frightened terrified", "joy rejoice glad gladness", "sorrow grief grieve mourn weep cry", "pray prayer ask request",
  "ask question inquire request", "call called name summon", "send sent", "take took taken receive received", "receive accept welcome",
  "bring brought carry lead", "lead led guide", "hear heard listen", "obey keep", "keep guard watch observe", "write wrote written",
  "read", "teach taught teacher", "learn learned disciple", "disciple follower student", "apostle messenger", "angel messenger",
  "prophet", "priest", "temple sanctuary", "law commandment", "commandment command order instruction", "command order",
  "truth true truly", "truly amen indeed", "light", "darkness dark", "water", "bread food loaf", "eat ate eaten", "drink drank",
  "sea lake", "mountain mount hill", "road way path journey", "day today", "night", "hour time", "time season", "now present",
  "after behind", "before front", "with together", "against", "into in", "out from", "upon on over", "under below beneath",
  "through", "because since for", "if", "not no never", "nothing none no", "also too even", "again", "first", "last end",
  "end goal finish", "begin beginning start", "rise arise raise risen raised stand", "stand stood", "sit sat seated",
  "save saved salvation rescue deliver", "salvation deliverance", "judge judgment condemn", "forgive forgiveness release",
  "power strength might ability", "able can could", "will want wish desire", "must necessary", "seek search look", "find found",
  "open opened", "close shut", "fall fell", "throw cast", "fill filled full", "eye eyes", "hand hands", "foot feet", "mouth",
  "face presence", "voice sound", "nation gentile people", "people crowd multitude", "crowd multitude", "gospel good news",
  "preach proclaim announce", "baptize baptise baptism", "pass", "remain stay abide dwell", "dwell live inhabit", "build built",
  "sanctify consecrate", "worship bow", "bless blessed praise", "curse cursed", "wise wisdom", "fool foolish",
  "death die", "shepherd tend", "flock sheep", "lamb sheep", "fruit crop", "tree wood", "rest repose", "place spot",
  "other another different else", "perceive know see understand", "vessel jar container utensil baggage goods",
  "toward to into unto", "from away out", "among in within between", "before front presence sight", "upon on onto",
  "because since for therefore", "therefore so then thus", "but however yet", "until till", "when while as",
  "beginning start origin", "word thing matter", "nothing none naught", "lack want need", "rebel rebellious provoke provoking",
  "people nation tribe", "enemy foe", "battle war fight", "sword", "gold", "silver money", "offer sacrifice offering",
  "altar", "tent tabernacle dwelling", "cry shout call", "wrath anger fury", "sing song", "praise glorify bless", "forever ever eternal age",
];
const SYN = new Map();
for (const g of GROUPS) {
  const ws = g.split(" ").map(stem);
  for (const w of ws) { if (!SYN.has(w)) SYN.set(w, new Set()); for (const x of ws) SYN.get(w).add(x); }
}

const SKIP_POS = new Set(["article", "conjunction", "particle"]);
const WEAK = ["the", "a", "an", "to", "of", "be", "one", "who"];
const allWords = (s) => (s || "").toLowerCase().split(/[^a-z']+/).map((w) => w.replace(/'s$/, "").replace(/'/g, "")).filter(Boolean);

function posOf(t) {
  if (t.lx >= 0) return LEX[t.lx].p;
  const h = (t.m || "").split("-")[0];
  return { T: "article", CONJ: "conjunction", PRT: "particle", P: "pronoun", D: "pronoun", R: "pronoun" }[h] || "other";
}

/**
 * Grade a translation. learned: { [lemmaKey]: [stems] } of synonyms the user taught.
 * Each result: { i, state: ok|miss|skip|name|unknown, keys }
 */
export function grade(text, verse, learned = {}) {
  const words = allWords(text);
  const have = new Set(words.map(stem));
  const results = verse.toks.map((t, i) => {
    const pos = posOf(t);
    if (t.pn) return { i, state: "name" };
    const ctx = t.g || "";
    if (SKIP_POS.has(pos) || (pos === "pronoun" && /^(he|she|it|they|him|her|them|his|its|their|self|you|i|me|we|us|my|your|our)\b/i.test(ctx.trim() || (t.lx >= 0 ? LEX[t.lx].e : "")))) return { i, state: "skip" };
    const lexAlts = (t.lx >= 0 ? LEX[t.lx].e : "").replace(/\//g, " ");
    if (!ctx && !lexAlts) return { i, state: "unknown" };
    let keys = new Set([...contentWords(ctx), ...allWords(lexAlts).filter((w) => !WEAK.includes(w))].map(stem).filter((k) => k.length > 1));
    if (!contentWords(ctx).length) keys = new Set([...allWords(ctx), ...allWords(lexAlts)].filter((w) => !["the", "a", "an"].includes(w)).map(stem));
    for (const k of [...keys]) for (const s of SYN.get(k) || []) keys.add(s);
    for (const s of learned[lemmaKey(t)] || []) keys.add(s);
    if (!keys.size) return { i, state: "skip" };
    const ok = [...keys].some((k) => have.has(k) || [...have].some((hv) => hv.length > 3 && k.length > 3 && (hv.startsWith(k) || k.startsWith(hv))));
    return { i, state: ok ? "ok" : "miss", keys: [...keys] };
  });
  const scored = results.filter((r) => r.state === "ok" || r.state === "miss");
  const score = scored.length ? Math.round((100 * scored.filter((r) => r.state === "ok").length) / scored.length) : 0;
  // words in the translation that didn't match anything (candidates for "teach a synonym")
  const used = new Set(results.flatMap((r) => (r.state === "ok" ? r.keys : [])));
  const leftovers = [...new Set(contentWords(text))].filter((w) => !used.has(stem(w)));
  return { results, score, leftovers };
}

export const HINT_COST = { word: 5, parsing: 10, lemmas: 10 };
export function penalty(h) { return Math.min(60, h.words * HINT_COST.word + (h.parsing ? HINT_COST.parsing : 0) + (h.lemmas ? HINT_COST.lemmas : 0)); }
