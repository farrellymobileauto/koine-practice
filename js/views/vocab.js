import { h, add, clear, icon, modal, toast, confirmBox, download, pickFile, shortInterval } from "../ui.js";
import * as S from "../store.js";
import { LEX, dictForm, findLemma } from "../data.js";
import { greekInput, greekMatches, normalize, transliterate, hasGreek } from "../greek.js";
import { gk } from "../gloss.js";
import { parseCSV, rowsToPairs, toCSV } from "../csv.js";
import { go } from "../app.js";

const { Rating } = S;
const LS_KEY = "koine.vocabPrefs";
function prefs() {
  try { return { lists: ["smart:core"], dirs: ["g2e"], mode: "srs", ...JSON.parse(localStorage.getItem(LS_KEY) || "{}") }; }
  catch { return { lists: ["smart:core"], dirs: ["g2e"], mode: "srs" }; }
}
function savePrefs(p) { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {} }

const DIR_LABEL = { g2e: "Greek → English", e2g: "English → Greek" };

function listStats(l) {
  let known = 0, learning = 0, due = 0;
  for (const w of l.wordIds) {
    const a = S.cardState(w, "g2e"), b = S.cardState(w, "e2g");
    if (a === "due" || b === "due") due++;
    if (a === "known" || b === "known") known++;
    else if (a === "learning" || b === "learning") learning++;
  }
  return { known, learning, due, total: l.wordIds.length };
}

// ---------------- Vocab home ----------------
export function vocabHome(el) {
  const p = prefs();
  const all = S.lists();
  p.lists = p.lists.filter((id) => all.some((l) => l.id === id));
  const selected = new Set(p.lists);

  const counts = h("div.small.muted");
  const startBtn = h("button.btn.primary.big.block", { onclick: start }, icon("play"), "Start studying");
  function refreshCounts() {
    const ids = [...new Set(all.filter((l) => selected.has(l.id)).flatMap((l) => l.wordIds))];
    if (!ids.length) { counts.textContent = "Pick at least one list."; startBtn.disabled = true; return; }
    startBtn.disabled = false;
    if (p.mode === "cram") { counts.textContent = `${ids.length} words · cram mode doesn't change your review schedule`; return; }
    const q = S.buildQueue(ids, { dirs: p.dirs });
    const due = q.filter((x) => x.due).length;
    counts.textContent = `${due} due · ${q.length - due} new (limit ${S.profile().newPerDay}/day, ${S.newRemainingToday()} left today) · ${ids.length} words`;
  }
  function start() {
    const ids = [...new Set(all.filter((l) => selected.has(l.id)).flatMap((l) => l.wordIds))];
    startStudy({ wordIds: ids, dirs: p.dirs, mode: p.mode, title: all.filter((l) => selected.has(l.id)).map((l) => l.name).join(", ") });
  }
  const chip = (l) => {
    const b = h("button.chip", { "aria-pressed": String(selected.has(l.id)), onclick: () => {
      selected.has(l.id) ? selected.delete(l.id) : selected.add(l.id);
      b.setAttribute("aria-pressed", String(selected.has(l.id)));
      p.lists = [...selected]; savePrefs(p); refreshCounts();
    } }, l.name, h("span.badge", l.wordIds.length));
    return b;
  };
  const seg = (opts, cur, onPick) => {
    const wrap = h("div.seg");
    for (const [v, label] of opts) {
      add(wrap, h("button", { "aria-pressed": String(cur(v)), onclick: (e) => { onPick(v); [...wrap.children].forEach((c, i) => c.setAttribute("aria-pressed", String(cur(opts[i][0])))); refreshCounts(); } }, label));
    }
    return wrap;
  };

  const usable = all.filter((l) => l.wordIds.length);
  add(el, 
    h("div.page-head", h("h1", "Vocab"),
      h("button.btn.sm", { onclick: () => importCSV() }, icon("upload", 18), "Import CSV"),
      h("button.btn.sm.primary", { onclick: newList }, icon("plus", 18), "New list")),
    h("div.card.stack",
      h("h2", "Study"),
      h("div.small.muted", "Lists to study"),
      h("div.chips", usable.map(chip)),
      h("div.row",
        seg([["g2e", "Greek → English"], ["e2g", "English → Greek"], ["both", "Both"]],
          (v) => (v === "both" ? p.dirs.length === 2 : p.dirs.length === 1 && p.dirs[0] === v),
          (v) => { p.dirs = v === "both" ? ["g2e", "e2g"] : [v]; savePrefs(p); }),
        seg([["srs", "Spaced review"], ["cram", "Cram"]], (v) => p.mode === v, (v) => { p.mode = v; savePrefs(p); })),
      counts, startBtn),
    section("My lists", all.filter((l) => l.kind === "mine"), h("div.empty", "No lists yet. Create one, import a CSV, or copy a built-in list.")),
    section("Automatic", all.filter((l) => l.kind === "auto")),
    section("Built-in (by NT frequency)", all.filter((l) => l.kind === "smart")));
  refreshCounts();
}

