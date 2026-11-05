import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, call, registerUser } from './helpers.js';
import { SCHOLARS_MATE, FOOLS_MATE, UNFINISHED, ILLEGAL, MULTI, LICHESS_ANNOTATED } from './samples.js';

let ctx;
let fetchLog;
let routes;

// Fake network for the importers; each test sets `routes`.
const fakeFetch = async (url) => {
  fetchLog.push(String(url));
  const key = Object.keys(routes).find((k) => String(url).includes(k));
  if (!key) return new Response('no route', { status: 500 });
  const { status = 200, body = '' } = routes[key];
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
};

before(async () => {
  ctx = await startTestApp({ fetchImpl: fakeFetch });
});
after(() => ctx.stop());

const addPgn = (cookie, pgn) => call(ctx.base, 'POST', '/api/games', { cookie, body: { pgn } });
const list = (cookie, q = '') => call(ctx.base, 'GET', `/api/games${q}`, { cookie });

test('all library routes require login', async () => {
  for (const [method, url] of [['GET', '/api/games'], ['POST', '/api/games'], ['GET', '/api/games/1'],
    ['DELETE', '/api/games/1'], ['POST', '/api/import/lichess'], ['POST', '/api/import/chesscom']]) {
    assert.equal((await call(ctx.base, method, url, { body: method === 'POST' ? {} : undefined })).status, 401, `${method} ${url}`);
  }
});

test('adding one PGN stores it with parsed details', async () => {
  const { cookie } = await registerUser(ctx.base);
  const r = await addPgn(cookie, SCHOLARS_MATE);
  assert.equal(r.status, 201);
  assert.equal(r.data.added.length, 1);
  assert.deepEqual([r.data.added[0].white, r.data.added[0].black, r.data.added[0].result, r.data.added[0].moveCount],
    ['Alice', 'Bob', '1-0', 7]);
  const l = await list(cookie);
  assert.equal(l.data.total, 1);
  assert.equal(l.data.games[0].playedAt, '2026-11-04');
  assert.equal(l.data.games[0].source, 'lichess', 'a PGN with a Lichess link is filed under Lichess');
  assert.equal('pgn' in l.data.games[0], false, 'list does not include the full PGN');
});

test('a multi-game PGN adds every game; pasting again skips duplicates', async () => {
  const { cookie } = await registerUser(ctx.base);
  const first = await addPgn(cookie, MULTI);
  assert.equal(first.data.added.length, 2);
  const again = await addPgn(cookie, MULTI);
  assert.equal(again.status, 200);
  assert.equal(again.data.added.length, 0);
  assert.equal(again.data.skipped, 2);
  assert.equal((await list(cookie)).data.total, 2);
});

test('unknown names and dates fall back to safe values', async () => {
  const { cookie } = await registerUser(ctx.base);
  const r = await addPgn(cookie, UNFINISHED);
  assert.equal(r.data.added[0].white, 'Unknown');
  assert.equal((await list(cookie)).data.games[0].playedAt, null);
});

test('invalid games are reported, valid ones in the same upload are still saved', async () => {
  const { cookie } = await registerUser(ctx.base);
  const mixed = await addPgn(cookie, `${ILLEGAL}\n\n${FOOLS_MATE}`);
  assert.equal(mixed.status, 201);
  assert.equal(mixed.data.added.length, 1);
  assert.equal(mixed.data.failed.length, 1);
  assert.equal(mixed.data.failed[0].index, 1);
  assert.match(mixed.data.failed[0].error, /Invalid PGN/);

  const onlyBad = await addPgn(cookie, ILLEGAL);
  assert.equal(onlyBad.status, 400);
  assert.equal(onlyBad.data.error, 'No valid games found');

  assert.equal((await addPgn(cookie, '   ')).status, 400);
  assert.equal((await call(ctx.base, 'POST', '/api/games', { cookie, body: {} })).status, 400);
  assert.equal((await addPgn(cookie, '[Event "x"]\n\n*')).status, 400, 'a game with no moves is rejected');
});

