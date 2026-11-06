// Key moments page: lists the blunders, mistakes, brilliant moves and great moves of an analysed
// game, and turns any of them into a GIF or video clip.
import { api } from './api.js';
import { initNav } from './nav.js';
import { loadPieces, PIECE_SETS, DEFAULT_PIECE_SET } from './board.js';
import { renderFrame } from './frame.js';
import { winPercent, formatEval } from './classify.js';
import {
  canvasSize, framePlan, captionFor, cleanWatermark, fileName, limitProblem, SPEEDS, GIF_MAX_SIZE,
} from './exportplan.js';
import {
  findMoments, momentTitle, clipRange, KINDS, KIND_LABELS, KIND_PLURALS, KIND_COLORS,
} from './findmoments.js';
import { CancelledError } from './gifexport.js';
import { videoSupported } from './videoexport.js';
import { runExport } from './runexport.js';
import { createResultView } from './resultview.js';

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const result = createResultView($('result'));

let gameId = '';
let game = null;
let startFen = '';
let positions = [];
let analysis = null;
let moments = [];
let selected = null;
let running = null;
let previewValue = 0; // the position shown in the preview (kept across range changes)

const evAt = (ply) => (ply === 0 ? analysis.startEv : analysis.moves[ply - 1].ev);
const previewPly = () => Number($('preview-ply').value);

function whyText(m) {
  if (m.kind === 'brilliant') return `Gave up ${m.sacrificed} points of material and still came out fine.`;
  if (m.kind === 'great') return 'The best reply to the opponent\'s error.';
  return `Lost ${Math.round(m.drop)} winning-chance points.`;
}

function renderList() {
  const filter = $('filter').value;
  const list = $('moment-list');
  list.replaceChildren();
  for (const m of moments.filter((x) => filter === 'all' || x.kind === filter)) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'moment';
    b.setAttribute('aria-pressed', String(selected === m));
    const badge = document.createElement('span');
    badge.className = `badge badge-${m.kind}`;
    badge.textContent = KIND_LABELS[m.kind];
    const san = document.createElement('span');
    san.className = 'san';
    san.textContent = `${Math.floor((m.ply - 1) / 2) + 1}${m.mover === 'white' ? '.' : '...'} ${m.san}`;
    const why = document.createElement('span');
    why.className = 'why';
    why.textContent = `${m.mover === 'white' ? game.white : game.black} - ${whyText(m)}`;
    b.append(badge, san, why);
    b.addEventListener('click', () => select(m));
    li.append(b);
    list.append(li);
  }
}

function settings() {
  const orientation = $('orientation').value;
  return {
    kind: $('kind').value,
    aspect: $('aspect').value,
    size: $('size').value,
    msPerMove: SPEEDS[$('speed').value],
    theme: $('theme').value,
    pieceSet: $('pieces').value,
    flipped: orientation === 'mover' ? selected.mover === 'black' : orientation === 'black',
    showBar: $('show-bar').checked,
    showNames: $('show-names').checked,
    hideTitle: $('hide-title').checked,
    title: $('title').value.trim(),
    watermark: cleanWatermark($('watermark').value),
    before: Number($('before').value) || 0,
    after: Number($('after').value) || 0,
  };
}

const currentRange = () => {
  const s = settings();
  return clipRange({ ply: selected.ply, before: s.before, after: s.after, maxPly: positions.length });
};

function draw(ply) {
  const s = settings();
  const cap = captionFor(ply, positions, analysis);
  const showTitle = s.title && (!s.hideTitle || ply >= selected.ply);
  renderFrame(ctx, canvas.width, canvas.height, {
    fen: ply === 0 ? startFen : positions[ply - 1].fen,
    flipped: s.flipped,
    theme: s.theme,
    pieceSet: s.pieceSet,
    lastMove: ply > 0 ? positions[ply - 1].uci : undefined,
    white: game.white,
    black: game.black,
    showNames: s.showNames,
    caption: { text: `${cap.text}   ${formatEval(evAt(ply))}`, cls: cap.cls },
    watermark: s.watermark,
    title: showTitle ? { text: s.title, color: KIND_COLORS[selected.kind] } : null,
    evBar: s.showBar ? winPercent(evAt(ply)) : null,
  });
}

function refresh() {
  if (!selected) return;
  const { from, to } = currentRange();
  const slider = $('preview-ply');
  slider.min = String(from);
  slider.max = String(to);
  slider.value = String(Math.max(from, Math.min(to, previewValue)));
  $('ply-label').textContent = previewPly() === 0 ? 'start position' : `after move ${previewPly()}`;
  const { w, h } = canvasSize($('aspect').value, $('size').value);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  draw(previewPly());
}

