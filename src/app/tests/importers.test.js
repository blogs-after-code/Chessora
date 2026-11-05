import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLichessGames, fetchChesscomGames, ImportError } from '../server/importers.js';
import { SCHOLARS_MATE, FOOLS_MATE, LICHESS_ANNOTATED } from './samples.js';
import { isoDateToMs, DAY_MS } from '../server/pgn-utils.js';

/** Fake fetch: routes[urlSubstring] = { status, body, json } ; records calls. */
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    const key = Object.keys(routes).find((k) => String(url).includes(k));
    if (!key) return new Response('no route', { status: 500 });
    const { status = 200, body = '' } = routes[key];
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  };
  impl.calls = calls;
  return impl;
}

test('lichess: parses games, uses site id, sends a User-Agent and the right query', async () => {
  const f = fakeFetch({ '/api/games/user/magnus': { body: `${SCHOLARS_MATE}\n\n${FOOLS_MATE}\n` } });
  const games = await fetchLichessGames({ username: 'magnus', max: 5, fetchImpl: f });
  assert.deepEqual(games.map((g) => g.sourceId), ['AbCdEfGh', 'ZyXwVuTs']);
  assert.match(f.calls[0].url, /max=5/);
  assert.match(f.calls[0].init.headers['User-Agent'], /Chessora/);
  assert.equal(f.calls[0].init.headers.Accept, 'application/x-chess-pgn');
});

test('lichess: sends a token only when configured', async () => {
  const f = fakeFetch({ '/api/games/user/': { body: SCHOLARS_MATE } });
  await fetchLichessGames({ username: 'abc', fetchImpl: f, token: 'tok' });
  assert.equal(f.calls[0].init.headers.Authorization, 'Bearer tok');
  await fetchLichessGames({ username: 'abc', fetchImpl: f });
  assert.equal(f.calls[1].init.headers.Authorization, undefined);
});

test('lichess: maps 404, 429, 500 and network failure to readable errors', async () => {
  for (const [status, expected] of [[404, 404], [429, 429], [500, 502]]) {
    const f = fakeFetch({ '/api/games/user/': { status } });
    await assert.rejects(fetchLichessGames({ username: 'abc', fetchImpl: f }), (e) => e instanceof ImportError && e.status === expected);
  }
  const down = async () => { throw new Error('ECONNREFUSED'); };
  await assert.rejects(fetchLichessGames({ username: 'abc', fetchImpl: down }), (e) => e.status === 502);
});

test('lichess: understands the /game/ID link style and sends since/until for a date range', async () => {
  const f = fakeFetch({ '/api/games/user/abc': { body: LICHESS_ANNOTATED } });
  const games = await fetchLichessGames({ username: 'abc', max: 5, from: '2026-10-05', to: '2026-10-20', fetchImpl: f });
  assert.deepEqual(games.map((g) => g.sourceId), ['GYxGySj0']);
  const url = new URL(f.calls[0].url);
  assert.equal(url.searchParams.get('since'), String(isoDateToMs('2026-10-05')));
  assert.equal(url.searchParams.get('until'), String(isoDateToMs('2026-10-20', true)));
  await fetchLichessGames({ username: 'abc', fetchImpl: f });
  assert.equal(new URL(f.calls[1].url).searchParams.get('since'), null, 'no dates -> no since/until');
});

/** A Chess.com API game; end is a UTC date-time. */
const ccGame = (id, end, extra = {}) => ({
  url: `https://www.chess.com/game/live/${id}`,
  pgn: `[Event "Live Chess"]\n[Site "Chess.com"]\n[Link "https://www.chess.com/game/live/${id}"]\n[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 1-0`,
  rules: 'chess',
  ...(end ? { end_time: Date.parse(end) / 1000 } : {}),
  ...extra,
});
const ccIds = (games) => games.map((g) => g.sourceId.split('/').pop());

test('chess.com latest: walks back month by month until it has enough, newest first, standard chess only', async () => {
  const f = fakeFetch({
    '/games/archives': { body: { archives: [
      'https://api.chess.com/pub/player/hikaru/games/2026/08',
      'https://api.chess.com/pub/player/hikaru/games/2026/09',
      'https://api.chess.com/pub/player/hikaru/games/2026/10',
    ] } },
    '/games/2026/10': { body: { games: [ccGame(1), ccGame(2, null, { rules: 'chess960' }), ccGame(3)] } },
    '/games/2026/09': { body: { games: [ccGame(4), ccGame(5)] } },
    '/games/2026/08': { body: { games: [ccGame(6)] } },
  });
  const games = await fetchChesscomGames({ username: 'Hikaru', max: 3, fetchImpl: f });
  assert.deepEqual(ccIds(games), ['3', '1', '5']);
  assert.equal(f.calls.length, 3, 'archives + October + September; August is not needed');
  assert.ok(f.calls.every((c) => c.url.includes('/player/hikaru/')), 'username is lower-cased');
});

test('chess.com date range: only months in the range are fetched, games are filtered by end time', async () => {
  const f = fakeFetch({
    '/games/archives': { body: { archives: [
      'https://api.chess.com/pub/player/abc/games/2026/09',
      'https://api.chess.com/pub/player/abc/games/2026/10',
      'https://api.chess.com/pub/player/abc/games/2026/11',
    ] } },
    '/games/2026/10': { body: { games: [
      ccGame(1, '2026-10-03T12:00:00Z'), ccGame(2, '2026-10-05T00:00:00Z'), ccGame(3, '2026-10-20T23:59:00Z'),
      ccGame(4, '2026-10-21T00:00:01Z'), ccGame(5),
    ] } },
  });
  const games = await fetchChesscomGames({ username: 'abc', from: '2026-10-05', to: '2026-10-20', max: 10, fetchImpl: f });
  assert.deepEqual(ccIds(games), ['3', '2']);
  assert.equal(f.calls.length, 2, 'archives + October only');
});

test('chess.com: max keeps only the newest games; pasted-style Link tag gives the id', async () => {
  const f = fakeFetch({
    '/games/archives': { body: { archives: ['https://api.chess.com/pub/player/abc/games/2026/03'] } },
    '/games/2026/03': { body: { games: [ccGame(1), ccGame(2), ccGame(3)] } },
  });
  const games = await fetchChesscomGames({ username: 'abc', max: 2, fetchImpl: f });
  assert.deepEqual(games.map((g) => g.sourceId), ['https://www.chess.com/game/live/3', 'https://www.chess.com/game/live/2']);
});

test('chess.com: unknown user, no archives, bad JSON, and a range with no matching months', async () => {
  await assert.rejects(fetchChesscomGames({ username: 'abc', fetchImpl: fakeFetch({ '/games/archives': { status: 404 } }) }), (e) => e.status === 404);
  await assert.rejects(fetchChesscomGames({ username: 'abc', fetchImpl: fakeFetch({ '/games/archives': { body: { archives: [] } } }) }), (e) => e.status === 404);
  const bad = fakeFetch({
    '/games/archives': { body: { archives: ['https://api.chess.com/pub/player/abc/games/2026/01'] } },
    '/games/2026/01': { body: 'not json' },
  });
  await assert.rejects(fetchChesscomGames({ username: 'abc', fetchImpl: bad }), (e) => e.status === 502);
  const none = fakeFetch({ '/games/archives': { body: { archives: ['https://api.chess.com/pub/player/abc/games/2026/01'] } } });
  assert.deepEqual(await fetchChesscomGames({ username: 'abc', from: '2020-01-01', to: '2020-02-01', fetchImpl: none }), []);
  assert.equal(none.calls.length, 1);
  assert.ok(DAY_MS > 0);
});
