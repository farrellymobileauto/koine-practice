// App data model on top of db.js.
import * as db from "./db.js";
import { LEX, LEX_BY_ID, TOTAL_TOKENS, dictForm, findLemma } from "./data.js";
import { fsrs, generatorParameters, createEmptyCard, Rating, State } from "../vendor/ts-fsrs.mjs";
import { prepWord, prepCards } from "./prepositions.js";

export { Rating, State };

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function deviceId() {
  let d = db.localGet("deviceId");
  if (!d) { d = uid(); db.localSet("deviceId", d); }
  return d;
}

// ---------- dates ----------
export function dayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
export function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

// ---------- profile ----------
const PROFILE_DEFAULTS = {
  name: "",
  chapter: 0,
  dailyGoal: 20,
  newPerDay: 10,
  newSource: "smart:core",
  translit: true,
  theme: "system",
  retention: 0.9,
  votdCorpus: "nt",
  apocrypha: true,
};
export function profile() {
  return { ...PROFILE_DEFAULTS, ...(db.get("kv", "profile")?.value || {}) };
}
export function saveProfile(patch) {
  db.put("kv", { id: "profile", value: { ...profile(), ...patch } });
}

// ---------- words ----------
// Lexicon words have id "L:<strong>". Custom words have id "U:<uid>".
// A lexicon word only gets a stored record if the user edits it.
export function word(id) {
  const stored = db.get("words", id);
  if (id.startsWith("P:")) {
    const p = prepWord(id);
    if (!p) return null;
    return { ...p, english: stored?.english || p.english, edited: !!stored };
  }
  if (id.startsWith("L:")) {
    const l = LEX_BY_ID.get(id.slice(2));
    if (!l) return stored || null;
    return {
      id, lemma: l.id,
      greek: stored?.greek || dictForm(l),
      english: stored?.english || l.e,
      pos: l.p, freq: l.f, lex: l,
      edited: !!stored,
    };
  }
  if (!stored) return null;
  const l = stored.lemma ? LEX_BY_ID.get(stored.lemma) : null;
  return { ...stored, pos: l?.p || stored.pos || "", freq: l?.f || 0, lex: l || null };
}

export function saveWord(w) {
  const rec = { id: w.id, greek: w.greek, english: w.english, lemma: w.lemma || null, created: w.created || Date.now() };
  db.put("words", rec);
  return rec;
}

/** Create a word from user input, linking it to the lexicon when the Greek matches. */
export function makeWord(greek, english) {
  const l = findLemma(greek);
  if (l) {
    const id = "L:" + l.id;
    const cur = word(id);
    if (english && english.trim() && english.trim() !== cur.english) saveWord({ ...cur, english: english.trim(), greek: cur.greek });
    return id;
  }
  const id = "U:" + uid();
  saveWord({ id, greek: greek.trim(), english: (english || "").trim(), lemma: null });
  return id;
}

// ---------- lists ----------
const BUILTIN = [
  { id: "smart:core", name: "Mounce core: words used 50+ times", desc: "The ~310 words taught in Basics of Biblical Greek", test: (l) => l.f >= 50 },
  { id: "smart:top100", name: "Top 100 words", desc: "The most frequent words in the NT", top: 100 },
  { id: "smart:25", name: "Used 25–49 times", test: (l) => l.f >= 25 && l.f < 50 },
  { id: "smart:10", name: "Used 10–24 times", test: (l) => l.f >= 10 && l.f < 25 },
  { id: "smart:nouns", name: "Nouns (10+ times)", test: (l) => l.p === "noun" && l.f >= 10 },
  { id: "smart:verbs", name: "Verbs (10+ times)", test: (l) => l.p === "verb" && l.f >= 10 },
  { id: "smart:adj", name: "Adjectives (10+ times)", test: (l) => l.p === "adjective" && l.f >= 10 },
  { id: "smart:prep", name: "Prepositions", test: (l) => l.p === "preposition" && l.f >= 5 },
  { id: "smart:prepcase", name: "Prepositions by case", desc: "One card per preposition and case: διά + genitive = through, διά + accusative = on account of", ids: () => prepCards().map((c) => c.id) },
  { id: "smart:conj", name: "Conjunctions, particles & adverbs (10+)", test: (l) => ["conjunction", "particle", "adverb"].includes(l.p) && l.f >= 10 },
];
let builtinCache = null;
function builtinWords(def) {
  builtinCache ||= {};
  if (!builtinCache[def.id]) {
    const src = LEX.filter((l) => !l.pn);
    builtinCache[def.id] = def.ids ? def.ids() : (def.top ? src.slice(0, def.top) : src.filter(def.test)).map((l) => "L:" + l.id);
  }
  return builtinCache[def.id];
}

