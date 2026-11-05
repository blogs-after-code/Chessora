// Simple game viewer: step through the saved game with buttons or the arrow keys.
import { api } from './api.js';
import { drawBoard } from './board.js';
import { initNav } from './nav.js';

const $ = (id) => document.getElementById(id);
let startFen = '';
let positions = [];
let ply = 0; // 0 = start position, n = after move n
let flipped = false;
const moveButtons = [];

function render() {
  const fen = ply === 0 ? startFen : positions[ply - 1].fen;
  drawBoard($('board'), fen, { size: Math.min(480, $('board').parentElement.clientWidth - 8), flipped });
  moveButtons.forEach((b, i) => b.classList.toggle('current', i + 1 === ply));
  if (ply > 0) moveButtons[ply - 1].scrollIntoView({ block: 'nearest' });
}

function go(n) {
  ply = Math.max(0, Math.min(positions.length, n));
  render();
}

function buildMoveList() {
  const list = $('moves');
  list.replaceChildren();
  positions.forEach((p, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'linklike';
    const moveNo = i % 2 === 0 ? `${i / 2 + 1}. ` : '';
    b.textContent = `${moveNo}${p.san}`;
    b.addEventListener('click', () => go(i + 1));
    li.append(b);
    list.append(li);
    moveButtons.push(b);
  });
}

async function start() {
  const user = await initNav();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  const id = new URLSearchParams(window.location.search).get('id');
  $('content').hidden = false;
  try {
    const data = await api(`/api/games/${encodeURIComponent(id)}`);
    const g = data.game;
    document.title = `${g.white} vs ${g.black} - Chessora`;
    $('title').textContent = `${g.white} vs ${g.black}`;
    $('meta').textContent = [g.result, g.playedAt, g.event].filter(Boolean).join(' · ');
    startFen = data.startFen;
    positions = data.positions;
    buildMoveList();
    render();
  } catch (err) {
    $('error').textContent = err.status === 404 ? 'Game not found.' : err.message;
  }
}

$('first').addEventListener('click', () => go(0));
$('prev').addEventListener('click', () => go(ply - 1));
$('next').addEventListener('click', () => go(ply + 1));
$('last').addEventListener('click', () => go(positions.length));
$('flip').addEventListener('click', () => { flipped = !flipped; render(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') go(ply - 1);
  else if (e.key === 'ArrowRight') go(ply + 1);
  else if (e.key === 'Home') go(0);
  else if (e.key === 'End') go(positions.length);
});
window.addEventListener('resize', () => positions.length && render());

start();
