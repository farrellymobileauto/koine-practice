import { h, add, clear, icon, toast, modal } from "../ui.js";
import { tableEl } from "./paradigms.js";
import * as S from "../store.js";
import { MOUNCE, prettyRef, dictForm } from "../data.js";
import { greekInput, normalize } from "../greek.js";
import { gk } from "../gloss.js";
import * as M from "../morph.js";
import { paradigm } from "../paradigms.js";
import { go, route } from "../app.js";
import { prepItems, samplePrep, runPrepSession } from "./prepdrill.js";

const LS = "koine.parsePrefs";
const DEFAULTS = { mode: "nouns", task: "recognize", source: "both", maxCh: 0, nounCats: null, tenses: null, moods: null, askDecl: false, withArticle: false, length: 15 };
function prefs() {
  let p = DEFAULTS;
  try { p = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS) || "{}") }; } catch {}
  if (!p.maxCh) p.maxCh = S.profile().chapter || 36;
  return p;
}
function savePrefs(p) { try { localStorage.setItem(LS, JSON.stringify(p)); } catch {} }

let pending = null; // { items, task, mode, title }

export function startParseWithTable(id) {
  const t = paradigm(id);
  const mode = t.parse.pos === "verb" ? "verbs" : "nouns";
  M.loadForms().then(() => {
    const items = S.shuffle(M.paradigmItems().filter((it) => it.table.id === id));
    pending = { items, task: "recognize", mode, title: t.title };
    if (route().path === "parse") location.reload(); else go("parse");
  });
}

/** Called from Today's weak spots: drill = { mode, tense?, mood?, cat? } */
export function startParseDrill(drill) {
  const p = prefs();
  p.mode = drill.mode || p.mode;
  if (drill.mode === "verbs") { p.tenses = drill.tense ? [drill.tense] : null; p.moods = drill.mood ? [drill.mood] : null; }
  else p.nounCats = drill.cat ? [drill.cat] : null;
  savePrefs(p);
  go("parse?go=1");
}

function poolFor(p) {
  let items = [];
  if (p.source !== "real") items.push(...M.paradigmItems());
  if (p.source !== "paradigm") items.push(...M.realItems());
  items = M.filterItems(items, { mode: p.mode, maxCh: p.maxCh, nounCats: p.nounCats, tenses: p.tenses, moods: p.moods });
  if (p.task === "produce") items = items.filter((it) => it.target && (it.source === "paradigm" || (it.lex && it.lex.f >= 50)));
  return items;
}

export function parseHome(el) {
  const p = prefs();
  const params = route().params;
  const body = h("div", h("div.card", h("div.small.muted", "Loading forms…")));
  add(el, h("div.page-head", h("h1", "Parse")), body);
  M.loadForms().then(() => {
    if (pending) { const s = pending; pending = null; return runSession(el, s); }
    if ((params.get("go") || params.get("quick")) && p.mode === "preps") {
      return prepItems().then((all) => runPrepSession(el, samplePrep(all, params.get("quick") ? 10 : p.length), () => { clear(el); parseHome(el); }));
    }
    if (params.get("go") || params.get("quick")) {
      if (params.get("quick")) p.length = 10;
      const items = M.sample(poolFor(p), p.length);
      if (items.length) return runSession(el, { items, task: p.task, mode: p.mode, title: "Parsing" });
    }
    setup(body, p);
  });
}

