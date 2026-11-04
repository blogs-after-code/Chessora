import { drawBoard, THEMES } from './board.js';
import { START_FEN } from './fen.js';
import { initNav } from './nav.js';

const canvas = document.getElementById('board');
const fenInput = document.getElementById('fen');
const themeSelect = document.getElementById('theme');
const flipBtn = document.getElementById('flip');
const errorBox = document.getElementById('error');
const healthBox = document.getElementById('health');

let flipped = false;

function render() {
  try {
    drawBoard(canvas, fenInput.value, { theme: themeSelect.value, flipped });
    errorBox.textContent = '';
  } catch (err) {
    errorBox.textContent = err.message;
  }
}

for (const name of Object.keys(THEMES)) {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name;
  themeSelect.appendChild(opt);
}

fenInput.value = START_FEN;
fenInput.addEventListener('input', render);
themeSelect.addEventListener('change', render);
flipBtn.addEventListener('click', () => { flipped = !flipped; render(); });
render();

// Proves the browser can reach the backend.
fetch('/api/health')
  .then((r) => r.json())
  .then((d) => { healthBox.textContent = `Server: ${d.status}`; healthBox.dataset.ok = 'true'; })
  .catch(() => { healthBox.textContent = 'Server: not reachable'; healthBox.dataset.ok = 'false'; });

initNav();
