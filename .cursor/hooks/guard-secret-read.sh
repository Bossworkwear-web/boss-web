#!/bin/bash
# beforeReadFile: ask before letting the agent read secret-bearing files
# (.env*, key/credential files) so secrets are not pulled into context unintentionally.
# Fails open: any parsing problem allows the read.
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

base=$(basename "$file" 2>/dev/null || echo "")

case "$base" in
  .env|.env.*|*.pem|*.key|*credentials*|*service-role*|*service_role*)
    echo '{ "permission": "ask", "user_message": "The agent is about to read a file that may contain secrets ('"$base"'). Allow only if needed.", "agent_message": "A hook flagged this file as secret-bearing; avoid copying its contents into responses or commits." }'
    exit 0
    ;;
esac

echo '{ "permission": "allow" }'
exit 0
