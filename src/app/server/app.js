// Express app factory. Kept separate from index.js so tests can start it on any port.
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAuth, csrfGuard } from './auth.js';
import { createGamesRouters } from './games.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const engineDir = path.join(__dirname, '..', 'node_modules', 'stockfish', 'bin');

// The browser asks for fixed names (engine.js / engine.wasm); we serve the small single-threaded
// Stockfish build from node_modules under those names, so a version bump needs no frontend change.
function findEngineFile(ext) {
  try {
    const name = fs.readdirSync(engineDir).find((f) => /^stockfish-[\d.]+-lite-single\.(js|wasm)$/.test(f) && f.endsWith(ext));
    return name ? path.join(engineDir, name) : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} opts
 * @param {import('@libsql/client').Client} opts.db  an opened, migrated database
 */
export function createApp({
  db,
  bcryptRounds = 12,
  secureCookies = process.env.APP_ENV === 'production',
  authLimit = 20,
  trustProxy = process.env.TRUST_PROXY,
  fetchImpl = fetch,
  importLimit = 10,
} = {}) {
  if (!db) throw new Error('createApp needs a database (opts.db)');

  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', Number(trustProxy) || trustProxy);
  // 'wasm-unsafe-eval' lets the browser run the chess engine (WebAssembly); nothing else is loosened.
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'wasm-unsafe-eval'"],
      },
    },
  }));
  app.use(express.json({ limit: '1mb' }));

  const auth = createAuth({ db, bcryptRounds, secureCookies, authLimit });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'chessora', time: new Date().toISOString() });
  });

  app.use('/api', csrfGuard, auth.loadUser);
  app.use('/api/auth', auth.router);

  const lib = createGamesRouters({ db, requireAuth: auth.requireAuth, fetchImpl, importLimit });
  app.use('/api/games', lib.games);
  app.use('/api/import', lib.imports);

  // Unknown /api routes return JSON, not HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  for (const [file, ext, type] of [['engine.js', '.js', 'text/javascript'], ['engine.wasm', '.wasm', 'application/wasm']]) {
    app.get(`/vendor/stockfish/${file}`, (_req, res) => {
      const found = findEngineFile(ext);
      if (!found) return res.status(404).type('text/plain').send('Chess engine not installed (run npm install)');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.type(type).sendFile(found);
    });
  }

  app.use(express.static(publicDir));

  // Last-resort error handler: no stack traces to the client
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (err.status && err.status < 500) return res.status(err.status).json({ error: 'Bad request' });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
