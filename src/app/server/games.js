// The user's game library (list / open / add / delete) and imports from Lichess and Chess.com.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler, validationFailed } from './auth.js';
import { parseGame, PgnError } from './pgn.js';
import { splitPgn, gameKey, detectOrigin, isoDateToMs, DAY_MS } from './pgn-utils.js';
import { ImportError, fetchLichessGames, fetchChesscomGames } from './importers.js';
import { patchSchema, readAnalysis } from './analysis.js';

export const MAX_GAMES_PER_USER = 500;
export const MAX_GAMES_PER_REQUEST = 50;

const addSchema = z.object({
  pgn: z.string({ required_error: 'Paste or upload a PGN' }).trim().min(1, 'Paste or upload a PGN'),
});

/**
 * Same options for both services: the latest N games (no dates), or N games from a date range.
 * Dates are YYYY-MM-DD (UTC days); both or neither must be given; at most one year apart.
 */
const importSchema = (usernameRegex, usernameMessage) => z.object({
  username: z.string({ required_error: 'Username is required' }).trim().regex(usernameRegex, usernameMessage),
  max: z.coerce.number().int().min(1, 'Choose 1 to 50 games').max(MAX_GAMES_PER_REQUEST, 'Choose 1 to 50 games').default(20),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
}).superRefine((d, ctx) => {
  if (!d.from && !d.to) return;
  const fail = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });
  const from = isoDateToMs(d.from);
  const to = isoDateToMs(d.to, true);
  if (from === null) return fail('from', 'Choose a start date');
  if (to === null) return fail('to', 'Choose an end date');
  if (from > to) return fail('to', 'The end date must not be before the start date');
  if (from < Date.UTC(2007, 0, 1)) return fail('from', 'The start date is too early');
  if (to - from > 366 * DAY_MS) return fail('to', 'Choose a range of at most one year');
});

const lichessSchema = importSchema(/^[A-Za-z0-9_-]{2,30}$/, 'Enter a valid Lichess username');
const chesscomSchema = importSchema(/^[A-Za-z0-9_-]{3,25}$/, 'Enter a valid Chess.com username');

const bulkDeleteSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1, 'Select at least one game').max(MAX_GAMES_PER_USER),
});

const summary = (r) => ({
  id: Number(r.id),
  source: String(r.source),
  white: String(r.white),
  black: String(r.black),
  result: String(r.result),
  event: String(r.event),
  playedAt: r.played_at ? String(r.played_at) : null,
  moveCount: Number(r.move_count),
  createdAt: String(r.created_at),
});

/**
 * Validate and store games for one user. Duplicates are skipped, bad games are reported.
 * @param {{pgn: string, sourceId?: string}[]} items
 */
export async function saveGames(db, userId, source, items) {
  const out = { added: [], skipped: 0, failed: [] };
  const counted = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM games WHERE user_id = ?', args: [userId] });
  let count = Number(counted.rows[0].n);

  for (let i = 0; i < items.length; i++) {
    let game;
    try {
      game = parseGame(items[i].pgn);
    } catch (err) {
      if (!(err instanceof PgnError)) throw err;
      out.failed.push({ index: i + 1, error: err.message });
      continue;
    }
    if (count >= MAX_GAMES_PER_USER) {
      out.failed.push({ index: i + 1, error: `Your library is full (max ${MAX_GAMES_PER_USER} games)` });
      continue;
    }
    // A game that carries its Lichess/Chess.com id is stored under that id, so pasting a game
    // you already imported (or the other way round) is recognised as a duplicate.
    const origin = detectOrigin(game.pgn);
    const rs = await db.execute({
      sql: `INSERT INTO games (user_id, source, source_id, pgn, white, black, result, event, played_at, move_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id, source, source_id) DO NOTHING`,
      args: [userId, origin?.source || source, origin?.sourceId || items[i].sourceId || gameKey(game.pgn),
        game.pgn, game.white, game.black, game.result, game.event, game.playedAt, game.moveCount],
    });
    if (rs.rowsAffected === 0) {
      out.skipped += 1;
      continue;
    }
    count += 1;
    out.added.push({
      id: Number(rs.lastInsertRowid), white: game.white, black: game.black,
      result: game.result, moveCount: game.moveCount,
    });
  }
  return out;
}

