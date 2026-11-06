import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canvasSize, framePlan, totalMs, plyAtTime, checkRange, limitProblem, captionFor, cleanWatermark,
  fileName, pickVideoType, GIF_MAX_FRAMES, VIDEO_MAX_MS,
} from '../public/js/exportplan.js';

test('picture sizes follow the aspect ratio and are even numbers', () => {
  assert.deepEqual(canvasSize('1:1', 'medium'), { w: 720, h: 720 });
  assert.deepEqual(canvasSize('9:16', 'medium'), { w: 720, h: 1280 });
  assert.deepEqual(canvasSize('16:9', 'medium'), { w: 1280, h: 720 });
  assert.deepEqual(canvasSize('9:16', 'large'), { w: 1080, h: 1920 });
  assert.deepEqual(canvasSize('16:9', 'small'), { w: 854, h: 480 });
  assert.deepEqual(canvasSize('nonsense', 'nonsense'), { w: 720, h: 720 });
  for (const a of ['1:1', '9:16', '16:9']) for (const s of ['small', 'medium', 'large']) {
    const { w, h } = canvasSize(a, s);
    assert.ok(w % 2 === 0 && h % 2 === 0, `${a} ${s}`);
  }
});

test('the frame plan holds the first and last position longer', () => {
  const plan = framePlan({ from: 2, to: 5, msPerMove: 500 });
  assert.deepEqual(plan.map((f) => f.ply), [2, 3, 4, 5]);
  assert.deepEqual(plan.map((f) => f.ms), [1000, 500, 500, 2000]);
  assert.equal(totalMs(plan), 4000);
  assert.deepEqual(framePlan({ from: 3, to: 3, msPerMove: 500 }).length, 1);
  const slow = framePlan({ from: 0, to: 2, msPerMove: 2000 });
  assert.deepEqual(slow.map((f) => f.ms), [2000, 2000, 2000], 'never shorter than a normal move');
});

test('the position shown at a given time', () => {
  const plan = framePlan({ from: 0, to: 3, msPerMove: 500 }); // 1000, 500, 500, 2000
  assert.equal(plyAtTime(plan, 0), 0);
  assert.equal(plyAtTime(plan, 999), 0);
  assert.equal(plyAtTime(plan, 1000), 1);
  assert.equal(plyAtTime(plan, 1600), 2);
  assert.equal(plyAtTime(plan, 2100), 3);
  assert.equal(plyAtTime(plan, 99999), 3, 'after the end it stays on the last position');
});

test('range checks', () => {
  assert.deepEqual(checkRange('0', '10', 20), { from: 0, to: 10 });
  assert.ok(checkRange(5, 5, 20).error);
  assert.ok(checkRange(8, 3, 20).error);
  assert.ok(checkRange(-1, 3, 20).error);
  assert.ok(checkRange(0, 21, 20).error);
  assert.ok(checkRange('a', 3, 20).error);
  assert.ok(checkRange(1.5, 3, 20).error);
});

test('limits for GIF and video', () => {
  const plan = (n, ms = 500) => framePlan({ from: 0, to: n - 1, msPerMove: ms });
  assert.equal(limitProblem({ kind: 'gif', plan: plan(40), size: 'medium' }), null);
  assert.match(limitProblem({ kind: 'gif', plan: plan(40), size: 'large' }), /Small or Medium/);
  assert.match(limitProblem({ kind: 'gif', plan: plan(GIF_MAX_FRAMES + 1), size: 'small' }), /at most/);
  assert.equal(limitProblem({ kind: 'gif', plan: plan(GIF_MAX_FRAMES), size: 'small' }), null);
  assert.equal(limitProblem({ kind: 'video', plan: plan(40), size: 'large' }), null);
  const tooLong = plan(Math.ceil(VIDEO_MAX_MS / 2000) + 2, 2000);
  assert.match(limitProblem({ kind: 'video', plan: tooLong, size: 'small' }), /at most/);
  assert.equal(limitProblem({ kind: 'png', plan: [], size: 'large' }), null);
});

test('captions show the move and its quality mark', () => {
  const positions = [{ san: 'e4' }, { san: 'e5' }, { san: 'Qh5' }, { san: 'Nf6' }];
  const analysis = { moves: [{ cls: 'best' }, { cls: 'good' }, { cls: 'mistake' }, { cls: 'blunder' }] };
  assert.deepEqual(captionFor(0, positions, null), { text: 'Start position', cls: null });
  assert.deepEqual(captionFor(1, positions, null), { text: '1. e4', cls: null });
  assert.deepEqual(captionFor(2, positions, null), { text: '1... e5', cls: null });
  assert.deepEqual(captionFor(3, positions, analysis), { text: '2. Qh5?', cls: 'mistake' });
  assert.deepEqual(captionFor(4, positions, analysis), { text: '2... Nf6??', cls: 'blunder' });
});

test('watermark text is tidied and shortened', () => {
  assert.equal(cleanWatermark('  @my   handle  '), '@my handle');
  assert.equal(cleanWatermark(undefined), '');
  assert.equal(cleanWatermark('x'.repeat(100)).length, 40);
});

test('download names are safe', () => {
  assert.equal(fileName({ white: 'Alice', black: 'Bob', kind: 'gif', ext: 'gif' }), 'chessora-alice-vs-bob-gif.gif');
  assert.equal(fileName({ white: 'A', black: 'B', kind: 'png', ply: 12, ext: 'png' }), 'chessora-a-vs-b-move12.png');
  assert.equal(fileName({ white: '../../etc/passwd', black: '<script>', kind: 'video', ext: 'mp4' }), 'chessora-etc-passwd-vs-script-video.mp4');
  assert.equal(fileName({ white: '???', black: '', kind: 'video', ext: 'webm' }), 'chessora-game-video.webm');
});

test('the best supported video format is picked, MP4 first', () => {
  assert.deepEqual(pickVideoType(() => true), { mime: 'video/mp4;codecs=avc1', ext: 'mp4' });
  assert.deepEqual(pickVideoType((t) => t.startsWith('video/webm')), { mime: 'video/webm;codecs=vp9', ext: 'webm' });
  assert.deepEqual(pickVideoType((t) => t === 'video/webm'), { mime: 'video/webm', ext: 'webm' });
  assert.equal(pickVideoType(() => false), null);
});
