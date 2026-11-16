// Principal parts: reference table, flashcards, "all six" quiz, and stem spotting (which part is this NT form built on?).
import { h, add, clear, icon, toast } from "../ui.js";
import * as S from "../store.js";
import { LEX } from "../data.js";
import { greekInput, greekMatches, normalize } from "../greek.js";
import * as M from "../morph.js";
import { partsOf, ppVerbs, PART_NAMES, PART_SHORT, partOfForm, variantsOf } from "../pparts.js";
import { startStudy } from "./vocab.js";

const LS = "koine.partsPrefs";
const SETS = [["50", "Core (50+)"], ["25", "25–49×"], ["10", "10–24×"], ["mine", "My verbs"]];
function prefs() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(LS) || "{}"); } catch {}
  return { set: "50", ...p };
}
function savePrefs(p) { try { localStorage.setItem(LS, JSON.stringify(p)); } catch {} }

function verbsFor(set) {
  if (set === "mine") return S.myVerbs().sort((a, b) => b.f - a.f);
  if (set === "50") return ppVerbs(50);
  if (set === "25") return ppVerbs(25, 50);
  return ppVerbs(10, 25);
}
const gloss = (l) => (S.word("L:" + l.id)?.english || l.e || "").split(/[;,]/)[0];

let session = null; // { kind: "six" | "stem", verbs }
function rerender(el) { clear(el); delete el.dataset.live; partsHome(el); }

export function partsHome(el) {
  if (session) { const s = session; session = null; return s.kind === "six" ? sixSession(el, s.verbs) : stemSession(el, s.verbs); }
  const p = prefs();
  add(el, h("div.page-head", h("h1", "Principal parts")),
    h("p.muted", "Every Greek verb's tenses are built on six stems. Learn the first form of each and you can recognize the whole verb."));
  const body = h("div.stack");
  add(el, body);
  draw();

  function draw() {
    clear(body);
    const verbs = verbsFor(p.set);
    const ids = S.ppIds(verbs);
    const seg = h("div.seg", SETS.map(([v, label]) => h("button", { "aria-pressed": String(p.set === v), onclick: () => { p.set = v; savePrefs(p); draw(); } }, label)));
    const due = S.dueCount(ids);
    const none = !verbs.length;
    add(body,
      h("div.card.stack",
        h("div.row.between", seg, h("span.small.muted", none ? "" : `${verbs.length} verbs · ${ids.length} parts`)),
        none ? h("p.muted", p.set === "mine" ? "None of your lists has a verb yet. Add verbs to a list in Vocab." : "No verbs in this group.") : null,
        h("div.grid.modes",
          mode("vocab", "Flashcards", due ? `${due} due · spaced repetition` : "Lexical form → each part, spaced repetition", () => startStudy({ wordIds: ids, mode: "srs", dirs: ["e2g"] }), none),
          mode("paradigms", "All six", "Type every part of a verb at once", () => { session = { kind: "six", verbs }; rerender(el); }, none),
          mode("parse", "Stem spotting", "A real NT form: which part is it built on?", () => { session = { kind: "stem", verbs }; rerender(el); }, none))),
      none ? null : referenceTable(verbs));
  }
}

function mode(ic, title, meta, onclick, disabled) {
  return h("button.mode-card", { onclick, disabled }, icon(ic, 22), h("div", h("div.title", title), h("div.meta.small.muted", meta)));
}

function referenceTable(verbs) {
  const rows = verbs.map((l) => {
    const parts = partsOf(l);
    return h("tr",
      parts.map((x, i) => h("td.greek", { class: x.source === "generated" ? "pp-gen" : x.source === "none" ? "pp-none" : "" },
        i === 0 ? h("a", { href: "#/lexicon/" + encodeURIComponent(l.id) }, x.form) : x.form)),
      h("td.small.muted", gloss(l)));
  });
  return h("details.card", { open: verbs.length <= 60 },
    h("summary", h("strong", "Reference table")),
    h("p.small.muted", "Plain: the form is in the NT. ", h("span.pp-gen", "Italic"), ": the NT has this stem but not this exact form, so it's built from the NT forms. —: the NT doesn't use this part."),
    h("div.table-wrap.pp-table", h("table", h("thead", h("tr", PART_SHORT.map((s) => h("th", s)), h("th", "meaning"))), h("tbody", rows))));
}

// ---------- "All six": type every part of one verb ----------
function orderForReview(verbs) {
  // verbs with due or new part cards first, then the rest
  const now = Date.now();
  const score = (l) => {
    let s = 0;
    for (const id of S.ppIds([l])) { const c = S.card(id, "e2g"); if (!c) s += 1; else if (new Date(c.fsrs.due) <= now) s += 3; }
    return s;
  };
  return S.shuffle([...verbs]).sort((a, b) => score(b) - score(a));
}

