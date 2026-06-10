#!/usr/bin/env bash
# Push Supabase URL + keys from boss-web/.env.local to the linked Vercel project, then remind you to rebuild.
#
# Prerequisites:
#   - npx vercel link (project boss-web)
#   - .env.local with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
#
# Usage:
#   bash scripts/sync-vercel-supabase-env.sh
#   npm run sync:vercel-supabase-env

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
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
)

cd "$BOSS_WEB"

if [[ ! -d .vercel ]]; then
  echo "==> Linking Vercel project (boss-web)…"
  $VERCEL_BIN link --yes --project boss-web
fi

for key in "${KEYS[@]}"; do
  val="$(read_env "$key")"
  for target in production preview; do
    printf '%s' "$val" | $VERCEL_BIN env update "$key" "$target" --yes
    echo "    Updated $key ($target)"
  done
done

echo ""
echo "==> Done. Vercel env updated."
echo "    IMPORTANT: push a commit to main (or run a fresh Vercel build) so NEXT_PUBLIC_* keys are baked into the new deployment."
echo "    Redeploy-only reuses an old build and may still show empty categories."
echo ""
echo "    git commit --allow-empty -m \"Rebuild after Supabase env sync\" && git push origin main"
