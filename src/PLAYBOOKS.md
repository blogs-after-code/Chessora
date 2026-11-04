# PLAYBOOKS - stack and phase advice per project type

Suggestions, not law. At Kickoff read only the section(s) that match the project, then record the final choice in `src/PRD.md`. Combine sections for mixed projects.

Sections: media downloader | web crawler | telegram bot | ml training | fullstack web | mobile app | desktop app | cli automation

---

## media downloader (download media from websites)

**Typical stack (simple default):** Python 3 + `yt-dlp` for video/audio sites, `httpx` or `requests`
for plain files/images, `ffmpeg` for merging/converting, SQLite (or a JSON file) for the download
history. CLI first; add a small GUI only if really needed.

**Ask at Kickoff:** which sites? video, audio, images or documents? single links, playlists or whole
sites? login required? where do files go? how much disk space?

**Key design points**
- Legal check: only download what you have the right to download; respect site terms and robots.txt.
- Resumable downloads, retry with backoff, polite delay between requests, concurrency limit.
- Never overwrite: unique filenames, dedupe by URL + content hash, keep a history table.
- Config file for output folder, quality, rate limit; `.env` for cookies/tokens.
- Clear progress + a final report (ok / skipped / failed with reasons).

**Phase outline (medium, 7):** 1 foundation + single-URL download -> 2 history/dedupe DB -> 3 playlists/batch
-> 4 site adapters + auth/cookies -> 5 retries, resume, rate limit -> 6 tests + hardening -> 7 packaging + docs.
**Small (3):** foundation -> single + batch download with history -> polish + docs.

**Pitfalls:** sites change often (isolate each site in its own adapter); huge playlists fill disks (add a
size/space check); cookies are secrets.

**Deployment:** local CLI (pipx/venv) or a Docker image; schedule with cron/systemd timer if recurring.

---

## web crawler / scraper

**Typical stack:** Python 3 + `httpx` + `selectolax`/`BeautifulSoup` for static pages; `Playwright` only
when the site needs JavaScript; `Scrapy` for large crawls. SQLite for small data, PostgreSQL for large.

**Ask at Kickoff:** target sites and pages, fields to extract, volume (pages/day), refresh frequency,
output (CSV/DB/API), login needed?

**Key design points**
- Respect robots.txt and terms; identify yourself with a clear User-Agent; throttle per domain.
- URL frontier (queue) + seen-set so restarts continue where they stopped (checkpointing).
- Separate: fetch -> parse -> store. Save raw HTML for debugging when affordable.
- Parsers per site/page type, with sample HTML fixtures in `src/app/tests/fixtures/` for tests.
- Validate and normalise extracted data; log and count failures instead of crashing.

**Phase outline (medium, 7):** 1 foundation + fetch one page -> 2 parser + fixtures -> 3 storage + schema
-> 4 frontier, dedupe, checkpoints -> 5 politeness, retries, proxies/JS rendering if needed -> 6 tests + monitoring
-> 7 scheduling + deployment + docs.

**Pitfalls:** layout changes break selectors (alert when yield drops); IP blocks; infinite URL spaces
(calendar links, filters) - cap depth and patterns.

**Deployment:** a VPS or container with cron/systemd/scheduler; logs and a "pages crawled / errors" summary.

---

## Telegram bot

**Typical stack:** Python 3 + `python-telegram-bot` or `aiogram` (async), SQLite/PostgreSQL,
long polling in development, webhook or polling on a small server in production.

**Ask at Kickoff:** commands and flows, who may use it (public/allowlist/admins), what user data is stored,
external APIs, expected number of users, languages.

**Key design points**
- Token in `.env` (from @BotFather); never commit it. Rotate if leaked.
- Handlers = thin; business logic in separate modules so it can be tested without Telegram.
- Persist state (conversation steps, settings) in the DB, not in memory.
- Rate limits: queue broadcast messages; handle `RetryAfter` errors.
- Admin commands guarded by user-ID allowlist; `/help`, `/start`, `/cancel` always present.

**Phase outline (small, 4):** 1 foundation + echo bot -> 2 core commands + DB -> 3 error handling, admin, tests
-> 4 deploy (systemd/Docker) + docs.
**Medium (6):** add payments/subscriptions, scheduled jobs, analytics, inline mode as separate phases.

**Pitfalls:** blocking calls inside async handlers; storing secrets in chat; no backup of the user DB.

**Deployment:** small VPS or container platform; restart-on-failure; log rotation; daily DB backup.

---

## ML model training

**Typical stack:** Python 3, `scikit-learn` for tabular data, `PyTorch` for deep learning (+ Hugging Face
`transformers` for text/vision fine-tuning), `pandas`/`numpy`, YAML config files, MLflow or simple CSV logs.

**Ask at Kickoff:** task and success metric, dataset (source, size, licence, labels), compute (CPU/GPU,
hours, budget), latency/size limits for serving, how the model will be used.

**Key design points**
- Baseline first (simple model) so progress is measurable.
- Reproducibility: fixed seeds, config file per run, record package versions and data version/hash.
- Proper splits (train/val/test), no leakage; evaluate on test once at the end.
- Training script accepts config; checkpoints saved; resumable.
- Keep data and weights outside the zip (record where they live in PRD section 6).
- Serving: simple `predict()` function -> CLI or FastAPI endpoint; add a model card (data, metrics, limits).