function sixSession(el, verbs) {
  el.dataset.live = "1";
  const queue = orderForReview(verbs).slice(0, 10);
  const total = queue.length;
  let done = 0, perfect = 0;
  const bar = h("i", { style: { width: "0%" } });
  const countEl = h("span.small.muted");
  const stage = h("div");
  add(el, h("div.study", h("div.progress-line", h("button.icon-btn", { onclick: finish, "aria-label": "End session" }, icon("x")), h("div.goal-bar", bar), countEl), stage));
  next();

  function next() {
    const l = queue.shift();
    if (!l) return finish();
    clear(stage);
    countEl.textContent = `${done}/${total}`;
    bar.style.width = (100 * done) / total + "%";
    const parts = partsOf(l);
    const inputs = [];
    const rows = parts.map((x, i) => {
      if (i === 0) return null;
      if (x.source === "none") return h("div.pp-row.none", h("label", PART_NAMES[i]), h("div.greek.muted", "— not used in the NT"));
      const inp = greekInput(h("input.input.greek", { placeholder: PART_SHORT[i], autocomplete: "off", "aria-label": PART_NAMES[i] }), S.profile().translit);
      inp.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const after = inputs.find((o) => o.i > i && !o.inp.disabled);
        if (after) after.inp.focus(); else check();
      });
      const out = h("div.pp-out");
      inputs.push({ i, inp, out, x });
      return h("div.pp-row", h("label", PART_NAMES[i]), inp, out);
    });
    const checkBtn = h("button.btn.primary", { onclick: check }, "Check");
    const card = h("div.card.flash.stack",
      h("div.tag", "All six principal parts"),
      h("div.prompt.greek", parts[0].form),
      h("div.hint", gloss(l), " · ", l.f, "× in NT"),
      h("div.pp-rows", rows),
      h("div.row", checkBtn, h("button.btn.ghost", { onclick: () => { inputs.forEach((o) => (o.inp.value = "")); check(); } }, "Show me")));
    add(stage, card, h("div.kbd-hint", "Enter moves to the next part, then checks"));
    setTimeout(() => inputs[0]?.inp.focus(), 20);

    function check() {
      let allOk = true;
      for (const o of inputs) {
        const typed = o.inp.value.trim();
        const ok = !!typed && greekMatches(typed, o.x.form);
        if (!ok) allOk = false;
        o.inp.disabled = true;
        o.inp.classList.add(ok ? "ok" : "no");
        clear(o.out);
        add(o.out, h("span", { class: ok ? "verdict ok" : "verdict no" }, ok ? "✓" : "✗"), " ", h("span.greek", o.x.form),
          o.x.source === "generated" ? h("span.small.muted", " (not in NT as such)") : null);
        const id = `PP:${l.id}:${o.i}`;
        S.review(id, "e2g", ok ? S.Rating.Good : S.Rating.Again);
        if (!ok) S.logMistake({ kind: "vocab", category: "Principal parts", wordId: id, lemma: l.id, prompt: `${parts[0].form} → ${PART_NAMES[o.i].toLowerCase()}`, expected: o.x.form, answer: typed, dir: "e2g" });
      }
      done++;
      if (allOk) perfect++;
      checkBtn.replaceWith(h("button.btn.primary", { onclick: next, autofocus: true }, done === total ? "Finish" : "Next verb"));
      card.querySelector(".btn.ghost")?.remove();
      setTimeout(() => card.querySelector(".btn.primary")?.focus(), 20);
    }
  }

  function finish() {
    clear(el);
    delete el.dataset.live;
    add(el, h("div.card.stack.center",
      h("h2", "Done"),
      h("p", `${perfect} of ${done} verbs with every part right.`),
      h("div.row", { style: { justifyContent: "center" } },
        h("button.btn.primary", { onclick: () => { session = { kind: "six", verbs }; rerender(el); } }, "Another round"),
        h("button.btn", { onclick: () => rerender(el) }, "Back"))));
  }
}

// ---------- stem spotting ----------
function stemItems(verbs) {
  const want = new Map(verbs.map((l) => [l.i, l]));
  const items = [];
  for (const [form, li, codes, count, ref] of M.rawForms() || []) {
    const lex = want.get(li);
    if (!lex || /^(οἶδα|εἰμί)$/.test(lex.g.normalize("NFC"))) continue;
    const parses = codes.flatMap((c) => M.codeToParses(c, lex));
    if (!parses.length) continue;
    const ps = new Set(parses.map((p) => partOfForm(p, form)));
    if (ps.size !== 1) continue; // ambiguous between stems
    const part = [...ps][0];
    if (part == null) continue;
    const parts = partsOf(lex);
    if (!parts || parts[part].source === "none") continue;
    items.push({ form, lex, part, parses, ref, count });
  }
  return items;
}