function section(title, lists, empty) {
  return [
    h("div.section-title", title),
    h("div.card", lists.length ? h("div.list", lists.map((l) => {
      const st = listStats(l);
      return h("a.list-item", { href: "#/vocab/list/" + encodeURIComponent(l.id) },
        h("div.main", h("div.title", l.name), h("div.meta", l.desc ? l.desc + " · " : "", `${st.total} words · ${st.known} known`)),
        st.due ? h("span.badge.due", st.due + " due") : null);
    })) : empty || h("div.empty", "Nothing here yet.")),
  ];
}

function newList() {
  modal("New list", (close) => {
    const name = h("input.input", { placeholder: "e.g. Mounce ch. 4, 1 John vocab", maxlength: 80 });
    const create = () => {
      if (!name.value.trim()) return name.focus();
      const l = S.createList(name.value.trim());
      close(); go("vocab/list/" + encodeURIComponent(l.id));
    };
    name.addEventListener("keydown", (e) => e.key === "Enter" && create());
    return h("div.stack", h("label.field", "Name", name), h("div.row.end", h("button.btn.primary", { onclick: create }, "Create list")));
  });
}

// ---------------- CSV import ----------------
export async function importCSV(targetListId = null) {
  const file = await pickFile(".csv,.tsv,.txt,text/csv");
  if (!file) return;
  const text = await file.text();
  const pairs = rowsToPairs(parseCSV(text));
  if (!pairs.length) { toast("No rows found. The file needs two columns: english, greek.", "bad"); return; }
  const mine = S.lists().filter((l) => l.kind === "mine");
  modal("Import " + file.name, (close) => {
    const name = h("input.input", { value: file.name.replace(/\.[^.]+$/, "") });
    const target = h("select.input", h("option", { value: "__new" }, "A new list"), mine.map((l) => h("option", { value: l.id, selected: l.id === targetListId }, l.name)));
    const nameField = h("label.field", "New list name", name);
    target.addEventListener("change", () => nameField.classList.toggle("hidden", target.value !== "__new"));
    if (targetListId) nameField.classList.add("hidden");
    const matched = pairs.filter((p) => findLemma(p.greek)).length;
    const go_ = () => {
      const ids = pairs.map((p) => S.makeWord(p.greek, p.english));
      let id = target.value;
      if (id === "__new") id = S.createList(name.value.trim() || "Imported list", ids).id;
      else S.updateList(id, { wordIds: [...S.list(id).wordIds, ...ids] });
      close(); toast(`Imported ${ids.length} words`);
      go("vocab/list/" + encodeURIComponent(id));
    };
    return h("div.stack",
      h("p.small", `${pairs.length} rows · ${matched} matched to NT words (these get frequency, parsing and tap-to-gloss). Your English is kept for every word.`),
      h("div.table-wrap", h("table",
        h("thead", h("tr", h("th", "English"), h("th", "Greek"), h("th", "NT match"))),
        h("tbody", pairs.slice(0, 200).map((p) => {
          const l = findLemma(p.greek);
          return h("tr", h("td", p.english), h("td.greek", p.greek), h("td", l ? h("span.badge.known", "✓ " + l.f + "×") : h("span.badge", "custom")));
        })))),
      pairs.length > 200 ? h("p.tiny.muted", `Showing the first 200 of ${pairs.length}.`) : null,
      h("label.field", "Add to", target), nameField,
      h("div.row.end", h("button.btn.ghost", { onclick: close }, "Cancel"), h("button.btn.primary", { onclick: go_ }, `Import ${pairs.length} words`)));
  }, { wide: true });
}