export function lookupsList() {
  return db.all("lookups").filter((r) => r.count >= 2).sort((a, b) => b.count - a.count).map((r) => "L:" + r.id);
}
export function missedList() {
  const ids = new Set();
  for (const c of db.all("cards")) if ((c.fsrs?.lapses || 0) >= 2) ids.add(c.wordId);
  const counts = {};
  for (const m of db.all("mistakes")) if (m.wordId) counts[m.wordId] = (counts[m.wordId] || 0) + 1;
  for (const [w, n] of Object.entries(counts)) if (n >= 2) ids.add(w);
  return [...ids];
}

export function lists() {
  const mine = db.all("lists").sort((a, b) => a.name.localeCompare(b.name)).map((l) => ({ ...l, kind: "mine" }));
  const smart = BUILTIN.map((d) => ({ id: d.id, name: d.name, desc: d.desc, kind: "smart", wordIds: builtinWords(d) }));
  const auto = [
    { id: "auto:lookups", name: "Words I keep looking up", desc: "Looked up 2+ times with tap-to-gloss", kind: "auto", wordIds: lookupsList() },
    { id: "auto:missed", name: "Words I keep missing", desc: "Missed 2+ times", kind: "auto", wordIds: missedList() },
  ];
  return [...mine, ...auto, ...smart];
}
export function list(id) {
  return lists().find((l) => l.id === id) || null;
}
export function createList(name, wordIds = []) {
  const rec = { id: "list:" + uid(), name, wordIds: [...new Set(wordIds)], created: Date.now() };
  db.put("lists", rec);
  return rec;
}
export function updateList(id, patch) {
  const cur = db.get("lists", id);
  if (!cur) return;
  const rec = { ...cur, ...patch };
  if (rec.wordIds) rec.wordIds = [...new Set(rec.wordIds)];
  db.put("lists", rec);
}
export function deleteList(id) { db.remove("lists", id); }

// ---------- cards & FSRS ----------
let scheduler = null;
function sched() {
  const p = profile();
  if (!scheduler || scheduler._ret !== p.retention) {
    scheduler = fsrs(generatorParameters({ request_retention: p.retention, enable_fuzz: true, enable_short_term: true }));
    scheduler._ret = p.retention;
  }
  return scheduler;
}

const cardId = (wordId, dir) => `${wordId}|${dir}`;
function toCard(f) {
  if (!f) return createEmptyCard(new Date());
  return { ...f, due: new Date(f.due), last_review: f.last_review ? new Date(f.last_review) : undefined };
}
function fromCard(c) {
  return { ...c, due: c.due.toISOString(), last_review: c.last_review ? new Date(c.last_review).toISOString() : null };
}
export function card(wordId, dir) {
  return db.get("cards", cardId(wordId, dir)) || null;
}
export function cardState(wordId, dir) {
  const c = card(wordId, dir);
  if (!c) return "new";
  const f = c.fsrs;
  if (f.state === State.Review) return new Date(f.due) <= new Date() ? "due" : "known";
  return "learning";
}
/** Preview the next due date for each rating. */
export function preview(wordId, dir) {
  const c = toCard(card(wordId, dir)?.fsrs);
  const rec = sched().repeat(c, new Date());
  const out = {};
  for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) out[r] = rec[r].card.due;
  return out;
}
export function review(wordId, dir, rating) {
  const existing = card(wordId, dir);
  const wasNew = !existing || existing.fsrs.state === State.New;
  const { card: next } = sched().next(toCard(existing?.fsrs), new Date(), rating);
  db.put("cards", { id: cardId(wordId, dir), wordId, dir, fsrs: fromCard(next), created: existing?.created || Date.now() });
  bumpActivity({ reviews: 1, correct: rating === Rating.Again ? 0 : 1, newCards: wasNew ? 1 : 0 });
  return next;
}

/** Is this word "known" (graduated to review in either direction)? */
export function wordKnown(wordId) {
  for (const dir of ["g2e", "e2g"]) {
    const c = card(wordId, dir);
    if (c && c.fsrs.state === State.Review) return true;
  }
  return false;
}