function stemSession(el, verbs) {
  el.dataset.live = "1";
  const stage = h("div");
  add(el, stage, h("div.muted.small", "Loading forms…"));
  M.loadForms().then(() => {
    el.lastChild.remove();
    const pool = stemItems(verbs);
    if (!pool.length) { add(stage, h("p.muted", "No NT forms for these verbs.")); return; }
    // spread across the six parts so the rarer stems come up too
    const byPart = [0, 1, 2, 3, 4, 5].map((i) => S.shuffle(pool.filter((it) => it.part === i)));
    const queue = [];
    while (queue.length < 15 && byPart.some((b) => b.length)) for (const b of S.shuffle([...byPart])) if (b.length && queue.length < 15) queue.push(b.pop());
    run(queue);
  });

  function run(queue) {
    const total = queue.length;
    let done = 0, right = 0;
    const bar = h("i", { style: { width: "0%" } });
    const countEl = h("span.small.muted");
    const box = h("div");
    clear(stage);
    add(stage, h("div.study", h("div.progress-line", h("button.icon-btn", { onclick: finish, "aria-label": "End session" }, icon("x")), h("div.goal-bar", bar), countEl), box));
    next();

    function next() {
      const it = queue.shift();
      if (!it) return finish();
      clear(box);
      countEl.textContent = `${done}/${total}`;
      bar.style.width = (100 * done) / total + "%";
      const parts = partsOf(it.lex);
      const lexInp = greekInput(h("input.input.greek", { placeholder: "Lexical form (optional)", autocomplete: "off" }), S.profile().translit);
      let answered = false;
      const buttons = PART_NAMES.map((name, i) => h("button.chip.pchip", { onclick: () => answer(i) }, name));
      const res = h("div.stack");
      const card = h("div.card.flash.stack",
        h("div.tag", "Which principal part is this form built on?"),
        h("div.prompt.greek", it.form),
        h("div.chips", buttons),
        h("div.chips", lexInp),
        res);
      add(box, card, h("div.kbd-hint", "Keys 1–6 pick a part"));
      const keys = (e) => { if (!document.body.contains(card)) { document.removeEventListener("keydown", keys); return; } if (!answered && /^[1-6]$/.test(e.key) && document.activeElement !== lexInp) answer(+e.key - 1); else if (answered && e.key === "Enter") nextBtn?.click(); };
      document.addEventListener("keydown", keys);
      let nextBtn = null;

      function answer(i) {
        if (answered) return;
        answered = true;
        document.removeEventListener("keydown", keys);
        const ok = i === it.part;
        const typed = lexInp.value.trim();
        const lexOk = !typed || greekMatches(typed, parts[0].form);
        if (ok && lexOk) right++;
        buttons.forEach((b, j) => { b.disabled = true; if (j === it.part) b.classList.add("right"); if (j === i && !ok) b.classList.add("wrong"); });
        lexInp.disabled = true;
        S.bumpActivity({ parse: 1 });
        if (!ok) S.logMistake({ kind: "parse", category: "Principal parts · stem", lemma: it.lex.id, prompt: it.form, expected: PART_NAMES[it.part], answer: PART_NAMES[i] });
        const pf = parts[it.part].form;
        add(res,
          h("div.verdict", { class: ok && lexOk ? "ok" : "no", role: "status" }, ok ? (lexOk ? "Correct" : "Right stem, but the lexical form is " + parts[0].form) : "It's the " + PART_NAMES[it.part].toLowerCase()),
          h("div", h("span.greek", it.form), " ← ", h("span.greek", pf), h("span.muted", ` (${PART_NAMES[it.part].toLowerCase()} of `), h("span.greek", parts[0].form), h("span.muted", ")")),
          h("div.small.muted", M.describeAll(it.parses).join("; ")),
          h("div.small.muted", "Principal parts: ", h("span.greek", parts.map((x) => x.form).join(", "))));
        nextBtn = h("button.btn.primary", { onclick: () => { done++; next(); } }, done + 1 === total ? "Finish" : "Next");
        add(res, h("div.row", nextBtn));
        setTimeout(() => nextBtn.focus(), 20);
      }
    }

    function finish() {
      clear(el);
      delete el.dataset.live;
      add(el, h("div.card.stack.center",
        h("h2", "Done"),
        h("p", `${right} of ${done} right.`),
        h("div.row", { style: { justifyContent: "center" } },
          h("button.btn.primary", { onclick: () => { session = { kind: "stem", verbs }; rerender(el); } }, "Another round"),
          h("button.btn", { onclick: () => rerender(el) }, "Back"))));
    }
  }
}
