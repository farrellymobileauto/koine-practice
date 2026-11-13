import { h, add, clear, icon, toast } from "../ui.js";
import * as S from "../store.js";
import { LEX, loadNT, mounceTitle } from "../data.js";
import * as C from "../corpus.js";
import { translateCard } from "./translate.js";
import { startStudy } from "./vocab.js";
import { startParseDrill } from "./parse.js";

// --------- verse of the day ---------
function hashStr(s) { let x = 2166136261; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; }

/** Pick a verse where the user knows ~90% of the words (or the easiest verses for a beginner). */
function pickVerse(nt, dateKey, known) {
  const candidates = [];
  nt.books.forEach((b, bi) => b.c.forEach((vs, ci) => vs.forEach((toks, vi) => {
    if (!toks || toks.length < 5 || toks.length > 22) return;
    let k = 0, maxRank = 0;
    for (const t of toks) {
      const l = LEX[t[1]];
      if (known.has(l.id) || l.pn) k++;
      if (!l.pn) maxRank = Math.max(maxRank, t[1]);
    }
    candidates.push({ bi, c: ci + 1, v: vi + 1, toks, cov: k / toks.length, maxRank });
  })));
  let pool = candidates.filter((x) => x.cov >= 0.85 && x.cov < 1);
  if (pool.length < 20) pool = candidates.filter((x) => x.cov >= 0.75);
  if (pool.length < 20) pool = [...candidates].sort((a, b) => a.maxRank - b.maxRank).slice(0, 150); // beginner: only very common words
  return pool[hashStr(dateKey) % pool.length];
}

const VOTD_KEY = "koine.votd";
function votdState(dk) {
  try { const s = JSON.parse(localStorage.getItem(VOTD_KEY) || "{}"); return s.date === dk ? s : { date: dk, text: "", hints: [], graded: null }; }
  catch { return { date: dk, text: "", hints: [], graded: null }; }
}
function saveVotd(s) { try { localStorage.setItem(VOTD_KEY, JSON.stringify(s)); } catch {} }

// --------- view ---------
export default function today(el) {
  const p = S.profile();
  const st = S.streakInfo();
  const t = S.today();
  const cov = S.coverage();
  const due = S.dueCount();
  const newSrc = S.list(p.newSource) || S.list("smart:core");

  const hour = new Date().getHours();
  const greet = (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening") + (p.name ? ", " + p.name : "");
  const goalPct = Math.min(100, (100 * t.reviews) / p.dailyGoal);

  const dailyIds = () => {
    const ids = new Set(S.db.all("cards").map((c) => c.wordId));
    for (const w of newSrc.wordIds) ids.add(w);
    return [...ids];
  };
  const q = S.buildQueue(dailyIds(), { dirs: p.dailyDirs || ["g2e"] });

  add(el, 
    h("div.card.hero",
      h("div.greet", greet, " · ", new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })),
      h("div.row.between",
        h("div", h("div.stat", t.reviews, h("small", ` / ${p.dailyGoal} reviews today`))),
        st.todayDone ? h("span.badge.known", "Daily goal met") : null),
      h("div.goal-bar", h("i", { style: { width: goalPct + "%" } })),
      h("button.btn.primary.big.block", {
        disabled: !q.length,
        onclick: () => startStudy({ queue: q, wordIds: [], dirs: p.dailyDirs || ["g2e"], mode: "srs", title: "Today's practice" }),
      }, icon("play"), q.length ? `Start today's practice · ${q.length} card${q.length === 1 ? "" : "s"}` : "All caught up on vocab"),
      h("div.row", { style: { gap: "8px" } },
        h("a.btn.sm", { href: "#/parse?quick=1" }, icon("parse", 16), "Parse 10 forms"),
        h("a.btn.sm.ghost", { href: "#/paradigms" }, icon("paradigms", 16), "Paradigms"),
        t.parse ? h("span.small.muted", `${t.parse} parsed today`) : null),
      h("div.small.muted", `${due} due for review · ${Math.min(S.newRemainingToday(), newSrc.wordIds.filter((w) => !S.card(w, "g2e")).length)} new words from “${newSrc.name}” · then the verse of the day below`),
      p.chapter ? h("div.stack", { style: { gap: "4px" } },
        h("div.row.between", h("div.small", h("b", `Mounce ch. ${p.chapter}`), " · " + mounceTitle(p.chapter)), h("a.small", { href: "#/profile" }, "Change")),
        h("div.goal-bar", { role: "progressbar", "aria-label": "Progress through Mounce", "aria-valuemin": 0, "aria-valuemax": 36, "aria-valuenow": p.chapter }, h("i", { style: { width: (100 * p.chapter) / 36 + "%" } })),
        h("div.tiny.muted", `${p.chapter} of 36 chapters`)) :
        h("div.small", "Not sure where you left off in Mounce? ", h("a", { href: "#/profile/placement" }, "Take the placement test"))),

    h("div.grid.two", { style: { marginTop: "14px" } },
      streakCard(st),
      h("div.card",
        h("h2", "NT coverage"),
        h("div.sub", "Share of the words in the Greek NT that you know"),
        h("div.stat", cov.pct.toFixed(1) + "%", h("small", ` · ${cov.words} word${cov.words === 1 ? "" : "s"} known`)),
        h("div.meter", h("i", { style: { width: Math.min(100, cov.pct) + "%" } })),
        cov.next ? h("div.small.muted", cov.need === 1 ? `Learn the most common word you don't know yet to reach ${cov.next}%.` : `Learn the ${cov.need} most common words you don't know yet to reach ${cov.next}%.`) : null,
        h("div.tiny.muted", "A word counts as known once its flashcard graduates to review."))),

    votdCard(),

    h("div.grid.two", { style: { marginTop: "14px" } }, weakCard(), recentCard()),
    h("div.grid.two", { style: { marginTop: "14px" } }, parseCard(), bookCoverageCard()));
}

