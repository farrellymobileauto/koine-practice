// Prepositions in context: see a real NT phrase, decide what the preposition means from the case that follows.
import { h, add, clear, icon } from "../ui.js";
import * as S from "../store.js";
import { LEX, loadNT, prettyRef } from "../data.js";
import { gk } from "../gloss.js";
import { meaningsFor, CASE_NAME } from "../prepositions.js";

let pool = null;

/** Every NT preposition (that takes more than one case) followed by a word whose case we know. */
export async function prepItems() {
  if (pool) return pool;
  const nt = await loadNT();
  pool = [];
  nt.books.forEach((b) => b.c.forEach((vs, ci) => vs.forEach((toks, vi) => {
    if (!toks) return;
    toks.forEach((t, i) => {
      const lex = LEX[t[1]];
      const cases = lex.p === "preposition" || lex.prep ? meaningsFor(lex) : null;
      if (!cases || Object.keys(cases).length < 2) return;
      // the case of the object: first following word with a case
      // the object is the very next word (an article, noun, pronoun, adjective or participle)
      if (/[.,;·:]$/.test(t[0])) return;
      for (let j = i + 1; j < Math.min(toks.length, i + 2); j++) {
        const code = nt.m[toks[j][2]];
        const m = code.match(/^(?:[NATPDRIFKXQ]-(?:[123])?|S-[123][SP]|V-[^-]+-)([NGDA])[SP]/);
        if (!m) return;
        if (!cases[m[1]]) return; // unusual construction; skip
        // phrase: the preposition through the first noun/pronoun (max 5 words)
        let end = j;
        while (end < toks.length - 1 && end < i + 5 && /^T-/.test(nt.m[toks[end][2]])) end++;
        pool.push({
          lex, case: m[1], cases,
          words: toks.slice(i, end + 1).map((x) => ({ w: x[0], lx: x[1], m: nt.m[x[2]] })),
          caseWord: j - i, ref: `${b.b}.${ci + 1}.${vi + 1}`,
        });
        return;
      }
    });
  })));
  return pool;
}

export function samplePrep(items, n) {
  // spread across prepositions and cases rather than drowning in ἐπί
  const byKey = new Map();
  for (const it of items) { const k = it.lex.id + it.case; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(it); }
  const keys = S.shuffle([...byKey.keys()]);
  const out = [];
  while (out.length < n && keys.length) {
    for (const k of [...keys]) {
      const list = byKey.get(k);
      if (!list.length) { keys.splice(keys.indexOf(k), 1); continue; }
      out.push(list.splice(Math.floor(Math.random() * list.length), 1)[0]);
      if (out.length >= n) break;
    }
  }
  return S.shuffle(out);
}

export function runPrepSession(el, items, onNew) {
  clear(el);
  el.dataset.live = "1";
  let i = 0, right = 0;
  const misses = [];
  const bar = h("i", { style: { width: "0%" } });
  const countEl = h("span.small.muted");
  const stage = h("div");
  add(el, h("div.study",
    h("div.progress-line", h("button.icon-btn", { onclick: finish, "aria-label": "End session" }, icon("x")), h("div.goal-bar", bar), countEl),
    stage));
  let onKey = null;
  const cleanupKeys = () => { if (onKey) document.removeEventListener("keydown", onKey); onKey = null; };
  window.addEventListener("hashchange", cleanupKeys, { once: true });

  function show() {
    if (i >= items.length) return finish();
    countEl.textContent = `${i}/${items.length}`;
    bar.style.width = (100 * i) / items.length + "%";
    const it = items[i];
    clear(stage);
    let done = false;
    const phrase = h("div.verse", { style: { fontSize: "2rem", margin: 0, textAlign: "center" } }, it.words.map((w, k) => [h("span", { class: k === 0 ? "prep-hl" : "" }, w.w), " "]));
    const feedback = h("div");
    const opts = Object.entries(it.cases);
    const nextBtn = h("button.btn.primary.big.block", { hidden: true, onclick: () => { i++; show(); } }, "Next");
    const buttons = opts.map(([c, meaning]) => h("button", { onclick: () => answer(c) }, meaning));
    add(stage, h("div.card.stack",
      h("div", { style: { textAlign: "center", padding: "12px 0 4px" } },
        h("div.small.muted", `${prettyRef(it.ref)} · real NT phrase`), phrase),
      h("h3", { style: { textAlign: "center" } }, `What does ${it.lex.g} mean here?`),
      h("div.options", buttons), feedback, nextBtn));

    function answer(c) {
      if (done) return;
      done = true;
      const ok = c === it.case;
      if (ok) right++; else misses.push(it);
      buttons.forEach((b, k) => { b.disabled = true; if (opts[k][0] === it.case) b.classList.add("right"); else if (opts[k][0] === c) b.classList.add("wrong"); });
      S.bumpActivity({ reviews: 1, correct: ok ? 1 : 0, parse: 1 });
      S.recordParse("prepositions", ok);
      if (!ok) S.logMistake({ kind: "parse", category: "Parse · prepositions", prompt: it.words.map((w) => w.w).join(" "), expected: `${it.lex.g} + ${CASE_NAME[it.case]} = ${it.cases[it.case]}`, answer: it.cases[c], lemma: it.lex.id, ref: it.ref, wordId: `P:${it.lex.id}:${it.case}` });
      const cw = it.words[it.caseWord];
      clear(phrase);
      add(phrase, it.words.map((w, k) => [gk(w.w, w.lx, { morph: w.m, cls: k === 0 ? "prep-hl" : k === it.caseWord ? "case-hl" : "" }), " "]));
      clear(feedback);
      add(feedback,
        h("div.verdict", { role: "status", class: ok ? "ok" : "no" }, ok ? "Correct" : "Not quite"),
        h("div", h("b.greek", it.lex.g), ` + ${CASE_NAME[it.case]} = `, h("b", it.cases[it.case])),
        h("div.small.muted", "The case comes from ", h("span.greek", cw ? cw.w.replace(/[.,;·:]$/, "") : ""), `, which is ${CASE_NAME[it.case]}.`));
      nextBtn.hidden = false; nextBtn.focus();
    }
    onKey = (e) => {
      if (document.querySelector(".modal-back")) return;
      if (!done && /^[1-3]$/.test(e.key) && opts[+e.key - 1]) answer(opts[+e.key - 1][0]);
      else if (done && e.key === "Enter") { e.preventDefault(); nextBtn.click(); }
    };
    cleanupKeys(); document.addEventListener("keydown", onKey);
  }

  function finish() {
    cleanupKeys();
    clear(stage);
    bar.style.width = "100%"; countEl.textContent = "";
    add(stage, h("div.card.stack", { style: { textAlign: "center", padding: "28px" } },
      h("h2", { style: { justifyContent: "center" } }, i ? "Session complete" : "Session ended"),
      i ? h("div.kpis", h("div.kpi", h("b", i), h("span", "phrases")), h("div.kpi", h("b", Math.round((100 * right) / i) + "%"), h("span", "correct")), h("div.kpi", h("b", S.today().reviews), h("span", "reviews today"))) : null,
      h("div.row", { style: { justifyContent: "center" } },
        misses.length ? h("button.btn", { onclick: () => runPrepSession(el, S.shuffle([...misses]), onNew) }, "Retry misses") : null,
        h("button.btn", { onclick: onNew }, "New session"),
        h("a.btn.primary", { href: "#/today" }, "Today"))));
  }
  show();
}