function setup(body, p) {
  clear(body);
  if (p.mode === "preps") return prepSetup(body, p);
  const count = h("div.small.muted");
  const refresh = () => {
    const n = poolFor(p).length;
    count.textContent = n ? `${n.toLocaleString()} forms match these settings` : "No forms match. Widen the filters or raise the chapter.";
    startBtn.disabled = !n;
    savePrefs(p);
  };
  const seg = (key, opts) => {
    const wrap = h("div.seg");
    for (const [v, label] of opts) wrap.append(h("button", { "aria-pressed": String(p[key] === v), onclick: () => { p[key] = v; [...wrap.children].forEach((b, i) => b.setAttribute("aria-pressed", String(opts[i][0] === p[key]))); redraw(); } }, label));
    return wrap;
  };
  const chips = (key, opts) => h("div.chips", opts.map(([v, label]) => {
    const on = () => !p[key] || p[key].includes(v);
    const b = h("button.chip", { "aria-pressed": String(on()), onclick: () => {
      let cur = p[key] ? [...p[key]] : opts.map((o) => o[0]);
      cur = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      p[key] = cur.length === opts.length ? null : cur;
      [...b.parentElement.children].forEach((c, i) => c.setAttribute("aria-pressed", String(!p[key] || p[key].includes(opts[i][0]))));
      refresh();
    } }, label);
    return b;
  }));
  const ch = h("select.input", MOUNCE.filter(([c]) => c >= 7).map(([c, t]) => h("option", { value: c, selected: c === p.maxCh }, `Up to ch. ${c} · ${t}`)));
  ch.addEventListener("change", () => { p.maxCh = +ch.value; refresh(); });
  const len = h("select.input", [10, 15, 20, 30, 50].map((n) => h("option", { value: n, selected: n === p.length }, `${n} forms`)));
  len.addEventListener("change", () => { p.length = +len.value; savePrefs(p); });
  const decl = h("input", { type: "checkbox", checked: p.askDecl });
  decl.addEventListener("change", () => { p.askDecl = decl.checked; savePrefs(p); });
  const art = h("input", { type: "checkbox", checked: p.withArticle });
  art.addEventListener("change", () => { p.withArticle = art.checked; savePrefs(p); });

  const startBtn = h("button.btn.primary.big.block", { onclick: () => {
    const items = M.sample(poolFor(p), p.length);
    runSession(body.parentElement, { items, task: p.task, mode: p.mode, title: "Parsing" });
  } }, icon("play"), "Start");

  function redraw() { setup(body, p); }

  add(body,
    h("div.card.stack",
      h("div.row", seg("mode", [["nouns", "Nouns & pronouns"], ["verbs", "Verbs"], ["preps", "Prepositions"]]), seg("task", [["recognize", "Recognize"], ["produce", "Produce"]])),
      h("div.small.muted", p.task === "recognize" ? "See a form and give its parsing. Any valid parsing counts." : "Get a lexical form and a parsing, then type the Greek form (accents optional)."),
      h("div.small.muted", "Forms from"),
      seg("source", [["both", "Paradigms + real NT forms"], ["paradigm", "Paradigms only"], ["real", "Real NT forms only"]]),
      h("label.field", "Grammar covered", ch, h("span.hint", "Only forms Mounce has taught by this chapter. Set your chapter in Profile.")),
      p.mode === "nouns"
        ? [h("div.small.muted", "Include"), chips("nounCats", M.NOUN_CATS),
           h("label.check", decl, h("span", "Also ask the declension of nouns")),
           h("label.check", art, h("span", "Include the article with nouns and adjectives (τοῦ λόγου)", h("br"), h("span.small.muted", p.task === "produce" ? "You type the article and the form together." : "The article narrows the parsing down, like reading the word in a sentence.")))]
        : [h("div.small.muted", "Tenses"), chips("tenses", M.TENSE_CATS), h("div.small.muted", "Moods"), chips("moods", M.MOOD_CATS)],
      h("label.field", "Session length", len),
      count, startBtn),
    h("div.section-title", "Tips"),
    h("div.card.small.muted",
      h("p", "Verbs are parsed by tense, voice, mood, person and number, with no lexical form. Participles take case, number and gender instead of person; infinitives take only tense, voice and mood."),
      h("p", "Middle and passive share forms in the present, imperfect and perfect, so either answer is right there. Deponent forms count as middle (or passive for -θη- forms)."),
      h("p", { style: { margin: 0 } }, "Keyboard: Enter checks and moves on.")));
  refresh();
}

