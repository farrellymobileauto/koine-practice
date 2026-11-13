import { h, add, clear, icon, toast } from "../ui.js";
import * as S from "../store.js";
import { PARADIGMS, GROUPS, rowsOf, cellsOf, paradigm } from "../paradigms.js";
import { findLemma, dictForm } from "../data.js";
import { greekInput, normalize, greekEqual } from "../greek.js";
import { gk } from "../gloss.js";
import { go } from "../app.js";

export function paradigmsHome(el) {
  const ch = S.profile().chapter || 36;
  const q = h("input.input", { type: "search", placeholder: "Find a paradigm (e.g. aorist, 3rd declension, λύω)" });
  const body = h("div");
  const draw = () => {
    clear(body);
    const s = q.value.trim().toLowerCase();
    for (const g of GROUPS) {
      const ts = PARADIGMS.filter((t) => t.group === g && (!s || (t.title + " " + t.group).toLowerCase().includes(s) || normalize(t.title).includes(normalize(s))));
      if (!ts.length) continue;
      add(body, h("div.section-title", g), h("div.card", h("div.list", ts.map((t) => h("a.list-item", { href: "#/paradigms/" + t.id },
        h("div.main", h("div.title", t.title), h("div.meta", `Mounce ch. ${t.ch}`)),
        t.ch > ch ? h("span.badge", "later") : h("span.badge.known", "learned"))))));
    }
    if (!body.childNodes.length) add(body, h("div.empty", "No paradigms match."));
  };
  q.addEventListener("input", draw);
  add(el,
    h("div.page-head", h("h1", "Paradigms")),
    h("p.muted.small", "Reference tables for quick lookup, plus fill-in tests. Badges compare each table to your Mounce chapter in Profile."),
    q, body);
  draw();
}

export function paradigmView(el, id) {
  const t = paradigm(id);
  if (!t) { add(el, h("a.back", { href: "#/paradigms" }, icon("back", 16), "Paradigms"), h("div.empty", "Paradigm not found.")); return; }
  el.dataset.live = "1";
  let mode = "view"; // view | test-all | test-half
  let hidden = new Set();
  let checked = false;
  const inputs = new Map();
  const cells = cellsOf(t);
  const rows = rowsOf(t);
  const lex = findLemma(t.lemma);
  const stage = h("div");
  const result = h("div");

  const start = (m) => {
    mode = m; checked = false; inputs.clear(); clear(result);
    hidden = new Set(cells.map((c, i) => i).filter(() => m === "test-all" || Math.random() < 0.5));
    if (m === "test-half" && hidden.size < 2) hidden = new Set([0, cells.length - 1]);
    draw();
    setTimeout(() => inputs.values().next().value?.focus(), 30);
  };

  function draw() {
    clear(stage);
    const head = h("tr", h("th", ""), t.cols.map((c) => h("th", c.label)));
    const body = rows.map((r, ri) => h("tr", h("th", { scope: "row" }, r.label), t.cols.map((_, ci) => {
      const idx = cells.findIndex((c) => c.r === ri && c.c === ci);
      const cell = cells[idx];
      if (!cell) return h("td", "");
      if (mode === "view" || !hidden.has(idx)) return h("td.greek.pcell", cell.lex !== null && lex ? gk(cell.display, (findLemma(cell.lemma) || lex).i) : cell.display);
      let inp = inputs.get(idx);
      if (!inp) {
        inp = greekInput(h("input.input.sm.greek.pin", { "aria-label": `${r.label} ${t.cols[ci].label}` }), S.profile().translit);
        inp.addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const order = [...inputs.keys()];
          const next = order[order.indexOf(idx) + 1];
          if (next != null) inputs.get(next).focus(); else check();
        });
        inputs.set(idx, inp);
      }
      const td = h("td.pcell", inp);
      if (checked) {
        const ok = cell.variants.some((v) => greekEqual(inp.value, v));
        td.classList.add(ok ? "ok" : "miss");
        if (!ok) add(td, h("div.greek.small", cell.display));
      }
      return td;
    })));
    add(stage, h("div.table-wrap.ptable", { style: { maxHeight: "none" } }, h("table", h("thead", head), h("tbody", body))));
    if (mode !== "view") add(stage, h("div.row.end", { style: { marginTop: "10px" } },
      checked ? null : h("span.tiny.muted", "Accents optional · Enter moves to the next box"),
      checked ? h("button.btn", { onclick: () => start(mode) }, "Try again") : h("button.btn.primary", { onclick: check }, "Check")));
  }

  function check() {
    if (checked) return;
    checked = true;
    let right = 0;
    for (const idx of hidden) {
      const cell = cells[idx];
      const val = inputs.get(idx)?.value || "";
      const ok = cell.variants.some((v) => greekEqual(val, v));
      if (ok) right++;
      else S.logMistake({ kind: "paradigm", category: "Paradigm · " + t.title, prompt: `${t.cols[cell.c].label} · ${rows[cell.r].label}`, expected: cell.display, answer: val, lemma: (findLemma(cell.lemma) || lex)?.id || null, drill: { paradigm: t.id } });
    }
    S.bumpActivity({ reviews: hidden.size, correct: right, paradigm: 1 });
    draw();
    const pct = Math.round((100 * right) / hidden.size);
    clear(result);
    add(result, h("div.card.row", { style: { marginTop: "12px" } },
      h("span.score", pct + "%"), h("span.muted", `${right} of ${hidden.size} correct`), h("span.spacer"),
      right < hidden.size ? h("span.small.muted", "Misses are in the Mistake Log") : h("span.badge.known", "Perfect")));
  }

  add(el,
    h("a.back", { href: "#/paradigms" }, icon("back", 16), "Paradigms"),
    h("div.page-head", h("h1", t.title)),
    h("div.row", { style: { marginBottom: "10px" } },
      h("span.badge", `Mounce ch. ${t.ch}`),
      lex ? h("span.small", h("span.greek", { style: { fontSize: "1.1rem" } }, gk(dictForm(lex), lex.i)), h("span.muted", " · " + lex.e)) : null),
    t.note ? h("p.small.muted", t.note) : null,
    h("div.row", { style: { margin: "6px 0 12px" } },
      h("div.seg",
        h("button", { "aria-pressed": "true", onclick: (e) => { setSeg(e); mode = "view"; clear(result); draw(); } }, "View"),
        h("button", { onclick: (e) => { setSeg(e); start("test-all"); } }, "Test: all"),
        h("button", { onclick: (e) => { setSeg(e); start("test-half"); } }, "Test: random half")),
      h("button.btn.sm", { onclick: () => import("./parse.js").then((m) => m.startParseWithTable(t.id)) }, icon("parse", 16), "Parse these forms")),
    stage, result);
  draw();
}

/** Read-only table (used in popups from the Parse tab). */
export function tableEl(t) {
  const rows = rowsOf(t);
  const cells = cellsOf(t);
  return h("div.stack",
    t.note ? h("p.small.muted", { style: { margin: 0 } }, t.note) : null,
    h("div.table-wrap.ptable", { style: { maxHeight: "none" } }, h("table",
      h("thead", h("tr", h("th", ""), t.cols.map((c) => h("th", c.label)))),
      h("tbody", rows.map((r, ri) => h("tr", h("th", { scope: "row" }, r.label), t.cols.map((_, ci) => h("td.greek.pcell", cells.find((c) => c.r === ri && c.c === ci)?.display || ""))))))),
    h("a.btn.sm", { href: "#/paradigms/" + t.id }, "Open in Paradigms (fill-in test)"));
}

function setSeg(e) {
  const seg = e.currentTarget.parentElement;
  [...seg.children].forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
}
