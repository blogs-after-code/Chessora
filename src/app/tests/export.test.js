import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from './helpers.js';

let ctx;
before(async () => {
  ctx = await startTestApp();
});
after(() => ctx.stop());

test('the GIF library and piece images are served', async () => {
  const lib = await fetch(`${ctx.base}/vendor/gifenc/gifenc.esm.js`);
  assert.equal(lib.status, 200);
  assert.match(lib.headers.get('content-type'), /javascript/);
  assert.match(await lib.text(), /GIFEncoder|writeFrame/);
  assert.equal((await fetch(`${ctx.base}/vendor/gifenc/package.json`)).status, 404);
  for (const name of ['wK', 'bP', 'bQ']) {
    const r = await fetch(`${ctx.base}/pieces/cburnett/${name}.svg`);
    assert.equal(r.status, 200, name);
    assert.match(r.headers.get('content-type'), /svg/);
  }
  assert.equal((await fetch(`${ctx.base}/pieces/cburnett/LICENSE.txt`)).status, 200);
});

test('the export page is served', async () => {
  const r = await fetch(`${ctx.base}/export.html`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Export image, GIF or video/);
});

test('the key moments page is served', async () => {
  const r = await fetch(`${ctx.base}/moments.html`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Key moments and clips/);
});

test('every piece file is a valid, sized SVG', async () => {
  for (const colour of ['w', 'b']) for (const p of ['K', 'Q', 'R', 'B', 'N', 'P']) {
    const text = await (await fetch(`${ctx.base}/pieces/cburnett/${colour}${p}.svg`)).text();
    const root = text.match(/<svg[^>]*>/)[0];
    assert.equal((root.match(/\swidth=/g) || []).length, 1, `${colour}${p} has exactly one width`);
    assert.equal((root.match(/\sheight=/g) || []).length, 1, `${colour}${p} has exactly one height`);
  }
});

test('the security policy lets the studio preview its own results (blob:) but not other sites', async () => {
  const csp = (await fetch(`${ctx.base}/export.html`)).headers.get('content-security-policy');
  assert.match(csp, /img-src 'self' data: blob:/);
  assert.match(csp, /media-src 'self' blob:/);
  assert.match(csp, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.doesNotMatch(csp, /https?:\/\//, 'no outside site is allowed');
});
