# PRD - Product Requirements Document

> Living document. Keep it accurate:
> if the tech stack or scope changes, update this file in the same step.

| Field | Value |
|---|---|
| Project name | Chessora |
| One-line summary | A free web toolkit that turns chess games (PGN or Lichess/Chess.com imports) into analysed, shareable content: animated board GIFs/images, blunder and brilliancy clips, meme content, and captions/scripts. |
| Project type | Web app (full-stack, JS only) |
| Size (decides phase count) | Medium (8 phases, one per day) |
| Owner | Divyansh Seth |
| Created | 2026-11-04 |
| Last updated | 2026-11-05 (approved; Phase 1 in progress) |

## Development environment (fill after the terminal check at Kickoff)
- OS / shell / editor: Ubuntu, bash, VS Code terminal
- Folder the terminal starts in (`pwd`): `/run/media/DivyanshSeth/HDD/Chessora/Chessora`
- Runtime versions: Node v24.20.0, npm 11.19.0, git 2.53.0 (confirmed by the human on 2026-11-04); project requires Node 20 or newer
- Note: the project sits on an external/mounted drive (`/run/media/...`). Such drives are sometimes mounted `noexec`, or are NTFS/exFAT, which can break `npm install` symlinks. Phase 1 checks this first.

## 1. Problem and users
- Problem being solved: Chess content creators spend hours manually screen-recording boards, hunting for the key moment of a game, and making thumbnails/GIFs. There is no free, simple tool that goes from "my game" to "ready-to-post clip, GIF or meme".
- Who uses it: Chess content creators on Instagram, YouTube and other platforms (first user is the owner, who also documents the build on Instagram). Other creators sign up with their own accounts.
- Success looks like: A creator signs up, imports a game from Lichess or Chess.com (or pastes a PGN), and within about 2 minutes downloads a GIF or clip of their biggest blunder or best move, with the whole app running on a free tier at zero cost.

## 2. Goals and non-goals
**Goals**
- Sign-up / login for multiple users; each user has their own saved games.
- PGN paste/upload to animated board GIF and still image.
- Free game analysis with Stockfish, with annotations (best move, blunder, mistake, excellent move).
- Import games from the Lichess and Chess.com free public APIs.
- Quick clips around blunders and excellent moves (key feature).
- Meme-based content creation (key feature; details to be provided by the owner before its phase).
- Caption and script helper (free, no paid AI API).
- Everything runs on free tiers and free tools; deployed online at the end.
- Plain HTML + CSS + JavaScript frontend, Node.js backend.

**Non-goals (explicitly out of scope)**
- Paid services or paid APIs (no paid LLM API, no paid hosting).
- React, Next.js or any frontend framework.
- Playing chess against opponents, live games, matchmaking.
- Mobile native apps.
- Payments, subscriptions, email verification (needs a mail service) and social login (v1).
- Server-side video rendering and server-side Stockfish (too heavy for free tiers; done in the browser instead).

## 3. Features
| ID | Feature | Priority (Must / Should / Could) | Phase |
|---|---|---|---|
| F1 | Project skeleton: Express server, static frontend, health endpoint, chessboard drawn from a FEN | Must | 1 |
| F2 | Sign up, log in, log out, saved sessions (hashed passwords) | Must | 2 |
| F3 | Paste/upload a PGN, validate it, save it to the user's library | Must | 3 |
| F4 | Import games by username from Lichess and Chess.com | Must | 3 |
| F5 | Stockfish analysis in the browser (WASM): evaluation per move, move classification, annotations | Must | 4 |
| F6 | PGN or position to animated board GIF and still PNG export (browser-side) | Must | 5 |
| F7 | Auto-find blunders and excellent moves, and export a short clip around each (GIF/WebM, browser-side) | Must | 6 |
| F8 | Meme content maker (details to be provided by the owner) | Must | 7 |
| F9 | Caption / title / script helper using templates built from game data (no paid AI) | Should | 7 |
| F10 | Board themes, piece sets, orientation, aspect ratios (1:1, 9:16, 16:9) for Instagram/YouTube | Should | 5-6 |
| F11 | Deployment on free tiers with a public URL | Must | 8 |
| F12 | Watermark / branding on exports (creator handle) | Could | 8 |

## 4. Tech stack
| Layer | Choice | Version | Why this choice | Status |
|---|---|---|---|---|
| Language / runtime | Node.js (JavaScript) | 20 or newer (human has v24.20.0) | Owner's choice; one language for the whole project | Planned |
| Framework(s) | Express (backend); plain HTML + CSS + JS (frontend, ES modules, no bundler) | Express 4.x | Boring and well known; no build step | Planned |
| Database / storage | SQLite file in development via `@libsql/client`; Turso (libSQL) free tier in production | latest stable | Same library works for a local file and for the free hosted DB, so free hosts with ephemeral disks do not lose user data | Planned |
| Key libraries | `chess.js` (PGN, moves, legal checks); `stockfish` WASM build running in a Web Worker (browser); `gif.js` or `gifenc` (GIF encoding in the browser); `MediaRecorder` + canvas for WebM clips; `bcryptjs` (password hashing); `express-session` or signed JWT in an httpOnly cookie; `helmet`, `express-rate-limit`, `dotenv`, `zod` (input validation) | pinned in Phase 1 | All free and open source; heavy work (engine, encoding) runs in the user's browser so the free server stays light | Planned |
| Testing | Node built-in test runner (`node --test`) for backend and pure logic; a manual browser checklist for UI | built in | No extra dependency | Planned |
| Hosting / infra | Render free web service (Node) or similar free Node host; Turso free DB; GitHub for the code | free tiers | Zero cost; final choice confirmed in Phase 8 | Planned |

