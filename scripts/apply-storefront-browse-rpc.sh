#!/usr/bin/env bash
# Apply storefront browse view + get_storefront_browse_rows RPC.
# Requires SUPABASE_DB_DIRECT_URL in boss-web/.env.local or environment.
#
# Usage:
#   bash scripts/apply-storefront-browse-rpc.sh
#   bash scripts/apply-storefront-browse-rpc.sh --dry-run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_WEB="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATION="$BOSS_WEB/supabase/migrations/20260605_storefront_browse_rpc.sql"
DRY_RUN=0

for arg in "$@"; do
  if [[ "$arg" == "--dry-run" ]]; then
    DRY_RUN=1
  fi
done

if [[ ! -f "$MIGRATION" ]]; then
  echo "Missing migration: $MIGRATION" >&2
  exit 1
fi

if [[ -z "${SUPABASE_DB_DIRECT_URL:-}" ]] && [[ -f "$BOSS_WEB/.env.local" ]]; then
  while IFS= read -r line; do
    if [[ "$line" =~ ^SUPABASE_DB_DIRECT_URL= ]]; then
      val="${line#SUPABASE_DB_DIRECT_URL=}"
      val="${val%\"}"
      val="${val#\"}"
      val="${val#"${val%%[![:space:]]*}"}"
      val="${val%"${val##*[![:space:]]}"}"
      if [[ -n "$val" ]]; then
        SUPABASE_DB_DIRECT_URL="$val"
      fi
    fi
  done < "$BOSS_WEB/.env.local"
fi

if [[ -z "${SUPABASE_DB_DIRECT_URL:-}" ]]; then
  echo "Set SUPABASE_DB_DIRECT_URL in .env.local or the environment." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required (brew install libpq)." >&2
  exit 1
fi

echo "== Storefront browse RPC pre-check =="
psql "$SUPABASE_DB_DIRECT_URL" -v ON_ERROR_STOP=1 -At -c "
select case
  when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_storefront_browse_rows'
  ) then 'rpc_exists=true'
  else 'rpc_exists=false'
end;
"

psql "$SUPABASE_DB_DIRECT_URL" -v ON_ERROR_STOP=1 -At -c "
select 'browse_view_rows=' || count(*)::text
from public.storefront_browse_products;
" 2>/dev/null || echo "browse_view_rows=missing"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run — migration not applied."
  exit 0
fi

echo "== Applying $MIGRATION =="
psql "$SUPABASE_DB_DIRECT_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

echo "== Post-check =="
psql "$SUPABASE_DB_DIRECT_URL" -v ON_ERROR_STOP=1 -At -c "
select 'browse_view_rows=' || count(*)::text
from public.storefront_browse_products;
"

psql "$SUPABASE_DB_DIRECT_URL" -v ON_ERROR_STOP=1 -At -c "
select 'rpc_sample=' || coalesce((select name from public.get_storefront_browse_rows(1, 0) limit 1), '(empty)');
"

echo "Done."
