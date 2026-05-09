#!/usr/bin/env bash
# Create a tarball in a temp dir (not next to the repo), copy it to Google Drive
# and optionally to an external disk, then remove the local tarball.
# Also rsyncs the working tree to My Drive/Boss_Web/boss-web/ and the external path.
#
# Optional env:
#   BACKUP_GOOGLE_DRIVE_ROOT  Absolute path to "My Drive" (if auto-detect fails)
#   BACKUP_DRIVE_SUBDIR       Under My Drive; default: Boss_Web
#   BACKUP_EXTERNAL_ROOT      e.g. /Volumes/External 4T HD/Boss Workwear

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_WEB="$(cd "$SCRIPT_DIR/.." && pwd)"
DEV_DIR="$(cd "$BOSS_WEB/.." && pwd)"
REPO_NAME="$(basename "$BOSS_WEB")"
SUBDIR="${BACKUP_DRIVE_SUBDIR:-Boss_Web}"
EXTERNAL_ROOT="${BACKUP_EXTERNAL_ROOT:-}"

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
TMP_TAR="$(mktemp "${TMPDIR:-/tmp}/boss-web-backup.XXXXXX.tar.gz")"

echo "==> Tarball (temporary): $TMP_TAR"
cd "$DEV_DIR"
tar "${excludes[@]}" -czf "$TMP_TAR" "$REPO_NAME"
echo "    Created ($(du -h "$TMP_TAR" | awk '{print $1}'))"

# Remove legacy tarball next to dev/ (older script behaviour)
rm -f "$DEV_DIR"/boss-web-backup-*.tar.gz || true

cleanup_tar() { rm -f "$TMP_TAR" || true; }
trap cleanup_tar EXIT

if [[ -z "$MY_DRIVE" && -z "$EXTERNAL_ROOT" ]]; then
  echo "==> No destinations: Google Drive not found and BACKUP_EXTERNAL_ROOT unset." >&2
  echo "    Set BACKUP_GOOGLE_DRIVE_ROOT and/or BACKUP_EXTERNAL_ROOT." >&2
  exit 1
fi

if [[ -n "$MY_DRIVE" ]]; then
  DEST_ROOT="$MY_DRIVE/$SUBDIR"
  ARCH_DIR="$DEST_ROOT/archives"
  mkdir -p "$ARCH_DIR"

  echo "==> Google Drive: $DEST_ROOT"
  rm -f "$ARCH_DIR"/boss-web-backup-*.tar.gz
  cp "$TMP_TAR" "$ARCH_DIR/$TAR_NAME"
  echo "    Copied tarball to $ARCH_DIR/$TAR_NAME"

  mkdir -p "$DEST_ROOT/boss-web"
  echo "==> Rsync working tree -> $DEST_ROOT/boss-web/"
  rsync -a --delete "${excludes[@]}" "$BOSS_WEB/" "$DEST_ROOT/boss-web/"
  echo "    Done (Drive)."
fi

if [[ -n "$EXTERNAL_ROOT" ]]; then
  if [[ ! -d "$EXTERNAL_ROOT" ]]; then
    echo "==> BACKUP_EXTERNAL_ROOT is not a directory: $EXTERNAL_ROOT" >&2
    exit 1
  fi
  EXT_ARCH="$EXTERNAL_ROOT/archives"
  mkdir -p "$EXT_ARCH"
  echo "==> External: $EXTERNAL_ROOT"
  rm -f "$EXT_ARCH"/boss-web-backup-*.tar.gz
  cp "$TMP_TAR" "$EXT_ARCH/$TAR_NAME"
  echo "    Copied tarball to $EXT_ARCH/$TAR_NAME"
  mkdir -p "$EXTERNAL_ROOT/boss-web"
  echo "==> Rsync working tree -> $EXTERNAL_ROOT/boss-web/"
  rsync -a --delete "${excludes[@]}" "$BOSS_WEB/" "$EXTERNAL_ROOT/boss-web/"
  echo "    Done (external)."
fi

echo "==> Removed temporary tarball."
cleanup_tar
trap - EXIT
