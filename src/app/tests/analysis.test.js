import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, call, registerUser } from './helpers.js';
import { SCHOLARS_MATE } from './samples.js';

let ctx;
before(async () => {
  ctx = await startTestApp();
});
after(() => ctx.stop());

// Scholar's mate has 7 moves
const fakeAnalysis = (n = 7, extra = {}) => ({
  version: 1,
  engine: 'Test engine',
  depth: 10,
  startEv: 20,
  moves: Array.from({ length: n }, (_, i) => ({ ev: 20 + i, best: 'e2e4', cls: 'good', loss: 3 })),
  ...extra,
});

async function addGame(cookie) {
  const r = await call(ctx.base, 'POST', '/api/games', { cookie, body: { pgn: SCHOLARS_MATE } });
  return r.data.added[0].id;
}
const patch = (cookie, id, body) => call(ctx.base, 'PATCH', `/api/games/${id}`, { cookie, body });
const open = (cookie, id) => call(ctx.base, 'GET', `/api/games/${id}`, { cookie });

test('the game page data includes each move in engine notation and no analysis at first', async () => {
  const { cookie } = await registerUser(ctx.base);
  const id = await addGame(cookie);
  const g = await open(cookie, id);
  assert.equal(g.data.positions[0].uci, 'e2e4');
  assert.equal(g.data.positions.at(-1).uci, 'h5f7');
  assert.equal(g.data.analysis, null);
});

test('saving an analysis works and it comes back with the game', async () => {
  const { cookie } = await registerUser(ctx.base);
  const id = await addGame(cookie);
  const saved = await patch(cookie, id, { analysis: fakeAnalysis() });
  assert.equal(saved.status, 200);
  const g = await open(cookie, id);
  assert.deepEqual(g.data.analysis, fakeAnalysis());
});

test('saving again replaces it, and null removes it', async () => {
  const { cookie } = await registerUser(ctx.base);
  const id = await addGame(cookie);
  await patch(cookie, id, { analysis: fakeAnalysis() });
  await patch(cookie, id, { analysis: fakeAnalysis(7, { depth: 14 }) });
  assert.equal((await open(cookie, id)).data.analysis.depth, 14);
  assert.equal((await patch(cookie, id, { analysis: null })).status, 200);
  assert.equal((await open(cookie, id)).data.analysis, null);
});

test('bad analysis data is rejected and nothing is saved', async () => {
  const { cookie } = await registerUser(ctx.base);
  const id = await addGame(cookie);
  const bad = [
    {},
    { analysis: 'text' },
    { analysis: fakeAnalysis(6) }, // wrong number of moves
    { analysis: fakeAnalysis(8) },
    { analysis: fakeAnalysis(7, { depth: 99 }) },
    { analysis: fakeAnalysis(7, { version: 2 }) },
    { analysis: fakeAnalysis(7, { extra: 'x' }) },
    { analysis: { ...fakeAnalysis(), moves: [{ ev: 1, best: 'e2e4', cls: 'amazing', loss: 0 }] } },
    { analysis: { ...fakeAnalysis(), moves: [{ ev: 1, best: 'zz', cls: 'good', loss: 0 }] } },
    { analysis: { ...fakeAnalysis(), moves: [{ ev: 99999, best: 'e2e4', cls: 'good', loss: 0 }] } },
    { analysis: fakeAnalysis(), other: 1 },
  ];
  for (const body of bad) {
    const r = await patch(cookie, id, body);
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
  }
  assert.equal((await open(cookie, id)).data.analysis, null);
});

test('you cannot analyse someone else\'s game, and you must be logged in', async () => {
  const owner = await registerUser(ctx.base);
  const other = await registerUser(ctx.base);
  const id = await addGame(owner.cookie);
  assert.equal((await patch(other.cookie, id, { analysis: fakeAnalysis() })).status, 404);
  assert.equal((await patch(undefined, id, { analysis: fakeAnalysis() })).status, 401);
  assert.equal((await patch(owner.cookie, 99999, { analysis: fakeAnalysis() })).status, 404);
  assert.equal((await patch(owner.cookie, 'abc', { analysis: fakeAnalysis() })).status, 404);
  assert.equal((await open(owner.cookie, id)).data.analysis, null);
});

test('the engine files are served with the right types, and the page may run WebAssembly', async () => {
  const wasm = await fetch(`${ctx.base}/vendor/stockfish/engine.wasm`);
  assert.equal(wasm.status, 200);
  assert.equal(wasm.headers.get('content-type'), 'application/wasm');
  assert.ok((await wasm.arrayBuffer()).byteLength > 1_000_000);
  const js = await fetch(`${ctx.base}/vendor/stockfish/engine.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
  assert.match(js.headers.get('content-security-policy'), /script-src 'self' 'wasm-unsafe-eval'/);
  assert.equal((await fetch(`${ctx.base}/vendor/stockfish/other.js`)).status, 404);
  assert.equal((await fetch(`${ctx.base}/vendor/stockfish/../../package.json`)).status, 404);
});
