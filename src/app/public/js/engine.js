// Runs Stockfish (WebAssembly) in a Web Worker so the page stays responsive.
// The server hands out the engine files at /vendor/stockfish/engine.js and engine.wasm.
import { parseInfo, parseBestmove } from './uci.js';
import { scoreToEv, buildAnalysis } from './classify.js';

export const ENGINE_URL = '/vendor/stockfish/engine.js';
export const ENGINE_NAME = 'Stockfish 19 lite';

export class AbortError extends Error {
  constructor() {
    super('Analysis cancelled');
    this.name = 'AbortError';
  }
}

/** Start the engine. Resolves when it is ready; call .terminate() when done or to cancel. */
export async function createEngine({ url = ENGINE_URL } = {}) {
  let worker;
  try {
    worker = new Worker(url);
  } catch {
    throw new Error('This browser could not start the chess engine.');
  }
  let pending = null; // { handler, resolve, reject, timer }
  let stopped = false;

  const settle = (fn) => {
    const p = pending;
    pending = null;
    clearTimeout(p.timer);
    fn(p);
  };
  worker.onmessage = (e) => {
    if (!pending || typeof e.data !== 'string') return;
    const result = pending.handler(e.data);
    if (result !== undefined) settle((p) => p.resolve(result));
  };
  worker.onerror = () => {
    if (pending) settle((p) => p.reject(new Error('The chess engine failed to load. Reload the page and try again.')));
    stopped = true;
  };

  const send = (cmd) => worker.postMessage(cmd);
  const waitFor = (handler, ms) => new Promise((resolve, reject) => {
    if (stopped) return reject(new AbortError());
    const timer = setTimeout(() => {
      if (pending) settle((p) => p.reject(new Error('The chess engine stopped responding.')));
    }, ms);
    pending = { handler, resolve, reject, timer };
  });

  send('uci');
  await waitFor((line) => (line === 'uciok' ? true : undefined), 30000);
  send('isready');
  await waitFor((line) => (line === 'readyok' ? true : undefined), 30000);
  send('ucinewgame');

  return {
    /** Evaluate one position to the given depth. Resolves { score, best, depth }. */
    analyse(fen, depth) {
      send(`position fen ${fen}`);
      send(`go depth ${depth}`);
      let last = null;
      return waitFor((line) => {
        const info = parseInfo(line);
        if (info) last = info;
        const best = parseBestmove(line);
        if (best === undefined) return undefined;
        return { score: last ? last.score : null, best, depth: last ? last.depth : 0 };
      }, 120000);
    },
    terminate() {
      stopped = true;
      worker.terminate();
      if (pending) settle((p) => p.reject(new AbortError()));
    },
  };
}

/**
 * Analyse a whole game, one position after another.
 * @param {object} p
 * @param {string} p.startFen
 * @param {{uci: string, fen: string}[]} p.positions
 * @param {number} p.depth
 * @param {(done: number, total: number) => void} [p.onProgress]
 * @param {{cancelled?: boolean, engine?: object}} [p.control] a plain object the caller keeps:
 *   to cancel, set control.cancelled = true and call control.engine?.terminate()
 * @returns the analysis object ready to be saved
 */
export async function analyseGame({ startFen, positions, depth, onProgress, control = {} }) {
  const engine = await createEngine();
  control.engine = engine;
  if (control.cancelled) {
    engine.terminate();
    throw new AbortError();
  }
  try {
    const fens = [startFen, ...positions.map((p) => p.fen)];
    const evs = [];
    const bests = [];
    for (let i = 0; i < fens.length; i++) {
      onProgress?.(i, fens.length);
      const r = await engine.analyse(fens[i], depth);
      if (!r.score) throw new Error('The engine did not return an evaluation.');
      evs.push(scoreToEv(r.score, fens[i].split(/\s+/)[1] !== 'b'));
      bests.push(r.best);
    }
    onProgress?.(fens.length, fens.length);
    return buildAnalysis({ evs, bests, played: positions.map((p) => p.uci), startFen, depth, engine: ENGINE_NAME });
  } finally {
    engine.terminate();
  }
}
