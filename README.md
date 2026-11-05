# project-template-type-pack

One folder you hand to an AI agent (or a developer) to build any project **phase by phase**:
downloaders, crawlers, bots, ML, websites, mobile and desktop apps, tools.

```
project-template-type-pack/
  README.md            <- this file
  src/
    AGENTS.md          <- rules for the AI / developer (read first)
    PRD.md             <- what we build, tech stack, API plan, deployment plan
    PHASES.md          <- phase-wise plan + live status (updated after every phase)
    PLAYBOOKS.md       <- stack + phase advice per project type
    app/               <- your code
  tools/
    check.sh           <- health check
    handoff.sh         <- clean zip to send back to the AI
  .gitignore  .env.example
```

## Use it (4 steps)
1. **Unzip** it somewhere, open the folder in VS Code (`File > Open Folder`), then open the
   terminal from the menu: **Terminal > New Terminal**.
2. **Kickoff** - attach the zip to a chat and send:
   > Read src/AGENTS.md. Project idea: <3-8 lines>. Start Phase 0 (Kickoff).
3. **Each phase** - send:
   > Read src/AGENTS.md. Do Phase N. Return the updated project as a zip.
4. **Replace** your folder with the returned zip (or copy `src/` and `tools/` over it) and
   follow the commands the AI gives you, step by step.

## What the AI always does first
Before giving any command it asks you to run `pwd && ls` in your VS Code terminal and paste
the result. Then it gives you commands **from step 1** (including `cd` to the right place),
written for exactly where you are. Default environment: **Ubuntu, bash, VS Code terminal**
(tell it if that changes).

## Rules that keep it healthy
- Finished phase -> its section in `src/PHASES.md` is marked `COMPLETED (date)`, tasks ticked.
- Tech stack change -> `src/PRD.md` updated in the same step (table + change log).
- Optional safety net: `git init && git add -A && git commit -m "baseline"`, then commit after
  every phase.

Useful: `bash tools/check.sh` (is everything consistent?) and `bash tools/handoff.sh`
(makes a clean zip without `.env`, `node_modules`, venvs).

Template version 2.0 (2026-11-04)

---

## Chessora - run it
Requires Node 20 or newer (tested target: Node 24). Start from the project folder
(the one that contains `README.md`, `src/` and `tools/`).

1. Go to the app folder:
   ```bash
   cd src/app
   ```
2. Install dependencies (needs internet; run it again after every update, Phase 4 added the Stockfish engine package):
   ```bash
   npm install
   ```
3. Optional: copy the settings file (only needed to change the port):
   ```bash
   cp ../../.env.example ../../.env
   ```
4. Start the server, then open http://localhost:3000 :
   ```bash
   npm start
   ```
   Good result: the terminal prints `Database migrations applied: ...` when the database is new or
   updated, then
   `Chessora running at http://localhost:3000`. The page shows a chessboard, a green "Server: ok"
   badge, and Log in / Sign up links. Your local database is `src/app/data/chessora.db` (git-ignored;
   copy it somewhere safe if you care about the accounts in it).
5. Run the tests (in a second terminal, also inside `src/app`):
   ```bash
   npm test
   ```
   Good result: `# fail 0` (the summary shows how many tests passed).

### Analysing a game (Phase 4)
Open a game from the library, choose a depth (12 is a good start) and press **Analyse game**. The
chess engine runs inside your browser, so it needs no extra setup and costs nothing. Every move gets
a label (best ... blunder), mistakes show a blue arrow with the engine's preferred move, and the
result is saved with the game, so it opens instantly next time.
