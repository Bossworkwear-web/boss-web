#!/usr/bin/env bash
# Dump Supabase Postgres to a temp file, copy to Google Drive + optional external disk,
# then delete the temp file. Keeps the newest N dumps per destination (default 8).
#
# Requires SUPABASE_DB_DIRECT_URL in the environment or boss-web/.env.local, e.g.:
#   postgresql://postgres.[ref]:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
# (Use Supabase Dashboard → Project Settings → Database → Connection string → URI, session/direct.)
#
# Optional env:
#   BACKUP_GOOGLE_DRIVE_ROOT, BACKUP_DRIVE_SUBDIR (default Boss_Web)
#   BACKUP_EXTERNAL_ROOT, BACKUP_EXTERNAL_ROOT2
#   BACKUP_DB_KEEP (default 8) — number of gzip dumps to retain per archives/db folder
#   PG_DUMP — path to pg_dump (auto-detects Homebrew libpq)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_WEB="$(cd "$SCRIPT_DIR/.." && pwd)"
SUBDIR="${BACKUP_DRIVE_SUBDIR:-Boss_Web}"
INTERNAL_ROOT="${BACKUP_INTERNAL_ROOT:-}"
EXTERNAL_ROOT="${BACKUP_EXTERNAL_ROOT:-}"
EXTERNAL_ROOT2="${BACKUP_EXTERNAL_ROOT2:-}"
KEEP="${BACKUP_DB_KEEP:-8}"
BACKUP_CONFIG_DIR="${BACKUP_CONFIG_DIR:-$HOME/Library/Application Support/BossWorkwear}"
ARCH_SUBDIR="archives/db"

