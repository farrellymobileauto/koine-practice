import { h, add, clear, icon, toast, confirmBox, download, pickFile, relTime } from "../ui.js";
import * as S from "../store.js";
import * as db from "../db.js";
import * as sync from "../sync.js";
import { MOUNCE, mounceTitle, loadPlacement, LEX, prettyRef } from "../data.js";
import { TRANSLIT, greekInput } from "../greek.js";
import { gk } from "../gloss.js";
import { applyTheme, go } from "../app.js";

export function profileView(el) {
  const p = S.profile();
  const set = (patch) => { S.saveProfile(patch); };

  const field = (label, input, hint) => h("label.field", label, input, hint ? h("span.hint", hint) : null);
  const num = (key, min, max) => {
    const i = h("input.input", { type: "number", min, max, value: p[key], inputmode: "numeric" });
    i.addEventListener("change", () => { const v = Math.max(min, Math.min(max, parseInt(i.value, 10) || min)); i.value = v; set({ [key]: v }); toast("Saved"); });
    return i;
  };
  const select = (key, opts, after) => {
    const s = h("select.input", opts.map(([v, l]) => h("option", { value: v, selected: String(p[key]) === String(v) }, l)));
    s.addEventListener("change", () => { const v = typeof p[key] === "number" ? Number(s.value) : s.value; set({ [key]: v }); after?.(v); toast("Saved"); });
    return s;
  };

  const name = h("input.input", { value: p.name, placeholder: "Your first name", maxlength: 40 });
  name.addEventListener("change", () => { set({ name: name.value.trim() }); toast("Saved"); });

  const lists = S.lists().filter((l) => l.kind !== "auto");
  const dirSel = h("select.input",
    [["g2e", "Greek → English"], ["e2g", "English → Greek (typing)"], ["both", "Both directions"]].map(([v, l]) =>
      h("option", { value: v, selected: (p.dailyDirs || ["g2e"]).length === 2 ? v === "both" : (p.dailyDirs || ["g2e"])[0] === v }, l)));
  dirSel.addEventListener("change", () => { set({ dailyDirs: dirSel.value === "both" ? ["g2e", "e2g"] : [dirSel.value] }); toast("Saved"); });

  const translit = h("input", { type: "checkbox", checked: p.translit });
  translit.addEventListener("change", () => { set({ translit: translit.checked }); toast("Saved"); });
  const tryIt = greekInput(h("input.input.greek", { placeholder: "Try it: type logos" }), p.translit);

  add(el, 
    h("div.page-head", h("h1", "Profile")),
    h("div.grid",
      h("div.card.stack",
        h("h2", icon("profile"), "You"),
        field("Name", name),
        field("Where you are in Mounce", select("chapter", [[0, "Not set"], ...MOUNCE.map(([c, t]) => [c, `Ch. ${c} · ${t}`])]),
          "Used to pick parsing drills and verse difficulty in later phases."),
        h("div.row", h("a.btn", { href: "#/profile/placement" }, "Take the placement test"), h("span.small.muted", "About 5 minutes; suggests a chapter."))),

      h("div.card.stack",
        h("h2", "Practice"),
        h("div.grid.two",
          field("Daily goal (reviews)", num("dailyGoal", 5, 500), "Hitting this, or finishing the verse of the day, counts for your streak."),
          field("New words in Today's practice", num("newPerDay", 0, 100), "How many new words the Today button adds each day from the list below. Studying a list from the Vocab tab has no limit.")),
        h("div.grid.two",
          field("New words in Today's practice come from", select("newSource", lists.map((l) => [l.id, l.name]))),
          field("Today's practice direction", dirSel)),
        field("Verse of the day comes from", select("votdCorpus", [["nt", "New Testament"], ["lxx", "Septuagint"], ["both", "Either"]])),
        apocryphaSwitch(p),
        field("Target recall", select("retention", [[0.85, "85%: fewer reviews"], [0.9, "90%: recommended"], [0.95, "95%: more reviews"]]),
          "How likely you should be to remember a card when it comes due (FSRS scheduling).")),

      h("div.card.stack",
        h("h2", "Typing Greek"),
        h("label.check", translit, h("span", h("b", "Turn Latin keys into Greek letters"), h("br"), h("span.small.muted", "Turn this off if you use a Greek keyboard on your phone or computer. Accents and breathing marks are never required in answers."))),
        h("div.keychart", Object.entries(TRANSLIT).map(([k, g]) => h("span", k, " → ", h("b", g)))),
        h("p.tiny.muted", "Final sigma (ς) is automatic. h = η, q = θ, c = ξ, x = χ, y = ψ, w = ω, f = φ, u = υ."),
        tryIt),

      h("div.card.stack",
        h("h2", "Appearance"),
        field("Theme", select("theme", [["system", "Match my device"], ["light", "Light"], ["dark", "Dark"]], () => applyTheme())),
        h("div.field", h("span", { style: { fontWeight: 500, fontSize: ".9rem" } }, "Accent color"), accentPicker(p.accent || "terracotta"))),

      syncCard(),
      dataCard(),

      h("div.card.small.muted",
        h("h2", "Sources & credits"),
        h("p", "App version: ", h("code", "v12")),
        h("p", "Greek NT text: Tyndale House Greek New Testament (THGNT) readings, grammar tags and glosses from STEPBible's TAGNT, by Tyndale House Cambridge & STEPBible.org, CC BY 4.0 (", h("a", { href: "https://github.com/STEPBible/STEPBible-Data", target: "_blank", rel: "noopener" }, "STEPBible-Data"), "). English glosses are based on the Berean Study Bible. Dictionary forms come from the TBESG lexicon (Abbott-Smith). The data was reformatted for this app: only THGNT words are kept and glosses are shortened."),
        h("p", "Septuagint: Brenton's Greek text and English translation (1851, public domain, via eBible.org). Lemmas and parsing are computer-assigned by looking up each form in the THGNT's tags and in the QuantForge Swete LXX analyses (CC BY-SA 4.0), so they can be wrong for ambiguous forms. NT English: Berean Standard Bible (public domain)."),
        h("p", "Spaced repetition: ts-fsrs (MIT)."))));
}