/** Build a study queue. mode: "srs" | "cram". dirs: ["g2e"], ["e2g"] or both. */
/** newLimit: max new cards to introduce (default: no limit). Today's practice passes its own daily amount. */
export function buildQueue(wordIds, { mode = "srs", dirs = ["g2e"], newLimit = Infinity } = {}) {
  const now = new Date();
  const items = [];
  const fresh = [];
  for (const w of wordIds) {
    for (const dir of dirs) {
      const c = card(w, dir);
      if (mode === "cram") { items.push({ wordId: w, dir }); continue; }
      if (!c || c.fsrs.state === State.New) fresh.push({ wordId: w, dir });
      else if (new Date(c.fsrs.due) <= now) items.push({ wordId: w, dir, due: new Date(c.fsrs.due) });
    }
  }
  if (mode === "cram") return shuffle(items);
  items.sort((a, b) => a.due - b.due);
  const limit = newLimit ?? Infinity;
  // introduce new cards in list order, both directions of a word together
  return [...items, ...fresh.slice(0, Math.max(0, limit))];
}
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function dueCount(wordIds = null) {
  const now = new Date();
  const set = wordIds ? new Set(wordIds) : null;
  let n = 0;
  for (const c of db.all("cards")) {
    if (set && !set.has(c.wordId)) continue;
    if (c.fsrs.state !== State.New && new Date(c.fsrs.due) <= now) n++;
  }
  return n;
}

// ---------- activity (one record per day per device, summed when read) ----------
export function bumpActivity(delta) {
  const id = dayKey() + "|" + deviceId();
  const cur = db.get("activity", id) || { id, date: dayKey(), device: deviceId(), reviews: 0, correct: 0, newCards: 0, mistakes: 0, votd: 0, placement: 0, parse: 0, paradigm: 0, translate: 0 };
  for (const [k, v] of Object.entries(delta)) cur[k] = (cur[k] || 0) + v;
  db.put("activity", cur);
}
export function activityByDay() {
  const out = {};
  for (const a of db.all("activity")) {
    const d = (out[a.date] ||= { reviews: 0, correct: 0, newCards: 0, mistakes: 0, votd: 0, placement: 0, parse: 0, paradigm: 0, translate: 0 });
    for (const k of Object.keys(d)) d[k] += a[k] || 0;
  }
  return out;
}
export function today() { return activityByDay()[dayKey()] || { reviews: 0, correct: 0, newCards: 0, mistakes: 0, votd: 0, placement: 0, parse: 0, paradigm: 0, translate: 0 }; }
/** New words Today's practice may still add today. */
export function newRemainingToday() { return Math.max(0, profile().newPerDay - today().newCards); }

export function goalMet(d, goal = profile().dailyGoal) {
  return !!d && (d.reviews >= goal || d.votd > 0);
}

// ---------- streak (with freezes) ----------
export function streakInfo() {
  const days = activityByDay();
  const goal = profile().dailyGoal;
  const st = { freezes: 0, frozen: [], earnedFor: 0, best: 0, ...(db.get("kv", "streak")?.value || {}) };
  const frozen = new Set(st.frozen);
  const met = (k) => goalMet(days[k], goal);
  const t = dayKey();
  let changed = false;

  // Auto-apply freezes to a gap that ends yesterday, if a streak existed before it.
  let gap = [];
  let k = addDays(t, -1);
  while (!met(k) && !frozen.has(k) && gap.length < 3) { gap.push(k); k = addDays(k, -1); }
  if (gap.length && gap.length <= st.freezes && (met(k) || frozen.has(k))) {
    for (const g of gap) frozen.add(g);
    st.freezes -= gap.length;
    changed = true;
  }

  let len = 0;
  let cursor = met(t) ? t : addDays(t, -1);
  while (met(cursor) || frozen.has(cursor)) { if (met(cursor)) len++; cursor = addDays(cursor, -1); }

  const earned = Math.floor(len / 7);
  if (len === 0 && st.earnedFor !== 0) { st.earnedFor = 0; changed = true; }
  if (earned > st.earnedFor) { st.freezes = Math.min(2, st.freezes + (earned - st.earnedFor)); st.earnedFor = earned; changed = true; }
  if (len > st.best) { st.best = len; changed = true; }
  st.frozen = [...frozen].filter((d) => d >= addDays(t, -400));
  if (changed) db.put("kv", { id: "streak", value: st }, { silent: true });
  return { length: len, best: st.best, freezes: st.freezes, todayDone: met(t), frozen, goal };
}

