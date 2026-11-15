import { h, add, clear, icon, toast } from "../ui.js";
import * as S from "../store.js";
import { LEX, LEX_BY_ID, dictForm, prettyRef } from "../data.js";
import { normalize, hasGreek, transliterate, greekInput, decodeMorph } from "../greek.js";
import * as M from "../morph.js";
import * as C from "../corpus.js";
import { startStudy } from "./vocab.js";

let defsPromise = null;
const loadDefs = () => (defsPromise ||= fetch("data/defs.json").then((r) => r.json()));

const POS_FILTERS = [["all", "All"], ["noun", "Nouns"], ["verb", "Verbs"], ["adjective", "Adjectives"], ["other", "Other"]];
let state = { q: "", pos: "all", lxx: false };

/** NT lexicon entries + (optionally) Septuagint-only words, as one searchable list. */
async function entries(includeLXX) {
  const out = LEX.map((l) => ({ key: l.id, g: l.g, head: dictForm(l), e: l.e, p: l.p, f: l.f, pn: l.pn, nt: true }));
  if (includeLXX) {
    await C.loadLXXIndex();
    C.LXX.lex.forEach((x, i) => { if (x[3] < 0 && !x[4] && x[2] >= 2) out.push({ key: "lxx:" + i, g: x[0], head: x[0], e: x[1], p: "", f: 0, lxxf: x[2], nt: false }); });
  }
  return out;
}

function search(list, q, pos) {
  const posOk = (x) => pos === "all" || (pos === "other" ? !["noun", "verb", "adjective"].includes(x.p) : x.p === pos);
  const pool = list.filter(posOk);
  if (!q) return pool.filter((x) => !x.pn && x.nt).slice(0, 60);
  const greekQ = hasGreek(q) ? q : transliterate(q.replace(/^h(?=[aeiouhw])/i, "")); // hagios -> αγιος
  const ng = normalize(greekQ);
  const le = q.toLowerCase().trim();
  const scored = [];
  for (const x of pool) {
    const n = normalize(x.g);
    let s = 0;
    if (ng && n === ng) s = 100;
    else if (ng && n.startsWith(ng)) s = 60;
    else if (ng.length >= 3 && n.includes(ng)) s = 30;
    if (!hasGreek(q) && le.length >= 2) {
      const words = (x.e || "").toLowerCase().split(/[^a-z]+/);
      if (words.includes(le)) s = Math.max(s, 80);
      else if (words.some((w) => w.startsWith(le))) s = Math.max(s, 40);
    }
    if (s) scored.push([s + Math.log10((x.f || x.lxxf || 0) + 1) * 4, x]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, 80).map((x) => x[1]);
}

export function lexiconHome(el) {
  // plain box: Latin letters search both the Greek (via transliteration) and the English glosses
  const input = h("input.input", { type: "search", placeholder: "Search Greek or English (λογος, logos, word)", value: state.q, "aria-label": "Search the lexicon", autocomplete: "off", spellcheck: "false", autocapitalize: "off" });
  const results = h("div.list");
  const meta = h("div.small.muted");
  let list = null;
  const run = async () => {
    state.q = input.value.trim();
    list = await entries(state.lxx);
    const r = search(list, state.q, state.pos);
    meta.textContent = state.q ? `${r.length} result${r.length === 1 ? "" : "s"}` : "Most common words. Type to search all 5,400+ NT words.";
    clear(results);
    if (!r.length) { add(results, h("div.empty", "No matches.")); return; }
    for (const x of r) {
      add(results, h("a.list-item", { href: "#/lexicon/" + encodeURIComponent(x.key) },
        h("div.main", h("div.word-g", x.head), h("div.meta", [x.e || (x.nt ? "" : "no gloss"), x.p, x.nt ? `${x.f.toLocaleString()}× NT` : `${x.lxxf}× LXX only`].filter(Boolean).join(" · ")))));
    }
  };
  let t = null;
  input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 150); });
  const seg = h("div.seg", POS_FILTERS.map(([v, l]) => h("button", { "aria-pressed": String(state.pos === v), onclick: (e) => { state.pos = v; [...seg.children].forEach((b, i) => b.setAttribute("aria-pressed", String(POS_FILTERS[i][0] === v))); run(); } }, l)));
  const lxx = h("input.switch", { type: "checkbox", role: "switch", checked: state.lxx, "aria-label": "Include Septuagint-only words" });
  lxx.addEventListener("change", () => { state.lxx = lxx.checked; run(); });
  add(el,
    h("div.page-head", h("h1", "Lexicon")),
    h("div.card.stack", input, h("div.row", seg, h("label.check.switch-row", lxx, h("span.small", "Include Septuagint-only words"))), meta),
    h("div.card", { style: { marginTop: "12px" } }, results));
  run();
  setTimeout(() => input.focus(), 30);
}

