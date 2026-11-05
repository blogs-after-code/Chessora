// Parse and validate one game with chess.js.
import { Chess } from 'chess.js';
import { cleanTag, normalizeResult, pgnDateToIso, stripAnnotations } from './pgn-utils.js';

export const MAX_PGN_CHARS = 100_000;

export class PgnError extends Error {}

/**
 * @param {string} rawPgn one game
 * @returns {{pgn, white, black, result, event, playedAt, moveCount, startFen, positions}}
 *   positions[i] = { san, uci, fen } is the move i and the position AFTER it (move 1 = index 0).
 * @throws {PgnError} when the text is not a playable game
 */
export function parseGame(rawPgn) {
  const pgn = String(rawPgn ?? '').trim();
  if (!pgn) throw new PgnError('Empty PGN');
  if (pgn.length > MAX_PGN_CHARS) {
    throw new PgnError(`PGN is too large (max ${MAX_PGN_CHARS.toLocaleString('en-US')} characters per game)`);
  }

  const chess = new Chess();
  try {
    // The original text is stored as-is; chess.js only sees the clean main line.
    chess.loadPgn(stripAnnotations(pgn));
  } catch (err) {
    throw new PgnError(`Invalid PGN: ${String(err.message).split('\n')[0].slice(0, 150)}`);
  }

  const moves = chess.history({ verbose: true });
  if (moves.length === 0) throw new PgnError('The game has no moves');

  const h = chess.header();
  return {
    pgn,
    white: cleanTag(h.White),
    black: cleanTag(h.Black),
    result: normalizeResult(h.Result),
    event: cleanTag(h.Event, ''),
    playedAt: pgnDateToIso(h.Date) || pgnDateToIso(h.UTCDate),
    moveCount: moves.length,
    startFen: moves[0].before,
    positions: moves.map((m) => ({ san: m.san, uci: `${m.from}${m.to}${m.promotion || ''}`, fen: m.after })),
  };
}