function apocryphaSwitch(p) {
  const sw = h("input.switch", { type: "checkbox", role: "switch", checked: p.apocrypha !== false, "aria-label": "Include apocryphal books" });
  sw.addEventListener("change", () => { S.saveProfile({ apocrypha: sw.checked }); toast(sw.checked ? "Apocrypha included" : "Apocrypha hidden"); });
  return h("label.check.switch-row", sw, h("span", h("b", "Include the Apocrypha"), h("br"),
    h("span.small.muted", "The deuterocanonical books of the Catholic Bible: Tobit, Judith, 1–2 Maccabees, Wisdom, Sirach, Baruch (with the Letter of Jeremiah), Susanna and Bel and the Dragon. When off, they're hidden from Translate, Reader and the verse of the day. Esther and Daniel keep their Greek additions. Books outside the Catholic canon aren't included at all.")));
}

const ACCENTS = [
  ["terracotta", "Terracotta", "#8a3b12"], ["blue", "Blue", "#2c5d9e"], ["green", "Green", "#2d6a4f"], ["teal", "Teal", "#1c7c7d"],
  ["purple", "Purple", "#6b3fa0"], ["rose", "Rose", "#b0305a"], ["gold", "Gold", "#8a6200"], ["slate", "Slate", "#3d4a5c"],
];
function accentPicker(cur) {
  const label = h("span.small.muted", ACCENTS.find((a) => a[0] === cur)?.[1] || "");
  const wrap = h("div.swatches", { role: "radiogroup", "aria-label": "Accent color" });
  for (const [id, name, color] of ACCENTS) {
    wrap.append(h("button.swatch", {
      style: { background: color }, title: name, "aria-label": name, "aria-pressed": String(id === cur), role: "radio",
      onclick: () => {
        S.saveProfile({ accent: id }); applyTheme(); label.textContent = name;
        [...wrap.children].forEach((b) => b.setAttribute("aria-pressed", String(b.title === name)));
      },
    }));
  }
  return h("div.stack", { style: { gap: "6px" } }, wrap, label);
}

