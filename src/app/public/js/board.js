// Draws a chessboard on a <canvas>. Pieces use Unicode chess glyphs for now;
// a licensed SVG piece set replaces them in Phase 5 (same drawBoard API).
import { parseFen } from './fen.js';

const GLYPHS = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

export const THEMES = {
  green: { light: '#eeeed2', dark: '#769656' },
  brown: { light: '#f0d9b5', dark: '#b58863' },
  blue: { light: '#dee3e6', dark: '#8ca2ad' },
};

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} fen
 * @param {{size?: number, theme?: keyof THEMES, flipped?: boolean}} [opts]
 */
export function drawBoard(canvas, fen, opts = {}) {
  const { size = 480, theme = 'green', flipped = false } = opts;
  const colors = THEMES[theme] || THEMES.green;
  const board = parseFen(fen);

  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sq = size / 8;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const row = flipped ? 7 - r : r;
      const col = flipped ? 7 - f : f;
      ctx.fillStyle = (r + f) % 2 === 0 ? colors.light : colors.dark;
      ctx.fillRect(f * sq, r * sq, sq, sq);

      const piece = board[row][col];
      if (piece) {
        ctx.font = `${sq * 0.8}px "Segoe UI Symbol", "DejaVu Sans", "Noto Sans Symbols 2", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // white pieces: light fill with dark outline; black pieces: dark fill
        const isWhite = piece === piece.toUpperCase();
        ctx.lineWidth = sq * 0.04;
        ctx.strokeStyle = isWhite ? '#222' : '#eee';
        ctx.fillStyle = isWhite ? '#fff' : '#111';
        const glyph = solidGlyph(piece);
        ctx.strokeText(glyph, f * sq + sq / 2, r * sq + sq / 2 + sq * 0.04);
        ctx.fillText(glyph, f * sq + sq / 2, r * sq + sq / 2 + sq * 0.04);
      }
    }
  }
}

// Always use the solid (black-style) glyph shapes so fill colour controls the side.
function solidGlyph(piece) {
  return GLYPHS[piece.toLowerCase()];
}
