#!/bin/bash
# afterFileEdit: auto-fix lint issues on edited JS/TS files using the project's ESLint.
# Fails open: never blocks the edit. jq is not assumed; node parses stdin.
set -euo pipefail

input=$(cat)

file=$(printf '%s' "$input" | node -e '
  let s = "";
  process.stdin.on("data", d => s += d);
  process.stdin.on("end", () => {
    try {
      const j = JSON.parse(s || "{}");
      process.stdout.write(j.file_path || j.filePath || j.path || "");
    } catch (e) {
      process.stdout.write("");
    }
  });
' 2>/dev/null || true)

# Only act on real source files we lint.
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

[ -f "$file" ] || exit 0

ESLINT="node_modules/.bin/eslint"
[ -x "$ESLINT" ] || exit 0

# Quiet, best-effort autofix. Never fail the edit on lint findings.
"$ESLINT" --fix "$file" >/dev/null 2>&1 || true
exit 0
