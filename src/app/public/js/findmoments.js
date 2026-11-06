// Finds the key moments of an analysed game (blunders, mistakes, brilliant sacrifices, great
// moves). Pure functions, no DOM, so they are unit-tested with `node --test`.
//
// Everything is judged from the saved analysis (see classify.js): "ev" is the evaluation in
// centipawns from White's view, and a move's quality label is already stored with it.
import { parseFen } from './fen.js';
import { MATE_LIMIT, winPercent, whiteMovesFirst } from './classify.js';

export const KINDS = ['brilliant', 'blunder', 'mistake', 'great'];
export const KIND_LABELS = {
  brilliant: 'Brilliant move', blunder: 'Blunder', mistake: 'Mistake', great: 'Great move',
};
export const KIND_PLURALS = {
  brilliant: 'Brilliant moves', blunder: 'Blunders', mistake: 'Mistakes', great: 'Great moves',
};
/** Short names used in clip titles, like "Blunder: Nf6??". */
export const TITLE_LABELS = {
  brilliant: 'Brilliant', blunder: 'Blunder', mistake: 'Mistake', great: 'Great move',
};
export const KIND_MARKS = { brilliant: '!!', blunder: '??', mistake: '?', great: '!' };
export const KIND_COLORS = {
  brilliant: '#26c2a3', blunder: '#ff6b6b', mistake: '#f0a030', great: '#6fcf73',
};

// A brilliant move = a sacrifice that works: it gives up at least this much material (pawn = 1,
// knight or bishop = 3, rook = 5, queen = 9) that is still missing after the opponent's reply ...
export const MIN_SACRIFICE = 2;
// ... yet the engine still rates it best or excellent, the mover is not worse afterwards, and was
// not already crushing before (unless the sacrifice is the way to a forced mate).
export const MIN_WIN_AFTER = 50;
export const MAX_WIN_BEFORE = 92;
// A great move = the engine's best move right after the opponent made a mistake or blunder that
// threw away at least this many winning-chance points, leaving the mover clearly better.
export const GREAT_MIN_PUNISH = 10;
export const GREAT_MIN_WIN_AFTER = 55;

const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };

/** Material on the board in pawn units (kings are not counted). */
export function material(fen) {
  const total = { white: 0, black: 0 };
  for (const row of parseFen(fen)) {
    for (const piece of row) {
      if (!piece) continue;
      const value = VALUES[piece.toLowerCase()] || 0;
      if (piece === piece.toUpperCase()) total.white += value;
      else total.black += value;
    }
  }
  return total;
}

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Find the key moments, biggest impact first. Each moment is one move (one "ply"); a move is
 * only ever listed once.
 * @param {{startFen: string, positions: {san: string, uci: string, fen: string}[], analysis: object|null}} g
 * @returns {{ply: number, kind: string, san: string, uci: string, mover: 'white'|'black',
 *            impact: number, drop: number, sacrificed: number, ev: number, evBefore: number}[]}
 *   impact is a 0-100 score used for sorting; drop = winning-chance points the mover lost
 */
export function findMoments({ startFen, positions, analysis }) {
  if (!analysis || !Array.isArray(analysis.moves) || analysis.moves.length !== positions.length) return [];
  const n = positions.length;
  const whiteFirst = whiteMovesFirst(startFen);
  const fenAt = (ply) => (ply === 0 ? startFen : positions[ply - 1].fen);
  const evAt = (ply) => (ply === 0 ? analysis.startEv : analysis.moves[ply - 1].ev);
  const isWhiteMove = (ply) => whiteFirst === ((ply - 1) % 2 === 0);
  // winning chance (0-100) of the side that makes move `ply`, before or after it
  const moverWin = (ply, ev) => (isWhiteMove(ply) ? winPercent(ev) : 100 - winPercent(ev));
  const dropOf = (ply) => Math.max(0, moverWin(ply, evAt(ply - 1)) - moverWin(ply, evAt(ply)));
  const balance = (fen, white) => {
    const m = material(fen);
    return white ? m.white - m.black : m.black - m.white;
  };

  const moments = [];
  for (let ply = 1; ply <= n; ply++) {
    const move = analysis.moves[ply - 1];
    const white = isWhiteMove(ply);
    const winBefore = moverWin(ply, evAt(ply - 1));
    const winAfter = moverWin(ply, evAt(ply));
    const drop = move.cls === 'best' ? 0 : dropOf(ply);
    const sacrificed = ply < n ? balance(fenAt(ply - 1), white) - balance(fenAt(ply + 1), white) : 0;
    const evBefore = evAt(ply - 1);
    const mateForMover = Math.abs(evBefore) >= MATE_LIMIT && (white ? evBefore > 0 : evBefore < 0);

    let kind = null;
    let impact = 0;
    if ((move.cls === 'best' || move.cls === 'excellent') && sacrificed >= MIN_SACRIFICE
      && winAfter >= MIN_WIN_AFTER && (winBefore <= MAX_WIN_BEFORE || mateForMover)) {
      kind = 'brilliant';
      impact = Math.min(100, 50 + 5 * sacrificed);
    } else if (move.cls === 'blunder') {
      kind = 'blunder';
      impact = drop;
    } else if (move.cls === 'mistake') {
      kind = 'mistake';
      impact = drop;
    } else if (move.cls === 'best' && ply >= 2) {
      const prev = analysis.moves[ply - 2];
      const punished = dropOf(ply - 1);
      if ((prev.cls === 'mistake' || prev.cls === 'blunder') && punished >= GREAT_MIN_PUNISH && winAfter >= GREAT_MIN_WIN_AFTER) {
        kind = 'great';
        impact = punished * 0.9; // listed just below the error it punishes
      }
    }
    if (!kind) continue;
    moments.push({
      ply,
      kind,
      san: positions[ply - 1].san,
      uci: positions[ply - 1].uci,
      mover: white ? 'white' : 'black',
      impact: round1(impact),
      drop: round1(drop),
      sacrificed: Math.max(0, sacrificed),
      ev: evAt(ply),
      evBefore,
    });
  }
  return moments.sort((a, b) => b.impact - a.impact || a.ply - b.ply);
}

/** Title for a clip, like "Blunder: Nf6??". */
export function momentTitle(moment) {
  return `${TITLE_LABELS[moment.kind]}: ${moment.san}${KIND_MARKS[moment.kind]}`;
}

/**
 * Which positions a clip covers: `before` positions before the key move and `after` after it.
 * Always at least two positions, and always inside the game (0 .. maxPly).
 */
export function clipRange({ ply, before, after, maxPly }) {
  let from = Math.max(0, ply - Math.max(0, before));
  let to = Math.min(maxPly, ply + Math.max(0, after));
  if (to <= from) {
    if (from < maxPly) to = from + 1;
    else from = Math.max(0, to - 1);
  }
  return { from, to };
}
