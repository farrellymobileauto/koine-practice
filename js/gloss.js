// Tap-to-gloss: any element with class "gk" and data-lx (lexicon index) shows a popover.
// Optional: data-m (morph code), data-cg (contextual gloss), data-ref.
import { h, add, icon, toast, modal } from "./ui.js";
import { LEX, dictForm } from "./data.js";
import { decodeMorph } from "./greek.js";
import * as S from "./store.js";
import { LXX } from "./corpus.js";
import { codeToParses, paradigmFor } from "./morph.js";

let pop = null;
const hooks = new Set(); // called with (lexEntry, el) on each lookup

export function onLookup(fn) { hooks.add(fn); return () => hooks.delete(fn); }

/** Render a clickable Greek word. */
export function gk(text, lexIndex, { morph = "", cgloss = "", cls = "", lxx = -1 } = {}) {
  if ((lexIndex == null || lexIndex < 0) && lxx < 0) return h("span", { class: cls }, text);
  return h("span.gk", { class: cls, "data-lx": lexIndex >= 0 ? lexIndex : null, "data-ll": lxx >= 0 ? lxx : null, "data-m": morph || null, "data-cg": cgloss || null, tabindex: 0, role: "button" }, text);
}

/** Septuagint word that isn't in the NT lexicon. */
function showLXXOnly(el) {
  const l = LXX?.lex[+el.dataset.ll];
  if (!l) return;
  closeGloss();
  for (const fn of hooks) fn(null, el);
  const m = el.dataset.m ? decodeMorph(el.dataset.m) : null;
  pop = h("div.gloss-pop", { role: "dialog", "aria-label": "Word details" },
    h("div.gp-head", h("div.gp-form.greek", el.textContent.replace(/[.,;·:]$/, "")), h("button.icon-btn", { onclick: closeGloss, "aria-label": "Close" }, icon("x", 18))),
    h("div.gp-lemma.greek", l[0]),
    h("div.gp-gloss", l[1] || (l[4] ? "(name)" : "No gloss: this word isn't in the NT lexicon")),
    m && m.text ? h("div.gp-morph", m.text, h("span.muted", " (computer-generated)")) : null,
    h("div.gp-meta", `${l[2].toLocaleString()}× in the LXX · not in the NT`));
  add(document.body, pop);
  place(el);
}

export function closeGloss() { pop?.remove(); pop = null; }

function show(el) {
  if (el.dataset.lx == null && el.dataset.ll != null) return showLXXOnly(el);
  const l = LEX[+el.dataset.lx];
  if (!l) return;
  const fromLXX = el.dataset.ll != null;
  closeGloss();
  S.recordLookup(l.id);
  for (const fn of hooks) fn(l, el);
  const m = el.dataset.m ? decodeMorph(el.dataset.m) : null;
  const wid = "L:" + l.id;
  const w = S.word(wid);
  const mine = S.lists().filter((x) => x.kind === "mine");
  const sel = h("select.input.sm", { "aria-label": "Add to list" },
    h("option", { value: "" }, "Add to list…"),
    mine.map((x) => h("option", { value: x.id, disabled: x.wordIds.includes(wid) }, x.name + (x.wordIds.includes(wid) ? " ✓" : ""))),
    h("option", { value: "__new" }, "+ New list…"));
  sel.addEventListener("change", () => {
    let id = sel.value;
    if (!id) return;
    if (id === "__new") {
      const name = prompt("Name for the new list:");
      if (!name) { sel.value = ""; return; }
      id = S.createList(name.trim(), [wid]).id;
    } else {
      const lst = S.list(id);
      S.updateList(id, { wordIds: [...lst.wordIds, wid] });
    }
    toast("Added " + l.g);
    closeGloss();
  });
  const state = S.wordKnown(wid) ? "known" : S.card(wid, "g2e") ? "learning" : "not studied yet";
  pop = h("div.gloss-pop", { role: "dialog", "aria-label": "Word details" },
    h("div.gp-head",
      h("div.gp-form.greek", el.textContent.replace(/[.,;·:]$/, "")),
      h("button.icon-btn", { onclick: closeGloss, "aria-label": "Close" }, icon("x", 18))),
    h("div.gp-lemma.greek", dictForm(l)),
    h("div.gp-gloss", w?.english || l.e),
    el.dataset.cg && el.dataset.cg !== l.e ? h("div.gp-cg", "Here: ", h("em", el.dataset.cg)) : null,
    m && m.text ? h("div.gp-morph", m.text, fromLXX ? h("span.muted", " (computer-generated)") : null) : null,
    h("div.gp-meta", `${l.p} · ${l.f.toLocaleString()}× in NT · ${state}`),
    h("div.gp-actions", sel, paradigmButton(el.dataset.m, l)));
  add(document.body, pop);
  place(el);
}

function paradigmButton(code, l) {
  if (!code) return null;
  const p = codeToParses(code, l)[0];
  const t = p && paradigmFor(p, l.g);
  if (!t) return null;
  return h("button.btn.sm", { style: { marginTop: "6px" }, onclick: async () => {
    closeGloss();
    const { tableEl } = await import("./views/paradigms.js");
    modal(t.title, tableEl(t), { wide: true });
  } }, icon("paradigms", 16), "See paradigm");
}

function place(el) {
  if (window.matchMedia("(max-width: 640px)").matches) { pop.classList.add("sheet"); return; }
  const r = el.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 8);
  let top = r.bottom + 8;
  if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 8);
  pop.style.left = left + "px";
  pop.style.top = top + "px";
}

export function initGloss() {
  document.addEventListener("click", (e) => {
    const t = e.target.closest(".gk");
    if (t) { e.preventDefault(); show(t); return; }
    if (pop && !e.target.closest(".gloss-pop")) closeGloss();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeGloss();
    if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("gk")) { e.preventDefault(); show(e.target); }
  });
  window.addEventListener("hashchange", closeGloss);
  window.addEventListener("resize", closeGloss);
}
