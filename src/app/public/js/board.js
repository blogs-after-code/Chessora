// Draws a chessboard on a <canvas>. Pieces are SVG images from a licensed set (see
// public/pieces/<set>/LICENSE.txt); until a set has loaded (or if it fails) the old text symbols
// are used, so drawing never breaks.
import { parseFen } from './fen.js';

const GLYPHS = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

export const THEMES = {
  green: { light: '#eeeed2', dark: '#769656' },
  brown: { light: '#f0d9b5', dark: '#b58863' },
  blue: { light: '#dee3e6', dark: '#8ca2ad' },
  slate: { light: '#c9ced6', dark: '#5b6b7e' },
};

/** Piece sets people can choose. "glyphs" needs no files. */
export const PIECE_SETS = {
  cburnett: 'Classic (cburnett)',
  glyphs: 'Simple text symbols',
};
export const DEFAULT_PIECE_SET = 'cburnett';

const cache = new Map(); // "set/wK" -> loaded <img>
const loading = new Map(); // set -> Promise

// "K" -> "wK", "k" -> "bK"
const pieceFile = (piece) => `${piece === piece.toUpperCase() ? 'w' : 'b'}${piece.toUpperCase()}`;

/** Load the 12 piece images of a set. Never rejects: on failure drawing falls back to symbols. */
export function loadPieces(set = DEFAULT_PIECE_SET) {
  if (set === 'glyphs') return Promise.resolve(true);
  if (!loading.has(set)) {
    const names = ['K', 'Q', 'R', 'B', 'N', 'P'].flatMap((p) => [`w${p}`, `b${p}`]);
    loading.set(set, Promise.all(names.map((name) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { cache.set(`${set}/${name}`, img); resolve(true); };
      img.onerror = () => resolve(false);
      img.src = `/pieces/${set}/${name}.svg`;
    }))).then((results) => results.every(Boolean)));
  }
  return loading.get(set);
}

// board row 0 is rank 8, column 0 is file a
function squareName(row, col) {
  return `${'abcdefgh'[col]}${8 - row}`;
}

/**
 * Draw a board into a square area of any 2D canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x left edge   @param {number} y top edge   @param {number} size side length
 * @param {string} fen
 * @param {{theme?: keyof THEMES, flipped?: boolean, lastMove?: string, arrow?: string,
 *          pieceSet?: keyof PIECE_SETS, coords?: boolean}} [opts]
 *   lastMove / arrow are moves like "e2e4": lastMove tints the two squares, arrow draws an arrow.
 */
export function drawBoardOn(ctx, x, y, size, fen, opts = {}) {
  const { theme = 'green', flipped = false, lastMove, arrow, pieceSet = DEFAULT_PIECE_SET, coords = true } = opts;
  const colors = THEMES[theme] || THEMES.green;
  const board = parseFen(fen);
  const sq = size / 8;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const row = flipped ? 7 - r : r;
      const col = flipped ? 7 - f : f;
      const light = (r + f) % 2 === 0;
      ctx.fillStyle = light ? colors.light : colors.dark;
      ctx.fillRect(x + f * sq, y + r * sq, sq, sq);
      if (lastMove && (squareName(row, col) === lastMove.slice(0, 2) || squareName(row, col) === lastMove.slice(2, 4))) {
        ctx.fillStyle = 'rgba(255, 221, 51, 0.45)';
        ctx.fillRect(x + f * sq, y + r * sq, sq, sq);
      }
    }
  }

  if (coords) drawCoords(ctx, x, y, sq, colors, flipped);

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[flipped ? 7 - r : r][flipped ? 7 - f : f];
      if (piece) drawPiece(ctx, piece, x + f * sq, y + r * sq, sq, pieceSet);
    }
  }

  if (arrow) drawArrow(ctx, arrow, x, y, sq, flipped);
}

/**
 * Draw a board on a <canvas> element, sized for the screen (sharp on high-density displays).
 * @param {HTMLCanvasElement} canvas
 * @param {string} fen
 * @param {{size?: number} & Parameters<typeof drawBoardOn>[5]} [opts]
 */
export function drawBoard(canvas, fen, opts = {}) {
  const { size = 480 } = opts;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBoardOn(ctx, 0, 0, size, fen, opts);
}

function drawPiece(ctx, piece, px, py, sq, pieceSet) {
  const img = pieceSet === 'glyphs' ? null : cache.get(`${pieceSet}/${pieceFile(piece)}`);
  if (img) {
    ctx.drawImage(img, px, py, sq, sq);
    return;
  }
  // fallback: text symbol; the solid (black-style) shapes are used so the fill colour sets the side
  ctx.save();
  ctx.font = `${sq * 0.8}px "Segoe UI Symbol", "DejaVu Sans", "Noto Sans Symbols 2", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const isWhite = piece === piece.toUpperCase();
  ctx.lineWidth = sq * 0.04;
  ctx.strokeStyle = isWhite ? '#222' : '#eee';
  ctx.fillStyle = isWhite ? '#fff' : '#111';
  const glyph = GLYPHS[piece.toLowerCase()];
  ctx.strokeText(glyph, px + sq / 2, py + sq / 2 + sq * 0.04);
  ctx.fillText(glyph, px + sq / 2, py + sq / 2 + sq * 0.04);
  ctx.restore();
}

// file letters along the bottom edge, rank numbers along the left edge, in the opposite square colour
function drawCoords(ctx, x, y, sq, colors, flipped) {
  ctx.save();
  ctx.font = `bold ${Math.max(8, sq * 0.2)}px system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < 8; i++) {
    const file = 'abcdefgh'[flipped ? 7 - i : i];
    const rank = flipped ? i + 1 : 8 - i;
    // bottom row: square (7, i) is light when (7 + i) is even
    ctx.fillStyle = (7 + i) % 2 === 0 ? colors.dark : colors.light;
    ctx.textAlign = 'right';
    ctx.fillText(file, x + (i + 1) * sq - sq * 0.07, y + 8 * sq - sq * 0.08);
    // left column: square (i, 0) is light when i is even
    ctx.fillStyle = i % 2 === 0 ? colors.dark : colors.light;
    ctx.textAlign = 'left';
    ctx.fillText(String(rank), x + sq * 0.07, y + i * sq + sq * 0.24);
  }
  ctx.restore();
}

function drawArrow(ctx, move, bx, by, sq, flipped) {
  const centre = (name) => {
    const col = 'abcdefgh'.indexOf(name[0]);
    const row = 8 - Number(name[1]);
    return [bx + ((flipped ? 7 - col : col) + 0.5) * sq, by + ((flipped ? 7 - row : row) + 0.5) * sq];
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
