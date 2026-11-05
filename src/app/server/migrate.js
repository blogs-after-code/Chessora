// Tiny migration runner. Add new migrations to the END of MIGRATIONS; never edit old ones.
import fs from 'node:fs';
import path from 'node:path';

export const MIGRATIONS = [
  {
    id: 1,
    name: 'create_users_and_sessions',
    sql: [
      `CREATE TABLE users (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         email TEXT NOT NULL UNIQUE,
         username TEXT NOT NULL UNIQUE COLLATE NOCASE,
         password_hash TEXT NOT NULL,
         created_at TEXT NOT NULL DEFAULT (datetime('now'))
       )`,
      `CREATE TABLE sessions (
         id TEXT PRIMARY KEY,
         user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         expires_at INTEGER NOT NULL
       )`,
      'CREATE INDEX idx_sessions_user ON sessions(user_id)',
      'CREATE INDEX idx_sessions_expires ON sessions(expires_at)',
    ],
  },
  {
    id: 2,
    name: 'create_games',
    sql: [
      `CREATE TABLE games (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         source TEXT NOT NULL CHECK (source IN ('pgn', 'lichess', 'chesscom')),
         source_id TEXT NOT NULL,
         pgn TEXT NOT NULL,
         white TEXT NOT NULL,
         black TEXT NOT NULL,
         result TEXT NOT NULL,
         event TEXT NOT NULL DEFAULT '',
         played_at TEXT,
         move_count INTEGER NOT NULL,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         UNIQUE (user_id, source, source_id)
       )`,
      'CREATE INDEX idx_games_user ON games(user_id, played_at)',
    ],
  },
  {
    id: 3,
    name: 'add_games_analysis_json',
    // Phase 4: the saved engine analysis (JSON text). NULL = not analysed yet.
    sql: ['ALTER TABLE games ADD COLUMN analysis_json TEXT'],
  },
];

/**
 * Apply pending migrations. If the database file already holds data from earlier
 * migrations, a copy is saved to data/backups/ first (local file databases only).
 * Returns the ids of the migrations that were applied.
 */
export async function migrate(db, { backupFile = null } = {}) {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       id INTEGER PRIMARY KEY,
       name TEXT NOT NULL,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  );
  const done = await db.execute('SELECT id FROM schema_migrations');
  const applied = new Set(done.rows.map((r) => Number(r.id)));
  const pending = MIGRATIONS.filter((m) => !applied.has(m.id));
  if (pending.length === 0) return [];

  if (backupFile && applied.size > 0 && fs.existsSync(backupFile)) {
    const dir = path.join(path.dirname(backupFile), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(backupFile, path.join(dir, `${path.basename(backupFile)}.${stamp}.bak`));
  }

  for (const m of pending) {
    await db.batch(
      [
        ...m.sql.map((sql) => ({ sql, args: [] })),
        { sql: 'INSERT INTO schema_migrations (id, name) VALUES (?, ?)', args: [m.id, m.name] },
      ],
      'write',
    );
  }
  return pending.map((m) => m.id);
}