function streakCard(st) {
  const days = S.activityByDay();
  const weeks = window.matchMedia("(max-width: 640px)").matches ? 17 : 26;
  const end = new Date();
  const start = new Date(end); start.setDate(end.getDate() - end.getDay() - (weeks - 1) * 7);
  const cells = [];
  const tk = S.dayKey();
  for (let d = new Date(start); S.dayKey(d) <= tk; d.setDate(d.getDate() + 1)) {
    const k = S.dayKey(d);
    const a = days[k];
    const n = a ? a.reviews + a.votd * 10 + a.placement * 5 : 0;
    const lvl = n === 0 ? 0 : n < 10 ? 1 : n < 25 ? 2 : n < 50 ? 3 : 4;
    cells.push(h("i", { class: [lvl ? "l" + lvl : "", st.frozen.has(k) ? "fz" : "", k === tk ? "today" : ""].join(" "), title: `${k}: ${a ? a.reviews + " reviews" : "no practice"}${st.frozen.has(k) ? " (streak freeze)" : ""}` }));
  }
  return h("div.card",
    h("h2", "Streak"),
    h("div.streak",
      h("span.flame", { class: st.todayDone ? "" : "off" }, icon("flame", 40)),
      h("div", h("div.stat", st.length, h("small", st.length === 1 ? " day" : " days")), h("div.small.muted", `Best ${st.best} · `, icon("snow", 13), ` ${st.freezes} freeze${st.freezes === 1 ? "" : "s"}`))),
    h("div.tiny.muted", { style: { marginTop: "6px" } }, st.todayDone ? "Today counts. Nice." : `Do ${st.goal} reviews or the verse of the day to keep it going. You earn a streak freeze (max 2) every 7 days; it covers a missed day automatically.`),
    h("div.heatmap", { "aria-label": "Practice heatmap" }, cells));
}

function weakCard() {
  const spots = S.weakSpots();
  const missed = S.missedList();
  return h("div.card",
    h("h2", "Weak spots"),
    h("div.sub", "From your mistakes in the last 14 days"),
    spots.length ? h("div.list", spots.map((s) => h("div.list-item",
      h("div.main", h("div.title", s.category), h("div.meta", `${s.count} miss${s.count === 1 ? "" : "es"}`)),
      s.drill?.paradigm ? h("a.btn.sm", { href: "#/paradigms/" + s.drill.paradigm }, "Drill") :
      s.kind === "parse" && s.drill ? h("button.btn.sm", { onclick: () => startParseDrill(s.drill) }, "Drill") :
      s.wordIds.length ? h("button.btn.sm", { onclick: () => startStudy({ wordIds: s.wordIds, dirs: ["g2e", "e2g"], mode: "cram", title: s.category }) }, "Drill") : null))) :
      h("div.empty.small", "No mistakes logged recently. Weak spots show up here as you practice."),
    missed.length ? h("button.btn.sm.ghost", { onclick: () => startStudy({ wordIds: missed, dirs: ["g2e"], mode: "cram", title: "Words I keep missing" }) }, `Drill the ${missed.length} words you keep missing`) : null);
}

function recentCard() {
  const days = S.activityByDay();
  let reviews7 = 0, correct7 = 0, active7 = 0;
  for (let i = 0; i < 7; i++) {
    const d = days[S.addDays(S.dayKey(), -i)];
    if (d) { reviews7 += d.reviews; correct7 += d.correct; if (d.reviews || d.votd) active7++; }
  }
  const cards = S.db.all("cards");
  const learning = cards.filter((c) => c.fsrs.state === S.State.Learning || c.fsrs.state === S.State.Relearning).length;
  const known = cards.filter((c) => c.fsrs.state === S.State.Review).length;
  return h("div.card",
    h("h2", "This week"),
    h("div.kpis",
      h("div.kpi", h("b", reviews7), h("span", "reviews")),
      h("div.kpi", h("b", reviews7 ? Math.round((100 * correct7) / reviews7) + "%" : "–"), h("span", "accuracy")),
      h("div.kpi", h("b", active7 + "/7"), h("span", "days active"))),
    h("div.small.muted", { style: { marginTop: "10px" } }, `${known} cards in review · ${learning} learning`));
}