function syncCard() {
  const c = sync.config();
  const card = h("div.card.stack");
  const url = h("input.input", { value: c.url, placeholder: "libsql://your-db-name-yourorg.turso.io", autocomplete: "off", spellcheck: "false" });
  const token = h("input.input", { value: c.token, type: "password", placeholder: "Database token", autocomplete: "off" });
  const status = h("div.small");
  const off = sync.onStatus((s) => {
    clear(status);
    if (!sync.configured()) { add(status, h("span.pill-sync", h("span.dot"), "Not connected. Progress is saved on this device only.")); return; }
    add(status, h("span.pill-sync", h("span.dot", { class: s.state }), s.message || "Connected"), s.last || sync.config().last ? h("span.muted", " · last sync " + relTime(s.last || sync.config().last)) : null);
  });
  const obs = new MutationObserver(() => { if (!document.body.contains(card)) { off(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });

  const connect = async () => {
    if (!url.value.trim() || !token.value.trim()) return toast("Enter the database URL and token", "bad");
    try {
      const n = await sync.testConnection(url.value, token.value);
      sync.saveConfig(url.value, token.value);
      toast(n ? `Connected · ${n} records on the server` : "Connected · new database set up");
      sync.startAutoSync();
      await sync.syncNow();
    } catch (e) { toast("Couldn't connect: " + e.message, "bad"); }
  };
  add(card, 
    h("h2", icon("sync"), "Sync (Turso)"),
    h("p.small.muted", "Connect a Turso database to keep your laptop and phone in sync. The URL and token are stored only in this browser, never in the app's code. Set it up once here, then sign in your other devices with the QR code below."),
    h("label.field", "Database URL", url),
    h("label.field", "Auth token", token),
    h("div.row", h("button.btn.primary", { onclick: connect }, sync.configured() ? "Save & reconnect" : "Connect"),
      sync.configured() ? h("button.btn", { onclick: () => sync.syncNow() }, "Sync now") : null,
      sync.configured() ? h("button.btn.ghost", { onclick: () => { sync.disconnect(); url.value = ""; token.value = ""; toast("Disconnected on this device"); } }, "Disconnect") : null),
    status,
    sync.configured() ? pairingBox() : pasteLinkBox(),
    h("details.small",
      h("summary", "How to get these"),
      h("ol",
        h("li", "Create a database: ", h("code", "turso db create koine")),
        h("li", "Get its URL: ", h("code", "turso db show koine --url")),
        h("li", "Create a token for just that database: ", h("code", "turso db tokens create koine")),
        h("li", "Paste both here. On your other devices, use the “Sign in another device” QR code instead."))));
  return card;
}

/** QR code + link that carries this device's sync details to another device. */
function pairingBox() {
  const link = pairLink(sync.config().url, sync.config().token);
  const qrHost = h("div.qr", { role: "img", "aria-label": "QR code for signing in another device" });
  const box = h("div.pairbox.stack",
    h("h3", { style: { margin: 0 } }, "Sign in another device"),
    h("p.small.muted", { style: { margin: 0 } }, "Scan this with your phone's camera, or send yourself the link. The device that opens it connects to the same sync database and stays signed in."),
    h("div.row", { style: { alignItems: "flex-start", gap: "16px" } },
      qrHost,
      h("div.stack", { style: { flex: 1, minWidth: "200px" } },
        h("button.btn", { onclick: async () => { try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { prompt("Copy this link:", link); } } }, icon("copy", 16), "Copy sign-in link"),
        navigator.share ? h("button.btn.ghost", { onclick: () => navigator.share({ title: "Koine Practice sign-in", url: link }).catch(() => {}) }, "Share…") : null,
        h("p.tiny.muted", { style: { margin: 0 } }, "Anyone with this link can see and change your progress, so only send it to yourself."))));
  import("../../vendor/qrcode.mjs").then(({ default: qrcode }) => {
    const qr = qrcode(0, "L");
    qr.addData(link);
    qr.make();
    qrHost.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
  }).catch(() => { qrHost.textContent = "QR code unavailable. Use the link."; });
  return box;
}

function pasteLinkBox() {
  const inp = h("input.input", { placeholder: "Paste a sign-in link from your other device", autocomplete: "off", spellcheck: "false" });
  const go_ = () => {
    const m = inp.value.match(/#\/pair\/([A-Za-z0-9_-]+)/);
    if (!m) return toast("That doesn't look like a sign-in link", "bad");
    location.hash = "#/pair/" + m[1];
  };
  return h("div.pairbox.stack",
    h("h3", { style: { margin: 0 } }, "Already synced on another device?"),
    h("p.small.muted", { style: { margin: 0 } }, "Open Profile → Sync there and scan its QR code, or paste its sign-in link here."),
    h("div.row", inp, h("button.btn", { onclick: go_ }, "Sign in")));
}

const PUBLIC_URL = "https://farrellymobileauto.github.io/koine-practice/";
export function pairLink(url, token) {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const base = local ? PUBLIC_URL : location.origin + location.pathname;
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ u: url, t: token })))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return base + "#/pair/" + payload;
}

