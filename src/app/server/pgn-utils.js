// Pure PGN helpers with no external dependencies (unit-testable anywhere).
import crypto from 'node:crypto';

/** Split text that may hold many games into one string per game. */
export function splitPgn(text) {
  const clean = String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return [];
  return clean
    .split(/\n(?=\[Event\s+")/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Stable id for a game's text, used to skip duplicates of pasted PGNs. */
export function gameKey(pgn) {
  const normalized = String(pgn).replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

/** "2026.11.04" -> "2026-11-04"; returns null for unknown or impossible dates. */
export function pgnDateToIso(value) {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() !== Number(mo) - 1 || dt.getUTCDate() !== Number(d)) {
    return null;
  }
  return `${y}-${mo}-${d}`;
}

/** Clean a PGN tag value for display/storage: no control characters, max 100 chars. */
export function cleanTag(value, fallback = 'Unknown') {
  // eslint-disable-next-line no-control-regex
  const v = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100);
  return v === '' || v === '?' ? fallback : v;
}

export function normalizeResult(value) {
  const v = String(value ?? '').trim();
  return ['1-0', '0-1', '1/2-1/2', '*'].includes(v) ? v : '*';
}

/** Extract a PGN tag value, e.g. tagValue(pgn, 'Site'). Returns null if absent. */
export function tagValue(pgn, name) {
  const m = new RegExp(`^\\[${name}\\s+"([^"]*)"\\]`, 'm').exec(pgn);
  return m ? m[1] : null;
}

/**
 * Remove everything chess.js cannot parse from the move text, keeping headers and the main line:
 * {comments}, ;line comments, (variations, nested), $NAG codes, ?! move marks and %escape lines.
 * Lichess "analysed" PGNs contain all of these (including two comments in a row).
 */
export function stripAnnotations(pgn) {
  const lines = String(pgn ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length && (lines[i].trim() === '' || lines[i].trim().startsWith('['))) i += 1;
  const headers = lines.slice(0, i).join('\n').trim();
  const text = lines.slice(i).join('\n');

  let out = '';
  let inBrace = false;
  let depth = 0;
  let lineStart = true;
  for (let k = 0; k < text.length; k += 1) {
    const ch = text[k];
    if (inBrace) {
      if (ch === '}') {
        inBrace = false;
        out += ' ';
      }
      continue;
    }
    if (lineStart && ch === '%') {
      while (k < text.length && text[k] !== '\n') k += 1;
      lineStart = true;
      continue;
    }
    lineStart = ch === '\n';
    if (ch === '{') inBrace = true;
    else if (ch === ';') {
      while (k < text.length && text[k] !== '\n') k += 1;
      lineStart = true;
      out += ' ';
    } else if (ch === '(') depth += 1;
    else if (ch === ')') {
      if (depth > 0) depth -= 1;
      if (depth === 0) out += ' ';
    } else if (depth === 0) out += ch;
  }
  const moves = out.replace(/\$\d+/g, ' ').replace(/[?!]+/g, '').replace(/\s+/g, ' ').trim();
  return headers ? `${headers}\n\n${moves}` : moves;
}

const DAY_MS = 86_400_000;
export { DAY_MS };

/** "2026-11-05" -> UTC milliseconds (start of day, or last millisecond of the day); null if invalid. */
export function isoDateToMs(value, endOfDay = false) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const dt = new Date(ms);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return endOfDay ? ms + DAY_MS - 1 : ms;
}

/**
 * Work out where a game came from, so the same game pasted or imported twice is recognised.
 * @returns {{source: 'lichess'|'chesscom', sourceId: string} | null}
 */
export function detectOrigin(pgn) {
  const site = tagValue(pgn, 'Site') || '';
  const link = tagValue(pgn, 'Link') || '';
  const gameId = tagValue(pgn, 'GameId') || '';

  if (/lichess\.org/i.test(site)) {
    if (/^[A-Za-z0-9]{8}$/.test(gameId)) return { source: 'lichess', sourceId: gameId };
    const m = /lichess\.org\/(?:game\/)?(?:export\/)?([A-Za-z0-9]{8})(?![A-Za-z0-9])/i.exec(site);
    if (m) return { source: 'lichess', sourceId: m[1] };
  }
  for (const text of [link, site]) {
    let m = /chess\.com\/game\/(live|daily)\/(\d+)/i.exec(text);
    if (!m) m = /chess\.com\/(live|daily)\/game\/(\d+)/i.exec(text);
    if (m) return { source: 'chesscom', sourceId: `https://www.chess.com/game/${m[1].toLowerCase()}/${m[2]}` };
  }
  return null;
}
