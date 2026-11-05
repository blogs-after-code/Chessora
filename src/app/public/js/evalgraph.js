// Draws the evaluation graph on a canvas: White's winning chance after every move.
// The light area is White's share, the dark area Black's. Clicking jumps to a move.
import { winPercent } from './classify.js';

const HEIGHT = 120;

/** White's winning chance (0-100) at ply 0..moves.length. */
export function graphValues(analysis) {
  return [analysis.startEv, ...analysis.moves.map((m) => m.ev)].map(winPercent);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{startEv: number, moves: {ev: number, cls: string}[]}} analysis
 * @param {{ply?: number, width?: number}} [opts]
 */
export function drawEvalGraph(canvas, analysis, { ply = 0, width = 480 } = {}) {
  const values = graphValues(analysis);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = HEIGHT * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${HEIGHT}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const n = values.length - 1;
  const x = (i) => (n === 0 ? 0 : (i / n) * width);
  const y = (v) => HEIGHT - (v / 100) * HEIGHT;

  ctx.fillStyle = '#3a3835';
  ctx.fillRect(0, 0, width, HEIGHT);

  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  values.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.lineTo(x(n), HEIGHT);
  ctx.closePath();
  ctx.fillStyle = '#e8e8e8';
  ctx.fill();

  ctx.strokeStyle = 'rgba(118, 150, 86, 0.9)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT / 2);
  ctx.lineTo(width, HEIGHT / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // dots on the big swings so they are easy to find
  analysis.moves.forEach((m, i) => {
    if (m.cls !== 'mistake' && m.cls !== 'blunder') return;
    ctx.beginPath();
    ctx.arc(x(i + 1), y(values[i + 1]), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = m.cls === 'blunder' ? '#e04b4b' : '#f0a030';
    ctx.fill();
  });

  ctx.strokeStyle = '#4aa3ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x(ply), 0);
  ctx.lineTo(x(ply), HEIGHT);
  ctx.stroke();
}

/** Which ply (0..moves) a click at clientX means. */
export function plyAtClick(canvas, clientX, plies) {
  const rect = canvas.getBoundingClientRect();
  const ratio = rect.width ? (clientX - rect.left) / rect.width : 0;
  return Math.max(0, Math.min(plies, Math.round(ratio * plies)));
}
