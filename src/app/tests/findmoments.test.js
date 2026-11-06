import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { MATE, buildAnalysis } from '../public/js/classify.js';
import { START_FEN } from '../public/js/fen.js';
import { material, findMoments, momentTitle, clipRange, KIND_LABELS } from '../public/js/findmoments.js';
import { framePlan } from '../public/js/exportplan.js';

// Build positions from SAN moves, and an analysis from chosen evaluations.
function game(sans) {
  const c = new Chess();
  const positions = sans.map((s) => {
    const m = c.move(s);
    return { san: m.san, uci: `${m.from}${m.to}${m.promotion || ''}`, fen: m.after };
  });
  return { startFen: START_FEN, positions };
}
function analyse(g, evs, notBest = {}) {
  const played = g.positions.map((p) => p.uci);
  const bests = [...played.map((u, i) => notBest[i] ?? u), null];
  return buildAnalysis({ evs, bests, played, startFen: g.startFen, depth: 12, engine: 'test' });
}

// Legal's mate: 5.Nxe5! gives up the queen for a forced mate
const LEGAL = ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'];
const LEGAL_EVS = [20, 30, 25, 35, 30, 40, 20, 25, MATE - 3, MATE - 2, MATE - 2, MATE - 1, MATE - 1, MATE];

test('material is counted in pawn units without kings', () => {
  assert.deepEqual(material(START_FEN), { white: 39, black: 39 });
  assert.deepEqual(material('4k3/8/8/8/8/8/4P3/3QK3 w - - 0 1'), { white: 10, black: 0 });
});

test('a queen sacrifice that leads to mate is brilliant, and the move that allowed it is a blunder', () => {
  const g = game(LEGAL);
  const moments = findMoments({ ...g, analysis: analyse(g, LEGAL_EVS, { 7: 'e7e6' }) });
  assert.deepEqual(moments.map((m) => [m.ply, m.kind]), [[9, 'brilliant'], [8, 'blunder']]);
  assert.equal(moments[0].san, 'Nxe5');
  assert.equal(moments[0].mover, 'white');
  assert.equal(moments[0].sacrificed, 8);
  assert.equal(moments[0].impact, 90);
  assert.equal(moments[1].mover, 'black');
  assert.ok(moments[1].impact > 40 && moments[1].impact < 55);
});

test('a sacrifice the engine does not like, or one in an already won game, is not brilliant', () => {
  const g = game(LEGAL);
  const bad = analyse(g, LEGAL_EVS.map((e, i) => (i === 9 ? -400 : e)), { 8: 'a2a3' });
  assert.ok(!findMoments({ ...g, analysis: bad }).some((m) => m.kind === 'brilliant'));
  const alreadyWon = analyse(g, LEGAL_EVS.map((e, i) => (i >= 8 && i <= 12 ? 1500 : e)));
  assert.ok(!findMoments({ ...g, analysis: alreadyWon }).some((m) => m.kind === 'brilliant'));
});

test('an even trade is not a sacrifice', () => {
  const g = game(['e4', 'd5', 'exd5', 'Qxd5', 'Nc3']);
  assert.deepEqual(findMoments({ ...g, analysis: analyse(g, [20, 20, 20, 20, 20, 20]) }), []);
});

test('the best move that punishes a blunder is a great move, listed just below the blunder', () => {
  const g = game(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']);
  const moments = findMoments({ ...g, analysis: analyse(g, [20, 30, 30, 40, 40, 60, MATE - 1, MATE], { 5: 'g7g6' }) });
  assert.deepEqual(moments.map((m) => [m.ply, m.kind]), [[6, 'blunder'], [7, 'great']]);
  assert.ok(moments[1].impact < moments[0].impact);
  assert.equal(momentTitle(moments[0]), 'Blunder: Nf6??');
  assert.equal(momentTitle(moments[1]), 'Great move: Qxf7#!');
  assert.equal(KIND_LABELS.mistake, 'Mistake');
});

test('mistakes are listed, ordinary moves are not', () => {
  const g = game(['e4', 'e5', 'Nf3']);
  // White's 2.Nf3 loses about 15 winning-chance points: a mistake
  const moments = findMoments({ ...g, analysis: analyse(g, [20, 20, 20, -150], { 2: 'b1c3' }) });
  assert.deepEqual(moments.map((m) => [m.ply, m.kind]), [[3, 'mistake']]);
});

test('nothing is found without a matching analysis', () => {
  const g = game(['e4', 'e5']);
  assert.deepEqual(findMoments({ ...g, analysis: null }), []);
  const a = analyse(g, [0, 0, 0]);
  assert.deepEqual(findMoments({ ...g, analysis: { ...a, moves: a.moves.slice(1) } }), []);
});

test('clip ranges stay inside the game and always have two positions', () => {
  assert.deepEqual(clipRange({ ply: 10, before: 4, after: 3, maxPly: 40 }), { from: 6, to: 13 });
  assert.deepEqual(clipRange({ ply: 2, before: 6, after: 3, maxPly: 40 }), { from: 0, to: 5 });
  assert.deepEqual(clipRange({ ply: 39, before: 4, after: 6, maxPly: 40 }), { from: 35, to: 40 });
  assert.deepEqual(clipRange({ ply: 10, before: 0, after: 0, maxPly: 40 }), { from: 10, to: 11 });
  assert.deepEqual(clipRange({ ply: 40, before: 0, after: 0, maxPly: 40 }), { from: 39, to: 40 });
  assert.deepEqual(clipRange({ ply: 5, before: -3, after: -3, maxPly: 40 }), { from: 5, to: 6 });
});

test('the key move of a clip stays on screen longer', () => {
  const plan = framePlan({ from: 6, to: 13, msPerMove: 500, keyPly: 10 });
  assert.equal(plan.find((f) => f.ply === 10).ms, 2000);
  assert.equal(plan.find((f) => f.ply === 9).ms, 500);
  assert.equal(framePlan({ from: 6, to: 13, msPerMove: 500, keyPly: 99 }).find((f) => f.ply === 10).ms, 500);
  assert.equal(framePlan({ from: 6, to: 13, msPerMove: 2500, keyPly: 10 }).find((f) => f.ply === 10).ms, 2500);
  assert.deepEqual(framePlan({ from: 1, to: 3, msPerMove: 500 }).map((f) => f.ms), [1000, 500, 2000], 'unchanged without a key move');
});