Status values: Planned | In use | Replaced | Dropped.

## 5. Architecture
- Overview:
```
Browser (HTML/CSS/JS)                         Node.js + Express server              External (free)
 - board renderer (canvas)  <--- REST/JSON --> - auth (sessions)                    - Lichess public API
 - Stockfish WASM (Worker)                     - games library API (CRUD)           - Chess.com public API
 - GIF / WebM / PNG exporters                  - import proxy (Lichess/Chess.com)   - Turso (libSQL) DB
 - meme + caption tools                        - SQLite/libSQL storage
```
- Main modules and responsibilities:
  - `src/app/server/`: Express app, routes (`auth`, `games`, `import`), middleware (security, rate limit, validation), DB access.
  - `src/app/public/`: static frontend pages and JS modules: `board` (rendering), `analysis` (Stockfish worker and move classification), `export` (GIF/PNG/WebM), `clips` (blunder/brilliancy finder), `memes`, `captions`.
  - `src/app/tests/`: backend and pure-logic tests.
- Data flow: input (PGN paste/upload, or Lichess/Chess.com username) -> server fetches and validates, saves to the user's library -> browser loads the game, runs Stockfish in a Worker, classifies moves -> user picks a moment or the whole game -> browser renders frames to canvas -> GIF/PNG/WebM file downloaded; captions/memes built from the same data.

## 6. Data and storage
- Data sources / inputs: user-pasted or uploaded PGN; Lichess public API (`/api/games/user/{username}`, NDJSON/PGN); Chess.com published-data API (`/pub/player/{username}/games/{YYYY}/{MM}`).
- Storage: tables `users(id, email, username, password_hash, created_at)`, `games(id, user_id, source, source_id, pgn, white, black, result, played_at, analysis_json, created_at)`, `exports(id, user_id, game_id, kind, created_at)` (metadata only; exported files are downloaded, not stored on the server). Sketch; the final schema is set in Phase 2-3.
- Backup and data-safety plan: development DB is a local file (`src/app/data/` is git-ignored); a `tools`-style backup copy of the DB file is made before any migration; production uses Turso, which keeps its own backups. Never delete user data without a backup or explicit confirmation.

## 7. API plan
**Internal API (endpoints this project exposes)**
| Method | Path / command | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | Liveness check | None |
| POST | `/api/auth/signup` | Create account | None |
| POST | `/api/auth/login` | Log in | None |
| POST | `/api/auth/logout` | Log out | Session |
| GET | `/api/auth/me` | Current user | Session |
| GET | `/api/games` | List the user's saved games | Session |
| POST | `/api/games` | Save a game from PGN | Session |
| GET | `/api/games/:id` | Get one game | Session |
| PATCH | `/api/games/:id` | Save analysis / annotations | Session |
| DELETE | `/api/games/:id` | Delete a game (with confirmation in the UI) | Session |
| POST | `/api/import/lichess` | Import recent games for a Lichess username | Session |
| POST | `/api/import/chesscom` | Import games for a Chess.com username/month | Session |

**External APIs / services used**
| Service | Used for | Auth method | Rate limits / cost | Fallback |
|---|---|---|---|---|
| Lichess public API | Import games by username | None for public games (optional token in `.env` for higher limits) | Free; about 1 request at a time per IP; respect HTTP 429 | PGN paste/upload |
| Chess.com published-data API | Import games by username and month | None | Free; serial requests recommended, cached responses; respect 429 | PGN paste/upload |
| Turso (libSQL) | Production database | Auth token in `.env` | Free tier with generous limits | Any other free libSQL/SQLite host |
| Stockfish (WASM, in browser) | Analysis | None | Free, runs on the user's device | Lichess cloud-eval API for single positions (optional) |

## 8. Deployment plan
- Environments: local (dev, SQLite file) and production (free tier). No staging at first.
- Where it runs and how it is packaged: one Node web service serves both the API and the static frontend (single deploy). Free host (Render free web service or similar) plus Turso free DB. Free web services sleep after idle time (first request is slow); this is documented for users.
- Config and secrets handling: `.env` locally (git-ignored), host environment variables in production; `.env.example` is kept current (`SESSION_SECRET`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `PORT`, optional `LICHESS_TOKEN`).
- Release steps and rollback: push to GitHub, host auto-deploys from the main branch; rollback by redeploying the previous commit; DB migrations are additive and run after a backup.
- Monitoring / logging: console logs with request IDs; `/api/health` for the host's health check; basic error log, no personal data in logs.

