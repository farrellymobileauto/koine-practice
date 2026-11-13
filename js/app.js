import { initDB, onChange, isMemoryOnly } from "./db.js";
import { loadLexicon } from "./data.js";
import { h, add, clear, icon, toast } from "./ui.js";
import { initGloss, closeGloss } from "./gloss.js";
import * as S from "./store.js";
import * as sync from "./sync.js";

import today from "./views/today.js";
import { vocabHome, listView, studyView } from "./views/vocab.js";
import mistakesView from "./views/mistakes.js";
import { profileView, placementView, pairView } from "./views/profile.js";
import { soonView, moreView } from "./views/more.js";
import { parseHome } from "./views/parse.js";
import { paradigmsHome, paradigmView } from "./views/paradigms.js";
import { translateHome, translateVerse } from "./views/translate.js";
import { readerView } from "./views/reader.js";

const NAV = [
  { id: "today", label: "Today", icon: "today" },
  { id: "vocab", label: "Vocab", icon: "vocab" },
  { id: "parse", label: "Parse", icon: "parse" },
  { id: "translate", label: "Translate", icon: "translate" },
  { id: "paradigms", label: "Paradigms", icon: "paradigms", more: true },
  { id: "reader", label: "Reader", icon: "reader", more: true },
  { id: "mistakes", label: "Mistake Log", icon: "mistakes", more: true },
  { id: "profile", label: "Profile", icon: "profile", more: true },
];

const ROUTES = [
  [/^today$/, () => today],
  [/^vocab$/, () => vocabHome],
  [/^vocab\/list\/(.+)$/, (m) => (el) => listView(el, decodeURIComponent(m[1]))],
  [/^vocab\/study$/, () => studyView],
  [/^mistakes$/, () => mistakesView],
  [/^profile$/, () => profileView],
  [/^profile\/placement$/, () => placementView],
  [/^more$/, () => moreView],
  [/^pair\/(.+)$/, (m) => (el) => pairView(el, m[1])],
  [/^pair$/, () => (el) => { location.hash = "#/profile"; }],
  [/^parse$/, () => parseHome],
  [/^paradigms$/, () => paradigmsHome],
  [/^paradigms\/(.+)$/, (m) => (el) => paradigmView(el, decodeURIComponent(m[1]))],
  [/^translate$/, () => translateHome],
  [/^translate\/(.+)$/, (m) => (el) => translateVerse(el, decodeURIComponent(m[1]))],
  [/^reader$/, () => (el) => readerView(el)],
  [/^reader\/(.+)$/, (m) => (el) => readerView(el, decodeURIComponent(m[1]))],
];

let cleanup = null;
let currentPath = null;

export function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [path, qs] = hash.split("?");
  return { path: path || "today", params: new URLSearchParams(qs || "") };
}
export function go(path) { location.hash = "#/" + path; }

function render(force = false) {
  const { path } = route();
  const view = document.getElementById("view");
  currentPath = path;
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  closeGloss();
  clear(view);
  view.dataset.live = "";
  let fn = null;
  for (const [re, make] of ROUTES) { const m = path.match(re); if (m) { fn = make(m); break; } }
  if (!fn) { go("today"); return; }
  const r = fn(view);
  cleanup = typeof r === "function" ? r : null;
  renderNav(path);
  if (!force) { window.scrollTo(0, 0); try { view.focus({ preventScroll: true }); } catch {} }
}

function renderNav(path) {
  const top = path.split("/")[0];
  const activeTab = NAV.find((n) => n.id === top)?.more || top === "more" ? "more" : top;
  const side = document.querySelector(".sidebar");
  add(clear(side), [
    h("div.brand", "Κοινή", h("small", "Koine Greek practice")),
    NAV.filter((n) => !n.more).map((n) => navLink(n, top)),
    h("div.sep"),
    NAV.filter((n) => n.more).map((n) => navLink(n, top)),
    h("div.sync-dot", { id: "sync-dot" })].flat());
  const bar = document.querySelector(".tabbar");
  add(clear(bar), [
    NAV.filter((n) => !n.more).map((n) => h("a", { href: "#/" + n.id, class: (activeTab === n.id ? "active " : "") + (n.soon ? "soon" : ""), "aria-current": activeTab === n.id ? "page" : null }, icon(n.icon, 22), n.label)),
    h("a", { href: "#/more", class: activeTab === "more" ? "active" : "" }, icon("more", 22), "More")].flat());
  updateSyncDot();
}
function navLink(n, top) {
  return h("a", { href: "#/" + n.id, class: top === n.id ? "active" : "", "aria-current": top === n.id ? "page" : null }, icon(n.icon), n.label, n.soon ? h("span.badge", "soon") : null);
}

let syncStatus = { state: "off" };
function updateSyncDot() {
  const el = document.getElementById("sync-dot");
  if (!el) return;
  clear(el);
  if (syncStatus.state === "off") { add(el, h("span.pill-sync", h("span.dot"), "This device only")); return; }
  add(el, h("span.pill-sync", h("span.dot", { class: syncStatus.state }), syncStatus.state === "error" ? "Sync problem" : syncStatus.state === "syncing" ? "Syncing…" : "Synced"));
}

export function applyTheme() {
  const t = S.profile().theme;
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const a = S.profile().accent;
  if (a && a !== "terracotta") document.documentElement.dataset.accent = a;
  else delete document.documentElement.dataset.accent;
  try { localStorage.setItem("koine.look", JSON.stringify({ t, a })); } catch {}
}

async function boot() {
  await initDB();
  try { await loadLexicon(); }
  catch (e) {
    document.getElementById("view").innerHTML = "<div class='boot'>Couldn't load data/lexicon.json. Open this app through a local web server (see README), not by double-clicking index.html.</div>";
    return;
  }
  S.deviceId();
  applyTheme();
  initGloss();
  window.addEventListener("hashchange", () => render());
  // Re-render the current view when data changes (views that manage their own state opt out with data-live="1").
  onChange(() => {
    applyTheme();
    const view = document.getElementById("view");
    if (view.dataset.live === "1") return;
    const a = document.activeElement;
    if (a && view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return; // don't interrupt typing
    if (document.querySelector(".modal-back")) return;
    const y = window.scrollY;
    render(true);
    window.scrollTo(0, y);
  });
  sync.onStatus((s) => { syncStatus = s; updateSyncDot(); });
  let pending = null;
  try { pending = sessionStorage.getItem("koine.pair"); sessionStorage.removeItem("koine.pair"); } catch {}
  if (pending && !location.hash.startsWith("#/pair/")) location.hash = "#/pair/" + pending;
  render();
  sync.startAutoSync();
  if (isMemoryOnly()) toast("Storage is blocked in this browser. Progress won't be saved.", "bad");
  if ("serviceWorker" in navigator && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

boot();
