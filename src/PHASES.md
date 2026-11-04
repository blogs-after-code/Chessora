# PHASES - phase-wise plan and live status

## Project state (AI keeps this current - update after every phase)
- **Current phase:** 1 - Foundation and setup (code written; waiting for the human to run the install and tests)
- **Terminal start folder:** `/run/media/DivyanshSeth/HDD/Chessora/Chessora`
- **OS / runtime versions:** Ubuntu 24 (bash, VS Code terminal); Node 20+ required (exact version recorded after the human pastes `node --version`)
- **How to run (NOT YET VERIFIED, the AI sandbox could not reach npm):** from `/run/media/DivyanshSeth/HDD/Chessora/Chessora`: 1) `cd src/app` 2) `npm install` 3) `npm start`, then open http://localhost:3000
- **How to test (NOT YET VERIFIED for the server tests):** 1) `cd src/app` 2) `npm test`. The pure FEN tests (2) passed in the AI sandbox; the 4 server tests need `npm install` first.
- **Known issues:** Express/helmet/dotenv could not be installed in the AI sandbox (no registry access), so the server and its tests are unverified. Pieces are Unicode glyphs until Phase 5.
- **Next up:** Human runs the Phase 1 commands and reports the result; then mark Phase 1 COMPLETED and start Phase 2

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
| 1 | Foundation and setup | AI agent | IN PROGRESS |
| 2 | Accounts and database | AI agent | NOT STARTED |
| 3 | Game library and import | AI agent | NOT STARTED |
| 4 | Stockfish analysis and annotations | AI agent | NOT STARTED |
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
**Status:** IN PROGRESS
**Owner:** AI agent
**Depends on:** Phase 0 (COMPLETED)
**Goal:** Project skeleton that runs end-to-end: Express server serving a static page that draws a chessboard from a FEN.

**Tasks**
- [ ] Check Node/npm versions and that `npm install` works on the current drive (move the project if not)
- [x] Create folder structure inside `src/app/` (`server/`, `public/`, `tests/`) and `package.json` with pinned dependencies
- [x] Express server with `/api/health`, security headers, and `.env` loading; update `.env.example`
- [x] Static page that renders a board from a FEN on a canvas (piece set with a free licence)
- [x] One test for `/api/health`; write run/test instructions in `README.md` and record them in Project state

**Deliverables:** Runnable skeleton
**Acceptance criteria:** Fresh clone runs with the documented commands; `/api/health` returns ok; the board shows the start position
**Instagram content idea:** Setting up the project live and rendering the first chessboard in code
**Completed on:** -
**Notes / deviations:** Code is written. NOT COMPLETED because the AI sandbox could not reach the npm registry (proxy 403), so `npm install`, the server, and the 4 server tests were not run; only the 2 pure FEN tests passed. The first task (check Node/npm and that `npm install` works on the external drive) needs the human's terminal and is still open. Pieces are Unicode glyphs for now (no licence issue); the licensed SVG set arrives in Phase 5.

---

### Phase 2 - Accounts and database
**Status:** NOT STARTED
**Owner:** AI agent
**Depends on:** Phase 1
**Goal:** Users can sign up, log in and log out; data stored through the libSQL client.

**Tasks**
- [ ] Database layer with migrations and a `users` table (local SQLite file, git-ignored)
- [ ] Signup / login / logout / me endpoints with bcrypt, validation (`zod`), sessions in httpOnly cookies, rate limiting, CSRF protection
- [ ] Landing, sign-up and log-in pages and a protected dashboard page
- [ ] Tests for auth flows and bad input

**Deliverables:** Working accounts
**Acceptance criteria:** A new user can sign up, log in, see the dashboard, log out; wrong passwords and duplicate emails are rejected; tests pass
**Instagram content idea:** How a creator login system works, with no paid service
**Completed on:** -
**Notes / deviations:** -

---

### Phase 3 - Game library and import
**Status:** NOT STARTED
**Owner:** AI agent
**Depends on:** Phase 2
**Goal:** Users can add games by PGN or by importing from Lichess and Chess.com, and see them in a library.

**Tasks**
- [ ] `games` table, CRUD endpoints (per-user access only)
- [ ] PGN paste/upload with validation using `chess.js`
- [ ] Lichess and Chess.com import endpoints with rate-limit and error handling (429, user not found)
- [ ] Dashboard library UI: list, open, delete with confirmation
- [ ] Tests with sample PGNs and mocked API responses

**Deliverables:** Game library with import
**Acceptance criteria:** Importing a real Lichess and a real Chess.com username saves games; PGN paste works; bad input shows clear errors
**Instagram content idea:** Pulling your own games from Lichess and Chess.com in one click
**Completed on:** -
**Notes / deviations:** -

---

### Phase 4 - Stockfish analysis and annotations
**Status:** NOT STARTED
**Owner:** AI agent
**Depends on:** Phase 3
**Goal:** Analyse a game in the browser with Stockfish WASM and annotate every move.

**Tasks**
- [ ] Game view page: board, move list, navigation (keys/buttons)
- [ ] Stockfish WASM in a Web Worker, depth setting, progress bar, cancel
- [ ] Move classification (best, excellent, good, inaccuracy, mistake, blunder) from centipawn loss; eval graph
- [ ] Save analysis JSON back to the game (`PATCH /api/games/:id`)
- [ ] Unit tests for the classification logic with fixed evaluations

**Deliverables:** Analysed game view
**Acceptance criteria:** A game gets analysed in the browser, with colour-coded annotations and an eval graph, and the result is saved and reloads without re-analysis
**Instagram content idea:** Finding your worst blunder with a free engine
**Completed on:** -
**Notes / deviations:** -

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

