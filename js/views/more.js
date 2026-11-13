import { h, add, icon } from "../ui.js";
import * as S from "../store.js";

const SOON = {
  parse: { title: "Parse", phase: 2, text: "Parse nouns and verbs: recognition (identify a form) and production (build the form), using both paradigm forms and real forms from the THGNT, with filters by Mounce chapter. Every valid parsing will count." },
  paradigms: { title: "Paradigms", phase: 2, text: "Quick-reference paradigm tables, plus fill-in-the-blank paradigm tests." },
  reader: { title: "Reader", phase: 4, text: "Read whole chapters with tap-to-gloss and no grading. Words you look up often are added to “Words I keep looking up” automatically." },
};

export function soonView(el, id) {
  const s = SOON[id];
  add(el, h("div.page-head", h("h1", s.title)),
    h("div.card.soon-card", icon(id === "paradigms" ? "paradigms" : id, 48), h("h2", { style: { justifyContent: "center" } }, `Coming in phase ${s.phase}`), h("p.muted", s.text),
      h("a.btn.primary", { href: "#/today" }, "Back to Today")));
}

export function moreView(el) {
  const n = S.mistakes().length;
  const item = (href, ic, title, meta, soon) => h("a.list-item", { href }, icon(ic), h("div.main", h("div.title", title), h("div.meta", meta)), soon ? h("span.badge", "soon") : null);
  add(el, h("div.page-head", h("h1", "More")),
    h("div.card", h("div.list",
      item("#/mistakes", "mistakes", "Mistake Log", n ? `${n} logged` : "Nothing logged yet"),
      item("#/profile", "profile", "Profile", "Settings, Mounce chapter, sync, backup"),
      item("#/paradigms", "paradigms", "Paradigms", "Reference tables & fill-in tests"),
      item("#/reader", "reader", "Reader", "Read whole chapters with tap-to-gloss"))));
}
