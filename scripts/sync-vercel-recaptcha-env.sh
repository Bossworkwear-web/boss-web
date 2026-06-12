#!/usr/bin/env bash
# Push reCAPTCHA keys from boss-web/.env.local to the linked Vercel project.
#
# Usage:
#   bash scripts/sync-vercel-recaptcha-env.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_WEB="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$BOSS_WEB/.env.local"
VERCEL_BIN="${VERCEL_BIN:-npx --yes vercel@54.11.1}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found." >&2
  exit 1
fi

read_env() {
  local key="$1"
  local line val
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -1 || true)"
  if [[ -z "$line" ]]; then
    echo "ERROR: ${key} missing in .env.local" >&2
    exit 1
  fi
  val="${line#${key}=}"
  if [[ "$val" == \"*\" && "$val" == *\" ]]; then val="${val:1:${#val}-2}"; fi
  if [[ "$val" == \'*\' && "$val" == *\' ]]; then val="${val:1:${#val}-2}"; fi
  printf '%s' "$val"
}

KEYS=(
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  RECAPTCHA_SECRET_KEY
)

cd "$BOSS_WEB"

if [[ ! -d .vercel ]]; then
  echo "==> Linking Vercel project (boss-web)…"
  $VERCEL_BIN link --yes --project boss-web
fi

for key in "${KEYS[@]}"; do
  val="$(read_env "$key")"
  for target in production preview; do
    if $VERCEL_BIN env ls "$target" 2>/dev/null | grep -q "^ ${key} "; then
      printf '%s' "$val" | $VERCEL_BIN env update "$key" "$target" --yes
      echo "    Updated $key ($target)"
    else
      printf '%s' "$val" | $VERCEL_BIN env add "$key" "$target" --yes
      echo "    Added $key ($target)"
    fi
  done
done

echo ""
echo "==> Done. Redeploy production so NEXT_PUBLIC_RECAPTCHA_SITE_KEY is baked into the build."
