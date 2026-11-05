// Pure helpers that read lines the chess engine prints (UCI protocol). No DOM, so they can be
// unit-tested with `node --test`.

/**
 * Read an "info" line. Returns { depth, score: { cp, mate } } (from the side to move's point of
 * view; exactly one of cp / mate is a number) or null when the line is not a usable evaluation
 * (other text, a bound estimate, or a secondary line of a multi-line search).
 */
export function parseInfo(line) {
  if (typeof line !== 'string' || !line.startsWith('info ')) return null;
  if (/\s(lowerbound|upperbound)(\s|$)/.test(line)) return null;
  const multipv = line.match(/\smultipv (\d+)/);
  if (multipv && Number(multipv[1]) > 1) return null;
  const score = line.match(/\sscore (cp|mate) (-?\d+)/);
  if (!score) return null;
  const depth = line.match(/\sdepth (\d+)/);
  const n = Number(score[2]);
  return {
    depth: depth ? Number(depth[1]) : 0,
    score: score[1] === 'cp' ? { cp: n, mate: null } : { cp: null, mate: n },
  };
}

/**
 * Read a "bestmove" line. Returns the move as text (like "e2e4"), null when there is no legal
 * move (checkmate or stalemate), or undefined when the line is not a bestmove line.
 */
export function parseBestmove(line) {
  if (typeof line !== 'string') return undefined;
  const m = line.match(/^bestmove (\S+)/);
  if (!m) return undefined;
  return m[1] === '(none)' || m[1] === '0000' ? null : m[1];
}