// ---------------- List detail ----------------
export function listView(el, id) {
  const l = S.list(id);
  if (!l) { add(el, h("a.back", { href: "#/vocab" }, icon("back", 16), "Vocab"), h("div.empty", "That list doesn't exist (it may have been deleted).")); return; }
  const mine = l.kind === "mine";
  const st = listStats(l);
  const filter = h("input.input", { placeholder: "Filter words…", type: "search" });
  const body = h("div.list");
  const words = l.wordIds.map((w) => S.word(w)).filter(Boolean);

  function renderRows() {
    clear(body);
    const q = filter.value.trim().toLowerCase();
    const nq = normalize(transliterate(q));
    const shown = words.filter((w) => !q || w.english.toLowerCase().includes(q) || normalize(w.greek).includes(nq) || normalize(w.greek).includes(normalize(q)));
    for (const w of shown.slice(0, 600)) {
      const a = S.cardState(w.id, "g2e"), b = S.cardState(w.id, "e2g");
      const state = a === "due" || b === "due" ? "due" : a === "known" || b === "known" ? "known" : a === "learning" || b === "learning" ? "learning" : "new";
      add(body, h("div.list-item",
        h("div.main",
          h("div.word-g", w.lex ? gk(w.greek, w.lex.i) : w.greek),
          h("div.meta", w.english, w.freq ? ` · ${w.pos} · ${w.freq}×` : "")),
        h("span.badge", { class: state }, state),
        h("button.icon-btn", { onclick: () => editWord(w), "aria-label": "Edit word" }, icon("edit", 18)),
        mine ? h("button.icon-btn", { onclick: () => { S.updateList(l.id, { wordIds: l.wordIds.filter((x) => x !== w.id) }); toast("Removed from list"); }, "aria-label": "Remove from list" }, icon("x", 18)) : null));
    }
    if (shown.length > 600) add(body, h("div.empty.small", `Showing 600 of ${shown.length}. Use the filter to narrow it down.`));
    if (!shown.length) add(body, h("div.empty", words.length ? "No matches." : mine ? "This list is empty. Add words or import a CSV." : "Nothing here yet."));
  }
  filter.addEventListener("input", renderRows);

  const exportCSV = () => download(l.name.replace(/[^\w\- ]+/g, "").trim() + ".csv", toCSV(words.map((w) => ({ english: w.english, greek: w.greek }))), "text/csv;charset=utf-8");

  add(el, 
    h("a.back", { href: "#/vocab" }, icon("back", 16), "Vocab"),
    h("div.page-head",
      h("h1", l.name),
      mine ? h("button.icon-btn", { onclick: rename, "aria-label": "Rename list" }, icon("edit")) : null),
    l.desc ? h("p.muted", l.desc) : null,
    h("div.kpis", h("div.kpi", h("b", st.total), h("span", "words")), h("div.kpi", h("b", st.known), h("span", "known")), h("div.kpi", h("b", st.due), h("span", "due now"))),
    h("div.row", { style: { margin: "14px 0" } },
      h("button.btn.primary", { disabled: !words.length, onclick: () => startStudy({ wordIds: l.wordIds, dirs: prefs().dirs, mode: prefs().mode, title: l.name }) }, icon("play", 18), "Study"),
      mine ? h("button.btn", { onclick: () => addWords(l) }, icon("plus", 18), "Add words") : null,
      mine ? h("button.btn", { onclick: () => importCSV(l.id) }, icon("upload", 18), "Import") : null,
      h("button.btn", { onclick: exportCSV, disabled: !words.length }, icon("download", 18), "Export CSV"),
      !mine ? h("button.btn", { onclick: () => { const n = S.createList(l.name + " (copy)", l.wordIds); go("vocab/list/" + encodeURIComponent(n.id)); toast("Copied to My lists"); } }, icon("copy", 18), "Copy to my lists") : null,
      mine ? h("button.btn.ghost", { onclick: async () => { if (await confirmBox("Delete list?", `“${l.name}” will be deleted. The words and your review progress stay.`)) { S.deleteList(l.id); go("vocab"); } } }, icon("trash", 18), "Delete") : null),
    words.length > 12 ? filter : null,
    h("div.card", { style: { marginTop: "10px" } }, body));
  renderRows();

  function rename() {
    modal("Rename list", (close) => {
      const name = h("input.input", { value: l.name });
      const save = () => { if (name.value.trim()) { S.updateList(l.id, { name: name.value.trim() }); close(); } };
      name.addEventListener("keydown", (e) => e.key === "Enter" && save());
      return h("div.stack", name, h("div.row.end", h("button.btn.primary", { onclick: save }, "Save")));
    });
  }
}

