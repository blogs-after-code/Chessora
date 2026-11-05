// Turns engine evaluations into move labels (best ... blunder). Pure functions, no DOM.
//
// "ev" is one number: the evaluation from WHITE's point of view in centipawns (100 = one pawn).
// A mate is stored as +-(10000 - moves to mate), so ev >= 9000 means White mates, <= -9000 Black mates.
//
// A move is labelled by how much of the mover's winning chance it threw away (in percentage
// points), not by raw centipawns: losing 200 cp when you are already +10 pawns up hardly matters,
// while losing 200 cp in an equal game decides it.

export const MATE = 10000;
export const MATE_LIMIT = 9000;
export const CP_CAP = 5000;

export const CLASSES = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];
export const LABELS = {
  best: 'Best', excellent: 'Excellent', good: 'Good',
  inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder',
};
export const MARKS = { best: '', excellent: '', good: '', inaccuracy: '?!', mistake: '?', blunder: '??' };

// Winning-chance points lost: up to 2 excellent, up to 5 good, up to 10 inaccuracy, up to 20 mistake, more = blunder.
const LIMITS = [['excellent', 2], ['good', 5], ['inaccuracy', 10], ['mistake', 20]];

/** Engine score (from the side to move's view) to an ev from White's view. */
export function scoreToEv(score, whiteToMove) {
  let v;
  if (score.mate !== null && score.mate !== undefined) {
    // mate 0 = the side to move is checkmated
    v = score.mate > 0 ? MATE - score.mate : -(MATE - Math.abs(score.mate));
  } else {
    v = Math.max(-CP_CAP, Math.min(CP_CAP, score.cp));
  }
  if (whiteToMove) return v;
  return v === 0 ? 0 : -v;
}

/** White's winning chance in percent (0-100) for an ev. */
export function winPercent(ev) {
  if (ev >= MATE_LIMIT) return 100;
  if (ev <= -MATE_LIMIT) return 0;
  const c = Math.max(-1000, Math.min(1000, ev));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

/** Text for the evaluation shown to people: "+0.35", "-1.20", "+M3", "Checkmate". */
export function formatEval(ev) {
  if (Math.abs(ev) >= MATE_LIMIT) {
    const n = MATE - Math.abs(ev);
    return n === 0 ? 'Checkmate' : `${ev > 0 ? '+' : '-'}M${n}`;
  }
  const pawns = (ev / 100).toFixed(2);
  return ev > 0 ? `+${pawns}` : pawns;
}

const clampLoss = (ev) => Math.max(-2000, Math.min(2000, ev));

/**
 * Label one move.
 * @param {{played: string, best: string|null, evBefore: number, evAfter: number, whiteMoved: boolean}} m
 *   evBefore / evAfter are evs (White's view) before and after the move.
 * @returns {{cls: string, loss: number, drop: number}} loss = centipawns lost (0 or more),
 *   drop = winning-chance points lost (0 or more)
 */
export function classifyMove({ played, best, evBefore, evAfter, whiteMoved }) {
  if (best && played === best) return { cls: 'best', loss: 0, drop: 0 };
  const sign = whiteMoved ? 1 : -1;
  const drop = Math.max(0, sign * (winPercent(evBefore) - winPercent(evAfter)));
  const loss = Math.round(Math.max(0, sign * (clampLoss(evBefore) - clampLoss(evAfter))));
  const hit = LIMITS.find(([, limit]) => drop <= limit);
  return { cls: hit ? hit[0] : 'blunder', loss, drop };
}

/** True when the first move of the game is White's (a game can start from a custom position). */
export function whiteMovesFirst(startFen) {
  return String(startFen).split(/\s+/)[1] !== 'b';
}

/**
 * Build the object that is saved with the game.
 * @param {object} p
 * @param {number[]} p.evs      evs of every position: evs[0] = start, evs[i] = after move i
 * @param {(string|null)[]} p.bests  bests[i] = engine's best move in position i
 * @param {string[]} p.played   the moves actually played, like "e2e4"
 * @param {string} p.startFen
 */
export function buildAnalysis({ evs, bests, played, startFen, depth, engine }) {
  if (evs.length !== played.length + 1 || bests.length !== evs.length) {
    throw new Error('Analysis input has the wrong length');
  }
  const whiteFirst = whiteMovesFirst(startFen);
  const moves = played.map((uci, i) => {
    const whiteMoved = whiteFirst === (i % 2 === 0);
    const { cls, loss } = classifyMove({ played: uci, best: bests[i], evBefore: evs[i], evAfter: evs[i + 1], whiteMoved });
    return { ev: evs[i + 1], best: bests[i], cls, loss };
  });
  return { version: 1, engine, depth, startEv: evs[0], moves };
}

/** Per side: how many moves of each label, and an accuracy score (0-100). */
export function summarize(analysis, startFen) {
  const whiteFirst = whiteMovesFirst(startFen);
  const blank = () => ({ counts: Object.fromEntries(CLASSES.map((c) => [c, 0])), total: 0, accuracySum: 0 });
  const sides = { white: blank(), black: blank() };
  analysis.moves.forEach((m, i) => {
    const whiteMoved = whiteFirst === (i % 2 === 0);
    const side = sides[whiteMoved ? 'white' : 'black'];
    const before = i === 0 ? analysis.startEv : analysis.moves[i - 1].ev;
    const drop = m.cls === 'best' ? 0 : Math.max(0, (whiteMoved ? 1 : -1) * (winPercent(before) - winPercent(m.ev)));
    side.counts[m.cls] += 1;
    side.total += 1;
    side.accuracySum += Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
  });
  const done = (s) => ({ counts: s.counts, moves: s.total, accuracy: s.total ? Math.round((s.accuracySum / s.total) * 10) / 10 : null });
  return { white: done(sides.white), black: done(sides.black) };
}