/** #/pair/<payload>: connect this device using details from another device. */
export function pairView(el, payload) {
  el.dataset.live = "1";
  // keep the token out of the address bar and history
  try { history.replaceState(null, "", location.pathname + "#/pair"); } catch {}
  let cfg = null;
  try {
    const json = decodeURIComponent(escape(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))));
    cfg = JSON.parse(json);
  } catch {}
  if (!cfg?.u || !cfg?.t) {
    add(el, h("div.page-head", h("h1", "Sign in")), h("div.card.empty", "This sign-in link is incomplete. Copy it again from your other device."));
    return;
  }
  const host = cfg.u.replace(/^(libsql|https?):\/\//, "").split("/")[0];
  const status = h("div.small.muted");
  const already = sync.configured() && sync.config().url === cfg.u;
  const connect = async () => {
    status.textContent = "Connecting…";
    try {
      const onServer = await sync.testConnection(cfg.u, cfg.t);
      sync.saveConfig(cfg.u, cfg.t);
      sync.startAutoSync();
      await sync.syncNow();
      let last = null;
      sync.onStatus((st) => { last = st; })();
      if (last?.state === "error") throw new Error(last.message);
      const cards = S.db.all("cards").length, words = S.db.all("lists").length;
      clear(status);
      add(status,
        h("div.verdict.ok", { role: "status" }, "Signed in"),
        h("p.small", `The server had ${onServer} saved record${onServer === 1 ? "" : "s"}. This device now has ${cards} flashcard${cards === 1 ? "" : "s"} and ${words} list${words === 1 ? "" : "s"}.`),
        onServer === 0 ? h("p.small.muted", "The server is empty, so there was nothing to download. On your other device, open Profile → Sync and press “Sync now” to upload its progress, then come back here and sign in again.") : null,
        /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone ? h("p.small.muted", "On iPhone, the home-screen app keeps its own storage, separate from Safari. If you use the home-screen app, sign in there too: open it, go to Profile → Sync, and paste this sign-in link.") : null,
        h("div.row", h("a.btn.primary", { href: "#/today" }, "Go to Today"),
          h("button.btn", { onclick: async () => { try { await navigator.clipboard.writeText(pairLink(cfg.u, cfg.t)); toast("Sign-in link copied"); } catch {} } }, "Copy sign-in link")));
    } catch (e) { status.textContent = "Couldn't connect: " + e.message; }
  };
  add(el,
    h("div.page-head", h("h1", "Sign in this device")),
    h("div.card.stack",
      h("p", already ? "This device is already connected to this sync database." : "Connect this device to your synced progress?"),
      h("p.small.muted", "Database: ", h("code", host)),
      h("p.small.muted", "Anything already saved on this device is merged in (the newest change wins). Nothing is deleted."),
      h("div.row", h("button.btn.primary", { onclick: connect }, already ? "Sync now" : "Sign in & sync"), h("a.btn.ghost", { href: "#/today" }, "Cancel")),
      status));
}

function dataCard() {
  const exportIt = () => {
    const data = { app: "koine-practice", version: 1, exported: new Date().toISOString(), ...db.exportAll() };
    download(`koine-backup-${S.dayKey()}.json`, JSON.stringify(data), "application/json");
  };
  const importIt = async () => {
    const f = await pickFile(".json,application/json");
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== "koine-practice") throw new Error("Not a Koine Practice backup");
      db.importAll(data);
      toast("Backup restored (newer entries kept)");
    } catch (e) { toast("Import failed: " + e.message, "bad"); }
  };
  const reset = async () => {
    if (!(await confirmBox("Erase everything on this device?", "This deletes all your lists, review history, mistakes and settings in this browser. If sync is on, the server copy is kept and will download again. Export a backup first if you're unsure.", { ok: "Erase" }))) return;
    await db.wipeAll();
    try { localStorage.removeItem("koine.votd"); localStorage.removeItem("koine.vocabPrefs"); } catch {}
    toast("Erased");
    go("today");
  };
  return h("div.card.stack",
    h("h2", "Your data"),
    h("p.small.muted", "Everything is stored in this browser. Export a backup now and then, especially if you don't use sync."),
    h("div.row",
      h("button.btn", { onclick: exportIt }, icon("download", 18), "Export backup"),
      h("button.btn", { onclick: importIt }, icon("upload", 18), "Restore backup"),
      h("button.btn.ghost", { onclick: reset }, icon("trash", 18), "Erase this device")));
}

// ---------------- Placement test ----------------
const OPTION_LABELS = {
  case: { N: "Nominative", G: "Genitive", D: "Dative", A: "Accusative" },
  tense: { P: "Present", F: "Future", I: "Imperfect", A: "Aorist", R: "Perfect" },
  voice: { A: "Active", M: "Middle", P: "Passive", MP: "Middle/Passive" },
  mood: { I: "Indicative", P: "Participle", S: "Subjunctive", N: "Infinitive", M: "Imperative" },
  pn: { "1S": "1st sing.", "2S": "2nd sing.", "3S": "3rd sing.", "1P": "1st plural", "2P": "2nd plural", "3P": "3rd plural" },
};
const QUESTION = { case: "What case is this?", tense: "What tense is this?", voice: "What voice is this?", mood: "What mood or form is this?", pn: "What person and number?" };

