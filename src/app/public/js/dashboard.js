// Dashboard: add games (Lichess / Chess.com / PGN) and manage the library.
// Text that comes from games or users is always inserted with textContent.
import { api } from './api.js';
import { initNav } from './nav.js';

const SOURCE_LABEL = { pgn: 'PGN', lichess: 'Lichess', chesscom: 'Chess.com' };
const SERVICE_LABEL = { lichess: 'Lichess', chesscom: 'Chess.com' };
const $ = (id) => document.getElementById(id);

// ---------- tiny helpers ----------
const store = {
  get(key) { try { return localStorage.getItem(`chessora.${key}`); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(`chessora.${key}`, value); } catch { /* storage unavailable */ } },
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const isoDay = (d) => d.toISOString().slice(0, 10);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

const statusBox = $('status');
function setStatus(text, isError = false) {
  statusBox.textContent = text;
  statusBox.classList.toggle('error', isError);
}
function showFailures(failed = []) {
  $('failures').replaceChildren(...failed.slice(0, 10).map((f) => el('li', { textContent: `Game ${f.index}: ${f.error}` })));
}

// ---------- add games: shared result handling ----------
function describe(result) {
  const parts = [`Added ${plural(result.added.length, 'game')}`];
  if (result.skipped) parts.push(`${result.skipped} already in your library`);
  if (result.failed?.length) parts.push(`${result.failed.length} could not be read`);
  return `${parts.join(' · ')}.${result.message ? ` ${result.message}.` : ''}`;
}

function showRecent(added) {
  $('recent').hidden = added.length === 0;
  $('recent-list').replaceChildren(...added.map((g) => el('li', {},
    el('a', { href: `/game.html?id=${g.id}`, textContent: `${g.white} vs ${g.black}` }),
    el('span', { className: 'hint', textContent: ` ${g.result} · ${plural(g.moveCount, 'move')}` }))));
}

/** POST to the API, show the outcome, refresh the library. Returns true on success. */
async function send(button, url, body, workingText) {
  button.disabled = true;
  setStatus(workingText);
  showFailures();
  try {
    const result = await api(url, { method: 'POST', body });
    setStatus(describe(result));
    showFailures(result.failed);
    showRecent(result.added);
    await loadLibrary();
    return true;
  } catch (err) {
    setStatus(Object.values(err.fields || {})[0] || err.message, true);
    showFailures(err.failed);
    showRecent([]);
    return false;
  } finally {
    button.disabled = false;
  }
}

// ---------- Lichess / Chess.com: ONE form template for both ----------
function buildImportForm(service) {
  const name = SERVICE_LABEL[service];
  const form = el('form', { className: 'importform' });
  form.innerHTML = `
    <label for="${service}-user">${name} username</label>
    <input id="${service}-user" name="username" autocomplete="off" required>
    <fieldset>
      <legend>Which games?</legend>
      <label class="check"><input type="radio" name="mode" value="latest" checked> Latest games</label>
      <label class="check"><input type="radio" name="mode" value="range"> From a date range</label>
    </fieldset>
    <div class="range" hidden>
      <div class="row">
        <div><label for="${service}-from">From</label><input id="${service}-from" name="from" type="date"></div>
        <div><label for="${service}-to">To</label><input id="${service}-to" name="to" type="date"></div>
      </div>
      <p class="hint">Dates are in UTC, up to one year apart.</p>
    </div>
    <label for="${service}-max">How many games (1-50)</label>
    <input id="${service}-max" name="max" type="number" min="1" max="50" value="20">
    <p class="hint">Newest games first. Games already in your library are skipped, so you can repeat an import safely.</p>
    <button type="submit">Import from ${name}</button>`;

  const user = form.elements.username;
  user.value = store.get(`${service}.user`) || '';
  const range = form.querySelector('.range');
  const today = new Date();
  form.elements.to.value = isoDay(today);
  form.elements.from.value = isoDay(new Date(today.getTime() - 30 * 86_400_000));

  form.addEventListener('change', (e) => {
    if (e.target.name === 'mode') range.hidden = form.elements.mode.value !== 'range';
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { username: user.value.trim(), max: Number(form.elements.max.value) || 20 };
    if (form.elements.mode.value === 'range') {
      body.from = form.elements.from.value;
      body.to = form.elements.to.value;
    }
    const ok = await send(form.querySelector('button[type="submit"]'), `/api/import/${service}`, body,
      `Fetching games from ${name}...`);
    if (ok) store.set(`${service}.user`, body.username);
  });
  return form;
}
$('panel-lichess').append(buildImportForm('lichess'));
$('panel-chesscom').append(buildImportForm('chesscom'));

// ---------- tabs ----------
function selectTab(tab) {
  for (const t of document.querySelectorAll('[data-tab]')) t.setAttribute('aria-selected', String(t.dataset.tab === tab));
  for (const p of document.querySelectorAll('[data-tabpanel]')) p.hidden = p.dataset.tabpanel !== tab;
  setStatus('');
  showFailures();
  store.set('tab', tab);
}
for (const t of document.querySelectorAll('[data-tab]')) t.addEventListener('click', () => selectTab(t.dataset.tab));
selectTab(['lichess', 'chesscom', 'pgn'].includes(store.get('tab')) ? store.get('tab') : 'lichess');

// ---------- PGN paste / upload ----------
const pgnText = $('pgn-text');
let loadedFrom = ''; // describes the file(s) the text came from, '' when typed/pasted

function countGames(text) {
  const tagged = (text.match(/^\[Event\s+"/gm) || []).length;
  return tagged || (text.trim() ? 1 : 0);
}

function refreshPgn() {
  const n = countGames(pgnText.value);
  $('pgn-count').textContent = n === 0 ? 'Nothing loaded yet.' : `${plural(n, 'game')} detected.`;
  $('pgn-submit').textContent = n > 1 ? `Add ${n} games to library` : 'Add to library';
  $('pgn-submit').disabled = n === 0;
  $('pgn-chip').hidden = !loadedFrom;
  $('pgn-chip-text').textContent = loadedFrom ? `Loaded from ${loadedFrom}` : '';
}

function resetPgn() {
  pgnText.value = '';
  loadedFrom = '';
  $('pgn-file').value = '';
  refreshPgn();
}

pgnText.addEventListener('input', () => { loadedFrom = ''; refreshPgn(); }); // edited by hand: no longer "from a file"
$('pgn-clear').addEventListener('click', () => { resetPgn(); setStatus(''); });
$('pgn-chip-clear').addEventListener('click', resetPgn);

$('pgn-file').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  e.target.value = ''; // so choosing the same file again works
  if (!files.length) return;
  if (files.reduce((sum, f) => sum + f.size, 0) > 900_000) {
    setStatus('Those files are too large (max about 900 KB in total). Split them or add them in batches.', true);
    return;
  }
  const texts = await Promise.all(files.map((f) => f.text()));
  pgnText.value = texts.join('\n\n');
  loadedFrom = files.length === 1 ? files[0].name : `${files[0].name} and ${plural(files.length - 1, 'other file')}`;
  setStatus('');
  refreshPgn();
});

$('form-pgn').addEventListener('submit', async (e) => {
  e.preventDefault();
  const ok = await send($('pgn-submit'), '/api/games', { pgn: pgnText.value }, 'Adding games...');
  if (ok) resetPgn(); // box is emptied, so it is clear what is (not) loaded
});
refreshPgn();

// ---------- library ----------
let allGames = [];
const selected = new Set();

async function loadLibrary() {
  const games = [];
  let total = 0;
  do {
    const page = await api(`/api/games?limit=100&offset=${games.length}`);
    games.push(...page.games);
    total = page.total;
    if (page.games.length === 0) break;
  } while (games.length < total);
  allGames = games;
  for (const id of [...selected]) if (!games.some((g) => g.id === id)) selected.delete(id);
  renderLibrary();
}

function visibleGames() {
  const q = $('search').value.trim().toLowerCase();
  const src = $('source-filter').value;
  return allGames.filter((g) => (!src || g.source === src)
    && (!q || `${g.white} ${g.black} ${g.event}`.toLowerCase().includes(q)));
}

function renderLibrary() {
  const shown = visibleGames();
  const shownIds = new Set(shown.map((g) => g.id));
  for (const id of [...selected]) if (!shownIds.has(id)) selected.delete(id); // never delete what is hidden

  $('total').textContent = allGames.length ? `(${allGames.length})` : '';
  $('toolbar').hidden = allGames.length === 0;
  $('empty').hidden = allGames.length > 0;
  $('showing').textContent = allGames.length && shown.length !== allGames.length
    ? `Showing ${shown.length} of ${allGames.length} games` : '';
  if (allGames.length && shown.length === 0) $('showing').textContent = 'No games match your search.';

  $('games').replaceChildren(...shown.map(gameRow));
  const n = selected.size;
  $('delete-selected').disabled = n === 0;
  $('delete-selected').textContent = n ? `Delete selected (${n})` : 'Delete selected';
  const all = $('select-all');
  all.checked = shown.length > 0 && n === shown.length;
  all.indeterminate = n > 0 && n < shown.length;
  all.disabled = shown.length === 0;
}

function gameRow(g) {
  const box = el('input', { type: 'checkbox', checked: selected.has(g.id), ariaLabel: `Select ${g.white} vs ${g.black}` });
  box.addEventListener('change', () => {
    if (box.checked) selected.add(g.id); else selected.delete(g.id);
    renderLibrary();
  });
  const bits = [g.result, plural(g.moveCount, 'move'), g.playedAt, g.event].filter(Boolean).join(' · ');
  const del = el('button', { type: 'button', className: 'danger small', textContent: 'Delete' });
  del.addEventListener('click', () => deleteGames([g.id], `"${g.white} vs ${g.black}"`));
  return el('li', { className: 'game' },
    box,
    el('div', { className: 'game-text' },
      el('a', { href: `/game.html?id=${g.id}`, className: 'game-title', textContent: `${g.white} vs ${g.black}` }),
      el('span', { className: 'hint', textContent: bits })),
    el('span', { className: `pill ${g.source}`, textContent: SOURCE_LABEL[g.source] || g.source }),
    del);
}

async function deleteGames(ids, what) {
  const question = ids.length === 1
    ? `Delete ${what} from your library? This cannot be undone.`
    : `Delete ${ids.length} games from your library? This cannot be undone.`;
  if (!window.confirm(question)) return;
  try {
    const r = await api('/api/games/bulk-delete', { method: 'POST', body: { ids } });
    setStatus(`Deleted ${plural(r.deleted, 'game')}.`);
    showFailures();
    showRecent([]);
    await loadLibrary();
  } catch (err) {
    setStatus(err.message, true);
  }
}

$('search').addEventListener('input', renderLibrary);
$('source-filter').addEventListener('change', renderLibrary);
$('select-all').addEventListener('change', (e) => {
  const shown = visibleGames();
  if (e.target.checked) shown.forEach((g) => selected.add(g.id)); else selected.clear();
  renderLibrary();
});
$('delete-selected').addEventListener('click', () => deleteGames([...selected]));

// ---------- start ----------
initNav().then((user) => {
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  $('welcome').textContent = `Welcome, ${user.username}`;
  $('content').hidden = false;
  loadLibrary().catch((err) => setStatus(err.message, true));
});
