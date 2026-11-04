import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFen, START_FEN } from '../public/js/fen.js';

test('start position parses to 8x8 with correct corners', () => {
  const b = parseFen(START_FEN);
  assert.equal(b.length, 8);
  assert.ok(b.every((r) => r.length === 8));
  assert.equal(b[0][0], 'r');
  assert.equal(b[7][4], 'K');
  assert.equal(b[4][4], null);
});

test('rejects empty, wrong rank count, bad characters and short ranks', () => {
  assert.throws(() => parseFen(''), /empty/);
  assert.throws(() => parseFen('8/8/8'), /8 ranks/);
  assert.throws(() => parseFen('rnbqkbnx/8/8/8/8/8/8/8'), /Invalid character/);
  assert.throws(() => parseFen('rnbqkbn/8/8/8/8/8/8/8'), /8 squares/);
});