function select(m) {
  selected = m;
  $('title').value = momentTitle(m);
  previewValue = m.ply;
  result.clear();
  $('status').textContent = '';
  $('error').textContent = '';
  renderList();
  refresh();
}

function setRunning(on) {
  $('make').hidden = on;
  $('cancel').hidden = !on;
  $('progress').hidden = !on;
  for (const id of ['kind', 'aspect', 'size', 'speed', 'theme', 'pieces', 'orientation', 'before', 'after', 'preview-ply', 'filter']) $(id).disabled = on;
  document.querySelectorAll('.moment').forEach((b) => { b.disabled = on; });
  if (on) $('progress').value = 0;
}

async function make() {
  if (running || !selected) return;
  $('error').textContent = '';
  $('status').textContent = '';
  const s = settings();
  try {
    const { from, to } = currentRange();
    const plan = framePlan({ from, to, msPerMove: s.msPerMove, keyPly: selected.ply });
    const problem = limitProblem({ kind: s.kind, plan, size: s.size });
    if (problem) throw new Error(problem);
    if (s.kind === 'video' && !videoSupported()) throw new Error('This browser cannot record video. Try Chrome, Edge or Firefox, or make a GIF.');
    const control = { cancelled: false };
    running = control;
    setRunning(true);
    $('status').textContent = s.kind === 'gif' ? 'Building the GIF...' : 'Recording the video...';
    const { blob, ext } = await runExport({
      kind: s.kind, canvas, plan, draw, control, onProgress: (f) => { $('progress').value = Math.round(f * 100); },
    });
    result.show(blob, {
      kind: s.kind,
      ext,
      name: fileName({ white: game.white, black: game.black, kind: `${selected.kind}-move${selected.ply}`, ext }),
    });
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
  gameId = new URLSearchParams(window.location.search).get('id');
  $('content').hidden = false;
  $('back').href = `/game.html?id=${encodeURIComponent(gameId)}`;
  $('analyse-link').href = `/game.html?id=${encodeURIComponent(gameId)}`;
  try {
    const data = await api(`/api/games/${encodeURIComponent(gameId)}`);
    game = data.game;
    startFen = data.startFen;
    positions = data.positions;
    analysis = data.analysis && data.analysis.moves.length === positions.length ? data.analysis : null;
  } catch (err) {
    $('error').textContent = err.status === 404 ? 'Game not found.' : err.message;
    return;
  }
  $('meta').textContent = `${game.white} vs ${game.black}`;
  if (!analysis) {
    $('no-analysis').hidden = false;
    return;
  }
  moments = findMoments({ startFen, positions, analysis });
  if (!moments.length) {
    $('no-moments').hidden = false;
    return;
  }
  $('maker').hidden = false;
  const all = document.createElement('option');
  all.value = 'all';
  all.textContent = `All moments (${moments.length})`;
  $('filter').append(all);
  for (const kind of KINDS) {
    const n = moments.filter((m) => m.kind === kind).length;
    if (!n) continue;
    const o = document.createElement('option');
    o.value = kind;
    o.textContent = `${KIND_PLURALS[kind]} (${n})`;
    $('filter').append(o);
  }
  for (const [key, label] of Object.entries(PIECE_SETS)) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = label;
    $('pieces').append(o);
  }
  $('pieces').value = DEFAULT_PIECE_SET;
  $('watermark').value = `@${user.username}`;
  if (!videoSupported()) {
    $('kind').value = 'gif';
    const opt = $('kind').querySelector('option[value="video"]');
    opt.disabled = true;
    opt.textContent = 'Video (not supported by this browser)';
    $('video-note').hidden = true;
  }
  select(moments[0]);
  loadPieces(DEFAULT_PIECE_SET).then(refresh);
}

$('filter').addEventListener('change', renderList);
for (const id of ['aspect', 'size', 'speed', 'theme', 'pieces', 'orientation', 'show-bar', 'show-names', 'hide-title', 'before', 'after']) {
  $(id).addEventListener('change', refresh);
}
for (const id of ['title', 'watermark']) $(id).addEventListener('input', refresh);
$('preview-ply').addEventListener('input', () => { previewValue = previewPly(); refresh(); });
$('kind').addEventListener('change', () => {
  if ($('kind').value === 'gif' && $('size').value === 'large') $('size').value = GIF_MAX_SIZE;
  $('video-note').hidden = $('kind').value !== 'video';
  refresh();
});
$('make').addEventListener('click', make);
$('cancel').addEventListener('click', () => { if (running) running.cancelled = true; });

start();
