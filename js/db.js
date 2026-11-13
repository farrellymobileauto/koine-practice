// Local-first storage: everything lives in IndexedDB and is mirrored in memory.
// Every change is stamped with updatedAt and queued in the outbox for sync.

const DB_NAME = "koine";
const DB_VERSION = 2;
export const SYNCED = ["words", "lists", "cards", "mistakes", "activity", "lookups", "kv", "translations"];
const LOCAL = ["local", "outbox"];

let idb = null;
const mem = {}; // store -> Map(id -> record)
const listeners = new Set();
let memoryOnly = false;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of [...SYNCED, ...LOCAL]) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readAll(store) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function initDB() {
  try {
    idb = await open();
    for (const s of [...SYNCED, ...LOCAL]) {
      const rows = await readAll(s);
      mem[s] = new Map(rows.map((r) => [r.id, r]));
    }
  } catch (e) {
    console.warn("IndexedDB unavailable; data will not be saved", e);
    memoryOnly = true;
    for (const s of [...SYNCED, ...LOCAL]) mem[s] = new Map();
  }
}

let pending = [];
let flushTimer = null;
function queueWrite(store, rec, del = false) {
  pending.push([store, rec, del]);
  if (!flushTimer) flushTimer = setTimeout(flush, 0);
}
async function flush() {
  flushTimer = null;
  if (memoryOnly || !idb) { pending = []; return; }
  const batch = pending; pending = [];
  if (!batch.length) return;
  const stores = [...new Set(batch.map((b) => b[0]))];
  await new Promise((resolve) => {
    const tx = idb.transaction(stores, "readwrite");
    for (const [store, rec, del] of batch) {
      if (del) tx.objectStore(store).delete(rec); else tx.objectStore(store).put(rec);
    }
    tx.oncomplete = resolve;
    tx.onerror = () => { console.error(tx.error); resolve(); };
  });
}
export const flushNow = () => flush();

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
let notifyTimer = null;
const changedStores = new Set();
function notify(store) {
  changedStores.add(store);
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    const s = new Set(changedStores); changedStores.clear();
    for (const fn of listeners) try { fn(s); } catch (e) { console.error(e); }
  }, 0);
}

export function get(store, id) {
  const r = mem[store]?.get(id);
  return r && !r.deleted ? r : undefined;
}
export function getRaw(store, id) { return mem[store]?.get(id); }
export function all(store) {
  const out = [];
  for (const r of mem[store].values()) if (!r.deleted) out.push(r);
  return out;
}

/** Save a record (synced stores get updatedAt + outbox entry). */
export function put(store, rec, { silent = false } = {}) {
  if (SYNCED.includes(store)) {
    rec.updatedAt = Date.now();
    const key = store + "/" + rec.id;
    const ob = { id: key, store, rid: rec.id };
    mem.outbox.set(key, ob);
    queueWrite("outbox", ob);
  }
  mem[store].set(rec.id, rec);
  queueWrite(store, rec);
  if (!silent) notify(store);
  return rec;
}

/** Soft-delete (tombstone) so the deletion syncs to other devices. */
export function remove(store, id) {
  const r = mem[store].get(id);
  if (!r) return;
  if (SYNCED.includes(store)) put(store, { id, deleted: true });
  else { mem[store].delete(id); queueWrite(store, id, true); notify(store); }
}

/** Apply a record coming from the server: no outbox entry, last-write-wins. */
export function applyRemote(store, rec) {
  const cur = mem[store].get(rec.id);
  if (cur && (cur.updatedAt || 0) >= (rec.updatedAt || 0)) return false;
  mem[store].set(rec.id, rec);
  queueWrite(store, rec);
  notify(store);
  return true;
}

export function outbox() { return [...mem.outbox.values()]; }
export function clearOutbox(keys) {
  for (const k of keys) { mem.outbox.delete(k); queueWrite("outbox", k, true); }
}

// Local-only key/value (device id, sync credentials, last sync cursor)
export function localGet(key, dflt) {
  const r = mem.local.get(key);
  return r ? r.value : dflt;
}
export function localSet(key, value) {
  const rec = { id: key, value };
  mem.local.set(key, rec);
  queueWrite("local", rec);
}

export async function wipeAll() {
  for (const s of [...SYNCED, "outbox"]) {
    mem[s].clear();
    if (idb) await new Promise((res) => { const tx = idb.transaction(s, "readwrite"); tx.objectStore(s).clear(); tx.oncomplete = res; tx.onerror = res; });
  }
  localSet("lastSeq", 0);
  notify("words");
}

export function exportAll() {
  const out = {};
  for (const s of SYNCED) out[s] = [...mem[s].values()];
  return out;
}

export function importAll(data) {
  for (const s of SYNCED) {
    for (const rec of data[s] || []) {
      const cur = mem[s].get(rec.id);
      if (!cur || (cur.updatedAt || 0) < (rec.updatedAt || 0)) {
        mem[s].set(rec.id, rec);
        queueWrite(s, rec);
        const key = s + "/" + rec.id;
        const ob = { id: key, store: s, rid: rec.id };
        mem.outbox.set(key, ob); queueWrite("outbox", ob);
      }
    }
    notify(s);
  }
}

export const isMemoryOnly = () => memoryOnly;
