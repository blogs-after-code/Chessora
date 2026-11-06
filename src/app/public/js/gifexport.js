// Turns a frame plan into an animated GIF in the browser, using the "gifenc" library
// (served by our server at /vendor/gifenc/gifenc.esm.js, loaded only when a GIF is requested).
import { GIF_MAX_BYTES } from './exportplan.js';

export class CancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CancelledError';
  }
}

/**
 * @param {object} p
 * @param {HTMLCanvasElement} p.canvas   the canvas the pictures are drawn on (created with willReadFrequently)
 * @param {{ply: number, ms: number}[]} p.plan
 * @param {(ply: number) => void} p.draw   draws one position on the canvas
 * @param {(fraction: number) => void} [p.onProgress]
 * @param {{cancelled?: boolean}} [p.control]
 * @returns {Promise<Blob>}
 */
export async function makeGif({ canvas, plan, draw, onProgress, control = {} }) {
  const { GIFEncoder, quantize, applyPalette } = await import('/vendor/gifenc/gifenc.esm.js');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const gif = GIFEncoder();
  for (let i = 0; i < plan.length; i++) {
    if (control.cancelled) throw new CancelledError();
    draw(plan[i].ply);
    const { data } = ctx.getImageData(0, 0, width, height);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: plan[i].ms });
    if (gif.bytesView().length > GIF_MAX_BYTES) {
      throw new Error('This GIF is getting too large. Choose a smaller size or a shorter range, or make a video.');
    }
    onProgress?.((i + 1) / plan.length);
    // let the page repaint and react to the Cancel button between frames
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}
