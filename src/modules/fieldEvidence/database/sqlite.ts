// src/modules/fieldEvidence/database/sqlite.ts
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';

let dbInstance: Database | null = null;
let SQL: SqlJsStatic | null = null;

// Load the SQL.js WASM file from node_modules
const initDb = async (): Promise<Database> => {
  if (dbInstance) return dbInstance;
  SQL = await initSqlJs({ locateFile: (file) => `./node_modules/sql.js/dist/${file}` });
  const stored = localStorage.getItem('fieldEvidence-db');
  if (stored) {
    const arr = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    dbInstance = new SQL.Database(arr);
  } else {
    dbInstance = new SQL.Database();
    // Load schema
    const schemaResp = await fetch('/src/modules/fieldEvidence/database/schema.sql');
    const schema = await schemaResp.text();
    dbInstance.run(schema);
    // Persist empty DB
    persistDb();
  }
  return dbInstance;
};

export const persistDb = () => {
  if (!dbInstance) return;
  const binary = dbInstance.export();
  const b64 = btoa(String.fromCharCode(...binary));
  localStorage.setItem('fieldEvidence-db', b64);
};

export const getDatabase = async (): Promise<Database> => {
  return initDb();
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
    persistDb();
    return rows;
  } catch (e) {
    console.error('SQL error', e);
    throw e;
  }
};
