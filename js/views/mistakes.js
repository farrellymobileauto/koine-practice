import { h, add, clear, icon, confirmBox, toast, relTime } from "../ui.js";
import * as S from "../store.js";
import { LEX_BY_ID, prettyRef } from "../data.js";
import { hasGreek, decodeMorph } from "../greek.js";
import { gk } from "../gloss.js";
import { startStudy } from "./vocab.js";

const KINDS = [["all", "All"], ["vocab", "Vocab"], ["parse", "Parsing"], ["paradigm", "Paradigms"], ["translate", "Translation"], ["placement", "Placement"]];
let kind = "all";
let range = "all";

export default function mistakesView(el) {
  const all = S.mistakes();
  const since = range === "week" ? Date.now() - 7 * 864e5 : range === "today" ? new Date().setHours(0, 0, 0, 0) : 0;
  const items = all.filter((m) => (kind === "all" || m.kind === kind) && m.ts >= since);
  const selected = new Set();

  const delSel = h("button.btn.sm.danger.hidden", { onclick: async () => {
    if (!(await confirmBox("Delete selected?", `Delete ${selected.size} mistake${selected.size === 1 ? "" : "s"} from the log?`))) return;
    for (const id of selected) S.deleteMistake(id);
    toast("Deleted");
  } }, icon("trash", 16), "Delete selected");
  const updateSel = () => { delSel.classList.toggle("hidden", !selected.size); delSel.lastChild.textContent = `Delete ${selected.size} selected`; };

  const wordIds = [...new Set(items.map((m) => m.wordId).filter((w) => w && S.word(w)))];
  add(el, 
    h("div.page-head", h("h1", "Mistake Log"),
      wordIds.length ? h("button.btn.sm.primary", { onclick: () => startStudy({ wordIds, dirs: ["g2e", "e2g"], mode: "cram", title: "Mistake review" }) }, icon("play", 16), `Review ${wordIds.length} word${wordIds.length === 1 ? "" : "s"}`) : null),
    h("p.muted.small", "Every miss from flashcards, parsing, paradigm tests, the verse of the day and the placement test lands here. Delete entries once you've got them."),
    h("div.row", { style: { marginBottom: "12px" } },
      h("div.seg", KINDS.map(([k, label]) => h("button", { "aria-pressed": String(kind === k), onclick: () => { kind = k; rerender(el); } }, label))),
      h("div.seg", [["all", "All time"], ["week", "7 days"], ["today", "Today"]].map(([k, label]) => h("button", { "aria-pressed": String(range === k), onclick: () => { range = k; rerender(el); } }, label)))),
    h("div.row", { style: { marginBottom: "10px" } },
      h("span.small.muted", `${items.length} mistake${items.length === 1 ? "" : "s"}`),
      h("span.spacer"),
      delSel,
      items.length ? h("button.btn.sm.ghost", { onclick: async () => {
        if (!(await confirmBox("Clear these mistakes?", `This deletes all ${items.length} mistakes currently shown. It can't be undone.`, { ok: "Delete all" }))) return;
        for (const m of items) S.deleteMistake(m.id);
        toast("Mistake log cleared");
      } }, "Delete all shown") : null));

  if (!items.length) {
    add(el, h("div.card.empty", icon("check"), h("div", all.length ? "No mistakes match these filters." : "No mistakes yet. Go make some — that's how you learn.")));
    return;
  }

  let lastDay = null;
  const card = h("div.card", h("div.list"));
  const list = card.firstChild;
  for (const m of items) {
    const day = new Date(m.ts).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    if (day !== lastDay) { add(list, h("div.section-title", { style: { margin: "12px 4px 2px" } }, day)); lastDay = day; }
    const lex = m.lemma ? LEX_BY_ID.get(m.lemma) : null;
    const promptNode = hasGreek(m.prompt) && lex ? gk(m.prompt, lex.i, { morph: m.morph || "" }) : m.prompt;
    const cb = h("input", { type: "checkbox", "aria-label": "Select" });
    cb.addEventListener("change", () => { cb.checked ? selected.add(m.id) : selected.delete(m.id); updateSel(); });
    add(list, h("div.list-item",
      h("label.check", cb),
      h("div.main",
        h("div.title", h("span", { class: hasGreek(m.prompt) ? "word-g" : "" }, promptNode), h("span.muted", " → "), h("span", { class: hasGreek(m.expected) ? "word-g" : "" }, m.expected)),
        m.answer ? h("div.meta", "You answered: ", h("span", { class: hasGreek(m.answer) ? "greek" : "" }, m.answer)) : null,
        m.morph ? h("div.meta", decodeMorph(m.morph).text) : null,
        h("div.meta", [m.category, m.ref ? prettyRef(m.ref) : null, relTime(m.ts)].filter(Boolean).join(" · "))),
      h("button.icon-btn", { onclick: () => { S.deleteMistake(m.id); toast("Deleted"); }, "aria-label": "Delete this mistake" }, icon("trash", 18))));
  }
  add(el, card);
}

function rerender(el) { clear(el); mistakesView(el); }
