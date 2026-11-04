# AGENTS.md - rules for any AI agent or developer

Default environment: **Ubuntu, bash, VS Code integrated terminal**. Ask if the human says otherwise.

## Read order (every session)
1. `src/AGENTS.md` (this file)  2. `src/PRD.md`  3. `src/PHASES.md`
4. `src/PLAYBOOKS.md` - only the section(s) for this project's type.

## Terminal protocol (mandatory - at Kickoff and at the start of EVERY phase/session)
1. **Ask first:** "In your VS Code terminal run `pwd && ls` and paste the output." Do not give any
   command before you have it. Ask again if the human says they moved folders or opened a new terminal.
2. **Commands start at step 1.** Number every step from 1, even if it feels obvious. Step 1 is
   always getting to the right folder (`cd` computed from the pasted `pwd`; say when it is already correct).
3. **Complete and in order:** folder -> environment (venv / node version) -> install -> run -> test.
   Never write "run the usual commands" or assume earlier state.
4. **Format:** one short code block per step (1-3 commands), then one line saying what a
   good result looks like. Use paths relative to the pasted `pwd`, or absolute paths.
5. If a command fails, ask for the full error text, then give corrected commands again **from step 1**
   of the affected part.
6. Record the verified run/test commands in the "Project state" block of `src/PHASES.md`.

## Working rules
- **One phase at a time.** Work only on the phase named (or the first not COMPLETED).
- **Confirm before coding.** Restate the phase goal and tasks in 3-5 lines; ask about anything
  unclear in the PRD instead of guessing on big decisions.
- **Keep it simple.** Boring, well-known tools; fewest moving parts that meet the acceptance criteria.
- **Protect data.** Never delete or overwrite user data/files without a backup or explicit confirmation.
- **No secrets in code.** Use environment variables and keep `.env.example` current.
- **Code goes in `src/app/`.** Documents stay in `src/`.
- **Every phase ends runnable**, or the phase notes say exactly why not.
- **Be honest.** Untested or partial work is not COMPLETED - say so in the notes.

## When a phase is finished (mandatory)
1. Tick finished tasks in that phase of `src/PHASES.md`; set `**Status:** COMPLETED (YYYY-MM-DD)`;
   fill "Completed on" and "Notes / deviations".
2. Update the "Project state" block in `src/PHASES.md` (current phase, how to run, how to test, next).
3. **Tech stack changed?** Update the Tech stack table in `src/PRD.md`, add a row to the change log,
   and fix every other PRD section that mentions the old tech.
4. Scope changed? Update PRD sections 2-3 and affected future phases.
5. Run `bash tools/check.sh` and fix any FAIL lines.
6. Reply with a **short** summary: what was done, the numbered terminal commands (per the protocol),
   what the next phase is.
7. Deliver the whole project as a zip with the **same structure** (do not rename or move
   `README.md`, `src/`, `tools/`).

## Status values (exactly these)
`NOT STARTED` | `IN PROGRESS` | `BLOCKED` | `COMPLETED (YYYY-MM-DD)`

## Kickoff (Phase 0)
Terminal protocol first. Then ask at most 8 short questions, propose the simplest stack
(use PLAYBOOKS.md), fill every `<<fill>>` in the PRD, decide Small/Medium/Large, rewrite the phase
list in `src/PHASES.md`, and write no application code until the human approves.