function editWord(w) {
  modal("Edit word", (close) => {
    const g = greekInput(h("input.input.greek", { value: w.greek }), S.profile().translit);
    const e = h("input.input", { value: w.english });
    const save = () => {
      if (!g.value.trim() || !e.value.trim()) return;
      S.saveWord({ ...w, greek: g.value.trim(), english: e.value.trim() });
      close(); toast("Saved");
    };
    return h("div.stack",
      h("label.field", "Greek", g),
      h("label.field", "English", e),
      w.lex ? h("p.small.muted", `NT lexicon: ${dictForm(w.lex)} = ${w.lex.e} (${w.lex.f}×)`) : null,
      h("div.row.end",
        w.edited ? h("button.btn.ghost", { onclick: () => { S.db.remove("words", w.id); close(); toast("Reset to lexicon"); } }, "Reset to lexicon") : null,
        h("button.btn.primary", { onclick: save }, "Save")));
  });
}

function addWords(l) {
  modal("Add words to " + l.name, (close) => {
    const added = new Set(l.wordIds);
    const q = h("input.input", { placeholder: "Search Greek or English (e.g. logos, λογος, word)", type: "search" });
    const results = h("div.list");
    const search = () => {
      clear(results);
      const s = q.value.trim();
      if (!s) { add(results, h("div.empty.small", "Type to search the 5,500 words in the NT.")); return; }
      const ng = normalize(hasGreek(s) ? s : transliterate(s));
      const le = s.toLowerCase();
      const hits = [];
      for (const x of LEX) {
        if (normalize(x.g).startsWith(ng) || (!hasGreek(s) && x.e.toLowerCase().split(/[\/,; ]+/).some((p) => p.startsWith(le)))) hits.push(x);
        if (hits.length >= 40) break;
      }
      for (const x of hits) {
        const wid = "L:" + x.id;
        const btn = h("button.btn.sm", { disabled: added.has(wid), onclick: () => {
          added.add(wid); btn.disabled = true; btn.textContent = "Added";
          S.updateList(l.id, { wordIds: [...(S.list(l.id).wordIds), wid] });
        } }, added.has(wid) ? "Added" : "Add");
        add(results, h("div.list-item", h("div.main", h("div.word-g", dictForm(x)), h("div.meta", `${x.e} · ${x.p} · ${x.f}×`)), btn));
      }
      if (!hits.length) add(results, h("div.empty.small", "No NT words match. Add it as a custom word below."));
    };
    q.addEventListener("input", search);
    const cg = greekInput(h("input.input.greek", { placeholder: "Greek" }), S.profile().translit);
    const ce = h("input.input", { placeholder: "English" });
    const addCustom = () => {
      if (!cg.value.trim() || !ce.value.trim()) return toast("Enter both Greek and English", "bad");
      const id = S.makeWord(cg.value, ce.value);
      S.updateList(l.id, { wordIds: [...S.list(l.id).wordIds, id] });
      toast("Added " + cg.value.trim()); cg.value = ""; ce.value = ""; cg.focus();
    };
    search();
    return h("div.stack", q, results,
      h("div.section-title", "Or add your own word"),
      h("div.grid.two", cg, ce),
      h("div.row.between", h("span.tiny.muted", S.profile().translit ? "Type Latin letters to get Greek (see Profile for the key chart)." : ""), h("button.btn", { onclick: addCustom }, "Add custom word")),
      h("div.row.end", h("button.btn.primary", { onclick: close }, "Done")));
  }, { wide: true });
}

