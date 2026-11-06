// Export studio: preview a game position and turn it into a PNG, an animated GIF or a video.
import { api } from './api.js';
import { initNav } from './nav.js';
import { loadPieces, PIECE_SETS, DEFAULT_PIECE_SET } from './board.js';
import { renderFrame } from './frame.js';
import {
  canvasSize, framePlan, checkRange, limitProblem, captionFor, cleanWatermark, fileName, SPEEDS, GIF_MAX_SIZE,
} from './exportplan.js';
import { makeGif, CancelledError } from './gifexport.js';
import { recordVideo, videoSupported } from './videoexport.js';
import { createResultView } from './resultview.js';

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

let gameId = '';
let game = null;
let startFen = '';
let positions = [];
let analysis = null;
let running = null; // { cancelled } while a GIF or video is being made
const result = createResultView($('result'));
const previewPly = () => Number($('preview-ply').value);

function settings() {
  return {
    kind: $('kind').value,
    aspect: $('aspect').value,
    size: $('size').value,
    msPerMove: SPEEDS[$('speed').value],
    theme: $('theme').value,
    pieceSet: $('pieces').value,
    flipped: $('orientation').value === 'black',
    showNames: $('show-names').checked,
    showCaption: $('show-caption').checked,
    showQuality: $('show-quality').checked && Boolean(analysis),
    watermark: cleanWatermark($('watermark').value),
  };
}

/** Draw one position on the canvas with the current settings. */
function draw(ply) {
  const s = settings();
  const caption = s.showCaption ? captionFor(ply, positions, s.showQuality ? analysis : null) : null;
  renderFrame(ctx, canvas.width, canvas.height, {
    fen: ply === 0 ? startFen : positions[ply - 1].fen,
    flipped: s.flipped,
    theme: s.theme,
    pieceSet: s.pieceSet,
    lastMove: ply > 0 ? positions[ply - 1].uci : undefined,
    white: game.white,
    black: game.black,
    showNames: s.showNames,
    caption,
    watermark: s.watermark,
  });
}

function resize() {
  const s = settings();
  const { w, h } = canvasSize(s.aspect, s.size);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function refresh() {
  if (!game) return;
  const s = settings();
  $('range-fields').hidden = s.kind === 'png';
  $('speed-field').hidden = s.kind === 'png';
  $('video-note').hidden = s.kind !== 'video';
  $('make').textContent = { png: 'Make image', gif: 'Make GIF', video: 'Make video' }[s.kind];
  $('ply-label').textContent = previewPly() === 0 ? 'start position' : `after move ${previewPly()}`;
  resize();
  draw(previewPly());
}

function showResult(blob, kind, ext) {
  result.show(blob, { kind, ext, name: fileName({ white: game.white, black: game.black, kind, ply: previewPly(), ext }) });
}

function setRunning(on) {
  $('make').hidden = on;
  $('cancel').hidden = !on;
  $('progress').hidden = !on;
  for (const id of ['aspect', 'size', 'speed', 'theme', 'pieces', 'orientation', 'from', 'to', 'preview-ply']) $(id).disabled = on;
  if (on) $('progress').value = 0;
}

const toBlob = (type) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image.'))), type);
});

async function make() {
  if (running) return;
  $('error').textContent = '';
  $('status').textContent = '';
  const s = settings();
  try {
    if (s.kind === 'png') {
      draw(previewPly());
      showResult(await toBlob('image/png'), 'png', 'png');
      $('status').textContent = 'Done.';
      return;
    }
    const range = checkRange($('from').value, $('to').value, positions.length);
    if (range.error) throw new Error(range.error);
    const plan = framePlan({ from: range.from, to: range.to, msPerMove: s.msPerMove });
    const problem = limitProblem({ kind: s.kind, plan, size: s.size });
    if (problem) throw new Error(problem);
    if (s.kind === 'video' && !videoSupported()) throw new Error('This browser cannot record video. Try Chrome, Edge or Firefox, or make a GIF.');

    const control = { cancelled: false };
    running = control;
    setRunning(true);
    $('status').textContent = s.kind === 'gif' ? 'Building the GIF...' : 'Recording the video...';
    const onProgress = (f) => { $('progress').value = Math.round(f * 100); };
    if (s.kind === 'gif') {
      showResult(await makeGif({ canvas, plan, draw, onProgress, control }), 'gif', 'gif');
    } else {
      const { blob, ext } = await recordVideo({ canvas, plan, draw, onProgress, control });
      showResult(blob, 'video', ext);
    }
    $('status').textContent = 'Done. Check it below, then download it.';
  } catch (err) {
    if (err instanceof CancelledError) $('status').textContent = 'Cancelled.';
    else $('error').textContent = err.message;
  } finally {
    running = null;
    setRunning(false);
    refresh();
  }
}

async function start() {
  const user = await initNav();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  const params = new URLSearchParams(window.location.search);
  gameId = params.get('id');
  $('content').hidden = false;
  $('back').href = `/game.html?id=${encodeURIComponent(gameId)}`;
  try {
    const data = await api(`/api/games/${encodeURIComponent(gameId)}`);
    game = data.game;
    startFen = data.startFen;
    positions = data.positions;
    analysis = data.analysis && data.analysis.moves.length === positions.length ? data.analysis : null;
  } catch (err) {
    $('error').textContent = err.status === 404 ? 'Game not found.' : err.message;
    $('make').disabled = true;
    return;
  }
  $('meta').textContent = `${game.white} vs ${game.black}`;
  for (const [key, label] of Object.entries(PIECE_SETS)) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = label;
    $('pieces').append(o);
  }
  $('pieces').value = DEFAULT_PIECE_SET;
  const n = positions.length;
  $('preview-ply').max = String(n);
  $('preview-ply').value = String(Math.max(0, Math.min(n, Number(params.get('ply')) || 0)));
  $('from').max = String(n);
  $('to').max = String(n);
  $('to').value = String(n);
  $('watermark').value = `@${user.username}`;
  $('show-quality').disabled = !analysis;
  $('show-quality').checked = Boolean(analysis);
  if (!videoSupported()) {
    $('kind').querySelector('option[value="video"]').disabled = true;
    $('kind').querySelector('option[value="video"]').textContent = 'Video (not supported by this browser)';
  }
  refresh();
  loadPieces(DEFAULT_PIECE_SET).then(refresh);
}

for (const id of ['kind', 'aspect', 'size', 'speed', 'theme', 'pieces', 'orientation', 'show-names', 'show-caption', 'show-quality']) {
  $(id).addEventListener('change', refresh);
}
$('preview-ply').addEventListener('input', refresh);
$('watermark').addEventListener('input', refresh);
$('set-from').addEventListener('click', () => { $('from').value = String(previewPly()); });
$('set-to').addEventListener('click', () => { $('to').value = String(previewPly()); });
$('make').addEventListener('click', make);
$('cancel').addEventListener('click', () => { if (running) running.cancelled = true; });
$('kind').addEventListener('change', () => {
  // GIF is limited to Medium: step the size down for the person instead of failing later
  if ($('kind').value === 'gif' && $('size').value === 'large') $('size').value = GIF_MAX_SIZE;
  refresh();
});

start();
