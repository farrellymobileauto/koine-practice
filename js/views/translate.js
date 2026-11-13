import { h, add, clear, icon, toast, relTime, confirmBox } from "../ui.js";
import * as S from "../store.js";
import { LEX, dictForm } from "../data.js";
import { decodeMorph, stem, contentWords } from "../greek.js";
import { gk, onLookup } from "../gloss.js";
import * as C from "../corpus.js";
import { grade, penalty, HINT_COST } from "../grade.js";
import { go, route } from "../app.js";

const LS = "koine.translatePrefs";
const DEF = { corpus: "nt", book: "", level: "medium", length: "any" };
function prefs() { try { return { ...DEF, ...JSON.parse(localStorage.getItem(LS) || "{}") }; } catch { return { ...DEF }; } }
function savePrefs(p) { try { localStorage.setItem(LS, JSON.stringify(p)); } catch {} }
const draftKey = (id) => "koine.draft." + id;
const getDraft = (id) => { try { return localStorage.getItem(draftKey(id)) || ""; } catch { return ""; } };
const setDraft = (id, v) => { try { v ? localStorage.setItem(draftKey(id), v) : localStorage.removeItem(draftKey(id)); } catch {} };

// ---------------- Translate home ----------------
export function translateHome(el) {
  const p = prefs();
  const seg = (key, opts, after) => {
    const wrap = h("div.seg");
    for (const [v, label] of opts) wrap.append(h("button", { "aria-pressed": String(p[key] === v), onclick: () => { p[key] = v; savePrefs(p); [...wrap.children].forEach((b, i) => b.setAttribute("aria-pressed", String(opts[i][0] === p[key]))); after?.(); } }, label));
    return wrap;
  };
  const bookSel = h("select.input");
  const fillBooks = async () => {
    clear(bookSel).append(h("option", { value: "" }, "Any book"));
    for (const [group, items] of await C.bookOptions(p.corpus)) {
      bookSel.append(h("optgroup", { label: group }, items.map(([v, n]) => h("option", { value: v, selected: v === p.book }, n))));
    }
    if (![...bookSel.options].some((o) => o.value === p.book)) { p.book = ""; savePrefs(p); }
  };
  bookSel.addEventListener("change", () => { p.book = bookSel.value; savePrefs(p); });
  fillBooks();

  const status = h("div.small.muted");
  const getOne = async (surprise = false) => {
    status.textContent = "Finding a verse…";
    const opts = surprise ? { corpus: "both", level: "any", length: "any" } : { ...p };
    if (!surprise && p.book) { const [corp, b] = p.book.split(":"); opts.corpus = corp; opts.book = b; }
    const { verse, relaxed } = await C.pickVerse({ ...opts, known: S.knownLemmas(), exclude: S.flaggedVerses() });
    if (!verse) { status.textContent = "No verse matched. Try other settings."; return; }
    if (relaxed) toast("Nothing matched exactly, so I loosened the filters");
    go("translate/" + encodeURIComponent(verse.id));
  };

  const redo = S.redoQueue();
  const hist = S.translations();
  const avg = hist.length ? Math.round(hist.slice(0, 20).reduce((s, t) => s + t.score, 0) / Math.min(20, hist.length)) : null;

  add(el,
    h("div.page-head", h("h1", "Translate")),
    h("div.card.stack",
      h("h2", "Get a verse"),
      h("div.small.muted", "Text"),
      seg("corpus", [["nt", "New Testament"], ["lxx", "Septuagint"], ["both", "Both"]], () => { p.book = ""; savePrefs(p); fillBooks(); }),
      h("label.field", "Book", bookSel),
      h("div.small.muted", "Difficulty (share of words you know)"),
      seg("level", [["easy", "Easy 90%+"], ["medium", "Medium 75–90%"], ["hard", "Hard"], ["any", "Any"]]),
      h("div.small.muted", "Length"),
      seg("length", [["short", "Short"], ["medium", "Medium"], ["long", "Long"], ["any", "Any"]]),
      h("div.row", h("button.btn.primary.big", { style: { flex: 1 }, onclick: () => getOne(false) }, icon("play"), "Get a verse"), h("button.btn.big", { onclick: () => getOne(true) }, "Surprise me")),
      status),
    redo.length ? h("div.card", { style: { marginTop: "14px" } },
      h("div.row.between", h("h2", { style: { margin: 0 } }, `Redo later · ${redo.length}`), h("a.btn.sm.primary", { href: "#/translate/" + encodeURIComponent(redo[0]) }, "Next one")),
      h("div.small.muted", { style: { marginTop: "6px" } }, "Verses you set aside to try again.")) : null,
    h("div.section-title", "History", avg != null ? h("span", { style: { textTransform: "none", letterSpacing: 0, fontWeight: 500 } }, ` · recent average ${avg}%`) : null),
    hist.length ? h("div.card", h("div.list", hist.slice(0, 40).map((t) => h("a.list-item", { href: "#/translate/" + encodeURIComponent(t.verse) },
      h("div.main", h("div.title", t.label), h("div.meta", (t.text || "").slice(0, 90) + ((t.text || "").length > 90 ? "…" : ""))),
      h("div", { style: { textAlign: "right" } }, h("div", { style: { fontWeight: 700 } }, t.score + "%"), h("div.tiny.muted", relTime(t.ts))))))) :
      h("div.card.empty", "Your translations will show up here."),
    h("p.tiny.muted", { style: { marginTop: "14px" } }, "NT: Tyndale House GNT (STEPBible TAGNT, CC BY 4.0) with the Berean Standard Bible. Septuagint: Brenton's Greek text and English translation (public domain), with computer-assigned lemmas and parsing. Flag any verse that looks wrong."));
}

