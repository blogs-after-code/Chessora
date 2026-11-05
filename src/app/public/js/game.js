// Game viewer: step through the game, run Stockfish in the browser, show and save the analysis.
import { api } from './api.js';
import { drawBoard } from './board.js';
import { initNav } from './nav.js';
import { analyseGame, AbortError } from './engine.js';
import { CLASSES, LABELS, MARKS, formatEval, summarize } from './classify.js';
import { drawEvalGraph, plyAtClick } from './evalgraph.js';

const $ = (id) => document.getElementById(id);
const MAX_PLIES = 1000; // same limit as the server
const SHOW_ARROW = ['inaccuracy', 'mistake', 'blunder'];

let gameId = '';
let game = null;
let startFen = '';
let positions = [];
let analysis = null; // saved (or just finished) analysis, or null
let unsaved = false; // true when the analysis finished but saving failed
let running = null; // { cancelled, engine } while the engine is working
let ply = 0; // 0 = start position, n = after move n
let flipped = false;
let moveButtons = [];

const moveText = (i) => `${i % 2 === 0 ? `${i / 2 + 1}. ` : ''}${positions[i].san}`;

function render() {
  const fen = ply === 0 ? startFen : positions[ply - 1].fen;
  const note = analysis && ply > 0 ? analysis.moves[ply - 1] : null;
  drawBoard($('board'), fen, {
    size: Math.min(480, $('board').parentElement.clientWidth - 8),
    flipped,
    lastMove: ply > 0 ? positions[ply - 1].uci : undefined,
    arrow: note && note.best && SHOW_ARROW.includes(note.cls) ? note.best : undefined,
  });
  moveButtons.forEach((b, i) => b.classList.toggle('current', i + 1 === ply));
  if (ply > 0) moveButtons[ply - 1].scrollIntoView({ block: 'nearest' });
  renderNote();
  renderGraph();
}

function renderNote() {
  const el = $('move-note');
  el.replaceChildren();
  if (!analysis) return;
  if (ply === 0) {
    el.textContent = `Start position. Evaluation ${formatEval(analysis.startEv)}.`;
    return;
  }
  const m = analysis.moves[ply - 1];
  const i = ply - 1;
  const name = document.createElement('strong');
  name.className = `lbl-${m.cls}`;
  name.textContent = `${Math.floor(i / 2) + 1}${i % 2 === 0 ? '.' : '...'} ${positions[i].san}${MARKS[m.cls]} - ${LABELS[m.cls]}`;
  const parts = [];
  if (m.loss > 0 && m.cls !== 'excellent') parts.push(`lost about ${m.loss} centipawns`);
  if (SHOW_ARROW.includes(m.cls) && m.best) parts.push(`the engine preferred ${m.best.slice(0, 2)}-${m.best.slice(2, 4)} (blue arrow)`);
  parts.push(`evaluation ${formatEval(m.ev)}`);
  el.append(name, ` - ${parts.join('; ')}.`);
}

function renderGraph() {
  if (!analysis) return;
  const width = Math.max(240, $('analysis-results').clientWidth || 480);
  drawEvalGraph($('graph'), analysis, { ply, width });
}

function go(n) {
  ply = Math.max(0, Math.min(positions.length, n));
  render();
}

function buildMoveList() {
  const list = $('moves');
  list.replaceChildren();
  moveButtons = [];
  positions.forEach((p, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'linklike';
    const cls = analysis ? analysis.moves[i].cls : null;
    if (cls) {
      b.classList.add(`cls-${cls}`);
      b.title = LABELS[cls];
    }
    b.textContent = `${moveText(i)}${cls ? MARKS[cls] : ''}`;
    b.addEventListener('click', () => go(i + 1));
    li.append(b);
    list.append(li);
    moveButtons.push(b);
  });
}

function buildSummary() {
  const table = $('summary');
  table.replaceChildren();
  const s = summarize(analysis, startFen);
  const caption = document.createElement('caption');
  caption.textContent = 'Move quality';
  table.append(caption);
  const row = (cells, tag = 'td') => {
    const tr = document.createElement('tr');
    cells.forEach((text) => {
      const c = document.createElement(tag);
      c.textContent = text;
      tr.append(c);
    });
    table.append(tr);
  };
  row(['', game.white, game.black], 'th');
  for (const cls of CLASSES) row([LABELS[cls], s.white.counts[cls], s.black.counts[cls]]);
  row(['Accuracy', s.white.accuracy === null ? '-' : `${s.white.accuracy}%`, s.black.accuracy === null ? '-' : `${s.black.accuracy}%`]);
}

