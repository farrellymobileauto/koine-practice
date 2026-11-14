// Tiny DOM helpers.

/** h("div.card#x", {onclick, class, ...attrs}, ...children) */
export function h(sel, props, ...kids) {
  if (props == null || typeof props !== "object" || props instanceof Node || Array.isArray(props)) {
    if (props !== undefined && props !== null) kids.unshift(props);
    props = {};
  }
  const m = sel.match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m?.[1] || "div");
  for (const part of (m?.[2] || "").match(/[.#][\w-]+/g) || []) {
    if (part[0] === ".") el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className += (el.className ? " " : "") + v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "html") el.innerHTML = v;
    else if (k === "value" || k === "checked" || k === "selected") el[k] = v;
    else if (k in el && typeof v !== "string" && k !== "list") el[k] = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

/** Null-safe append that also flattens arrays. */
export function add(el, ...kids) { append(el, kids); return el; }

export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }

export function toast(msg, kind = "") {
  let host = document.querySelector(".toasts");
  if (!host) document.body.append((host = h("div.toasts", { role: "status", "aria-live": "polite" })));
  const t = h("div.toast", { class: kind }, msg);
  host.append(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3000);
}

/** Modal dialog. Returns { el, close }. content can be a node or (close) => node. */
export function modal(title, content, { wide = false } = {}) {
  const back = h("div.modal-back");
  const close = () => { back.remove(); document.removeEventListener("keydown", onKey); window.dispatchEvent(new Event("koine:modal-closed")); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const body = typeof content === "function" ? content(close) : content;
  const box = h("div.modal", { class: wide ? "wide" : "", role: "dialog", "aria-modal": "true", "aria-label": title },
    h("div.modal-head", h("h2", title), h("button.icon-btn", { onclick: close, "aria-label": "Close" }, icon("x"))),
    h("div.modal-body", body));
  back.append(box);
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  document.addEventListener("keydown", onKey);
  document.body.append(back);
  setTimeout(() => box.querySelector("input,textarea,select,button:not(.icon-btn)")?.focus(), 30);
  return { el: box, close };
}

export function confirmBox(title, message, { ok = "Delete", danger = true } = {}) {
  return new Promise((resolve) => {
    const m = modal(title, (close) => h("div",
      h("p", message),
      h("div.row.end",
        h("button.btn.ghost", { onclick: () => { close(); resolve(false); } }, "Cancel"),
        h("button.btn", { class: danger ? "danger" : "primary", onclick: () => { close(); resolve(true); } }, ok))));
    return m;
  });
}

export function download(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const a = h("a", { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = h("input", { type: "file", accept, style: { display: "none" } });
    inp.addEventListener("change", () => { resolve(inp.files[0] || null); inp.remove(); });
    document.body.append(inp); inp.click();
  });
}

export function relTime(d) {
  const ms = new Date(d) - new Date();
  const abs = Math.abs(ms), m = 6e4, hr = 36e5, day = 864e5;
  const f = (n, u) => `${n} ${u}${n === 1 ? "" : "s"}`;
  let s;
  if (abs < hr) s = f(Math.max(1, Math.round(abs / m)), "min");
  else if (abs < day) s = f(Math.round(abs / hr), "hour");
  else if (abs < 30 * day) s = f(Math.round(abs / day), "day");
  else if (abs < 365 * day) s = f(Math.round(abs / (30 * day)), "month");
  else s = f(Math.round(abs / (365 * day)), "year");
  return ms >= 0 ? "in " + s : s + " ago";
}
export function shortInterval(d) {
  const ms = new Date(d) - new Date();
  if (ms < 36e5) return Math.max(1, Math.round(ms / 6e4)) + "m";
  if (ms < 864e5) return Math.round(ms / 36e5) + "h";
  if (ms < 30 * 864e5) return Math.round(ms / 864e5) + "d";
  if (ms < 365 * 864e5) return Math.round(ms / (30 * 864e5)) + "mo";
  return (ms / (365 * 864e5)).toFixed(1) + "y";
}

// Inline SVG icons (stroke-based, 24px grid).
const ICONS = {
  today: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  vocab: '<rect x="3" y="5" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>',
  parse: '<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="18" cy="16" r="3"/>',
  translate: '<path d="M4 5h9M8.5 3v2M6 5c1 4 4 7 7 8M11 5c-1 4-4 7-7 8"/><path d="m13 21 4-9 4 9M14.5 18h5"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  mistakes: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17.5v.01"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  paradigms: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>',
  reader: '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6v14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"/>',
  snow: '<path d="M12 2v20M4 7l16 10M20 7 4 17"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14-5L4 8M4 13a8 8 0 0 0 14 5l2-2"/><path d="M4 4v4h4M20 20v-4h-4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
};
export function icon(name, size = 20) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("width", size); s.setAttribute("height", size);
  s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.8"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  s.classList.add("ico");
  s.innerHTML = ICONS[name] || "";
  return s;
}
