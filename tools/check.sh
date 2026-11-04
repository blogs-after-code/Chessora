#!/usr/bin/env bash
# tools/check.sh - quick health check for the template. Run from anywhere:
#   bash tools/check.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
fail=0; warn=0
ok()  { echo "  OK   $1"; }
bad() { echo "  FAIL $1"; fail=$((fail+1)); }
wr()  { echo "  WARN $1"; warn=$((warn+1)); }

echo "== Required files =="
for f in src/AGENTS.md src/PRD.md src/PHASES.md src/PLAYBOOKS.md; do
  if [ -f "$f" ]; then ok "$f"; else bad "$f is missing"; fi
done
if [ -d src/app ]; then ok "src/app/"; else wr "src/app/ is missing (code folder)"; fi

echo "== Phase status =="
if [ -f src/PHASES.md ]; then
  total=$(grep -c '^\*\*Status:\*\*' src/PHASES.md)
  completed=$(grep -c '^\*\*Status:\*\* COMPLETED' src/PHASES.md)
  inprog=$(grep -c '^\*\*Status:\*\* IN PROGRESS' src/PHASES.md)
  blocked=$(grep -c '^\*\*Status:\*\* BLOCKED' src/PHASES.md)
  echo "  phases: $total | completed: $completed | in progress: $inprog | blocked: $blocked"
  if [ "$total" -lt 2 ]; then bad "fewer than 2 phases found"; else ok "$total phases found"; fi
  if [ "$total" -gt 18 ]; then wr "more than 18 phases - consider merging"; fi
  if [ "$inprog" -gt 1 ]; then wr "more than one phase is IN PROGRESS"; fi
  if grep -E '^\*\*Status:\*\* COMPLETED' src/PHASES.md | grep -qv 'COMPLETED ([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\})'; then
    wr "a COMPLETED phase has no date, use COMPLETED (YYYY-MM-DD)"
  fi
  # a COMPLETED phase must not have unticked tasks
  bad_phases=$(awk '
    function flush() { if (name != "" && status ~ /^COMPLETED/ && open > 0) print "    - " name " (" open " unticked task(s))" }
    /^### Phase/ { flush(); name=$0; status=""; open=0; next }
    /^\*\*Status:\*\*/ { status=$0; sub(/^\*\*Status:\*\* */, "", status); next }
    /^- \[ \]/ { open++ }
    END { flush() }
  ' src/PHASES.md)
  if [ -n "$bad_phases" ]; then
    bad "COMPLETED phases that still have unticked tasks:"; echo "$bad_phases"
  else
    ok "completed phases have all tasks ticked"
  fi
fi

echo "== PRD =="
if [ -f src/PRD.md ]; then
  left=$(grep -c '<<fill' src/PRD.md)
  if [ "$left" -gt 0 ]; then wr "PRD still has $left unfilled <<fill>> marker(s)"; else ok "PRD has no unfilled markers"; fi
  if grep -q 'Tech stack change log' src/PRD.md; then ok "tech stack change log present"; else wr "PRD has no tech stack change log section"; fi
fi

echo "== Project state =="
if [ -f src/PHASES.md ]; then
  st=$(grep -c '<<fill' src/PHASES.md)
  if [ "$st" -gt 0 ]; then wr "PHASES.md Project state has $st unfilled <<fill>> marker(s) (expected before Kickoff ends)"; else ok "Project state filled in"; fi
fi

echo "== Safety =="
if find . -name '.env' -not -path './.git/*' | grep -q .; then
  wr ".env file present - do not share it inside a zip (tools/handoff.sh excludes it)"
else
  ok "no .env file found"
fi

echo
echo "Result: $fail failure(s), $warn warning(s)"
if [ "$fail" -gt 0 ]; then exit 1; fi
exit 0