function renderAnalysisPanel() {
  const has = Boolean(analysis);
  $('analysis-results').hidden = !has;
  $('analyse').textContent = has ? 'Re-analyse' : 'Analyse game';
  if (!running) {
    $('analysis-status').textContent = has
      ? `Analysed with ${analysis.engine} at depth ${analysis.depth}${unsaved ? ' (not saved yet)' : ' (saved)'}. Click the graph or a move to explore.`
      : 'Not analysed yet. The analysis runs on your own computer and usually takes under two minutes.';
  }
  if (has) buildSummary();
  buildMoveList();
  render();
}

function setRunning(on) {
  $('analyse').hidden = on;
  $('depth').disabled = on;
  $('cancel').hidden = !on;
  $('progress').hidden = !on;
  if (on) {
    $('progress').value = 0;
    $('retry-save').hidden = true;
  }
}

async function save(result) {
  try {
    await api(`/api/games/${encodeURIComponent(gameId)}`, { method: 'PATCH', body: { analysis: result } });
    unsaved = false;
    $('retry-save').hidden = true;
    $('analysis-error').textContent = '';
  } catch (err) {
    unsaved = true;
    $('retry-save').hidden = false;
    $('analysis-error').textContent = `The analysis finished but could not be saved: ${err.message}`;
  }
  analysis = result;
  renderAnalysisPanel();
}

async function runAnalysis() {
  if (running) return;
  if (analysis && !window.confirm('Re-analysing replaces the saved analysis for this game. Continue?')) return;
  $('analysis-error').textContent = '';
  const control = { cancelled: false };
  running = control;
  setRunning(true);
  $('analysis-status').textContent = 'Starting the chess engine...';
  let result;
  try {
    result = await analyseGame({
      startFen,
      positions,
      depth: Number($('depth').value),
      control,
      onProgress: (done, total) => {
        $('progress').value = (done / total) * 100;
        $('analysis-status').textContent = `Analysing position ${Math.min(done + 1, total)} of ${total}...`;
      },
    });
  } catch (err) {
    running = null;
    setRunning(false);
    if (err instanceof AbortError || control.cancelled) {
      $('analysis-status').textContent = 'Analysis cancelled. Your saved analysis (if any) was not changed.';
    } else {
      $('analysis-status').textContent = '';
      $('analysis-error').textContent = err.message;
    }
    return;
  }
  running = null;
  setRunning(false);
  await save(result);
}

async function start() {
  const user = await initNav();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  gameId = new URLSearchParams(window.location.search).get('id');
  $('content').hidden = false;
  try {
    const data = await api(`/api/games/${encodeURIComponent(gameId)}`);
    game = data.game;
    document.title = `${game.white} vs ${game.black} - Chessora`;
    $('title').textContent = `${game.white} vs ${game.black}`;
    $('meta').textContent = [game.result, game.playedAt, game.event].filter(Boolean).join(' · ');
    startFen = data.startFen;
    positions = data.positions;
    analysis = data.analysis && data.analysis.moves.length === positions.length ? data.analysis : null;
    if (positions.length > MAX_PLIES) {
      $('analyse').disabled = true;
      $('analysis-status').textContent = `This game is too long to analyse (more than ${MAX_PLIES} moves).`;
    }
    renderAnalysisPanel();
  } catch (err) {
    $('analysis-panel').hidden = true;
    $('error').textContent = err.status === 404 ? 'Game not found.' : err.message;
  }
}

$('first').addEventListener('click', () => go(0));
$('prev').addEventListener('click', () => go(ply - 1));
$('next').addEventListener('click', () => go(ply + 1));
$('last').addEventListener('click', () => go(positions.length));
$('flip').addEventListener('click', () => { flipped = !flipped; render(); });
$('analyse').addEventListener('click', runAnalysis);
$('retry-save').addEventListener('click', () => analysis && save(analysis));
$('cancel').addEventListener('click', () => {
  if (!running) return;
  running.cancelled = true;
  if (running.engine) running.engine.terminate();
});
$('graph').addEventListener('click', (e) => analysis && go(plyAtClick($('graph'), e.clientX, positions.length)));
document.addEventListener('keydown', (e) => {
  if (['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.key === 'ArrowLeft') go(ply - 1);
  else if (e.key === 'ArrowRight') go(ply + 1);
  else if (e.key === 'Home') go(0);
  else if (e.key === 'End') go(positions.length);
});
window.addEventListener('resize', () => positions.length && render());

start();
