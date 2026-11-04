import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../server/db.js';
import { migrate, MIGRATIONS } from '../server/migrate.js';

test('migrations apply once and are idempotent', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chessora-mig-'));
  const db = await openDb(`file:${path.join(dir, 'm.db')}`);
  try {
    const first = await migrate(db);
    assert.deepEqual(first, MIGRATIONS.map((m) => m.id));
    assert.deepEqual(await migrate(db), []);
    const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
    const names = tables.rows.map((r) => String(r.name));
    assert.ok(names.includes('users') && names.includes('sessions'));
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('existing database file is backed up before new migrations', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chessora-bak-'));
  const file = path.join(dir, 'b.db');
  const db = await openDb(`file:${file}`);
  try {
    await migrate(db); // fresh database: nothing to back up
    assert.equal(fs.existsSync(path.join(dir, 'backups')), false);
    await db.execute('DELETE FROM schema_migrations'); // pretend an older state
    await db.execute({ sql: 'INSERT INTO schema_migrations (id, name) VALUES (?, ?)', args: [0, 'old'] });
    await db.execute('DROP TABLE sessions');
    await db.execute('DROP TABLE users');
    await migrate(db, { backupFile: file });
    assert.equal(fs.readdirSync(path.join(dir, 'backups')).length, 1);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
