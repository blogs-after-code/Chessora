import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATE, scoreToEv, winPercent, formatEval, classifyMove, whiteMovesFirst, buildAnalysis, summarize,
} from '../public/js/classify.js';
import { parseInfo, parseBestmove } from '../public/js/uci.js';

test('scores are turned into White-point-of-view numbers', () => {
  assert.equal(scoreToEv({ cp: 35, mate: null }, true), 35);
  assert.equal(scoreToEv({ cp: 35, mate: null }, false), -35, 'Black to move: flip the sign');
  assert.equal(scoreToEv({ cp: 0, mate: null }, false), 0);
  assert.ok(Object.is(scoreToEv({ cp: 0, mate: null }, false), 0), 'never negative zero');
  assert.equal(scoreToEv({ cp: null, mate: 3 }, true), MATE - 3);
  assert.equal(scoreToEv({ cp: null, mate: -2 }, true), -(MATE - 2));
  assert.equal(scoreToEv({ cp: null, mate: 3 }, false), -(MATE - 3));
  assert.equal(scoreToEv({ cp: null, mate: 0 }, false), MATE, 'Black is checkmated: White wins');
  assert.equal(scoreToEv({ cp: null, mate: 0 }, true), -MATE, 'White is checkmated: Black wins');
  assert.equal(scoreToEv({ cp: 99999, mate: null }, true), 5000, 'huge scores are capped below mate');
});

test('winning chance is 50 when equal, symmetric, and 0/100 for mates', () => {
  assert.equal(winPercent(0), 50);
  assert.ok(Math.abs(winPercent(200) + winPercent(-200) - 100) < 1e-9);
  assert.ok(winPercent(300) > winPercent(100));
  assert.equal(winPercent(MATE - 4), 100);
  assert.equal(winPercent(-(MATE - 4)), 0);
});

test('evaluations are formatted for people', () => {
  assert.equal(formatEval(35), '+0.35');
  assert.equal(formatEval(-120), '-1.20');
  assert.equal(formatEval(0), '0.00');
  assert.equal(formatEval(MATE - 3), '+M3');
  assert.equal(formatEval(-(MATE - 1)), '-M1');
  assert.equal(formatEval(MATE), 'Checkmate');
});

test('move labels follow how much winning chance was lost', () => {
  const white = (evAfter, extra = {}) => classifyMove({ played: 'a2a3', best: 'e2e4', evBefore: 0, evAfter, whiteMoved: true, ...extra });
  assert.equal(white(-10).cls, 'excellent');
  assert.equal(white(-50).cls, 'good');
  assert.equal(white(-80).cls, 'inaccuracy');
  assert.equal(white(-150).cls, 'mistake');
  assert.equal(white(-300).cls, 'blunder');
  assert.equal(white(40).cls, 'excellent', 'an improving move is never a loss');
  assert.equal(white(40).loss, 0);
  assert.equal(white(-300).loss, 300);
  assert.equal(white(-300, { played: 'e2e4' }).cls, 'best', 'the engine move is always best');
  assert.equal(white(-300, { best: null }).cls, 'blunder');
});

test('Black is judged from Black point of view', () => {
  const m = classifyMove({ played: 'a7a6', best: 'e7e5', evBefore: 0, evAfter: 300, whiteMoved: false });
  assert.equal(m.cls, 'blunder');
  const ok = classifyMove({ played: 'a7a6', best: 'e7e5', evBefore: 0, evAfter: -300, whiteMoved: false });
  assert.equal(ok.cls, 'excellent');
});

test('throwing away a tiny edge in a won game is not a blunder', () => {
  const m = classifyMove({ played: 'a2a3', best: 'e2e4', evBefore: 1500, evAfter: 1100, whiteMoved: true });
  assert.equal(m.cls, 'excellent');
  const lostMate = classifyMove({ played: 'a2a3', best: 'e2e4', evBefore: MATE - 2, evAfter: 0, whiteMoved: true });
  assert.equal(lostMate.cls, 'blunder');
});

test('a game can start with Black to move', () => {
  assert.equal(whiteMovesFirst('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'), true);
  assert.equal(whiteMovesFirst('8/8/8/8/8/8/8/k1K5 b - - 0 1'), false);
});

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

test('buildAnalysis labels every move and keeps the saved shape', () => {
  const a = buildAnalysis({
    startFen: START, depth: 12, engine: 'Test',
    evs: [20, 25, 20, -300],
    bests: ['e2e4', 'e7e5', 'g1f3', null],
    played: ['e2e4', 'a7a6', 'a2a3'],
  });
  assert.equal(a.version, 1);
  assert.equal(a.startEv, 20);
  assert.equal(a.moves.length, 3);
  assert.deepEqual(a.moves[0], { ev: 25, best: 'e2e4', cls: 'best', loss: 0 });
  assert.equal(a.moves[1].cls, 'excellent', 'Black went from +25 to +20: tiny change');
  assert.equal(a.moves[2].cls, 'blunder');
  assert.throws(() => buildAnalysis({ startFen: START, evs: [0], bests: [null], played: ['e2e4'], depth: 1, engine: 'x' }));
});

test('summary counts labels and gives accuracy per side', () => {
  const a = buildAnalysis({
    startFen: START, depth: 12, engine: 'Test',
    evs: [0, 0, 0, -300, -300],
    bests: ['e2e4', 'e7e5', 'g1f3', 'b8c6', null],
    played: ['e2e4', 'e7e5', 'a2a3', 'b8c6'],
  });
  const s = summarize(a, START);
  assert.equal(s.white.moves, 2);
  assert.equal(s.black.moves, 2);
  assert.equal(s.white.counts.blunder, 1);
  assert.equal(s.white.counts.best, 1);
  assert.equal(s.black.counts.best, 2);
  assert.equal(s.black.accuracy, 100);
  assert.ok(s.white.accuracy < 100 && s.white.accuracy > 0);
});

test('engine info lines are read correctly', () => {
  assert.deepEqual(parseInfo('info depth 8 seldepth 9 multipv 1 score cp 41 nodes 3751 nps 48089 time 78 pv b1c3 b8c6'),
    { depth: 8, score: { cp: 41, mate: null } });
  assert.deepEqual(parseInfo('info depth 5 score mate -3 nodes 10'), { depth: 5, score: { cp: null, mate: -3 } });
  assert.deepEqual(parseInfo('info depth 0 score mate 0'), { depth: 0, score: { cp: null, mate: 0 } });
  assert.deepEqual(parseInfo('info depth 0 score cp 0'), { depth: 0, score: { cp: 0, mate: null } });
  assert.equal(parseInfo('info depth 8 score cp 41 lowerbound nodes 1'), null);
  assert.equal(parseInfo('info depth 8 score cp 41 upperbound'), null);
  assert.equal(parseInfo('info depth 8 multipv 2 score cp 10'), null);
  assert.equal(parseInfo('info string something'), null);
  assert.equal(parseInfo('bestmove e2e4'), null);
  assert.equal(parseInfo(42), null);
});

test('bestmove lines are read correctly', () => {
  assert.equal(parseBestmove('bestmove e2e4 ponder e7e5'), 'e2e4');
  assert.equal(parseBestmove('bestmove e7e8q'), 'e7e8q');
  assert.equal(parseBestmove('bestmove (none)'), null);
  assert.equal(parseBestmove('bestmove 0000'), null);
  assert.equal(parseBestmove('info depth 1'), undefined);
  assert.equal(parseBestmove(undefined), undefined);
});