## 9. Non-functional requirements
- Performance / scale: small (tens of users). Heavy work (engine, GIF/video encoding) runs in the browser. Analysis default depth is limited so a game finishes within a minute or two on a normal laptop.
- Security and privacy: hashed passwords (bcrypt), httpOnly + SameSite session cookies, input validation with `zod`, rate limiting on auth and import routes, `helmet` headers, CSRF protection for state-changing requests, no secrets in code, minimal personal data (email and username only).
- Legal / terms-of-service / licensing notes: Stockfish is GPLv3 (the WASM engine is used as a separate library; keep its licence and credit it). Choose chess piece sets with a clear free licence (for example the Lichess `cburnett` set, GPL/CC-BY-SA, or other CC0 sets) and credit them. Use the Lichess and Chess.com APIs within their terms (identify the app, respect rate limits, no scraping). Exports of other people's games are their games; add a short note about crediting players. Meme templates must use original or properly licensed images.
- Platforms supported: modern desktop browsers (Chrome, Edge, Firefox) first; responsive layout so it is usable on a phone. Server: any host running Node 20 or newer.

## 10. Risks and open questions
| # | Risk / question | Impact | Plan / owner |
|---|---|---|---|
| 1 | The meme feature is not yet described by the owner | Phase 7 scope unclear | Owner describes it before Phase 7; Phase 7 starts with a short spec questionnaire |
| 2 | "Clips" meaning: short animated board clips (GIF/WebM) of the moves around a blunder or excellent move; NOT live video (confirmed by owner 2026-11-04; live video is a possible future idea) | None now | Resolved |
| 3 | In-browser video/GIF encoding is slow on weak devices | Poor experience | Limit clip length and frame size; show progress; offer GIF and WebM options |
| 4 | Free host sleeps when idle and has a small RAM/CPU limit | Slow first load | Keep the server light (no engine, no encoding); document it |
| 5 | Free-tier DB or host rules may change | Deployment surprises | Use libSQL (SQLite-compatible), so a local-file fallback is always possible; re-verify free tiers in Phase 8 |
| 6 | The project folder is on an external drive (`/run/media/...`) | `npm install` or execution may fail if the mount is NTFS/exFAT or `noexec` | Check in Phase 1 step 1; if needed move the project to the home folder |
| 7 | Open source licences (Stockfish GPLv3, piece sets) | Legal compliance | Record licences in the README credits in Phase 8 |
| 8 | Plan is one phase per day; Phase 7 (memes + captions) and Phase 8 (deploy) are the heaviest | Schedule slip | If Phase 7 or 8 is too big for one day, split it into a 9th phase (still within the Medium size guidance by agreement) |

## 11. Tech stack change log
Add a row every time the stack changes (also update section 4).
| Date | Change (old -> new) | Reason | Phase |
|---|---|---|---|
| 2026-11-04 | Initial stack chosen: Node.js + Express, plain HTML/CSS/JS, libSQL/SQLite, browser-side Stockfish WASM | Kickoff; owner asked for HTML/CSS/JS + Node.js, no React/Next.js, free tiers only | 0 |

**Key decisions** (non-obvious choices, so nobody re-argues them)
| Date | Decision | Reason | Alternatives rejected |
|---|---|---|---|
| 2026-11-04 | Build phase by phase from this template, one phase per day | Predictable, resumable work; matches the owner's daily Instagram content plan | Ad-hoc chats |
| 2026-11-04 | Run Stockfish and GIF/video encoding in the browser, not on the server | Free hosts have tiny CPU/RAM; keeps cost at zero | Server-side Stockfish and ffmpeg |
| 2026-11-04 | No frontend framework | Not frontend-heavy; owner's choice | React, Next.js |
| 2026-11-04 | libSQL client (SQLite locally, Turso in production) | Free hosts often have ephemeral disks | Plain SQLite file in production; Render free Postgres (expires) |
| 2026-11-04 | Captions via templates built from game data, no paid AI API | Owner will not pay for anything before earning | Paid LLM APIs |

## 12. Document history
| Date | Change | By |
|---|---|---|
| 2026-11-04 | PRD created from template | template |
| 2026-11-04 | Kickoff: PRD filled in (draft, awaiting owner approval) | AI agent |
| 2026-11-04 | PRD approved by owner; clips confirmed as animated board clips (not live video) | AI agent |

## 13. Project-type details
**Web / mobile / desktop**
- Screens or pages list: (1) Landing + sign up / log in; (2) Dashboard: game library, import (Lichess / Chess.com / PGN); (3) Game view: board, move list, engine analysis, annotations; (4) Export studio: GIF / image / clip settings (theme, size, speed, aspect ratio); (5) Moments: auto-detected blunders and excellent moves with one-click clip; (6) Meme studio (details later); (7) Caption / script helper; (8) Account / settings.
- Auth model: email + password (bcrypt), server-side session in an httpOnly cookie; no email verification in v1.
- Offline needs: none required; exports and analysis work after the game is loaded, but the app needs the network to sign in and import.
- Target OS / browsers: Chrome, Edge, Firefox (desktop first), responsive for mobile browsers.
- Release channel: single production site on a free tier; code on GitHub.
