// Draws one complete export picture (background, player names, board, move text, watermark)
// onto any canvas. Used for the preview, PNG, GIF and video, so they always look the same.
import { drawBoardOn } from './board.js';

const CLASS_COLORS = {
  best: '#6fcf73', excellent: '#a5d65b', good: '#9db0b9',
  inaccuracy: '#f2d03b', mistake: '#f0a030', blunder: '#ff6b6b',
};
const FONT = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// shorten text with ... until it fits
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}...`).width > maxWidth) t = t.slice(0, -1);
  return `${t}...`;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w @param {number} h picture size in pixels
 * @param {{fen: string, flipped: boolean, theme: string, pieceSet: string, lastMove?: string,
 *          white: string, black: string, showNames: boolean,
 *          caption: {text: string, cls: string|null}|null, watermark: string,
 *          title?: {text: string, color: string}|null, evBar?: number|null}} s
 *   title = banner above the board (clips); evBar = White's winning chance 0-100 for a bar beside the board
 */
export function renderFrame(ctx, w, h, s) {
  const short = Math.min(w, h);
  const pad = Math.round(short * 0.03);
  const titleH = s.title ? Math.round(short * 0.085) : 0;
  const nameH = s.showNames ? Math.round(short * 0.06) : 0;
  const capH = s.caption ? Math.round(short * 0.07) : 0;
  const wmH = s.watermark ? Math.round(short * 0.05) : 0;
  const barW = typeof s.evBar === 'number' ? Math.max(8, Math.round(short * 0.035)) : 0;
  const side = barW ? barW + Math.round(barW * 0.6) : 0; // room taken by the bar on each side (keeps the board centred)
  const boardSize = Math.max(80, Math.floor(Math.min(w - 2 * pad - 2 * side, h - 2 * pad - titleH - 2 * nameH - capH - wmH) / 8) * 8);
  const stackH = titleH + nameH * 2 + boardSize + capH + wmH;
  const top = Math.round((h - stackH) / 2);
  const x = Math.round((w - boardSize) / 2);

  ctx.fillStyle = '#161512';
  ctx.fillRect(0, 0, w, h);

  if (s.title) {
    ctx.fillStyle = s.title.color || '#ffffff';
    ctx.font = `bold ${Math.round(titleH * 0.62)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fit(ctx, s.title.text, w - 2 * pad), w / 2, top + titleH / 2);
  }
  const y0 = top + titleH;

  const topIsBlack = !s.flipped; // white at the bottom: Black's name goes on top
  if (s.showNames) {
    drawName(ctx, topIsBlack ? s.black : s.white, topIsBlack ? '#111' : '#fff', x, y0, boardSize, nameH);
    drawName(ctx, topIsBlack ? s.white : s.black, topIsBlack ? '#fff' : '#111', x, y0 + nameH + boardSize, boardSize, nameH);
  }

  drawBoardOn(ctx, x, y0 + nameH, boardSize, s.fen, {
    theme: s.theme, flipped: s.flipped, pieceSet: s.pieceSet, lastMove: s.lastMove, coords: true,
  });
  if (barW) drawEvBar(ctx, x - side, y0 + nameH, barW, boardSize, s.evBar, s.flipped);

  let y = y0 + nameH * 2 + boardSize;
  if (s.caption) {
    ctx.fillStyle = CLASS_COLORS[s.caption.cls] || '#eeeeee';
    ctx.font = `bold ${Math.round(capH * 0.62)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fit(ctx, s.caption.text, w - 2 * pad), w / 2, y + capH / 2);
    y += capH;
  }
  if (s.watermark) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = `${Math.round(wmH * 0.7)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fit(ctx, s.watermark, w - 2 * pad), w / 2, y + wmH / 2);
  }
}

// vertical bar: the light part is White's share of the winning chance
function drawEvBar(ctx, bx, by, barW, size, whitePct, flipped) {
  const white = size * (Math.max(0, Math.min(100, whitePct)) / 100);
  ctx.fillStyle = '#403d39';
  ctx.fillRect(bx, by, barW, size);
  ctx.fillStyle = '#f2f2f2';
  if (flipped) ctx.fillRect(bx, by, barW, white);
  else ctx.fillRect(bx, by + size - white, barW, white);
  ctx.fillStyle = 'rgba(118, 150, 86, 0.9)';
  ctx.fillRect(bx, by + size / 2 - 1, barW, 2);
}

function drawName(ctx, name, dotColor, x, y, boardSize, nameH) {
  const r = nameH * 0.2;
  ctx.beginPath();
  ctx.arc(x + r + 2, y + nameH / 2, r, 0, Math.PI * 2);
  ctx.fillStyle = dotColor;
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = Math.max(1, nameH * 0.03);
  ctx.stroke();
  ctx.fillStyle = '#f2f2f2';
  ctx.font = `bold ${Math.round(nameH * 0.52)}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(fit(ctx, name, boardSize - r * 2 - 14), x + r * 2 + 10, y + nameH / 2 + 1);
}