export function placementView(el) {
  el.dataset.live = "1";
  const stage = h("div");
  add(el, h("a.back", { href: "#/profile" }, icon("back", 16), "Profile"), h("div.page-head", h("h1", "Placement test")), stage);
  add(stage, h("div.card.stack",
    h("p", "This walks through Mounce's grammar in order, from 2nd-declension nouns up to the imperative, using real forms from the Greek NT. You get 3 forms per topic. Miss 2 of 3 and the test stops there and suggests that chapter."),
    h("p.small.muted", "If a form could be more than one thing (e.g. nominative or accusative), any correct option counts. Tap the form to see its gloss, though that counts as a miss."),
    h("button.btn.primary.big", { onclick: run }, "Start")));

  async function run() {
    const topics = await loadPlacement();
    let ti = 0, qi = 0, right = 0, asked = [];
    const log = [];
    const pickItems = (t) => S.shuffle([...t.i]).slice(0, 3);
    let items = pickItems(topics[0]);

    function ask() {
      const t = topics[ti];
      const it = items[qi];
      let peeked = false;
      clear(stage);
      const opts = t.o.map((o) => h("button", { onclick: () => answer(o, btns) }, OPTION_LABELS[t.d][o] || o));
      const btns = opts;
      const form = gk(it.f, it.l, { cls: "" });
      form.addEventListener("click", () => { peeked = true; });
      add(stage, h("div.card.stack",
        h("div.row.between", h("span.badge", `Ch. ${t.ch} · ${t.t}`), h("span.small.muted", `Topic ${ti + 1} of ${topics.length} · ${qi + 1}/3`)),
        h("div.goal-bar", h("i", { style: { width: `${(100 * ti) / topics.length}%` } })),
        h("div", { style: { textAlign: "center", padding: "18px 0" } }, h("div.verse", { style: { fontSize: "2.4rem", margin: 0 } }, form), h("div.small.muted", prettyRef(it.r))),
        h("h3", { style: { textAlign: "center" } }, QUESTION[t.d]),
        h("div.options", opts)));

      function answer(o, buttons) {
        const ok = it.a.includes(o) && !peeked;
        buttons.forEach((b, i) => { b.disabled = true; const v = t.o[i]; if (it.a.includes(v)) b.classList.add("right"); else if (v === o) b.classList.add("wrong"); });
        if (ok) right++;
        else {
          const l = LEX[it.l];
          S.logMistake({ kind: "placement", category: `Placement · ${t.t}`, prompt: it.f, expected: it.a.map((a) => OPTION_LABELS[t.d][a]).join(" or "), answer: (OPTION_LABELS[t.d][o] || o) + (peeked ? " (looked up)" : ""), lemma: l?.id, ref: it.r });
        }
        log.push({ ch: t.ch, ok });
        setTimeout(() => {
          qi++;
          if (qi < 3 && !(qi - right >= 2)) return ask();
          if (right >= 2) { ti++; qi = 0; right = 0; if (ti >= topics.length) return result(34); items = pickItems(topics[ti]); return ask(); }
          return result(t.ch);
        }, ok ? 450 : 1100);
      }
    }

    function result(ch) {
      S.bumpActivity({ placement: 1 });
      add(clear(stage), h("div.card.stack", { style: { textAlign: "center" } },
        h("h2", { style: { justifyContent: "center" } }, "Suggested: Mounce chapter " + ch),
        h("p", mounceTitle(ch)),
        h("p.small.muted", ch === 34 ? "You got through every topic. Pick up at the μι verbs (ch. 34), or wherever you like." : ch === topics[0].ch ? `Start with chapter ${ch} (${mounceTitle(ch)}) and work forward from there. Your misses are in the Mistake Log.` : `You did well up to here. Review chapter ${ch} (${mounceTitle(ch)}) and keep going from there. Your misses are in the Mistake Log.`),
        h("div.row", { style: { justifyContent: "center" } },
          h("button.btn.primary", { onclick: () => { S.saveProfile({ chapter: ch }); toast("Chapter set to " + ch); go("profile"); } }, `Set my chapter to ${ch}`),
          h("button.btn", { onclick: run }, "Retake"),
          h("a.btn.ghost", { href: "#/mistakes" }, "See misses"))));
    }
    ask();
  }
}