// ---------- coverage ----------
export function knownLemmas() {
  const s = new Set();
  for (const c of db.all("cards")) {
    if (c.fsrs.state !== State.Review) continue;
    const w = word(c.wordId);
    if (w?.lemma) s.add(w.lemma);
  }
  return s;
}
export function coverage() {
  const known = knownLemmas();
  let tokens = 0;
  for (const id of known) tokens += LEX_BY_ID.get(id)?.f || 0;
  const pct = TOTAL_TOKENS ? (100 * tokens) / TOTAL_TOKENS : 0;
  // next milestone: how many of the most frequent unknown words reach it
  const milestones = [10, 25, 40, 50, 60, 70, 75, 80, 85, 90, 95];
  const next = milestones.find((m) => m > pct);
  let need = 0, acc = tokens;
  if (next) {
    for (const l of LEX) {
      if (acc / TOTAL_TOKENS * 100 >= next) break;
      if (!known.has(l.id)) { acc += l.f; need++; }
    }
  }
  return { pct, words: known.size, next, need };
}

// ---------- mistakes ----------
export function logMistake(m) {
  const rec = { id: "m:" + uid(), ts: Date.now(), ...m };
  db.put("mistakes", rec);
  bumpActivity({ mistakes: 1 });
  return rec;
}
export function mistakes() { return db.all("mistakes").sort((a, b) => b.ts - a.ts); }
export function deleteMistake(id) { db.remove("mistakes", id); }

export function weakSpots(days = 14) {
  const since = Date.now() - days * 864e5;
  const by = {};
  for (const m of db.all("mistakes")) {
    if (m.ts < since) continue;
    (by[m.category] ||= { category: m.category, count: 0, wordIds: new Set(), kind: m.kind, drill: m.drill || null }).count++;
    if (m.wordId) by[m.category].wordIds.add(m.wordId);
  }
  return Object.values(by).sort((a, b) => b.count - a.count).slice(0, 4).map((x) => ({ ...x, wordIds: [...x.wordIds] }));
}

// ---------- tap-to-gloss lookups ----------
export function recordLookup(lemmaId) {
  const cur = db.get("lookups", lemmaId) || { id: lemmaId, count: 0 };
  db.put("lookups", { ...cur, count: cur.count + 1, last: Date.now() }, { silent: true });
}

export { db };

// ---------- translations (history, redo queue, flags, learned synonyms) ----------
function kvList(id) { return db.get("kv", id)?.value || []; }
function kvSetList(id, v) { db.put("kv", { id, value: v }); }

export function saveTranslation(t) {
  const rec = { id: "t:" + uid(), ts: Date.now(), ...t };
  db.put("translations", rec);
  return rec;
}
export function translations() { return db.all("translations").sort((a, b) => b.ts - a.ts); }
export function lastTranslation(verseId) { return translations().find((t) => t.verse === verseId) || null; }
export function deleteTranslation(id) { db.remove("translations", id); }

export const redoQueue = () => kvList("redo");
export function addRedo(verseId) { const q = redoQueue().filter((x) => x !== verseId); kvSetList("redo", [...q, verseId]); }
export function removeRedo(verseId) { const q = redoQueue(); if (q.includes(verseId)) kvSetList("redo", q.filter((x) => x !== verseId)); }

export const flaggedVerses = () => new Set(kvList("flags"));
export function flagVerse(verseId) { const f = kvList("flags"); if (!f.includes(verseId)) kvSetList("flags", [...f, verseId]); }

export function learnedSynonyms() { return db.get("kv", "syn")?.value || {}; }
export function learnSynonym(key, wordStem) {
  const cur = learnedSynonyms();
  const list = new Set(cur[key] || []);
  list.add(wordStem);
  db.put("kv", { id: "syn", value: { ...cur, [key]: [...list] } });
}

// ---------- parsing accuracy by category (stored on the day's activity record) ----------
export function recordParse(category, ok) {
  const id = dayKey() + "|" + deviceId();
  const cur = db.get("activity", id) || { id, date: dayKey(), device: deviceId(), reviews: 0, correct: 0 };
  const pcat = { ...(cur.pcat || {}) };
  const [n, k] = pcat[category] || [0, 0];
  pcat[category] = [n + 1, k + (ok ? 1 : 0)];
  db.put("activity", { ...cur, pcat }, { silent: true });
}
export function parseStats(days = 30) {
  const since = addDays(dayKey(), -days);
  const out = {};
  for (const a of db.all("activity")) {
    if (a.date < since || !a.pcat) continue;
    for (const [cat, [n, k]] of Object.entries(a.pcat)) { const o = (out[cat] ||= { category: cat, n: 0, ok: 0 }); o.n += n; o.ok += k; }
  }
  return Object.values(out).sort((a, b) => b.n - a.n);
}
