# PHASES - phase-wise plan and live status

## Project state (AI keeps this current - update after every phase)
- **Current phase:** 4 - Stockfish analysis and annotations (code written and tested by the AI in a real Chromium; waiting for the human to run install, tests and the browser check on their own machine)
- **Terminal start folder:** `/run/media/DivyanshSeth/HDD/Chessora/Chessora`
- **OS / runtime versions:** Ubuntu 24 (bash, VS Code terminal); Node 20+ required (exact version recorded after the human pastes `node --version`)
- **How to run:** from `/run/media/DivyanshSeth/HDD/Chessora/Chessora`: 1) stop any old server (Ctrl+C) 2) `cd src/app` 3) `npm install` (Phase 4 adds the `stockfish` package) 4) `npm start`, then open http://localhost:3000. Database migrations run automatically on start and make a backup copy of the database first (migration 3 adds the `analysis_json` column).
- **How to test:** 1) `cd src/app` 2) `npm install` 3) `npm test`. Expect `# fail 0` (69 tests passed in the AI sandbox on 2026-11-05; the human's own result is not yet confirmed for Phase 4).
- **Known issues:** The AI ran the whole Phase 4 flow (analyse, save, reload, cancel) in headless Chromium, not in Firefox or on the human's machine. `npm audit` reports one high warning for `zod` 3.x (memory use on huge arrays); the fix is a breaking upgrade to zod 4, so it is left for the Phase 8 security pass (the server already caps request bodies at 1 MB). The browser asks for `/favicon.ico`, which does not exist yet (harmless 404). The "lite" engine is weaker than full Stockfish but far stronger than any human; labels can differ a little from Lichess or Chess.com. Pieces are Unicode glyphs until Phase 5. If the server was running before an update, restart it (an old process keeps answering with old code).
- **Next up:** Human runs the Phase 4 steps and reports the result; then mark Phase 4 COMPLETED and start Phase 5

## How many phases?
| Size | Phases | Typical examples |
|---|---|---|
| Small | 2-4 | single script, simple downloader, small bot, one-page tool |
| Medium | 6-8 | crawler + storage + scheduler, CRUD website, ML train + serve, mobile app with backend |
| Large | 12-18 | multi-service platform, many roles/modules, production ML pipeline |

**Starter lists (Kickoff picks one and rewrites the phases below):**
- **Small (4):** Foundation -> Core features -> Testing and polish -> Deployment and handoff. (2-3 phase version: merge the middle ones.)
- **Medium (7):** Foundation -> Data layer -> Core feature set A -> Core feature set B -> Integrations and API -> Testing and hardening -> Deployment and docs. (8th: UI polish or Admin tools.)
- **Large (15):** Foundation -> Architecture spike -> Data model -> Auth and roles -> Core module 1 -> Core module 2 -> Core module 3 -> Integrations -> API -> UI/client layer -> Admin and reporting -> Testing and QA -> Security and performance -> Deployment and operations -> Launch and handoff. (12: merge modules and QA/security. 18: split modules per feature, add beta + post-launch.)

Each phase must be finishable in one focused session and end in something that runs.

## Overview (keep in sync with the sections below)
| # | Phase | Owner | Status |
|---|---|---|---|
| 0 | Kickoff | Human + AI | COMPLETED (2026-11-04) |
| 1 | Foundation and setup | AI agent | COMPLETED (2026-11-05) |
| 2 | Accounts and database | AI agent | COMPLETED (2026-11-05) |
| 3 | Game library and import | AI agent | COMPLETED (2026-11-05) |
| 4 | Stockfish analysis and annotations | AI agent | IN PROGRESS |
| 5 | Image and GIF export | AI agent | NOT STARTED |
| 6 | Blunder and brilliancy clips | AI agent | NOT STARTED |
| 7 | Meme studio and caption helper | Human + AI | NOT STARTED |
| 8 | Testing, deployment and docs | Human + AI | NOT STARTED |

Status values: `NOT STARTED` | `IN PROGRESS` | `BLOCKED` | `COMPLETED (YYYY-MM-DD)`

---
### Phase 0 - Kickoff
**Status:** COMPLETED (2026-11-04)
**Owner:** Human + AI agent
**Depends on:** -
**Goal:** Turn the idea into a clear PRD, pick the stack, size the project, and set the real phase list.

**Tasks**
- [x] Ask the human the missing questions (users, must-have features, constraints, deadline)
- [x] Fill every placeholder marker in `src/PRD.md` (stack, API plan, deployment plan)
- [x] Decide project size (Small / Medium / Large) and rewrite this file using the starter lists above
- [x] Human reviews and approves PRD + phase list

**Deliverables:** Completed PRD.md, rewritten PHASES.md
**Acceptance criteria:** No unfilled markers left in PRD; phase count matches the size; every phase has tasks + acceptance criteria
**Completed on:** 2026-11-04
**Notes / deviations:** Medium size with 8 phases (the top of the Medium range) to fit one phase per day. Stack changed from the template's "Python path" suggestion to Node.js, as the owner requested. Owner approved on 2026-11-04 and confirmed clips are animated board clips, not live video.

---

### Phase 1 - Foundation and setup
**Status:** COMPLETED (2026-11-05)
**Owner:** AI agent
**Depends on:** Phase 0 (COMPLETED)
**Goal:** Project skeleton that runs end-to-end: Express server serving a static page that draws a chessboard from a FEN.

**Tasks**
- [x] Check Node/npm versions and that `npm install` works on the current drive (move the project if not)
- [x] Create folder structure inside `src/app/` (`server/`, `public/`, `tests/`) and `package.json` with pinned dependencies
- [x] Express server with `/api/health`, security headers, and `.env` loading; update `.env.example`
- [x] Static page that renders a board from a FEN on a canvas (piece set with a free licence)
- [x] One test for `/api/health`; write run/test instructions in `README.md` and record them in Project state

**Deliverables:** Runnable skeleton
**Acceptance criteria:** Fresh clone runs with the documented commands; `/api/health` returns ok; the board shows the start position
**Instagram content idea:** Setting up the project live and rendering the first chessboard in code
**Completed on:** 2026-11-05
**Notes / deviations:** Human verified on their machine (Node v24.20.0, npm 11.19.0, external drive works): `npm install`, `npm test` (6 pass) and `npm start` with the board and a green server badge. Fix made during verification: the test script is `node --test` (the form `node --test tests/` fails on Node 24). Pieces are Unicode glyphs until Phase 5; the licensed SVG set replaces them there.

---

### Phase 2 - Accounts and database
**Status:** COMPLETED (2026-11-05)
**Owner:** AI agent
**Depends on:** Phase 1 (COMPLETED)
**Goal:** Users can sign up, log in and log out; data stored through the libSQL client.

**Tasks**
- [x] Database layer with migrations and a `users` table (local SQLite file, git-ignored)
- [x] Signup / login / logout / me endpoints with bcrypt, validation (`zod`), sessions in httpOnly cookies, rate limiting, CSRF protection
- [x] Landing, sign-up and log-in pages and a protected dashboard page
- [x] Tests for auth flows and bad input

**Deliverables:** Working accounts
**Acceptance criteria:** A new user can sign up, log in, see the dashboard, log out; wrong passwords and duplicate emails are rejected; tests pass
**Instagram content idea:** How a creator login system works, with no paid service
**Completed on:** 2026-11-05
**Notes / deviations:** Human verified in the browser on 2026-11-05: sign up, log in, log out, dashboard redirect and error messages work (the human did not paste the `npm test` summary, so the automated test result is unconfirmed). The first signup failed only because an old Phase 1 server process was still running; restarting fixed it. Deviations: sessions use an own small DB-backed layer instead of express-session (see PRD section 11); CSRF protection is SameSite=Lax cookies plus an Origin check; the dashboard HTML is public but contains no data and redirects to login when `/api/auth/me` returns 401. No email verification (non-goal).

---

### Phase 3 - Game library and import
**Status:** COMPLETED (2026-11-05)
**Owner:** AI agent
**Depends on:** Phase 2 (COMPLETED)
**Goal:** Users can add games by PGN or by importing from Lichess and Chess.com, and see them in a library.

**Tasks**
- [x] `games` table, CRUD endpoints (per-user access only)
- [x] PGN paste/upload with validation using `chess.js`
- [x] Lichess and Chess.com import endpoints with rate-limit and error handling (429, user not found)
- [x] Dashboard library UI: list, open, delete with confirmation
- [x] Tests with sample PGNs and mocked API responses

**Deliverables:** Game library with import
**Acceptance criteria:** Importing a real Lichess and a real Chess.com username saves games; PGN paste works; bad input shows clear errors
**Instagram content idea:** Pulling your own games from Lichess and Chess.com in one click
**Completed on:** 2026-11-05
**Notes / deviations:** Human confirmed on 2026-11-05 that Phase 3 is done (revised version). First human test (2026-11-05): 42 of 43 tests passed (the one failure was a bug in a test, fixed); Lichess and Chess.com imports worked. Feedback led to a revision: (1) pasted analysed Lichess PGNs (two comments in a row, variations, ?? marks) failed, so annotations are now stripped before parsing (original text is still stored); (2) Lichess and Chess.com imports now offer identical options (latest N games, or N games from a From/To date range) and both forms are built from one template; (3) library has checkboxes, select-all, search, source filter and one-click bulk delete (`POST /api/games/bulk-delete`); (4) the PGN box shows how many games were detected, what file is loaded, a Clear button, and is emptied after a successful add; (5) a pasted game that carries a Lichess/Chess.com link is recognised as a duplicate of the imported one. Other additions: game viewer (`/game.html?id=N`), per-user caps (500 games, 50 per request), import rate limit. A parallel edit of the importers and PGN helpers (date options, `stripAnnotations`) appeared on disk during this revision; it was kept and merged, duplicates removed. PATCH for analysis stays in Phase 4.

---

### Phase 4 - Stockfish analysis and annotations
**Status:** IN PROGRESS
**Owner:** AI agent
**Depends on:** Phase 3 (COMPLETED)
**Goal:** Analyse a game in the browser with Stockfish WASM and annotate every move.

**Tasks**
- [x] Game view page: board, move list, navigation (keys/buttons)
- [x] Stockfish WASM in a Web Worker, depth setting, progress bar, cancel
- [x] Move classification (best, excellent, good, inaccuracy, mistake, blunder) from centipawn loss; eval graph
- [x] Save analysis JSON back to the game (`PATCH /api/games/:id`)
- [x] Unit tests for the classification logic with fixed evaluations

**Deliverables:** Analysed game view
**Acceptance criteria:** A game gets analysed in the browser, with colour-coded annotations and an eval graph, and the result is saved and reloads without re-analysis
**Instagram content idea:** Finding your worst blunder with a free engine
**Completed on:** -
**Notes / deviations:** NOT COMPLETED until the human confirms on their own machine. The AI verified in headless Chromium: engine runs in a Worker, a 7-move and a 41-move game were analysed (about 1 second each at depth 8-10), saved, reloaded without re-analysis, cancel works, graph click and arrow keys work, phone-width layout works; 69 automated tests pass (52 old + 17 new); migration 3 was tried on a copy of the human's real database (1 user, 1 game kept, backup file created). Choices: engine = npm `stockfish` 19.0.1 "lite single-threaded" build, served by our server at `/vendor/stockfish/engine.js` and `engine.wasm` (no copy in the repo, no special headers); `helmet` now allows `'wasm-unsafe-eval'` for scripts. Deviation: labels use the loss of *winning chance* (percentage points) instead of raw centipawns, because 200 centipawns lost in a won game should not be called a blunder; centipawn loss is still saved and shown. Limits: 2 points = excellent, 5 = good, 10 = inaccuracy, 20 = mistake, more = blunder; the engine's own best move is always "best". Extras: last-move highlight and a blue arrow for the engine's preferred move on inaccuracies, mistakes and blunders (`board.js` got two optional settings), per-side summary table with an accuracy score, "Try saving again" when saving fails, confirmation before re-analysing. Stored shape: `{version, engine, depth, startEv, moves:[{ev, best, cls, loss}]}` with `ev` = centipawns from White's view (mates as +-(10000 - moves to mate)).

---

### Phase 5 - Image and GIF export
**Status:** NOT STARTED
**Owner:** AI agent
**Depends on:** Phase 4
**Goal:** Export positions as PNG and whole games or move ranges as animated GIFs, entirely in the browser.

**Tasks**
- [ ] Export studio page: theme, piece set, orientation, speed, size and aspect ratio (1:1, 9:16, 16:9)
- [ ] PNG export of any position
- [ ] GIF encoding in the browser with progress and size limits
- [ ] Optional watermark text (creator handle)
- [ ] Manual browser checklist for exports (Chrome and Firefox)

**Deliverables:** Working image and GIF exporter
**Acceptance criteria:** A saved game exports to a PNG and a GIF that play correctly in an Instagram upload and a normal image viewer
**Instagram content idea:** From PGN to animated GIF with no editing software
**Completed on:** -
**Notes / deviations:** -

---

### Phase 6 - Blunder and brilliancy clips
**Status:** NOT STARTED
**Owner:** AI agent
**Depends on:** Phase 5
**Goal:** Auto-find key moments and create short clips around them quickly (the key feature).

**Tasks**
- [ ] Moments page listing blunders and excellent moves from the saved analysis, sorted by impact
- [ ] One-click clip around a moment (a few moves before and after, with the annotation shown), with adjustable length
- [ ] Clip formats: GIF and WebM (via canvas and MediaRecorder); 9:16 for Reels/Shorts
- [ ] Optional text overlay (for example 'Blunder: Qxf7??') and eval bar
- [ ] Tests for moment detection; manual checklist for clip export

**Deliverables:** Quick clips at key moments
**Acceptance criteria:** From an analysed game, a creator downloads a clip of a blunder and one of a best move in under a minute
**Instagram content idea:** Auto-detecting the blunder and cutting the clip in one click
**Completed on:** -
**Notes / deviations:** -

---

### Phase 7 - Meme studio and caption helper
**Status:** NOT STARTED
**Owner:** Human + AI
**Depends on:** Phase 6
**Goal:** Meme-based content creation (details provided by the owner) and a free template-based caption/script helper.

**Tasks**
- [ ] Owner describes the meme feature (short spec: formats, templates, text rules, examples); AI confirms scope in 3-5 lines
- [ ] Meme studio: board moment plus template/caption layout, export as image/GIF
- [ ] Caption, title and script generator from game data (opening, result, blunder, move count) using templates, with a copy button and hashtags
- [ ] Tests for the template logic; licence check for any meme assets

**Deliverables:** Meme studio and caption helper
**Acceptance criteria:** A creator can make a meme from a game moment and get a ready caption and short script, all without a paid service
**Instagram content idea:** Turning a blunder into a meme and an auto-written caption
**Completed on:** -
**Notes / deviations:** -

---

### Phase 8 - Testing, deployment and docs
**Status:** NOT STARTED
**Owner:** Human + AI
**Depends on:** Phase 7
**Goal:** Make it reliable, deploy on a free tier, and leave it documented.

**Tasks**
- [ ] Fix known bugs; run the manual browser checklist on Chrome, Firefox and a phone; performance and security pass
- [ ] Set up the free host and Turso DB; configure environment variables; push to GitHub for auto-deploy
- [ ] Smoke-test the deployed site (signup, import, analysis, export, clip)
- [ ] Final README (run, deploy, credits and licences), PRD cleanup, backlog of next ideas

**Deliverables:** Public free-tier deployment
**Acceptance criteria:** Anyone can open the URL, sign up and create a clip; the human can redeploy using the README alone
**Instagram content idea:** Launching it online for free
**Completed on:** -
**Notes / deviations:** -

---

