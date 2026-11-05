// Fetch games from the free public Lichess and Chess.com APIs.
// `fetchImpl` can be replaced in tests so no real network is needed.
import { splitPgn, gameKey, detectOrigin, isoDateToMs } from './pgn-utils.js';

export class ImportError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const USER_AGENT = 'Chessora/0.1 (chess content toolkit)';
const TIMEOUT_MS = 15_000;
const MAX_RESPONSE_CHARS = 25_000_000; // a busy Chess.com month can be several MB
const CHESSCOM_LATEST_MONTHS = 3; // "latest N games" looks back at most this many months
const CHESSCOM_MAX_RANGE_MONTHS = 13;

async function request(fetchImpl, url, headers, serviceName) {
  let res;
  try {
    res = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT, ...headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ImportError(502, `Could not reach ${serviceName}. Please try again in a moment.`);
  }
  if (res.status === 404) throw new ImportError(404, `${serviceName} user (or data) not found`);
  if (res.status === 429) {
    throw new ImportError(429, `${serviceName} is limiting requests. Wait a minute and try again.`);
  }
  if (!res.ok) throw new ImportError(502, `${serviceName} returned an error (HTTP ${res.status})`);
  return res;
}

async function readText(res, serviceName) {
  const text = await res.text();
  if (text.length > MAX_RESPONSE_CHARS) throw new ImportError(502, `${serviceName} sent too much data`);
  return text;
}

/**
 * Both importers take the same options:
 *   max  - most games to return (newest first)
 *   from, to - optional "YYYY-MM-DD" dates (UTC, both inclusive). Without them: the latest games.
 * @returns {Promise<{pgn: string, sourceId: string}[]>} newest first
 */
export async function fetchLichessGames({ username, max = 20, from, to, fetchImpl = fetch, token } = {}) {
  const url = new URL(`https://lichess.org/api/games/user/${encodeURIComponent(username)}`);
  const params = {
    max: String(max),
    clocks: 'false',
    evals: 'false',
    opening: 'true',
    perfType: 'ultraBullet,bullet,blitz,rapid,classical,correspondence',
  };
  if (from && to) {
    params.since = String(isoDateToMs(from));
    params.until = String(isoDateToMs(to, true));
  }
  url.search = new URLSearchParams(params).toString();

  const res = await request(
    fetchImpl,
    url.toString(),
    { Accept: 'application/x-chess-pgn', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    'Lichess',
  );
  const text = await readText(res, 'Lichess');
  return splitPgn(text).slice(0, max).map((pgn) => ({ pgn, sourceId: detectOrigin(pgn)?.sourceId || gameKey(pgn) }));
}

async function chesscomJson(fetchImpl, url) {
  const res = await request(fetchImpl, url, { Accept: 'application/json' }, 'Chess.com');
  try {
    return JSON.parse(await readText(res, 'Chess.com'));
  } catch (err) {
    if (err instanceof ImportError) throw err;
    throw new ImportError(502, 'Chess.com sent an unreadable response');
  }
}

export async function fetchChesscomGames({ username, max = 20, from, to, fetchImpl = fetch } = {}) {
  const name = encodeURIComponent(String(username).toLowerCase());
  const base = `https://api.chess.com/pub/player/${name}/games`;

  const archives = await chesscomJson(fetchImpl, `${base}/archives`);
  const months = (Array.isArray(archives.archives) ? archives.archives : [])
    .map((u) => /\/games\/(\d{4})\/(\d{2})$/.exec(String(u)))
    .filter(Boolean)
    .map((m) => ({ y: Number(m[1]), m: Number(m[2]) }))
    .reverse(); // newest month first
  if (months.length === 0) throw new ImportError(404, 'No Chess.com games found for that user');

  const ranged = Boolean(from && to);
  const sinceMs = ranged ? isoDateToMs(from) : 0;
  const untilMs = ranged ? isoDateToMs(to, true) : 0;
  const wanted = ranged
    ? months
      .filter((x) => Date.UTC(x.y, x.m - 1, 1) <= untilMs && Date.UTC(x.y, x.m, 1) - 1 >= sinceMs)
      .slice(0, CHESSCOM_MAX_RANGE_MONTHS)
    : months.slice(0, CHESSCOM_LATEST_MONTHS);

  const out = [];
  for (const { y, m } of wanted) {
    if (out.length >= max) break;
    const data = await chesscomJson(fetchImpl, `${base}/${y}/${String(m).padStart(2, '0')}`);
    const list = Array.isArray(data.games) ? data.games : [];
    const picked = list
      .filter((g) => g && typeof g.pgn === 'string' && (g.rules || 'chess') === 'chess')
      .filter((g) => !ranged || (typeof g.end_time === 'number' && g.end_time * 1000 >= sinceMs && g.end_time * 1000 <= untilMs))
      .reverse(); // newest first
    out.push(...picked);
  }
  return out
    .slice(0, max)
    .map((g) => ({
      pgn: g.pgn,
      sourceId: detectOrigin(g.pgn)?.sourceId || (typeof g.url === 'string' && g.url ? g.url : gameKey(g.pgn)),
    }));
}