test('opening a game returns every position', async () => {
  const { cookie } = await registerUser(ctx.base);
  const id = (await addPgn(cookie, SCHOLARS_MATE)).data.added[0].id;
  const r = await call(ctx.base, 'GET', `/api/games/${id}`, { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.data.game.pgn, SCHOLARS_MATE);
  assert.equal(r.data.positions.length, 7);
  assert.equal(r.data.positions[0].san, 'e4');
  assert.match(r.data.startFen, /^rnbqkbnr\/pppppppp\/8\/8\/8\/8\/PPPPPPPP\/RNBQKBNR w KQkq/);
  assert.equal(r.data.positions.at(-1).san, 'Qxf7#');
});

test('users cannot see or delete each other\'s games', async () => {
  const a = await registerUser(ctx.base);
  const b = await registerUser(ctx.base);
  const id = (await addPgn(a.cookie, SCHOLARS_MATE)).data.added[0].id;
  assert.equal((await call(ctx.base, 'GET', `/api/games/${id}`, { cookie: b.cookie })).status, 404);
  assert.equal((await call(ctx.base, 'DELETE', `/api/games/${id}`, { cookie: b.cookie })).status, 404);
  assert.equal((await list(b.cookie)).data.total, 0);
  assert.equal((await call(ctx.base, 'GET', `/api/games/${id}`, { cookie: a.cookie })).status, 200);
  // the same game can be added by both users
  assert.equal((await addPgn(b.cookie, SCHOLARS_MATE)).status, 201);
});

test('delete removes the game; bad ids give 404', async () => {
  const { cookie } = await registerUser(ctx.base);
  const id = (await addPgn(cookie, FOOLS_MATE)).data.added[0].id;
  assert.equal((await call(ctx.base, 'DELETE', `/api/games/${id}`, { cookie })).status, 200);
  assert.equal((await call(ctx.base, 'GET', `/api/games/${id}`, { cookie })).status, 404);
  assert.equal((await call(ctx.base, 'DELETE', `/api/games/${id}`, { cookie })).status, 404);
  assert.equal((await call(ctx.base, 'GET', '/api/games/abc', { cookie })).status, 404);
});

test('list paginates and sorts newest game first', async () => {
  const { cookie } = await registerUser(ctx.base);
  await addPgn(cookie, MULTI); // 2026-11-04 and 2026-11-03
  await addPgn(cookie, UNFINISHED); // no date
  const all = await list(cookie);
  assert.deepEqual(all.data.games.map((g) => g.white), ['Alice', 'Carol', 'Unknown']);
  const page = await list(cookie, '?limit=1&offset=1');
  assert.equal(page.data.games.length, 1);
  assert.equal(page.data.games[0].white, 'Carol');
  assert.equal(page.data.total, 3);
});

test('lichess import saves games and skips them on a second import', async () => {
  const { cookie } = await registerUser(ctx.base);
  fetchLog = [];
  routes = { '/api/games/user/magnus': { body: `${SCHOLARS_MATE}\n\n${FOOLS_MATE}\n` } };
  const r = await call(ctx.base, 'POST', '/api/import/lichess', { cookie, body: { username: 'magnus', max: 10 } });
  assert.equal(r.status, 201);
  assert.equal(r.data.fetched, 2);
  assert.equal(r.data.added.length, 2);
  assert.match(fetchLog[0], /lichess\.org\/api\/games\/user\/magnus\?.*max=10/);
  const again = await call(ctx.base, 'POST', '/api/import/lichess', { cookie, body: { username: 'magnus' } });
  assert.equal(again.status, 200);
  assert.equal(again.data.skipped, 2);
  assert.equal((await list(cookie)).data.games[0].source, 'lichess');
});

test('lichess import: bad username is rejected before any network call; upstream errors are passed on', async () => {
  const { cookie } = await registerUser(ctx.base);
  fetchLog = [];
  const bad = await call(ctx.base, 'POST', '/api/import/lichess', { cookie, body: { username: 'no spaces!' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.fields.username);
  assert.equal(fetchLog.length, 0);

  routes = { '/api/games/user/ghost': { status: 404 } };
  assert.equal((await call(ctx.base, 'POST', '/api/import/lichess', { cookie, body: { username: 'ghost' } })).status, 404);
  routes = { '/api/games/user/busy': { status: 429 } };
  assert.equal((await call(ctx.base, 'POST', '/api/import/lichess', { cookie, body: { username: 'busy' } })).status, 429);
  routes = { '/api/games/user/empty': { body: '' } };
  const empty = await call(ctx.base, 'POST', '/api/import/lichess', { cookie, body: { username: 'empty' } });
  assert.equal(empty.status, 200);
  assert.equal(empty.data.fetched, 0);
});

const ccGame = (id, end) => ({
  url: `https://www.chess.com/game/live/${id}`,
  pgn: `[Event "Live Chess"]\n[Site "Chess.com"]\n[Link "https://www.chess.com/game/live/${id}"]\n[Date "2026.10.10"]\n[White "Hikaru"]\n[Black "Opp${id}"]\n[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`,
  rules: 'chess',
  end_time: Date.parse(end) / 1000,
});

test('chess.com import: latest games, then a date range; same options as Lichess', async () => {
  const { cookie } = await registerUser(ctx.base);
  routes = {
    '/games/archives': { body: { archives: [
      'https://api.chess.com/pub/player/hikaru/games/2026/03',
      'https://api.chess.com/pub/player/hikaru/games/2026/10',
    ] } },
    '/games/2026/10': { body: { games: [ccGame(9, '2026-10-10T10:00:00Z'), ccGame(10, '2026-10-25T10:00:00Z')] } },
    '/games/2026/03': { body: { games: [ccGame(8, '2026-03-02T10:00:00Z')] } },
  };
  const latest = await call(ctx.base, 'POST', '/api/import/chesscom', { cookie, body: { username: 'Hikaru', max: 2 } });
  assert.equal(latest.status, 201);
  assert.equal(latest.data.added.length, 2);

  const march = await call(ctx.base, 'POST', '/api/import/chesscom', {
    cookie, body: { username: 'hikaru', from: '2026-03-01', to: '2026-03-31', max: 50 },
  });
  assert.equal(march.data.added.length, 1);
  const all = await list(cookie);
  assert.equal(all.data.total, 3);
  assert.ok(all.data.games.every((g) => g.source === 'chesscom'));
});

test('date range validation is the same for both services', async () => {
  fetchLog = [];
  for (const service of ['lichess', 'chesscom']) {
    const { cookie } = await registerUser(ctx.base); // one user per service keeps each under the import rate limit
    const post = (body) => call(ctx.base, 'POST', `/api/import/${service}`, { cookie, body: { username: 'hikaru', ...body } });
    assert.ok((await post({ from: '2026-01-01' })).data.fields.to, 'only one date');
    assert.equal((await post({ from: '2026-02-30', to: '2026-03-01' })).status, 400, 'impossible date');
    assert.ok((await post({ from: '2026-05-02', to: '2026-05-01' })).data.fields.to, 'end before start');
    assert.ok((await post({ from: '2024-01-01', to: '2026-01-01' })).data.fields.to, 'more than a year');
    assert.equal((await post({ max: 51 })).status, 400, 'too many games');
    assert.equal((await post({ max: 0 })).status, 400);
  }
  assert.equal(fetchLog.length, 0, 'nothing reached the network');
});

test('a pasted analysed Lichess PGN (comments, variations, ?? marks) is accepted', async () => {
  const { cookie } = await registerUser(ctx.base);
  const r = await addPgn(cookie, LICHESS_ANNOTATED);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.added[0].moveCount, 41);
  assert.equal(r.data.added[0].white, 'DivyanshSeth505');
  const id = r.data.added[0].id;
  const g = await call(ctx.base, 'GET', `/api/games/${id}`, { cookie });
  assert.equal(g.data.positions.length, 41);
  assert.equal(g.data.positions.at(-1).san, 'Nxa5');
  assert.equal(g.data.game.pgn, LICHESS_ANNOTATED.trim(), 'the original text, comments included, is what is stored');
  assert.equal((await list(cookie)).data.games[0].source, 'lichess');
});

test('the same game pasted and imported is recognised as a duplicate, in either order', async () => {
  const { cookie } = await registerUser(ctx.base);
  assert.equal((await addPgn(cookie, LICHESS_ANNOTATED)).data.added.length, 1);
  routes = { '/api/games/user/dim': { body: LICHESS_ANNOTATED } };
  const imp = await call(ctx.base, 'POST', '/api/import/lichess', { cookie, body: { username: 'dim' } });
  assert.equal(imp.data.added.length, 0);
  assert.equal(imp.data.skipped, 1);

  const other = await registerUser(ctx.base);
  await call(ctx.base, 'POST', '/api/import/lichess', { cookie: other.cookie, body: { username: 'dim' } });
  const pasted = await addPgn(other.cookie, LICHESS_ANNOTATED);
  assert.equal(pasted.data.skipped, 1);
  assert.equal((await list(other.cookie)).data.total, 1);
});

test('bulk delete removes several games at once, only the caller\'s own', async () => {
  const a = await registerUser(ctx.base);
  const b = await registerUser(ctx.base);
  const added = (await addPgn(a.cookie, `${MULTI}\n\n${UNFINISHED}`)).data.added.map((g) => g.id);
  assert.equal(added.length, 3);
  const bId = (await addPgn(b.cookie, FOOLS_MATE)).data.added[0].id;

  const del = (cookie, ids) => call(ctx.base, 'POST', '/api/games/bulk-delete', { cookie, body: { ids } });
  assert.equal((await del(undefined, added)).status, 401);
  assert.equal((await del(a.cookie, [])).status, 400);
  assert.equal((await del(a.cookie, ['x'])).status, 400);

  const mixed = await del(a.cookie, [added[0], added[1], bId, 999999, added[0]]); // someone else's, unknown and repeated ids
  assert.equal(mixed.status, 200);
  assert.equal(mixed.data.deleted, 2);
  assert.equal((await list(a.cookie)).data.total, 1);
  assert.equal((await list(b.cookie)).data.total, 1, "b's game is untouched");
  assert.equal((await del(a.cookie, [added[2]])).data.deleted, 1);
  assert.equal((await list(a.cookie)).data.total, 0);
});

test('imports are rate limited per user', async () => {
  const limited = await startTestApp({ fetchImpl: fakeFetch, importLimit: 2 });
  try {
    const { cookie } = await registerUser(limited.base);
    routes = { '/api/games/user/': { body: '' } };
    const go = () => call(limited.base, 'POST', '/api/import/lichess', { cookie, body: { username: 'abc' } });
    assert.equal((await go()).status, 200);
    assert.equal((await go()).status, 200);
    assert.equal((await go()).status, 429);
  } finally {
    await limited.stop();
  }
});
