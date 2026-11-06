// Pure helpers for the export studio (no DOM, so they are unit-tested with `node --test`):
// output sizes, frame timing, limits, captions, file names and the video format choice.
import { MARKS } from './classify.js';

export const ASPECTS = { '1:1': [1, 1], '9:16': [9, 16], '16:9': [16, 9] };
/** Length of the shorter side of the picture, in pixels. */
export const SIZES = { small: 480, medium: 720, large: 1080 };
/** Time each move is on screen, in milliseconds. */
export const SPEEDS = { fast: 500, normal: 1000, relaxed: 1500, slow: 2000 };

export const HOLD_START_MS = 1000; // the first position stays a little longer
export const HOLD_END_MS = 2000; // so does the last one
export const KEY_HOLD_MS = 2000; // and the key move of a clip
export const GIF_MAX_SIZE = 'medium';
export const GIF_MAX_FRAMES = 250;
export const GIF_MAX_BYTES = 40 * 1024 * 1024;
export const VIDEO_MAX_MS = 180_000; // video is recorded in real time, so keep it bounded
export const WATERMARK_MAX = 40;

/** Width and height in pixels (both even numbers, which video encoders like). */
export function canvasSize(aspect, size) {
  const [a, b] = ASPECTS[aspect] || ASPECTS['1:1'];
  const short = SIZES[size] || SIZES.medium;
  if (a === b) return { w: short, h: short };
  const long = Math.round(((short * Math.max(a, b)) / Math.min(a, b)) / 2) * 2;
  return a > b ? { w: long, h: short } : { w: short, h: long };
}

/**
 * Which positions are shown and for how long. Position 0 is the start, n is after move n.
 * `keyPly` (optional) is the key move of a clip: it stays on screen for at least `keyMs`.
 * @returns {{ply: number, ms: number}[]}
 */
export function framePlan({ from, to, msPerMove, holdStart = HOLD_START_MS, holdEnd = HOLD_END_MS, keyPly = null, keyMs = KEY_HOLD_MS }) {
  const plan = [];
  for (let ply = from; ply <= to; ply++) plan.push({ ply, ms: msPerMove });
  if (plan.length === 0) return plan;
  plan[0].ms = Math.max(holdStart, msPerMove);
  if (plan.length > 1) plan[plan.length - 1].ms = Math.max(holdEnd, msPerMove);
  if (keyPly !== null) {
    const key = plan.find((f) => f.ply === keyPly);
    if (key) key.ms = Math.max(key.ms, keyMs);
  }
  return plan;
}

export const totalMs = (plan) => plan.reduce((sum, f) => sum + f.ms, 0);

/** The position (ply) that is on screen `t` milliseconds after the start. */
export function plyAtTime(plan, t) {
  let end = 0;
  for (const f of plan) {
    end += f.ms;
    if (t < end) return f.ply;
  }
  return plan.length ? plan[plan.length - 1].ply : 0;
}

/**
 * Check the chosen start and end positions for a GIF or video.
 * @returns {{from: number, to: number} | {error: string}}
 */
export function checkRange(from, to, maxPly) {
  const f = Number(from);
  const t = Number(to);
  if (!Number.isInteger(f) || !Number.isInteger(t)) return { error: 'Start and end must be whole numbers.' };
  if (f < 0 || t > maxPly) return { error: `Positions go from 0 to ${maxPly}.` };
  if (f >= t) return { error: 'The end position must come after the start position.' };
  return { from: f, to: t };
}

/** Returns a message when the chosen options are too big, or null when they are fine. */
export function limitProblem({ kind, plan, size }) {
  if (kind === 'gif') {
    if (SIZES[size] > SIZES[GIF_MAX_SIZE]) return 'GIF files are limited to Small or Medium size to keep them a sensible file size. Choose a smaller size, or make a video.';
    if (plan.length > GIF_MAX_FRAMES) return `A GIF can have at most ${GIF_MAX_FRAMES} positions. Choose a shorter range, or make a video.`;
  }
  if (kind === 'video' && totalMs(plan) > VIDEO_MAX_MS) {
    return `A video can be at most ${VIDEO_MAX_MS / 60000} minutes long. Choose a shorter range or a faster speed.`;
  }
  return null;
}

/** Text under the board: "12. Qxf7#" in the colour of its quality label when the game is analysed. */
export function captionFor(ply, positions, analysis) {
  if (ply <= 0) return { text: 'Start position', cls: null };
  const i = ply - 1;
  const cls = analysis && analysis.moves[i] ? analysis.moves[i].cls : null;
  const mark = cls ? MARKS[cls] : '';
  return { text: `${Math.floor(i / 2) + 1}${i % 2 === 0 ? '.' : '...'} ${positions[i].san}${mark}`, cls };
}

export function cleanWatermark(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, WATERMARK_MAX);
}

const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

/** A safe download name like "chessora-alice-vs-bob-gif.gif" (no player text can break the path). */
export function fileName({ white, black, kind, ply, ext }) {
  const who = [slug(white), slug(black)].filter(Boolean).join('-vs-') || 'game';
  const part = kind === 'png' ? `move${ply}` : kind;
  return `chessora-${who}-${part}.${ext}`;
}

const VIDEO_TYPES = [
  ['video/mp4;codecs=avc1', 'mp4'],
  ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9', 'webm'],
  ['video/webm;codecs=vp8', 'webm'],
  ['video/webm', 'webm'],
];

/** The best video format this browser can record (MP4 first), or null. */
export function pickVideoType(isSupported) {
  for (const [mime, ext] of VIDEO_TYPES) {
    if (isSupported(mime)) return { mime, ext };
  }
  return null;
}
