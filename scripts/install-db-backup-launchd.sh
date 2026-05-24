#!/usr/bin/env bash
# Install daily launchd DB backup (runs at 02:00; avoids macOS Desktop TCC by using ~/Library).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_WEB="$(cd "$SCRIPT_DIR/.." && pwd)"
SUPPORT_DIR="$HOME/Library/Application Support/BossWorkwear"
SCRIPTS_DIR="$HOME/Library/Scripts"
PLIST_SRC="$SCRIPT_DIR/com.bossworkwear.supabase-db-backup.plist.example"
PLIST_DST="$HOME/Library/LaunchAgents/com.bossworkwear.supabase-db-backup.plist"
RUNNER="$SCRIPTS_DIR/bossworkwear-supabase-db-backup.sh"
LABEL="com.bossworkwear.supabase-db-backup"

mkdir -p "$SUPPORT_DIR" "$SCRIPTS_DIR" "$(dirname "$PLIST_DST")"
chmod 700 "$SUPPORT_DIR"

cp "$SCRIPT_DIR/backup-supabase-db.sh" "$SUPPORT_DIR/backup-supabase-db.sh"
chmod 700 "$SUPPORT_DIR/backup-supabase-db.sh"

# Seed launchd env from boss-web/.env.local when present.
if [[ -f "$BOSS_WEB/.env.local" ]]; then
  line="$(grep -E '^SUPABASE_DB_DIRECT_URL=' "$BOSS_WEB/.env.local" | tail -1 || true)"
  if [[ -n "$line" ]]; then
    umask 077
    printf '%s\n' "$line" > "$SUPPORT_DIR/db-backup.env"
  fi
fi

cat > "$RUNNER" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/opt/libpq/bin:/usr/local/opt/libpq/bin:${PATH:-}"
export BACKUP_EXTERNAL_ROOT="${BACKUP_EXTERNAL_ROOT:-/Volumes/External 4T HD/Boss Workwear}"
export BACKUP_DB_KEEP="${BACKUP_DB_KEEP:-8}"
export BACKUP_CONFIG_DIR="${BACKUP_CONFIG_DIR:-$HOME/Library/Application Support/BossWorkwear}"
exec bash "$BACKUP_CONFIG_DIR/backup-supabase-db.sh"
EOF
chmod 700 "$RUNNER"

cat > "$PLIST_DST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>${RUNNER}</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key>
      <integer>2</integer>
      <key>Minute</key>
      <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/bossworkwear-supabase-db-backup.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/bossworkwear-supabase-db-backup.err.log</string>
  </dict>
</plist>
EOF

USER_ID="$(id -u)"
launchctl bootout "gui/${USER_ID}/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/${USER_ID}" "$PLIST_DST"
launchctl enable "gui/${USER_ID}/${LABEL}"

echo "==> Installed daily DB backup (02:00)"
echo "    Runner: $RUNNER"
echo "    Script: $SUPPORT_DIR/backup-supabase-db.sh"
echo "    Env:    $SUPPORT_DIR/db-backup.env"
echo "    Plist:  $PLIST_DST"
echo ""
echo "Test now: launchctl start ${LABEL}"
