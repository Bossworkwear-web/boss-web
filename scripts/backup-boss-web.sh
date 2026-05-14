#!/usr/bin/env bash
# Create a tarball in a temp dir (not next to the repo), copy it to Google Drive
# and optionally to one or two external disks, then remove the local tarball.
# Also rsyncs the working tree to My Drive/Boss_Web/boss-web/ and each external path.
#
# Optional env:
#   BACKUP_GOOGLE_DRIVE_ROOT   Absolute path to "My Drive" (if auto-detect fails)
#   BACKUP_DRIVE_SUBDIR        Under My Drive; default: Boss_Web
#   BACKUP_EXTERNAL_ROOT       e.g. /Volumes/External 4T HD/Boss Workwear
#   BACKUP_EXTERNAL_ROOT2      Second disk, e.g. /Volumes/ESD-USB/Boss Workwear

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_WEB="$(cd "$SCRIPT_DIR/.." && pwd)"
DEV_DIR="$(cd "$BOSS_WEB/.." && pwd)"
REPO_NAME="$(basename "$BOSS_WEB")"
SUBDIR="${BACKUP_DRIVE_SUBDIR:-Boss_Web}"
EXTERNAL_ROOT="${BACKUP_EXTERNAL_ROOT:-}"
EXTERNAL_ROOT2="${BACKUP_EXTERNAL_ROOT2:-}"

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

has_any_external=false
[[ -n "$EXTERNAL_ROOT" ]] && has_any_external=true
[[ -n "$EXTERNAL_ROOT2" ]] && has_any_external=true

if [[ -z "$MY_DRIVE" && "$has_any_external" != true ]]; then
  echo "==> No destinations: Google Drive not found and no BACKUP_EXTERNAL_ROOT / BACKUP_EXTERNAL_ROOT2." >&2
  echo "    Set BACKUP_GOOGLE_DRIVE_ROOT and/or BACKUP_EXTERNAL_ROOT (and optional BACKUP_EXTERNAL_ROOT2)." >&2
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

backup_to_external() {
  local root="$1"
  if [[ -z "$root" ]]; then
    return 0
  fi
  local parent
  parent="$(dirname "$root")"
  if [[ ! -d "$parent" ]]; then
    echo "==> Skipping external (volume not mounted): $root"
    return 0
  fi
  mkdir -p "$root"
  local ext_arch="$root/archives"
  mkdir -p "$ext_arch"
  echo "==> External: $root"
  rm -f "$ext_arch"/boss-web-backup-*.tar.gz
  cp "$TMP_TAR" "$ext_arch/$TAR_NAME"
  echo "    Copied tarball to $ext_arch/$TAR_NAME"
  mkdir -p "$root/boss-web"
  echo "==> Rsync working tree -> $root/boss-web/"
  rsync -a --delete "${excludes[@]}" "$BOSS_WEB/" "$root/boss-web/"
  echo "    Done (external: $root)."
}

backup_to_external "$EXTERNAL_ROOT"
backup_to_external "$EXTERNAL_ROOT2"

echo "==> Removed temporary tarball."
cleanup_tar
trap - EXIT