export async function lexiconEntry(el, key) {
  el.dataset.live = "1";
  add(el, h("a.back", { href: "#/lexicon" }, icon("back", 16), "Lexicon"), h("div.card", h("div.small.muted", "Loading…")));
  if (key.startsWith("lxx:")) return lxxEntry(el, +key.slice(4));
  const l = LEX_BY_ID.get(key);
  if (!l) { clear(el); add(el, h("a.back", { href: "#/lexicon" }, icon("back", 16), "Lexicon"), h("div.card.empty", "Word not found.")); return; }
  const [defs] = await Promise.all([loadDefs(), M.loadForms(), C.loadLXXIndex()]);
  const def = defs[l.id];
  const lxxCount = C.LXX.lex.reduce((s, x) => s + (x[3] === l.i ? x[2] : 0), 0);
  const w = S.word("L:" + l.id);
  const state_ = S.wordKnown("L:" + l.id) ? "known" : S.card("L:" + l.id, "g2e") ? "learning" : "not studied yet";
  const facts = [
    l.p,
    l.p === "noun" && l.x ? { M: "masculine", F: "feminine", N: "neuter" }[l.x] : null,
    l.d ? `${l.d}${["", "st", "nd", "rd"][l.d]} declension` : null,
    `${l.f.toLocaleString()}× in the NT (#${l.i + 1})`,
    lxxCount ? `${lxxCount.toLocaleString()}× in the LXX` : null,
    state_,
  ].filter(Boolean);

  // add-to-list
  const mine = S.lists().filter((x) => x.kind === "mine");
  const wid = "L:" + l.id;
  const sel = h("select.input.sm", { "aria-label": "Add to list", style: { width: "auto" } }, h("option", { value: "" }, "Add to list…"),
    mine.map((x) => h("option", { value: x.id, disabled: x.wordIds.includes(wid) }, x.name + (x.wordIds.includes(wid) ? " ✓" : ""))), h("option", { value: "__new" }, "+ New list…"));
  sel.addEventListener("change", () => {
    let id = sel.value; if (!id) return;
    if (id === "__new") { const name = prompt("Name for the new list:"); if (!name) { sel.value = ""; return; } id = S.createList(name.trim(), [wid]).id; }
    else S.updateList(id, { wordIds: [...S.list(id).wordIds, wid] });
    toast("Added " + l.g); sel.value = "";
  });

  // forms in the NT
  const forms = (M.rawForms() || []).filter((f) => f[1] === l.i).sort((a, b) => b[3] - a[3]);
  const formRows = forms.map(([form, , codes, count, ref]) => {
    const ps = M.expandAmbiguity(codes.flatMap((c) => M.codeToParses(c, l)));
    const desc = ps.length ? M.describeAll(ps).join(" · or · ") : codes.map((c) => decodeMorph(c).text).join(" / ");
    return { form, desc, count, ref };
  });
  const formsBox = h("div");
  let showAll = false;
  const drawForms = () => {
    clear(formsBox);
    if (!formRows.length) return;
    const rows = showAll ? formRows : formRows.slice(0, 25);
    add(formsBox,
      h("div.table-wrap", { style: { maxHeight: "none" } }, h("table",
        h("thead", h("tr", h("th", "Form"), h("th", "Parsing"), h("th", "Count"), h("th", "First at"))),
        h("tbody", rows.map((r) => h("tr", h("td.greek", { style: { fontSize: "1.1rem" } }, r.form), h("td", r.desc), h("td", r.count),
          h("td", h("a", { href: "#/reader/nt:" + r.ref.split(".").slice(0, 2).join(".") }, prettyRef(r.ref)))))))),
      formRows.length > 25 ? h("button.btn.sm.ghost", { style: { marginTop: "6px" }, onclick: () => { showAll = !showAll; drawForms(); } }, showAll ? "Show fewer" : `Show all ${formRows.length} forms`) : null);
  };

  const defBox = h("div.lexdef");
  if (def) {
    defBox.innerHTML = def[0]; // built from the lexicon data and limited to <b>, <i>, <br>, <a data-r>
    for (const a of defBox.querySelectorAll("a[data-r]")) a.href = "#/reader/nt:" + a.dataset.r.split(".").slice(0, 2).join(".");
  }

  clear(el);
  add(el,
    h("a.back", { href: "#/lexicon" }, icon("back", 16), "Lexicon"),
    h("div.card.stack",
      h("div", h("div.lexhead.greek", dictForm(l)), def?.[1] ? h("div.small.muted", def[1]) : null),
      h("div.lexgloss", w?.english || l.e),
      h("div.chips", facts.map((f) => h("span.badge", f))),
      h("div.row", sel,
        h("button.btn.sm", { onclick: () => startStudy({ wordIds: [wid], dirs: ["g2e", "e2g"], mode: "cram", title: l.g }) }, icon("vocab", 16), "Flashcard"),
        l.p === "verb" ? h("button.btn.sm", { onclick: () => import("./parse.js").then((m) => m.startParseVerb(l.g)) }, icon("parse", 16), "Parse its forms") : null)),
    def ? [h("div.section-title", "Definition (Abbott-Smith)"), h("div.card", defBox)] : null,
    formRows.length ? [h("div.section-title", `Forms in the NT · ${formRows.length}`), h("div.card", formsBox)] : null,
    h("p.tiny.muted", { style: { marginTop: "12px" } }, "Definitions: G. Abbott-Smith, A Manual Greek Lexicon of the New Testament (public domain), via STEPBible TBESG (CC BY 4.0)."));
  drawForms();
}

async function lxxEntry(el, i) {
  await C.loadLXXIndex();
  const x = C.LXX.lex[i];
  clear(el);
  if (!x) { add(el, h("a.back", { href: "#/lexicon" }, icon("back", 16), "Lexicon"), h("div.card.empty", "Word not found.")); return; }
  add(el,
    h("a.back", { href: "#/lexicon" }, icon("back", 16), "Lexicon"),
    h("div.card.stack",
      h("div.lexhead.greek", x[0]),
      h("div.lexgloss", x[1] || "No English gloss available"),
      h("div.chips", h("span.badge", `${x[2].toLocaleString()}× in the LXX`), h("span.badge", "not in the NT")),
      h("p.small.muted", "This word only appears in the Septuagint. Its lemma and parsing were assigned by computer, and there's no dictionary entry for it yet.")));
}