function votdCard() {
  const box = h("div.card", { style: { marginTop: "14px" } }, h("h2", "Verse of the day"), h("div.small.muted", "Loading…"));
  renderVotd(box).catch((e) => { console.error(e); add(clear(box), h("h2", "Verse of the day"), h("div.small.muted", "Couldn't load the verse.")); });
  return box;
}

async function renderVotd(box) {
  const dk = S.dayKey();
  const state = votdState(dk);
  let verse = state.id ? await C.getVerse(state.id) : null;
  if (!verse) {
    // Same verse all day. Beginners get verses made of the most common NT words.
    const known = S.knownLemmas();
    const corpus = S.profile().votdCorpus || "nt";
    if (known.size < 40 && corpus !== "lxx") {
      const nt = await loadNT();
      const v = pickVerse(nt, dk, known);
      verse = await C.getVerse(`nt:${nt.books[v.bi].b}.${v.c}.${v.v}`);
    } else {
      verse = (await C.pickVerse({ corpus, level: "easy", length: "any", known, exclude: S.flaggedVerses(), seed: hashStr(dk) })).verse;
    }
    state.id = verse.id; saveVotd(state);
  }
  const prev = S.lastTranslation(verse.id);
  const doneToday = votdState(dk).done && prev && new Date(prev.ts).toDateString() === new Date().toDateString();
  translateCard(box, verse, {
    title: "Verse of the day",
    restore: doneToday ? prev : null,
    onGraded: () => { if (!votdState(dk).done) { S.bumpActivity({ votd: 1 }); saveVotd({ ...votdState(dk), done: true }); } },
  });
  if (doneToday) add(box, h("div.small", { style: { marginTop: "8px" } }, h("a", { href: "#/translate" }, "Translate more verses →")));
}

function parseCard() {
  const stats = S.parseStats(30);
  const total = stats.reduce((a, b) => a + b.n, 0);
  const weakest = [...stats].filter((x) => x.n >= 5).sort((a, b) => a.ok / a.n - b.ok / b.n)[0];
  return h("div.card",
    h("h2", "Parsing accuracy"),
    h("div.sub", total ? `${total} forms in the last 30 days` : "Last 30 days"),
    stats.length ? h("div.stack", { style: { gap: "8px" } }, stats.slice(0, 7).map((x) => {
      const pct = Math.round((100 * x.ok) / x.n);
      return h("div",
        h("div.row.between.small", h("span", x.category[0].toUpperCase() + x.category.slice(1)), h("span.muted", `${pct}% · ${x.n}`)),
        h("div.meter.thin", { role: "img", "aria-label": `${x.category}: ${pct}% correct` }, h("i", { style: { width: pct + "%", background: pct >= 85 ? "var(--good)" : pct >= 60 ? "var(--warn)" : "var(--bad)" } })));
    })) : h("div.empty.small", "Parse some forms and your accuracy by category shows up here."),
    weakest && weakest.ok / weakest.n < 0.85 ? h("div.small.muted", { style: { marginTop: "10px" } }, "Weakest: ", h("b", weakest.category), ". ", h("a", { href: "#/parse" }, "Practice in Parse")) : null);
}

function bookCoverageCard() {
  const box = h("div.card", h("h2", "Coverage by book"), h("div.sub", "Share of each NT book's words (not counting names) that you know"));
  const body = h("div");
  add(box, body);
  loadNT().then((nt) => {
    const known = S.knownLemmas();
    const rows = nt.books.map((b) => {
      let n = 0, k = 0;
      for (const ch of b.c) for (const v of ch) for (const t of v || []) { const l = LEX[t[1]]; if (l.pn) continue; n++; if (known.has(l.id)) k++; }
      return { b, pct: n ? (100 * k) / n : 0 };
    }).sort((a, b) => b.pct - a.pct);
    let all = false;
    const draw = () => {
      clear(body);
      add(body, h("div.stack", { style: { gap: "6px" } }, (all ? rows : rows.slice(0, 6)).map((r) => h("div",
        h("div.row.between.small", h("a", { href: `#/reader/nt:${r.b.b}.1` }, r.b.n), h("span.muted", r.pct.toFixed(0) + "%")),
        h("div.meter.thin", h("i", { style: { width: r.pct + "%" } }))))),
        h("button.btn.sm.ghost", { style: { marginTop: "8px" }, onclick: () => { all = !all; draw(); } }, all ? "Show fewer" : "Show all 27 books"));
    };
    draw();
  });
  return box;
}