// ---------------- Verse page ----------------
export function translateVerse(el, id) {
  el.dataset.live = "1";
  add(el, h("a.back", { href: "#/translate" }, icon("back", 16), "Translate"), h("div.card", h("div.small.muted", "Loading verse…")));
  C.getVerse(id).then((verse) => {
    clear(el);
    add(el, h("a.back", { href: "#/translate" }, icon("back", 16), "Translate"));
    if (!verse) { add(el, h("div.card.empty", "That verse isn't available (it may have been filtered out for transcription errors).")); return; }
    const box = h("div.card");
    add(el, box);
    translateCard(box, verse, { full: true });
  });
}

/**
 * The translate exercise for one verse. Used by the Translate tab and the verse of the day.
 * opts: { full (show next/redo/flag actions), title, onGraded(result) }
 */
export function translateCard(box, verse, opts = {}) {
  clear(box);
  const hints = { words: new Set(), parsing: false, lemmas: false };
  const prev = S.lastTranslation(verse.id);
  let draft = getDraft(verse.id) || "";
  const known = S.knownLemmas();
  const cov = Math.round(100 * C.coverage(verse, known));
  const verseEl = h("div.verse.tverse", { lang: "el" });
  const hintEl = h("span.tiny.muted");
  const out = h("div");
  let graded = null;

  const drawVerse = () => {
    clear(verseEl);
    verse.toks.forEach((t, i) => {
      const word = gk(t.w, t.lx, { morph: t.m, cgloss: verse.corpus === "nt" ? t.g : "", lxx: t.lx < 0 ? t.ll : -1, cls: hints.words.has(i) ? "hinted" : "" });
      if (t.lx >= 0 && verse.corpus === "lxx") word.dataset.ll = t.ll; // marks parsing as computer-generated
      word.dataset.i = i;
      if (hints.parsing || hints.lemmas) {
        const lemma = t.lx >= 0 ? LEX[t.lx].g : C.LXX?.lex[t.ll]?.[0] || "";
        add(verseEl, h("span.wblock", word,
          hints.lemmas ? h("span.wsub.greek", lemma) : null,
          hints.parsing ? h("span.wsub", shortParse(t.m)) : null), " ");
      } else add(verseEl, word, " ");
    });
  };
  const off = onLookup((l, elx) => {
    if (!verseEl.contains(elx)) return;
    hints.words.add(+elx.dataset.i); elx.classList.add("hinted"); updateHints();
  });
  const obs = new MutationObserver(() => { if (!document.body.contains(box)) { off(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });

  const updateHints = () => {
    const pen = penalty({ words: hints.words.size, parsing: hints.parsing, lemmas: hints.lemmas });
    hintEl.textContent = pen ? `Hints so far cost ${pen} points` : `Tap a word for help (−${HINT_COST.word} each)`;
  };
  const toggle = (key, label) => {
    const b = h("button.chip", { "aria-pressed": "false", onclick: () => { hints[key] = !hints[key]; b.setAttribute("aria-pressed", String(hints[key])); drawVerse(); updateHints(); } }, label);
    return b;
  };

  const ta = h("textarea.input", { placeholder: "Your English translation…", value: draft });
  ta.addEventListener("input", () => { draft = ta.value; setDraft(verse.id, draft); });

  const check = () => {
    if (!ta.value.trim()) { ta.focus(); return; }
    const first = !graded;
    graded = grade(ta.value, verse, S.learnedSynonyms());
    const pen = penalty({ words: hints.words.size, parsing: hints.parsing, lemmas: hints.lemmas });
    const final = Math.max(0, graded.score - pen);
    if (first) {
      S.saveTranslation({ verse: verse.id, label: verse.label, corpus: verse.corpus, text: ta.value, score: final, raw: graded.score, hints: hints.words.size + (hints.parsing ? 1 : 0) + (hints.lemmas ? 1 : 0) });
      S.bumpActivity({ reviews: 5, translate: 1 });
      S.removeRedo(verse.id);
      for (const r of graded.results) {
        if (r.state !== "miss") continue;
        const t = verse.toks[r.i];
        const l = t.lx >= 0 ? LEX[t.lx] : null;
        S.logMistake({ kind: "translate", category: "Translation · " + (l?.p || "word"), wordId: l ? "L:" + l.id : null, lemma: l?.id || null, prompt: t.w, expected: t.g || l?.e || "", answer: "", ref: verse.label, morph: t.m });
      }
      setDraft(verse.id, "");
      opts.onGraded?.(final);
    }
    showResult(final, pen);
  };

  function showResult(final, pen) {
    clear(out);
    const teach = (r) => {
      const t = verse.toks[r.i];
      const cands = graded.leftovers;
      if (!cands.length) { toast("Every word in your translation already matched something."); return; }
      const pick = h("div.chips", cands.slice(0, 12).map((w) => h("button.chip", { onclick: () => {
        S.learnSynonym(C.lemmaKey(t), stem(w));
        toast(`Got it: “${w}” counts for ${t.w.replace(/[.,;·:]$/, "")} from now on`);
        check();
      } }, w)));
      const wrapper = out.querySelector(".teach");
      clear(wrapper).append(h("div.small", "Which of your words translates ", h("b.greek", t.w.replace(/[.,;·:]$/, "")), "?"), pick);
    };
    add(out,
      h("div.row", { style: { marginTop: "12px" } }, h("span.score", final + "%"),
        h("span.small.muted", pen ? `${graded.score}% of key words found · −${pen} for hints` : "of the key words found in your translation")),
      h("div.wordcheck", graded.results.map((r) => {
        const t = verse.toks[r.i];
        const label = r.state === "name" ? "name" : r.state === "unknown" ? "?" : (t.g || "");
        const chip = h("div.wc", { class: r.state === "name" ? "skip" : r.state === "unknown" ? "skip" : r.state },
          h("span.g", gk(t.w, t.lx, { morph: t.m, cgloss: verse.corpus === "nt" ? t.g : "", lxx: t.lx < 0 ? t.ll : -1 })), h("span.e", label));
        if (r.state === "miss") chip.append(h("button.teachbtn", { onclick: () => teach(r), title: "I translated this. Teach the app my word." }, "I had it"));
        return chip;
      })),
      h("div.teach"),
      h("div.refbox",
        h("div.small.muted", verse.corpus === "nt" ? "Berean Standard Bible" : "Brenton (1851), from the LXX"),
        h("div", verse.en || h("span.muted", "No English available for this verse."))),
      h("p.tiny.muted", "Grey words (articles, conjunctions, particles, names, and Septuagint words without a gloss) aren't scored. If you translated a red word with a different word, tap “I had it” and the app will accept that word from now on."));
    if (opts.full) add(out, h("div.row", { style: { marginTop: "10px" } },
      h("button.btn.primary", { onclick: nextVerse }, "Next verse"),
      h("button.btn", { onclick: () => { S.addRedo(verse.id); toast("Added to Redo later"); } }, "Redo later"),
      flagBtn()));
  }

  const flagBtn = () => h("button.btn.ghost", { onclick: async () => {
    if (!(await confirmBox("Flag this verse?", "It won't be offered again. Use this for verses with transcription errors or a mismatched English translation.", { ok: "Flag it", danger: false }))) return;
    S.flagVerse(verse.id); toast("Flagged. It won't come up again.");
    if (opts.full) nextVerse();
  } }, "Looks wrong?");

  async function nextVerse() {
    const p = prefs();
    const o = { ...p };
    if (p.book) { const [corp, b] = p.book.split(":"); o.corpus = corp; o.book = b; }
    const { verse: v } = await C.pickVerse({ ...o, known: S.knownLemmas(), exclude: new Set([...S.flaggedVerses(), verse.id]) });
    if (v) go("translate/" + encodeURIComponent(v.id));
  }

  add(box,
    h("div.row.between", h("h2", { style: { margin: 0 } }, opts.title || verse.label), h("span.badge", opts.title ? verse.label : verse.corpus === "nt" ? "THGNT" : "Septuagint (Brenton)")),
    h("div.sub", { style: { marginTop: "4px" } }, `You know ${cov}% of these words`, prev ? ` · last time ${prev.score}% (${relTime(prev.ts)})` : ""),
    verseEl,
    h("div.chips", { style: { marginBottom: "10px" } }, toggle("parsing", `Show parsing (−${HINT_COST.parsing})`), toggle("lemmas", `Show lexical forms (−${HINT_COST.lemmas})`)),
    h("label.field", "Translate", ta),
    h("div.row.between", { style: { marginTop: "8px" } }, hintEl, h("div.row", !opts.full ? null : flagBtn(), h("button.btn.primary", { onclick: check }, "Check"))),
    out);
  drawVerse(); updateHints();
  if (opts.restore) {
    // show a finished attempt again (e.g. the verse of the day after the page refreshes)
    ta.value = opts.restore.text || "";
    graded = grade(ta.value, verse, S.learnedSynonyms());
    showResult(opts.restore.score, Math.max(0, (opts.restore.raw ?? opts.restore.score) - opts.restore.score));
  }
  return { check };
}

function shortParse(code) {
  if (!code) return "";
  const t = decodeMorph(code).text;
  return t.replace(/^(noun|verb|adjective|article|personal pronoun|preposition|conjunction|adverb|particle), ?/, (m, w) => (/^(preposition|conjunction|adverb|particle)$/.test(w) ? w + " " : ""))
    .replace("person", "").replace(/singular/g, "sg").replace(/plural/g, "pl").replace(/masculine/g, "m").replace(/feminine/g, "f").replace(/neuter/g, "n")
    .replace(/nominative/g, "nom").replace(/genitive/g, "gen").replace(/dative/g, "dat").replace(/accusative/g, "acc").replace(/indicative/g, "ind").replace(/subjunctive/g, "subj")
    .replace(/imperative/g, "impv").replace(/participle/g, "ptc").replace(/infinitive/g, "inf").replace(/\s+/g, " ").trim();
}
