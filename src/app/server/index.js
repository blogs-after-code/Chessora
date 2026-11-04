// Entry point: loads .env (from the project root), opens + migrates the database, starts the server.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDb, defaultDbUrl, localFileOf } from './db.js';
import { migrate } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const PORT = Number(process.env.PORT) || 3000;
const dbUrl = process.env.DATABASE_URL || defaultDbUrl();

const db = await openDb(dbUrl, process.env.DATABASE_AUTH_TOKEN);
const applied = await migrate(db, { backupFile: localFileOf(dbUrl) });
if (applied.length) console.log(`Database migrations applied: ${applied.join(', ')}`);

const app = createApp({ db });
app.listen(PORT, () => {
  console.log(`Chessora running at http://localhost:${PORT}`);
});
