// Records the animation as a video (MP4 where the browser can, otherwise WebM) by playing it on a
// canvas and capturing that canvas with MediaRecorder. It runs in real time: a 30 second video
// takes 30 seconds to make, and the tab must stay open and visible.
import { pickVideoType, plyAtTime, totalMs } from './exportplan.js';
import { CancelledError } from './gifexport.js';

const TICK_MS = 1000 / 20;

/** True when this browser can record video from a canvas. */
export function videoSupported() {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    && pickVideoType((t) => MediaRecorder.isTypeSupported(t)) !== null;
}

/**
 * @param {object} p
 * @param {HTMLCanvasElement} p.canvas
 * @param {{ply: number, ms: number}[]} p.plan
 * @param {(ply: number) => void} p.draw
 * @param {(fraction: number) => void} [p.onProgress]
 * @param {{cancelled?: boolean}} [p.control]
 * @returns {Promise<{blob: Blob, ext: string}>}
 */
export async function recordVideo({ canvas, plan, draw, onProgress, control = {} }) {
  const type = pickVideoType((t) => MediaRecorder.isTypeSupported(t));
  if (!type) throw new Error('This browser cannot record video. Try Chrome, Edge or Firefox, or make a GIF.');

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = () => reject(new Error('The browser failed while recording the video.'));
  });

  const total = totalMs(plan);
  draw(plan[0].ply);
  recorder.start(250);
  const t0 = performance.now();
  try {
    await new Promise((resolve) => {
      const tick = () => {
        const t = performance.now() - t0;
        if (control.cancelled || t >= total) return resolve();
        // Redraw on every tick, even when the position has not changed: the browser only records a
        // new video frame when the canvas is redrawn, and without this a position that stays on
        // screen for a few seconds (like the last one) would get no video time at all.
        draw(plyAtTime(plan, t));
        onProgress?.(t / total);
        setTimeout(tick, TICK_MS);
        return undefined;
      };
      tick();
    });
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped.catch(() => {});
    stream.getTracks().forEach((tr) => tr.stop());
  }
  if (control.cancelled) throw new CancelledError();
  onProgress?.(1);
  return { blob: new Blob(chunks, { type: type.mime.split(';')[0] }), ext: type.ext };
}
