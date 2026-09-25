// src/modules/fieldEvidence/database/sqlite.ts
// SQLite (sql.js / WASM) database persisted as raw bytes in IndexedDB.
// IndexedDB is used instead of localStorage because evidence photos quickly exceed
// localStorage's ~5 MB quota, and binary data can be stored without base64 encoding.
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import schema from './schema.sql?raw';

const IDB_NAME = 'ner-connect-field-evidence';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'evidence-db';
const LEGACY_LOCALSTORAGE_KEY = 'fieldEvidence-db';

let dbPromise: Promise<Database> | null = null;

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<Uint8Array | undefined> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const req = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: Uint8Array): Promise<void> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Databases saved by the earlier localStorage version (base64 text) are moved over once.
function takeLegacyDatabase(): Uint8Array | undefined {
  try {
    const stored = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (!stored) return undefined;
    const bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
    return bytes;
  } catch {
    return undefined;
  }
}

// ─── Database lifecycle ───────────────────────────────────────────────────────

async function initDb(): Promise<Database> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = (await idbGet(IDB_KEY)) ?? takeLegacyDatabase();
  const db = saved ? new SQL.Database(saved) : new SQL.Database();
  db.run(schema); // CREATE TABLE IF NOT EXISTS — safe on existing databases
  await idbSet(IDB_KEY, db.export());
  return db;
}

export const getDatabase = (): Promise<Database> => {
  // Share one in-flight initialisation so concurrent callers get the same instance.
  if (!dbPromise) {
    dbPromise = initDb().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
};

export const persistDb = async (): Promise<void> => {
  const db = await getDatabase();
  await idbSet(IDB_KEY, db.export());
};

export const execute = async (sql: string, params?: any[]): Promise<any[]> => {
  const db = await getDatabase();
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params || []);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    if (!/^\s*select\b/i.test(sql)) {
      await persistDb();
    }
    return rows;
  } catch (e) {
    console.error('SQL error', e);
    throw e;
  }
};
