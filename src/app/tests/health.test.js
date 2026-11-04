import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from './helpers.js';

let ctx;
before(async () => { ctx = await startTestApp(); });
after(() => ctx.stop());

test('GET /api/health returns ok', async () => {
  const res = await fetch(`${ctx.base}/api/health`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});

test('unknown /api route returns JSON 404', async () => {
  const res = await fetch(`${ctx.base}/api/nope`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Not found' });
});

test('home page is served', async () => {
  const res = await fetch(`${ctx.base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Chessora/);
});

test('security headers are set', async () => {
  const res = await fetch(`${ctx.base}/api/health`);
  assert.ok(res.headers.get('x-content-type-options'));
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('malformed JSON gives a 400, not a crash', async () => {
  const res = await fetch(`${ctx.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not json',
  });
  assert.equal(res.status, 400);
});
