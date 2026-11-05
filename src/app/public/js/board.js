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
 * @param {{size?: number, theme?: keyof THEMES, flipped?: boolean, lastMove?: string, arrow?: string}} [opts]
 *   lastMove / arrow are moves like "e2e4": lastMove tints the two squares, arrow draws an arrow.
 */
export function drawBoard(canvas, fen, opts = {}) {
  const { size = 480, theme = 'green', flipped = false, lastMove, arrow } = opts;
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
      if (lastMove && (squareName(row, col) === lastMove.slice(0, 2) || squareName(row, col) === lastMove.slice(2, 4))) {
        ctx.fillStyle = 'rgba(255, 221, 51, 0.45)';
        ctx.fillRect(f * sq, r * sq, sq, sq);
      }

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

  if (arrow) drawArrow(ctx, arrow, sq, flipped);
}

// Always use the solid (black-style) glyph shapes so fill colour controls the side.
function solidGlyph(piece) {
  return GLYPHS[piece.toLowerCase()];
}

// board row 0 is rank 8, column 0 is file a
function squareName(row, col) {
  return `${'abcdefgh'[col]}${8 - row}`;
}

function drawArrow(ctx, move, sq, flipped) {
  const centre = (name) => {
    const col = 'abcdefgh'.indexOf(name[0]);
    const row = 8 - Number(name[1]);
    return [((flipped ? 7 - col : col) + 0.5) * sq, ((flipped ? 7 - row : row) + 0.5) * sq];
  };
  const [x1, y1] = centre(move.slice(0, 2));
  const [x2, y2] = centre(move.slice(2, 4));
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = sq * 0.32;
  const tipX = x2 - Math.cos(angle) * sq * 0.05;
  const tipY = y2 - Math.sin(angle) * sq * 0.05;
  ctx.save();
  ctx.strokeStyle = 'rgba(40, 140, 220, 0.85)';
  ctx.fillStyle = 'rgba(40, 140, 220, 0.85)';
  ctx.lineWidth = sq * 0.14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(tipX - Math.cos(angle) * head * 0.8, tipY - Math.sin(angle) * head * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - Math.cos(angle - 0.45) * head, tipY - Math.sin(angle - 0.45) * head);
  ctx.lineTo(tipX - Math.cos(angle + 0.45) * head, tipY - Math.sin(angle + 0.45) * head);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
