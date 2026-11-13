import { h, add, clear, icon, toast } from "../ui.js";
import * as S from "../store.js";
import { LEX, loadNT } from "../data.js";
import { gk } from "../gloss.js";
import * as C from "../corpus.js";
import { go } from "../app.js";

const LS = "koine.reader";
const DEF = { corpus: "nt", book: "Jhn", ch: 1, gloss: "unknown", english: false };
function prefs() { try { return { ...DEF, ...JSON.parse(localStorage.getItem(LS) || "{}") }; } catch { return { ...DEF }; } }
function savePrefs(p) { try { localStorage.setItem(LS, JSON.stringify(p)); } catch {} }

/** #/reader or #/reader/nt:Jhn.3 */
export async function readerView(el, loc) {
  el.dataset.live = "1";
  const p = prefs();
  if (loc) {
    const [corpus, rest] = loc.split(":");
    const [book, ch] = rest.split(".");
    Object.assign(p, { corpus, book, ch: +ch || 1 });
  }
  if (p.corpus === "lxx" && !C.apocryphaOn() && C.APOCRYPHA.has(p.book)) Object.assign(p, { book: "Gen", ch: 1 });
  savePrefs(p);

  add(el, h("div.page-head", h("h1", "Reader")), h("div.card", h("div.small.muted", "Loading…")));
  const [nt, en] = await Promise.all([loadNT(), C.loadEnNT()]);
  await C.loadLXXIndex();
  let book, chapters, lxxData = null;
  if (p.corpus === "lxx") {
    lxxData = await C.loadLXXBook(p.book).catch(() => null);
    if (!lxxData) { Object.assign(p, { book: "Gen", ch: 1 }); savePrefs(p); lxxData = await C.loadLXXBook("Gen"); }
    book = { id: p.book, name: C.lxxBookName(p.book) };
    chapters = lxxData.c.length;
  } else {
    const b = nt.books.find((x) => x.b === p.book) || nt.books[3];
    p.book = b.b;
    book = { id: b.b, name: b.n };
    chapters = b.c.length;
  }
  p.ch = Math.min(Math.max(1, p.ch), chapters);
  savePrefs(p);

  const known = S.knownLemmas();
  clear(el);

  // ----- controls -----
  const corpusSeg = h("div.seg", [["nt", "New Testament"], ["lxx", "Septuagint"]].map(([v, l]) =>
    h("button", { "aria-pressed": String(p.corpus === v), onclick: () => { if (p.corpus !== v) go(`reader/${v}:${v === "nt" ? "Jhn" : "Ps"}.1`); } }, l)));
  const bookSel = h("select.input", { "aria-label": "Book" });
  if (p.corpus === "nt") nt.books.forEach((b) => bookSel.append(h("option", { value: b.b, selected: b.b === p.book }, b.n)));
  else {
    const vis = C.lxxBooksVisible();
    bookSel.append(h("optgroup", { label: "Septuagint" }, vis.filter((b) => !C.APOCRYPHA.has(b.id)).map((b) => h("option", { value: b.id, selected: b.id === p.book }, b.n))));
    const ap = vis.filter((b) => C.APOCRYPHA.has(b.id));
    if (ap.length) bookSel.append(h("optgroup", { label: "Apocrypha" }, ap.map((b) => h("option", { value: b.id, selected: b.id === p.book }, b.n))));
  }
  bookSel.addEventListener("change", () => go(`reader/${p.corpus}:${bookSel.value}.1`));
  const chSel = h("select.input", { "aria-label": "Chapter" }, Array.from({ length: chapters }, (_, i) => h("option", { value: i + 1, selected: i + 1 === p.ch }, `Chapter ${i + 1}`)));
  chSel.addEventListener("change", () => go(`reader/${p.corpus}:${p.book}.${chSel.value}`));
  const glossSeg = h("div.seg", { "aria-label": "Glosses" }, [["off", "No glosses"], ["unknown", "Words I don't know"], ["all", "All words"]].map(([v, l]) =>
    h("button", { "aria-pressed": String(p.gloss === v), onclick: () => { p.gloss = v; savePrefs(p); redraw(); } }, l)));
  const engSw = h("input.switch", { type: "checkbox", role: "switch", checked: p.english, "aria-label": "Show English" });
  engSw.addEventListener("change", () => { p.english = engSw.checked; savePrefs(p); redraw(); });

  const nav = () => h("div.row.between", { style: { margin: "14px 0" } },
    h("button.btn", { disabled: p.ch <= 1, onclick: () => go(`reader/${p.corpus}:${p.book}.${p.ch - 1}`) }, icon("back", 16), "Previous"),
    h("span.small.muted", `${book.name} ${p.ch} of ${chapters}`),
    h("button.btn", { disabled: p.ch >= chapters, onclick: () => go(`reader/${p.corpus}:${p.book}.${p.ch + 1}`) }, "Next", h("span", { style: { display: "inline-block", transform: "rotate(180deg)" } }, icon("back", 16))));

  const text = h("div.reader-text", { lang: "el" });
  add(el,
    h("div.page-head", h("h1", `${book.name} ${p.ch}`)),
    h("div.card.stack",
      corpusSeg,
      h("div.grid.two", bookSel, chSel),
      h("div.row", glossSeg, h("label.check.switch-row", engSw, h("span", "English"))),
      h("div.tiny.muted", p.corpus === "nt" ? "Tyndale House GNT · BSB English" : "Brenton's Septuagint (Greek & English) · parsing is computer-assigned")),
    nav(), text, nav());

  function redraw() {
    clear(text);
    const verses = p.corpus === "nt" ? nt.books.find((b) => b.b === p.book).c[p.ch - 1] : lxxData.c[p.ch - 1];
    let hidden = 0;
    (verses || []).forEach((toks, vi) => {
      const vnum = vi + 1;
      if (!toks || !toks.length) { if (p.corpus === "lxx" && toks === null && lxxData.en[p.ch - 1]?.[vi]) hidden++; return; }
      const id = `${p.corpus}:${p.book}.${p.ch}.${vnum}`;
      const words = toks.map((t) => {
        let lx, ll = -1, m, g;
        if (p.corpus === "nt") { lx = t[1]; m = nt.m[t[2]]; g = nt.g[t[3]]; }
        else { const l = C.LXX.lex[t[1]]; lx = l[3]; ll = t[1]; m = C.LXX.m[t[2]]; g = lx >= 0 ? LEX[lx].e : l[1]; }
        const isName = lx >= 0 ? LEX[lx].pn : p.corpus === "lxx" && C.LXX.lex[ll][4];
        const word = gk(t[0], lx, { morph: m, cgloss: p.corpus === "nt" ? g : "", lxx: lx < 0 ? ll : -1 });
        if (lx >= 0 && p.corpus === "lxx") word.dataset.ll = ll;
        const show = p.gloss === "all" || (p.gloss === "unknown" && !isName && !(lx >= 0 && known.has(LEX[lx].id)));
        if (p.gloss === "off" || !g) return [word, " "];
        return [h("span.rblock", word, h("span.rgloss", show ? g : " ")), " "];
      });
      const eng = p.corpus === "nt" ? en[p.book]?.[p.ch - 1]?.[vi] : lxxData.en[p.ch - 1]?.[vi];
      const engEl = h("div.reng", { hidden: !p.english }, eng || "");
      add(text, h("p.rverse", { id: "v" + vnum, class: p.gloss !== "off" ? "interlinear" : "" },
        h("button.vnum", { title: "Show English / translate", "aria-label": `Verse ${vnum} options`, onclick: () => verseMenu(id, engEl) }, vnum), " ",
        words, engEl));
    });
    if (hidden) add(text, h("p.tiny.muted", `${hidden} verse${hidden === 1 ? "" : "s"} in this chapter couldn't be tagged and ${hidden === 1 ? "is" : "are"} hidden.`));
    if (!text.childNodes.length) add(text, h("div.empty", "No readable verses in this chapter."));
  }

  function verseMenu(id, engEl) {
    document.querySelector(".vmenu")?.remove();
    const menu = h("div.vmenu.row",
      h("button.btn.sm", { onclick: () => { engEl.hidden = !engEl.hidden; menu.remove(); } }, engEl.hidden ? "Show English" : "Hide English"),
      h("a.btn.sm.primary", { href: "#/translate/" + encodeURIComponent(id) }, icon("translate", 16), "Translate this verse"),
      h("button.btn.sm.ghost", { onclick: () => menu.remove() }, "Close"));
    engEl.before(menu);
  }

  redraw();
}