function prepSetup(body, p) {
  const modeSeg = h("div.seg", [["nouns", "Nouns & pronouns"], ["verbs", "Verbs"], ["preps", "Prepositions"]].map(([v, l]) =>
    h("button", { "aria-pressed": String(p.mode === v), onclick: () => { p.mode = v; savePrefs(p); setup(body, p); } }, l)));
  const len = h("select.input", [10, 15, 20, 30, 50].map((n) => h("option", { value: n, selected: n === p.length }, `${n} phrases`)));
  len.addEventListener("change", () => { p.length = +len.value; savePrefs(p); });
  const count = h("div.small.muted", "Loading phrases…");
  const startBtn = h("button.btn.primary.big.block", { disabled: true }, icon("play"), "Start");
  add(body, h("div.card.stack",
    modeSeg,
    h("p.small.muted", { style: { margin: 0 } }, "See a real NT phrase like διὰ τοῦ νόμου and pick what the preposition means there. The answer depends on the case of the word that follows (genitive, dative or accusative). Only prepositions with more than one meaning are drilled: διά, ἐπί, κατά, μετά, παρά, περί, ὑπέρ, ὑπό."),
    h("label.field", "Session length", len),
    count, startBtn),
    h("div.section-title", "Tip"),
    h("div.card.small.muted", "To learn the meanings first, study the “Prepositions by case” list in Vocab. It has one card per preposition and case."));
  prepItems().then((all) => {
    count.textContent = `${all.length.toLocaleString()} phrases in the NT`;
    startBtn.disabled = false;
    startBtn.onclick = () => runPrepSession(body.parentElement, samplePrep(all, p.length), () => { clear(body.parentElement); parseHome(body.parentElement); });
  });
  savePrefs(p);
}

