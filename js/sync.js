// Optional sync to a Turso (libSQL) database over its HTTP API. No server needed.
// The database URL and token are stored only on this device (never in the code or in synced data).
import * as db from "./db.js";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS records (store TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY (store, id))`,
  `CREATE INDEX IF NOT EXISTS records_seq ON records(seq)`,
];
const UPSERT = `INSERT INTO records (store, id, data, updated_at, seq) VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM records))
ON CONFLICT(store, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, seq = excluded.seq
WHERE excluded.updated_at >= records.updated_at`;

let status = { state: "off", message: "", last: null };
const subs = new Set();
export function onStatus(fn) { subs.add(fn); fn(status); return () => subs.delete(fn); }
function setStatus(s) { status = { ...status, ...s }; for (const f of subs) f(status); }

export function config() {
  return { url: db.localGet("tursoUrl", ""), token: db.localGet("tursoToken", ""), last: db.localGet("lastSync", null) };
}
export function configured() { const c = config(); return !!(c.url && c.token); }
export function saveConfig(url, token) {
  db.localSet("tursoUrl", (url || "").trim());
  db.localSet("tursoToken", (token || "").trim());
  db.localSet("lastSeq", 0); // pull everything from the new database
}
export function disconnect() { saveConfig("", ""); setStatus({ state: "off", message: "" }); }

function endpoint(url) {
  let u = url.trim().replace(/^libsql:\/\//, "https://").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(u)) u = "https://" + u;
  return u + "/v2/pipeline";
}
const arg = (v) => (typeof v === "number" ? { type: "integer", value: String(Math.trunc(v)) } : v == null ? { type: "null" } : { type: "text", value: String(v) });

async function pipeline(stmts, { url, token } = config()) {
  const body = { requests: [...stmts.map(([sql, args = []]) => ({ type: "execute", stmt: { sql, args: args.map(arg) } })), { type: "close" }] };
  const res = await fetch(endpoint(url), {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.status === 401 ? "Token rejected (401). Check the token is for this database." : `Turso returned ${res.status}`);
  const json = await res.json();
  const out = [];
  for (const r of json.results.slice(0, stmts.length)) {
    if (r.type === "error") throw new Error(r.error?.message || "Turso error");
    const result = r.response.result;
    out.push(result.rows.map((row) => row.map((c) => (c.type === "integer" ? Number(c.value) : c.value))));
  }
  return out;
}

export async function testConnection(url, token) {
  await pipeline(SCHEMA.map((s) => [s]), { url, token });
  const [[row]] = await pipeline([["SELECT COUNT(*) FROM records"]], { url, token });
  return row[0];
}

let running = null;
export function syncNow() {
  if (!configured()) return Promise.resolve();
  if (!running) running = doSync().finally(() => { running = null; });
  return running;
}

async function doSync() {
  setStatus({ state: "syncing", message: "Syncing…" });
  try {
    await db.flushNow();
    await pipeline(SCHEMA.map((s) => [s]));
    // push
    const ob = db.outbox();
    for (let i = 0; i < ob.length; i += 100) {
      const chunk = ob.slice(i, i + 100);
      const stmts = [];
      for (const o of chunk) {
        const rec = db.getRaw(o.store, o.rid);
        if (rec) stmts.push([UPSERT, [o.store, o.rid, JSON.stringify(rec), rec.updatedAt || Date.now()]]);
      }
      if (stmts.length) await pipeline(stmts);
      db.clearOutbox(chunk.map((o) => o.id));
    }
    // pull
    let lastSeq = db.localGet("lastSeq", 0);
    let pulled = 0;
    for (;;) {
      const [rows] = await pipeline([["SELECT store, data, seq FROM records WHERE seq > ? ORDER BY seq LIMIT 500", [lastSeq]]]);
      for (const [store, data, seq] of rows) {
        if (db.SYNCED.includes(store)) { if (db.applyRemote(store, JSON.parse(data))) pulled++; }
        lastSeq = Math.max(lastSeq, seq);
      }
      if (rows.length < 500) break;
    }
    db.localSet("lastSeq", lastSeq);
    const last = new Date().toISOString();
    db.localSet("lastSync", last);
    setStatus({ state: "ok", message: pulled ? `Synced · ${pulled} update${pulled === 1 ? "" : "s"} from other devices` : "Synced", last });
  } catch (e) {
    console.warn("sync failed", e);
    setStatus({ state: "error", message: navigator.onLine ? e.message : "Offline. Will sync when you're back online." });
  }
}

let timer = null;
let lastChange = 0;
export function startAutoSync() {
  if (!configured()) { setStatus({ state: "off" }); return; }
  syncNow();
  db.onChange(() => {
    lastChange = Date.now();
    clearTimeout(timer);
    timer = setTimeout(() => { if (db.outbox().length) syncNow(); }, 8000);
  });
  setInterval(() => { if (document.visibilityState === "visible") syncNow(); }, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && db.outbox().length) syncNow();
    if (document.visibilityState === "visible" && Date.now() - lastChange > 30000) syncNow();
  });
  window.addEventListener("online", () => syncNow());
}
