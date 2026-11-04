// Database access through the libSQL client:
// a local SQLite file in development, a hosted Turso database in production.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');
export const DEFAULT_DB_FILE = path.join(DATA_DIR, 'chessora.db');

/** Local database URL used when DATABASE_URL is not set. Creates the data folder. */
export function defaultDbUrl() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return `file:${DEFAULT_DB_FILE}`;
}

/** If the URL is a local file database, return its path (used for backups), else null. */
export function localFileOf(url) {
  return url.startsWith('file:') ? url.slice('file:'.length) : null;
}

export async function openDb(url, authToken) {
  const db = createClient({ url, authToken: authToken || undefined });
  await db.execute('PRAGMA foreign_keys = ON');
  return db;
}