export function createGamesRouters({ db, requireAuth, fetchImpl = fetch, importLimit = 10, lichessToken = process.env.LICHESS_TOKEN }) {
  // ---------- /api/games ----------
  const games = express.Router();
  games.use(requireAuth);

  games.get('/', asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const total = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM games WHERE user_id = ?', args: [req.user.id] });
    const rs = await db.execute({
      sql: `SELECT id, source, white, black, result, event, played_at, move_count, created_at
              FROM games WHERE user_id = ?
             ORDER BY (played_at IS NULL), played_at DESC, id DESC
             LIMIT ? OFFSET ?`,
      args: [req.user.id, limit, offset],
    });
    res.json({ games: rs.rows.map(summary), total: Number(total.rows[0].n) });
  }));

  games.post('/', asyncHandler(async (req, res) => {
    const parsed = addSchema.safeParse(req.body ?? {});
    if (!parsed.success) return validationFailed(res, parsed.error);
    const parts = splitPgn(parsed.data.pgn);
    if (parts.length > MAX_GAMES_PER_REQUEST) {
      return res.status(400).json({ error: `Too many games in one upload (max ${MAX_GAMES_PER_REQUEST})` });
    }
    const result = await saveGames(db, req.user.id, 'pgn', parts.map((pgn) => ({ pgn })));
    return sendSaveResult(res, result);
  }));

  games.post('/bulk-delete', asyncHandler(async (req, res) => {
    const parsed = bulkDeleteSchema.safeParse(req.body ?? {});
    if (!parsed.success) return validationFailed(res, parsed.error);
    const ids = [...new Set(parsed.data.ids)];
    const rs = await db.execute({
      sql: `DELETE FROM games WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
      args: [req.user.id, ...ids],
    });
    return res.json({ deleted: rs.rowsAffected });
  }));

  games.get('/:id', asyncHandler(async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Game not found' });
    const rs = await db.execute({
      sql: 'SELECT * FROM games WHERE id = ? AND user_id = ?',
      args: [Number(req.params.id), req.user.id],
    });
    if (!rs.rows.length) return res.status(404).json({ error: 'Game not found' });
    const row = rs.rows[0];
    const parsed = parseGame(String(row.pgn));
    return res.json({
      game: { ...summary(row), pgn: String(row.pgn) },
      startFen: parsed.startFen,
      positions: parsed.positions,
      analysis: readAnalysis(row.analysis_json),
    });
  }));

  // Phase 4: save (or clear) the engine analysis of one game.
  games.patch('/:id', asyncHandler(async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Game not found' });
    const parsed = patchSchema.safeParse(req.body ?? {});
    if (!parsed.success) return validationFailed(res, parsed.error);
    const id = Number(req.params.id);
    const found = await db.execute({ sql: 'SELECT move_count FROM games WHERE id = ? AND user_id = ?', args: [id, req.user.id] });
    if (!found.rows.length) return res.status(404).json({ error: 'Game not found' });
    const { analysis } = parsed.data;
    if (analysis && analysis.moves.length !== Number(found.rows[0].move_count)) {
      return res.status(400).json({ error: 'The analysis does not match this game' });
    }
    await db.execute({
      sql: 'UPDATE games SET analysis_json = ? WHERE id = ? AND user_id = ?',
      args: [analysis ? JSON.stringify(analysis) : null, id, req.user.id],
    });
    return res.json({ ok: true });
  }));

  games.delete('/:id', asyncHandler(async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Game not found' });
    const rs = await db.execute({
      sql: 'DELETE FROM games WHERE id = ? AND user_id = ?',
      args: [Number(req.params.id), req.user.id],
    });
    if (rs.rowsAffected === 0) return res.status(404).json({ error: 'Game not found' });
    return res.json({ ok: true });
  }));

  // ---------- /api/import ----------
  const imports = express.Router();
  imports.use(requireAuth);
  imports.use(rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: importLimit,
    keyGenerator: (req) => `user-${req.user.id}`,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many imports. Please wait a few minutes.' },
  }));

  // Returns the fetched games, or sends the response itself (error / nothing found) and returns null.
  async function runImport(res, fetchGames) {
    try {
      const items = await fetchGames();
      if (items.length > 0) return items;
      res.json({ fetched: 0, added: [], skipped: 0, failed: [], message: 'No games found to import' });
      return null;
    } catch (err) {
      if (err instanceof ImportError) {
        res.status(err.status).json({ error: err.message });
        return null;
      }
      throw err;
    }
  }

  imports.post('/lichess', asyncHandler(async (req, res) => {
    const parsed = lichessSchema.safeParse(req.body ?? {});
    if (!parsed.success) return validationFailed(res, parsed.error);
    const items = await runImport(res, () => fetchLichessGames({ ...parsed.data, fetchImpl, token: lichessToken }));
    if (!items) return null;
    const result = await saveGames(db, req.user.id, 'lichess', items);
    return res.status(result.added.length ? 201 : 200).json({ fetched: items.length, ...result });
  }));

  imports.post('/chesscom', asyncHandler(async (req, res) => {
    const parsed = chesscomSchema.safeParse(req.body ?? {});
    if (!parsed.success) return validationFailed(res, parsed.error);
    const items = await runImport(res, () => fetchChesscomGames({ ...parsed.data, fetchImpl }));
    if (!items) return null;
    const result = await saveGames(db, req.user.id, 'chesscom', items);
    return res.status(result.added.length ? 201 : 200).json({ fetched: items.length, ...result });
  }));

  return { games, imports };
}

function sendSaveResult(res, result) {
  if (result.added.length === 0 && result.skipped === 0 && result.failed.length > 0) {
    return res.status(400).json({ error: 'No valid games found', ...result });
  }
  return res.status(result.added.length ? 201 : 200).json(result);
}