// ---------------- Study session ----------------
let pending = null;
export function startStudy(opts) { pending = opts; go("vocab/study"); }

export function studyView(el) {
  if (!pending) { go("vocab"); return; }
  const opts = pending;
  el.dataset.live = "1";
  const cram = opts.mode === "cram";
  let queue = opts.queue ? [...opts.queue] : S.buildQueue(opts.wordIds, { mode: opts.mode, dirs: opts.dirs });
  const total = queue.length;
  let done = 0, correct = 0, reviewed = 0;
  const seen = new Set();
  let cur = null, revealed = false, verdict = null, typed = "";
  const missed = [];

  const bar = h("i", { style: { width: "0%" } });
  const countEl = h("span.small.muted");
  const stage = h("div");
  add(el, 
    h("div.study",
      h("div.progress-line", h("button.icon-btn", { onclick: finish, "aria-label": "End session" }, icon("x")), h("div.goal-bar", bar), countEl),
      stage));

  function next() {
    cur = queue.shift();
    revealed = false; verdict = null; typed = "";
    if (!cur) return finish();
    draw();
  }

  function draw() {
    clear(stage);
    countEl.textContent = `${done}/${total}`;
    bar.style.width = (total ? (100 * done) / total : 100) + "%";
    const w = S.word(cur.wordId);
    if (!w) { next(); return; }
    const g2e = cur.dir === "g2e";
    const meta = [w.pos, w.freq ? w.freq + "× in NT" : ""].filter(Boolean).join(" · ");
    const isNew = !S.card(cur.wordId, cur.dir);
    const card = h("div.card.flash", { onclick: () => { if (g2e && !revealed) reveal(); } },
      h("div.tag", DIR_LABEL[cur.dir], isNew && !cram ? " · new" : ""),
      h("div.prompt", { class: g2e ? "greek" : "" }, g2e ? w.greek : w.english),
      !g2e && w.prepCase ? h("div.hint", `preposition + ${({ G: "genitive", D: "dative", A: "accusative" })[w.prepCase]}`) : null);
    if (g2e) {
      if (!revealed) add(card, h("div.hint", "Tap or press Space to show the answer"));
      else add(card, h("div.answer", w.english), h("div.hint", meta));
    } else {
      const inp = greekInput(h("input.input.greek", { placeholder: "Type the Greek", value: typed, disabled: revealed }), S.profile().translit);
      inp.addEventListener("click", (e) => e.stopPropagation());
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (!revealed) check(inp.value); } });
      add(card, inp);
      if (!revealed) add(card, h("div.row", h("button.btn.primary", { onclick: (e) => { e.stopPropagation(); check(inp.value); } }, "Check"), h("button.btn.ghost", { onclick: (e) => { e.stopPropagation(); check(""); } }, "I don't know")));
      else add(card, h("div.verdict", { role: "status",  class: verdict ? "ok" : "no" }, verdict ? "Correct" : typed ? "Not quite" : "Answer"), h("div.answer.greek", w.lex ? gk(w.greek, w.lex.i) : w.greek), h("div.hint", meta));
      if (!revealed) setTimeout(() => inp.focus(), 20);
    }
    add(stage, card);
    if (revealed) add(stage, rateButtons(w));
    add(stage, h("div.kbd-hint", revealed ? "Keys: 1 Again · 2 Hard · 3 Good · 4 Easy" : g2e ? "Space to flip" : "Enter to check"));
  }

  function reveal() { revealed = true; draw(); }
  function check(v) {
    typed = v; verdict = greekMatches(v, S.word(cur.wordId).greek); revealed = true; draw();
  }

  function rateButtons(w) {
    if (cram) {
      return h("div.rate", { style: { gridTemplateColumns: "1fr 1fr" } },
        h("button.again", { onclick: () => rate(Rating.Again) }, "Missed it", h("small", "see again")),
        h("button.good", { onclick: () => rate(Rating.Good) }, "Got it", h("small", "next")));
    }
    const pv = S.preview(cur.wordId, cur.dir);
    const b = (r, cls, label) => h("button", { class: cls, onclick: () => rate(r) }, label, h("small", shortInterval(pv[r])));
    const wrap = h("div");
    if (cur.dir === "e2g" && verdict === false && typed) {
      add(wrap, h("div.row.end", { style: { marginTop: "10px" } }, h("button.btn.sm.ghost", { onclick: () => { verdict = true; draw(); } }, "I was actually right")));
    }
    const rate4 = h("div.rate", b(Rating.Again, "again", "Again"), b(Rating.Hard, "hard", "Hard"), b(Rating.Good, "good", "Good"), b(Rating.Easy, "easy", "Easy"));
    if (cur.dir === "e2g" && verdict === false) [...rate4.children].slice(1).forEach((x) => (x.disabled = true));
    add(wrap, rate4);
    return wrap;
  }

  function rate(r) {
    const w = S.word(cur.wordId);
    const firstTime = !seen.has(cur.wordId + cur.dir);
    seen.add(cur.wordId + cur.dir);
    if (r === Rating.Again && firstTime) {
      missed.push(cur.wordId);
      S.logMistake({
        kind: "vocab", category: "Vocab · " + (w.pos || "word"), wordId: w.id, lemma: w.lemma || null,
        prompt: cur.dir === "g2e" ? w.greek : w.english, expected: cur.dir === "g2e" ? w.english : w.greek,
        answer: cur.dir === "e2g" ? typed : "", dir: cur.dir,
      });
    }
    if (firstTime) { reviewed++; if (r !== Rating.Again) correct++; }
    if (cram) {
      S.bumpActivity({ reviews: 1, correct: r === Rating.Again ? 0 : 1 });
      if (r === Rating.Again) queue.splice(Math.min(queue.length, 3), 0, cur); else done++;
    } else {
      const nextCard = S.review(cur.wordId, cur.dir, r);
      if (new Date(nextCard.due) - Date.now() < 15 * 60 * 1000) queue.splice(Math.min(queue.length, 4), 0, { ...cur, again: true });
      else done++;
    }
    next();
  }

  function onKey(e) {
    if (!cur || e.target.tagName === "INPUT") return;
    if (!revealed && cur.dir === "g2e" && (e.key === " " || e.key === "Enter")) { e.preventDefault(); reveal(); return; }
    if (revealed && /^[1-4]$/.test(e.key)) {
      const r = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy][+e.key - 1];
      if (cram && (r === Rating.Hard || r === Rating.Easy)) return;
      if (cur.dir === "e2g" && verdict === false && r !== Rating.Again) return;
      rate(r);
    }
    if (revealed && cur.dir === "e2g" && e.key === "Enter") rate(verdict ? Rating.Good : Rating.Again);
  }
  document.addEventListener("keydown", onKey);

  function finish() {
    document.removeEventListener("keydown", onKey);
    cur = null;
    clear(stage);
    bar.style.width = "100%";
    countEl.textContent = "";
    const pct = reviewed ? Math.round((100 * correct) / reviewed) : 0;
    add(stage, h("div.card.stack", { style: { textAlign: "center", padding: "28px" } },
      h("h2", { style: { justifyContent: "center" } }, total === 0 ? "Nothing to review right now" : "Session complete"),
      total === 0 ? h("p.muted", "No cards are due and you've reached today's new-word limit for these lists. Try Cram mode, pick more lists, or raise the daily new-word limit in Profile.") :
        h("div.kpis", h("div.kpi", h("b", reviewed), h("span", "cards")), h("div.kpi", h("b", pct + "%"), h("span", "first-try correct")), h("div.kpi", h("b", S.today().reviews), h("span", "reviews today"))),
      missed.length ? h("p.small.muted", `Missed: ${[...new Set(missed)].map((id) => S.word(id)?.greek.split(",")[0]).join(", ")}`) : null,
      h("div.row", { style: { justifyContent: "center" } },
        h("a.btn", { href: "#/vocab" }, "Back to Vocab"),
        h("a.btn.primary", { href: "#/today" }, "Today"))));
    pending = null;
  }

  next();
  return () => document.removeEventListener("keydown", onKey);
}