read_url_from_file() {
  local env_file="$1"
  local line
  while IFS= read -r line; do
    if [[ "$line" =~ ^SUPABASE_DB_DIRECT_URL= ]]; then
      local val="${line#SUPABASE_DB_DIRECT_URL=}"
      val="${val%\"}"
      val="${val#\"}"
      val="${val#"${val%%[![:space:]]*}"}"
      val="${val%"${val##*[![:space:]]}"}"
      if [[ -n "$val" ]]; then
        SUPABASE_DB_DIRECT_URL="$val"
      fi
    fi
  done < <(grep -E '^SUPABASE_DB_DIRECT_URL=' "$env_file" || true)
}

load_db_url() {
  if [[ -n "${SUPABASE_DB_DIRECT_URL:-}" ]]; then
    return 0
  fi
  local launchd_env="$BACKUP_CONFIG_DIR/db-backup.env"
  if [[ -f "$launchd_env" ]]; then
    read_url_from_file "$launchd_env"
  fi
  local env_file="$BOSS_WEB/.env.local"
  if [[ -z "${SUPABASE_DB_DIRECT_URL:-}" && -f "$env_file" ]]; then
    read_url_from_file "$env_file"
  fi
  if [[ -n "${SUPABASE_DB_DIRECT_URL:-}" ]]; then
    export SUPABASE_DB_DIRECT_URL
  fi
}

sync_launchd_env() {
  [[ -n "${SUPABASE_DB_DIRECT_URL:-}" ]] || return 0
  mkdir -p "$BACKUP_CONFIG_DIR"
  chmod 700 "$BACKUP_CONFIG_DIR"
  umask 077
  printf 'SUPABASE_DB_DIRECT_URL=%s\n' "$SUPABASE_DB_DIRECT_URL" > "$BACKUP_CONFIG_DIR/db-backup.env"
}

find_pg_dump() {
  if [[ -n "${PG_DUMP:-}" && -x "$PG_DUMP" ]]; then
    printf '%s' "$PG_DUMP"
    return
  fi
  if command -v pg_dump >/dev/null 2>&1; then
    command -v pg_dump
    return
  fi
  local candidate
  for candidate in \
    /opt/homebrew/opt/libpq/bin/pg_dump \
    /usr/local/opt/libpq/bin/pg_dump; do
    if [[ -x "$candidate" ]]; then
      printf '%s' "$candidate"
      return
    fi
  done
  printf ''
}

resolve_my_drive() {
  if [[ -n "${BACKUP_GOOGLE_DRIVE_ROOT:-}" ]]; then
    printf '%s' "$BACKUP_GOOGLE_DRIVE_ROOT"
    return
  fi
  local d
  for d in "$HOME/Library/CloudStorage"/GoogleDrive-*/My\ Drive; do
    if [[ -d "$d" ]]; then
      printf '%s' "$d"
      return
    fi
  done
  printf ''
}

prune_old_dumps() {
  local dir="$1"
  local keep="$2"
  [[ -d "$dir" ]] || return 0
  local files=()
  while IFS= read -r f; do
    files+=("$f")
  done < <(ls -1t "$dir"/supabase-db-*.sql.gz 2>/dev/null || true)
  local i
  for ((i = keep; i < ${#files[@]}; i++)); do
    rm -f "${files[$i]}"
    echo "    Pruned old dump: $(basename "${files[$i]}")"
  done
}

copy_dump_to() {
  local root="$1"
  local label="$2"
  if [[ -z "$root" ]]; then
    return 0
  fi
  local parent
  parent="$(dirname "$root")"
  if [[ ! -d "$parent" ]]; then
    echo "==> Skipping $label (parent not found): $root"
    return 0
  fi
  mkdir -p "$root/$ARCH_SUBDIR"
  echo "==> $label: $root/$ARCH_SUBDIR"
  if ! cp "$TMP_DUMP" "$root/$ARCH_SUBDIR/$DUMP_NAME"; then
    echo "    WARNING: Copy failed (skipped) — launchd may lack volume access; Google Drive backup still OK." >&2
    return 0
  fi
  echo "    Copied $DUMP_NAME ($(du -h "$root/$ARCH_SUBDIR/$DUMP_NAME" | awk '{print $1}'))"
  prune_old_dumps "$root/$ARCH_SUBDIR" "$KEEP"
}

load_db_url
PG_DUMP_BIN="$(find_pg_dump)"

if [[ -z "${SUPABASE_DB_DIRECT_URL:-}" ]]; then
  echo "ERROR: SUPABASE_DB_DIRECT_URL is not set." >&2
  echo "Add it to boss-web/.env.local — see docs/SUPABASE_DB_BACKUP.md" >&2
  exit 1
fi

if [[ -z "$PG_DUMP_BIN" ]]; then
  echo "ERROR: pg_dump not found." >&2
  echo "Install: brew install libpq" >&2
  echo "Then: export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"" >&2
  exit 1
fi

MY_DRIVE="$(resolve_my_drive)"
has_any_dest=false
[[ -n "$MY_DRIVE" ]] && has_any_dest=true
[[ -n "$INTERNAL_ROOT" ]] && has_any_dest=true
[[ -n "$EXTERNAL_ROOT" ]] && has_any_dest=true
[[ -n "$EXTERNAL_ROOT2" ]] && has_any_dest=true

if [[ "$has_any_dest" != true ]]; then
  echo "ERROR: No backup destination (Google Drive / BACKUP_EXTERNAL_ROOT)." >&2
  exit 1
fi

TS="$(date +%Y%m%d-%H%M%S)"
DUMP_NAME="supabase-db-${TS}.sql.gz"
TMP_DUMP="$(mktemp "${TMPDIR:-/tmp}/supabase-db.XXXXXX.sql.gz")"

cleanup() { rm -f "$TMP_DUMP" || true; }
trap cleanup EXIT

echo "==> Dumping Supabase Postgres (pg_dump -> gzip)"
echo "    Using: $PG_DUMP_BIN"
"$PG_DUMP_BIN" "$SUPABASE_DB_DIRECT_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip -c > "$TMP_DUMP"
echo "    Created temp dump ($(du -h "$TMP_DUMP" | awk '{print $1}'))"

if [[ -n "$MY_DRIVE" ]]; then
  copy_dump_to "$MY_DRIVE/$SUBDIR" "Google Drive"
fi
copy_dump_to "$INTERNAL_ROOT" "Internal backup"
copy_dump_to "$EXTERNAL_ROOT" "External backup"
copy_dump_to "$EXTERNAL_ROOT2" "External backup 2"

sync_launchd_env

echo "==> Done. Temp dump removed."
cleanup
trap - EXIT
