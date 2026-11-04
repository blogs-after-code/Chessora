#!/usr/bin/env bash
# tools/handoff.sh - make a clean zip of this whole project to give to an AI chat or agent.
#   bash tools/handoff.sh
# Excludes: .git, .env, node_modules, virtualenvs, build output, caches, big model files.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="$(basename "$ROOT")"
STAMP="$(date +%Y%m%d-%H%M)"
OUT="$(dirname "$ROOT")/${NAME}-${STAMP}.zip"

if [ -f "$ROOT/tools/check.sh" ]; then
  bash "$ROOT/tools/check.sh" || echo "(check reported failures - zip will still be created)"
fi

python3 - "$ROOT" "$OUT" <<'PY'
import os, sys, zipfile
root, out = sys.argv[1], sys.argv[2]
skip_dirs = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build",
             ".idea", ".vscode", ".next", "target", "downloads", ".pytest_cache"}
skip_files = {".env", ".DS_Store"}
skip_ext = (".pyc", ".pt", ".bin", ".ckpt", ".sqlite3", ".log")
top = os.path.basename(root)
count = 0
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for base, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in skip_dirs)
        for fn in sorted(files):
            if fn in skip_files or fn.endswith(skip_ext):
                continue
            full = os.path.join(base, fn)
            arc = os.path.join(top, os.path.relpath(full, root))
            zi = zipfile.ZipInfo.from_file(full, arc)
            zi.compress_type = zipfile.ZIP_DEFLATED
            with open(full, "rb") as f:
                z.writestr(zi, f.read())
            count += 1
print("Zipped %d files" % count)
PY
echo "Created: $OUT"