**Phase outline (medium, 7):** 1 foundation + data loading -> 2 data cleaning + EDA notes -> 3 baseline + metric
-> 4 main model training + tuning -> 5 evaluation + error analysis -> 6 inference API/CLI + tests -> 7 packaging, model card, docs.

**Pitfalls:** data leakage; overfitting to validation; unversioned data; GPU-only code with no CPU fallback.

**Deployment:** container with the model file mounted/downloaded; health endpoint; log inputs/outputs carefully (privacy).

---

## full-stack website / web app

**Simple defaults (pick one stack, do not mix many):**
- Python path: `FastAPI` (or Django for admin-heavy apps) + PostgreSQL + a light frontend (HTMX/Jinja or React).
- JavaScript path: `Next.js` (React) full-stack + PostgreSQL via Prisma/Drizzle, or Express + React.
Use SQLite for prototypes only.

**Ask at Kickoff:** pages/screens list, user roles, login method, data entities, payments?, file uploads?,
SEO needs, expected traffic, hosting preference.

**Key design points**
- Data model + migrations first; auth early; then one vertical slice at a time.
- Validate input on the server; hash passwords with a standard library (never roll your own).
- API design: consistent errors, pagination, versioning when public.
- Environment config via `.env`; separate dev/prod databases; automated backups.
- Accessibility + mobile layout from the first screen.

**Phase outline (medium, 8):** 1 foundation + hello page -> 2 DB schema + migrations -> 3 auth + roles
-> 4 main feature slice A -> 5 slice B -> 6 admin/dashboard + emails/notifications -> 7 tests + security + performance
-> 8 deploy (domain, HTTPS, backups, monitoring) + docs.
**Large:** split per module (billing, search, reports...), add beta + post-launch phases.

**Pitfalls:** building every page before auth/data are settled; secrets in the frontend bundle; no DB backups.

**Deployment:** managed platform or a VPS with Docker; HTTPS; DB backups; a staging copy if the budget allows.

---

## mobile app (Android / iOS)

**Simple defaults:** one codebase with `Flutter` (Dart) or `React Native` (TypeScript). Native
(`Kotlin` for Android, `Swift` for iOS) only for platform-heavy needs. Backend: your own API or a
managed backend (e.g. Firebase/Supabase) to avoid running servers.

**Ask at Kickoff:** platforms, screens and navigation, login, offline needs, push notifications,
device features (camera, GPS), payments, target store(s), who owns developer accounts.

**Key design points**
- Screens list and rough wireframes in PRD section 3 before building UI.
- Keep state management simple and consistent; separate UI from data access.
- Offline: decide what is cached, how conflicts resolve.
- Handle permissions gracefully; test on a real low-end device.
- Store release needs: app icons, screenshots, privacy policy, signing keys (keep keys safe, back them up!).

**Phase outline (medium, 7):** 1 foundation + navigation shell -> 2 backend/API + auth -> 3 core screens A
-> 4 core screens B -> 5 offline, notifications, device features -> 6 testing on devices + polish
-> 7 store release + docs.

**Pitfalls:** losing the signing key; ignoring different screen sizes; no crash reporting.

**Deployment:** internal test tracks first (Play Internal Testing / TestFlight), then public release.

---

## desktop application (Windows / Linux / macOS)

**Simple defaults:** `Tauri` (small, Rust core + web UI) or `Electron` (JS, easiest ecosystem) for
web-style UIs; `PyQt/PySide` or `Tkinter` for Python tools; `.NET MAUI/WPF` for Windows-only.

**Ask at Kickoff:** target OSes, offline use, local data location, installer vs portable, auto-update,
integration with files/hardware, licence/activation.

**Key design points**
- Store user data in the OS app-data folder; provide export/backup; migrate data formats carefully.
- Keep UI thin; put logic in testable modules; long tasks in background threads with progress + cancel.
- Logging to a file users can send you; clear error dialogs.
- Packaging early (Phase 2-3) so installer problems surface early.

**Phase outline (medium, 6):** 1 foundation + window opens -> 2 core logic + local storage -> 3 main screens
-> 4 settings, import/export, backups -> 5 packaging + auto-update + testing on each OS -> 6 docs + release.

**Pitfalls:** writing data next to the executable; no migration plan for stored data; signing/notarisation surprises.

**Deployment:** installers per OS (AppImage/.deb, .msi/.exe, .dmg) plus a release page.

---

## CLI tool / automation script / API service

**Simple defaults:** Python 3 (`argparse` or `typer`) or Node (`commander`); `FastAPI` when it must be an HTTP service;
cron/systemd timers for schedules.

**Ask at Kickoff:** inputs and outputs, commands/flags, how it is triggered (manual, schedule, webhook),
where it runs, how failures are reported.

**Key design points**
- Idempotent: running twice must not duplicate or damage anything. Offer `--dry-run`.
- Clear exit codes and readable errors; logs to a file.
- Config in a file/env, not hard-coded paths.
- Back up or move-to-trash instead of deleting.

**Phase outline (small, 3-4):** 1 foundation + one command -> 2 all commands + config + dry-run -> 3 tests + docs
-> 4 scheduling/packaging.

**Pitfalls:** destructive operations without confirmation; silent failures in scheduled runs.

**Deployment:** `pipx`/venv install, Docker image, or a scheduled job on a server.

---
