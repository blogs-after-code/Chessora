import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitPgn, gameKey, pgnDateToIso, cleanTag, normalizeResult, tagValue, stripAnnotations, isoDateToMs, detectOrigin,
} from '../server/pgn-utils.js';
import { SCHOLARS_MATE, FOOLS_MATE, MULTI, ANNOTATED_SHORT, LICHESS_ANNOTATED } from './samples.js';

test('splitPgn separates games, handles CRLF, BOM and empty input', () => {
  assert.deepEqual(splitPgn(MULTI), [SCHOLARS_MATE, FOOLS_MATE]);
  assert.deepEqual(splitPgn('﻿' + MULTI.replace(/\n/g, '\r\n')), [SCHOLARS_MATE, FOOLS_MATE]);
  assert.deepEqual(splitPgn('   '), []);
  assert.deepEqual(splitPgn(null), []);
  assert.equal(splitPgn('1. e4 e5').length, 1);
});

test('gameKey ignores whitespace differences but not content', () => {
  assert.equal(gameKey(SCHOLARS_MATE), gameKey(SCHOLARS_MATE.replace(/\n/g, '\r\n') + '\n\n'));
  assert.notEqual(gameKey(SCHOLARS_MATE), gameKey(FOOLS_MATE));
});

test('pgnDateToIso accepts real dates only', () => {
  assert.equal(pgnDateToIso('2026.11.04'), '2026-11-04');
  assert.equal(pgnDateToIso('????.??.??'), null);
  assert.equal(pgnDateToIso('2026.02.31'), null);
  assert.equal(pgnDateToIso(undefined), null);
});

test('cleanTag, normalizeResult and tagValue', () => {
  assert.equal(cleanTag('?'), 'Unknown');
  assert.equal(cleanTag('  Magnus\u0007 '), 'Magnus');
  assert.equal(cleanTag('', ''), '');
  assert.equal(cleanTag('x'.repeat(300)).length, 100);
  assert.equal(normalizeResult('1/2-1/2'), '1/2-1/2');
  assert.equal(normalizeResult('banana'), '*');
  assert.equal(tagValue(SCHOLARS_MATE, 'White'), 'Alice');
  assert.equal(tagValue(SCHOLARS_MATE, 'Nope'), null);
});

test('stripAnnotations keeps headers and leaves only the plain main line', () => {
  const short = stripAnnotations(ANNOTATED_SHORT);
  assert.ok(short.startsWith('[Event "Annotated"]'));
  assert.equal(short.split('\n\n')[1], '1. e4 1... e5 2. Qg4 2... Nc6 3. Bc4 3... Nf6 4. Qf3 1-0');

  // the real Lichess "analysed" game: two comments in a row, variations, ?? marks
  const full = stripAnnotations(LICHESS_ANNOTATED).split('\n\n')[1];
  assert.doesNotMatch(full, /[{}();$?!]/);
  assert.ok(full.startsWith('1. e4 1... e5 2. Qg4 2... Nc6 3. Bc4'));
  assert.ok(full.endsWith('21. Nxa5 1-0'));
  // plain games pass through unchanged in meaning
  assert.equal(stripAnnotations(FOOLS_MATE).split('\n\n')[1], '1. f3 e5 2. g4 Qh4# 0-1');
});

test('isoDateToMs returns UTC day bounds, or null for impossible dates', () => {
  assert.equal(isoDateToMs('2026-11-05'), Date.UTC(2026, 10, 5));
  assert.equal(isoDateToMs('2026-11-05', true), Date.UTC(2026, 10, 6) - 1);
  assert.equal(isoDateToMs('2026-02-30'), null);
  assert.equal(isoDateToMs('05/11/2026'), null);
  assert.equal(isoDateToMs(undefined), null);
});

test('detectOrigin recognises Lichess and Chess.com games', () => {
  assert.deepEqual(detectOrigin(LICHESS_ANNOTATED), { source: 'lichess', sourceId: 'GYxGySj0' }); // /game/ID link + GameId tag
  assert.deepEqual(detectOrigin(SCHOLARS_MATE), { source: 'lichess', sourceId: 'AbCdEfGh' }); // plain /ID link
  assert.deepEqual(detectOrigin('[Site "https://lichess.org/AbCdEfGh/black"]\n\n1. e4 *'), { source: 'lichess', sourceId: 'AbCdEfGh' });
  assert.deepEqual(detectOrigin('[Site "Chess.com"]\n[Link "https://www.chess.com/game/live/123456"]\n\n1. e4 *'),
    { source: 'chesscom', sourceId: 'https://www.chess.com/game/live/123456' });
  assert.deepEqual(detectOrigin('[Link "https://www.chess.com/game/daily/77"]\n\n1. e4 *'),
    { source: 'chesscom', sourceId: 'https://www.chess.com/game/daily/77' });
  assert.deepEqual(detectOrigin('[Link "https://www.chess.com/live/game/55"]\n\n1. e4 *'),
    { source: 'chesscom', sourceId: 'https://www.chess.com/game/live/55' });
  assert.equal(detectOrigin('[Event "Club night"]\n[Site "Mumbai"]\n\n1. e4 *'), null);
});