// ---------------- session ----------------
function runSession(el, sess) {
  clear(el);
  el.dataset.live = "1";
  const { items, task } = sess;
  const askDecl = prefs().askDecl;
  const withArticle = prefs().withArticle && sess.mode === "nouns";
  let i = 0, right = 0;
  const misses = [];
  const bar = h("i", { style: { width: "0%" } });
  const countEl = h("span.small.muted");
  const stage = h("div");
  add(el, h("div.study",
    h("div.progress-line", h("button.icon-btn", { onclick: () => finish(), "aria-label": "End session" }, icon("x")), h("div.goal-bar", bar), countEl),
    stage));
  let onKey = null;
  window.addEventListener("hashchange", () => { if (onKey) document.removeEventListener("keydown", onKey); onKey = null; }, { once: true });

  function show() {
    if (i >= items.length) return finish();
    countEl.textContent = `${i}/${items.length}`;
    bar.style.width = (100 * i) / items.length + "%";
    const it = items[i];
    (task === "produce" ? produce : recognize)(it);
  }

  function next(ok, mistakeId) {
    if (ok) right++; else misses.push(items[i]);
    i++; show();
  }

  // ----- recognition -----
  function recognize(it) {
    clear(stage);
    const ans = {};
    let done = false, logged = null;
    let valid = it.parses.filter((p) => (sess.mode === "verbs" ? p.pos === "verb" : p.pos !== "verb"));
    // With the article shown, only the parsings that match it are valid (τῆς ὥρας = gen. sg., τὰς ὥρας = acc. pl.).
    let art = null;
    if (withArticle) {
      const nominal = valid.filter((p) => M.articleFor(p));
      const t = nominal.find((p) => it.target && M.keyOf(p) === M.keyOf(it.target)) || nominal[Math.floor(Math.random() * nominal.length)];
      art = t ? M.articleFor(t) : null;
      if (art) valid = valid.filter((p) => M.articleFor(p) && normalize(M.articleFor(p)) === normalize(art));
    }
    const usesPerson = valid.some((p) => p.pos !== "verb" && !p.gender);
    const rowsWrap = h("div.stack");
    const feedback = h("div");
    const checkBtn = h("button.btn.primary.big.block", { disabled: true, onclick: () => (done ? next(lastOk) : check()) }, "Check");
    let lastOk = false;

    const formEl = h("div.verse", { style: { fontSize: "2.6rem", margin: 0 } }, art ? h("span.art", art + " ") : null, it.form);
    const card = h("div.card.stack",
      h("div", { style: { textAlign: "center", padding: "14px 0 4px" } },
        h("div.tag.small.muted", it.source === "real" ? `${prettyRef(it.ref)} · real NT form` : "Paradigm form"), formEl),
      rowsWrap, feedback, checkBtn);
    add(stage, card);

    const dims = () => {
      if (sess.mode === "verbs") {
        const d = ["tense", "voice", "mood"];
        if (ans.mood === "P") d.push("case", "number", "gender");
        else if (ans.mood && ans.mood !== "N") d.push("person", "number");
        return d;
      }
      const d = ["case", "number", usesPerson ? "person" : "gender"];
      if (askDecl && valid.some((p) => p.pos === "noun")) d.push("decl");
      return d;
    };
    const OPTS = {
      tense: ["P", "I", "F", "A", "R"], voice: ["A", "M", "P"], mood: ["I", "S", "M", "N", "P"],
      case: ["N", "G", "D", "A"], number: ["S", "P"], gender: ["M", "F", "N"], person: ["1", "2", "3"], decl: ["1", "2", "3"],
    };
    function drawRows() {
      clear(rowsWrap);
      for (const d of dims()) {
        const row = h("div.chips", { role: "group", "aria-label": M.DIM_LABEL[d] },
          h("span.dimlabel", M.DIM_LABEL[d]),
          OPTS[d].map((v) => h("button.chip.pchip", {
            "aria-pressed": String(ans[d] === (d === "decl" ? +v : v)), "data-d": d, "data-v": v, disabled: done,
            onclick: () => { ans[d] = d === "decl" ? +v : v; if (d === "mood") { for (const k of ["case", "number", "gender", "person"]) delete ans[k]; } drawRows(); },
          }, M.SHORT[d][v])));
        add(rowsWrap, row);
      }
      checkBtn.disabled = !done && !dims().every((d) => ans[d] != null);
      if (done) markRows();
    }

    let best = null;
    function check() {
      const ok = valid.some((p) => M.dimsFor(p, { askDecl }).every((d) => ans[d] === p[d]) && dims().length === M.dimsFor(p, { askDecl }).length);
      // closest valid parse, for marking
      best = valid.map((p) => ({ p, n: M.dimsFor(p, { askDecl }).filter((d) => ans[d] === p[d]).length })).sort((a, b) => b.n - a.n)[0]?.p;
      done = true; lastOk = ok;
      S.bumpActivity({ reviews: 1, correct: ok ? 1 : 0, parse: 1 });
      S.recordParse(M.categoryLabel(best || valid[0]), ok);
      if (!ok) logged = logParseMistake(it, best, M.describe({ ...best, ...ans }), sess.mode);
      drawRows();
      clear(formEl);
      add(formEl, art ? h("span.art", art + " ") : null, it.lex ? gk(it.form, it.lex.i) : it.form);
      const uniq = M.describeAll(valid);
      const tbl = M.paradigmFor(best || valid[0], it.lemma);
      clear(feedback);
      add(feedback,
        h("div.verdict", { role: "status",  class: ok ? "ok" : "no" }, ok ? "Correct" : "Not quite"),
        h("div", h("b", uniq.length > 1 ? "Valid parsings: " : "Parsing: "), uniq.join(" · or · ")),
        it.lex ? h("div.small.muted", "From ", h("span.greek", dictForm(it.lex)), " · ", it.lex.e) : null,
        h("div.row", { style: { marginTop: "6px" } },
          tbl ? h("button.btn.sm", { onclick: () => modal(tbl.title, tableEl(tbl), { wide: true }) }, icon("paradigms", 16), "See paradigm") : null,
          !ok ? h("button.btn.sm.ghost", { onclick: () => { if (logged) S.deleteMistake(logged.id); S.bumpActivity({ correct: 1 }); lastOk = true; next(true); } }, "I was actually right") : null));
      checkBtn.textContent = "Next";
      checkBtn.disabled = false;
      checkBtn.focus();
    }
    function markRows() {
      for (const b of rowsWrap.querySelectorAll(".pchip")) {
        const d = b.dataset.d, v = d === "decl" ? +b.dataset.v : b.dataset.v;
        if (best && best[d] === v) b.classList.add("right");
        else if (ans[d] === v) b.classList.add("wrong");
      }
    }
    drawRows();
    setKey((e) => { if (document.querySelector(".modal-back")) return; if (e.key === "Enter" && !checkBtn.disabled) { e.preventDefault(); checkBtn.click(); } });
  }

  // ----- production -----
  function produce(it) {
    clear(stage);
    const target = it.source === "paradigm" ? it.target : M.productionTarget([it.target]);
    const art = withArticle ? M.articleFor(target) : null;
    const answers = [...new Set([...(it.answers || []), ...M.formsFor(it.lemma, target)])].map((a) => (art ? `${art} ${a}` : a));
    const lemmaLabel = it.lex ? dictForm(it.lex) : it.lemma;
    const inp = greekInput(h("input.input.greek", { placeholder: art ? "Type the article and the form" : "Type the form", style: { textAlign: "center" } }), S.profile().translit);
    const feedback = h("div");
    let done = false, ok = false, logged = null;
    const btn = h("button.btn.primary.big.block", { onclick: () => (done ? next(ok) : check()) }, "Check");
    add(stage, h("div.card.stack",
      h("div", { style: { textAlign: "center", padding: "10px 0" } },
        h("div.verse", { style: { fontSize: "1.9rem", margin: 0 } }, lemmaLabel),
        h("div", { style: { fontSize: "1.15rem", fontWeight: 600 } }, M.describe(target, { withGender: target.pos !== "noun" })),
        it.lex ? h("div.small.muted", it.lex.e) : null),
      inp, h("div.tiny.muted", "Accents and breathing marks are optional."), feedback, btn));
    setTimeout(() => inp.focus(), 30);
    function check() {
      if (!inp.value.trim()) return inp.focus();
      ok = answers.some((a) => normalize(a) === normalize(inp.value));
      done = true; inp.disabled = true;
      S.bumpActivity({ reviews: 1, correct: ok ? 1 : 0, parse: 1 });
      S.recordParse(M.categoryLabel(target), ok);
      if (!ok) logged = logParseMistake(it, target, inp.value, sess.mode, answers.join(" / "));
      const tbl = M.paradigmFor(target, it.lemma);
      clear(feedback);
      add(feedback,
        h("div.verdict", { role: "status",  class: ok ? "ok" : "no" }, ok ? "Correct" : "Not quite"),
        h("div", answers.length > 1 ? "Accepted forms: " : "Answer: ", h("span.greek", { style: { fontSize: "1.3rem" } }, answers.join(", "))),
        h("div.row", { style: { marginTop: "6px" } },
          tbl ? h("button.btn.sm", { onclick: () => modal(tbl.title, tableEl(tbl), { wide: true }) }, icon("paradigms", 16), "See paradigm") : null,
          !ok ? h("button.btn.sm.ghost", { onclick: () => { if (logged) S.deleteMistake(logged.id); S.bumpActivity({ correct: 1 }); next(true); } }, "I was actually right") : null));
      btn.textContent = "Next";
      btn.focus();
    }
    setKey((e) => { if (document.querySelector(".modal-back")) return; if (e.key === "Enter") { e.preventDefault(); if (done) btn.click(); else if (e.target === inp) check(); } });
  }

  function setKey(fn) {
    if (onKey) document.removeEventListener("keydown", onKey);
    onKey = fn; document.addEventListener("keydown", onKey);
  }

  function finish() {
    if (onKey) document.removeEventListener("keydown", onKey);
    clear(stage);
    bar.style.width = "100%"; countEl.textContent = "";
    const total = i;
    add(stage, h("div.card.stack", { style: { textAlign: "center", padding: "28px" } },
      h("h2", { style: { justifyContent: "center" } }, total ? "Session complete" : "Session ended"),
      total ? h("div.kpis", h("div.kpi", h("b", total), h("span", "forms")), h("div.kpi", h("b", Math.round((100 * right) / total) + "%"), h("span", "correct")), h("div.kpi", h("b", S.today().reviews), h("span", "reviews today"))) : null,
      misses.length ? h("p.small.muted", "Missed: ", h("span.greek", misses.map((m) => m.form).join(", "))) : null,
      h("div.row", { style: { justifyContent: "center" } },
        misses.length ? h("button.btn", { onclick: () => runSession(el, { ...sess, items: S.shuffle([...misses]) }) }, "Retry misses") : null,
        h("button.btn", { onclick: () => { clear(el); parseHome(el); } }, "New session"),
        h("a.btn.primary", { href: "#/today" }, "Today"))));
  }

  show();
  return () => onKey && document.removeEventListener("keydown", onKey);
}

function logParseMistake(it, p, answerText, mode, expectedOverride) {
  const drill = mode === "verbs" ? { mode, tense: p.tense, mood: p.mood } : { mode, cat: M.nounCat(p) };
  return S.logMistake({
    kind: "parse", category: "Parse · " + M.categoryLabel(p), prompt: it.form === undefined ? it.lemma : (expectedOverride ? `${it.lex ? dictForm(it.lex) : it.lemma}: ${M.describe(p)}` : it.form),
    expected: expectedOverride || M.describeAll(it.parses).join(" or "), answer: answerText,
    lemma: it.lex?.id || null, ref: it.ref || null, drill,
  });
}
