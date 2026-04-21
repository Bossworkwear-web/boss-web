#!/usr/bin/env bash
# Create a tarball next to this repo (../boss-web-backup-*.tar.gz) and mirror
# the project into Google Drive under My Drive/Boss_Web/ (see below).
#
# Optional env:
#   BACKUP_GOOGLE_DRIVE_ROOT  Absolute path to "My Drive" (if auto-detect fails)
#   BACKUP_DRIVE_SUBDIR       Under My Drive; default: Boss_Web

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_WEB="$(cd "$SCRIPT_DIR/.." && pwd)"
DEV_DIR="$(cd "$BOSS_WEB/.." && pwd)"
REPO_NAME="$(basename "$BOSS_WEB")"
SUBDIR="${BACKUP_DRIVE_SUBDIR:-Boss_Web}"

excludes=(--exclude='node_modules' --exclude='.next')

resolve_my_drive() {
  if [[ -n "${BACKUP_GOOGLE_DRIVE_ROOT:-}" ]]; then
    printf '%s' "$BACKUP_GOOGLE_DRIVE_ROOT"
    return
  fi
  local d
  # macOS — Google Drive for desktop
  for d in "$HOME/Library/CloudStorage"/GoogleDrive-*/My\ Drive; do
    if [[ -d "$d" ]]; then
      printf '%s' "$d"
      return
    fi
  done
  printf ''
}

MY_DRIVE="$(resolve_my_drive)"
TS="$(date +%Y%m%d-%H%M%S)"
TAR_NAME="boss-web-backup-${TS}.tar.gz"

cd "$DEV_DIR"
echo "==> Local tarball in $DEV_DIR"
rm -f boss-web-backup-*.tar.gz
tar "${excludes[@]}" -czf "$TAR_NAME" "$REPO_NAME"
echo "    Created $TAR_NAME ($(du -h "$TAR_NAME" | awk '{print $1}'))"

if [[ -z "$MY_DRIVE" ]]; then
  echo "==> Google Drive 'My Drive' not found." >&2
  echo "    Set BACKUP_GOOGLE_DRIVE_ROOT to the full path of your My Drive folder." >&2
  echo "    Local backup only: $DEV_DIR/$TAR_NAME" >&2
  exit 0
fi

DEST_ROOT="$MY_DRIVE/$SUBDIR"
ARCH_DIR="$DEST_ROOT/archives"
mkdir -p "$ARCH_DIR"

echo "==> Google Drive: $DEST_ROOT"
rm -f "$ARCH_DIR"/boss-web-backup-*.tar.gz
cp "$DEV_DIR/$TAR_NAME" "$ARCH_DIR/"
echo "    Copied tarball to $ARCH_DIR/$TAR_NAME"

mkdir -p "$DEST_ROOT/boss-web"
echo "==> Rsync working tree -> $DEST_ROOT/boss-web/"
rsync -a --delete "${excludes[@]}" "$BOSS_WEB/" "$DEST_ROOT/boss-web/"
echo "    Done."
