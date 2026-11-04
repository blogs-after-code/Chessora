// Pure FEN helpers (no DOM), so they can be unit-tested with `node --test`.
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const PIECES = 'pnbrqkPNBRQK';

/**
 * Parse the piece-placement part of a FEN into an 8x8 array.
 * board[0] is rank 8 (top), board[7] is rank 1. Cells are a piece letter or null.
 * Throws an Error with a readable message on invalid input.
 */
export function parseFen(fen) {
  if (typeof fen !== 'string' || !fen.trim()) throw new Error('FEN is empty');
  const placement = fen.trim().split(/\s+/)[0];
  const ranks = placement.split('/');
  if (ranks.length !== 8) throw new Error('FEN must have 8 ranks');

  return ranks.map((rank, i) => {
    const row = [];
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') {
        for (let n = 0; n < Number(ch); n++) row.push(null);
      } else if (PIECES.includes(ch)) {
        row.push(ch);
      } else {
        throw new Error(`Invalid character "${ch}" in rank ${8 - i}`);
      }
    }
    if (row.length !== 8) throw new Error(`Rank ${8 - i} does not have 8 squares`);
    return row;
  });
}
