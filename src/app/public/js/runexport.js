// Runs one GIF or video build and returns the file (shared by the clip maker; same engine as the export studio).
import { makeGif } from './gifexport.js';
import { recordVideo } from './videoexport.js';

/**
 * @param {{kind: 'gif'|'video', canvas: HTMLCanvasElement, plan: {ply: number, ms: number}[],
 *          draw: (ply: number) => void, onProgress?: (f: number) => void, control?: {cancelled?: boolean}}} p
 * @returns {Promise<{blob: Blob, ext: string}>}
 */
export async function runExport({ kind, canvas, plan, draw, onProgress, control }) {
  if (kind === 'gif') return { blob: await makeGif({ canvas, plan, draw, onProgress, control }), ext: 'gif' };
  return recordVideo({ canvas, plan, draw, onProgress, control });
}
