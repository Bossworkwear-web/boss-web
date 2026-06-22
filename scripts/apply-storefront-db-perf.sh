#!/usr/bin/env bash
# Apply storefront DB performance migration (indexes + slug backfill).
# Requires SUPABASE_DB_DIRECT_URL in boss-web/.env.local or environment.
#
# Usage:
#   bash scripts/apply-storefront-db-perf.sh
#   bash scripts/apply-storefront-db-perf.sh --dry-run   # print counts only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_WEB="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATION="$BOSS_WEB/supabase/migrations/20260604_products_storefront_perf.sql"
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

echo "== Storefront DB perf pre-check =="
psql "$SUPABASE_DB_DIRECT_URL" -v ON_ERROR_STOP=1 -At -c "
select 'missing_slug_count=' || count(*)::text
from public.products
where slug is null or trim(slug) = '';
"

psql "$SUPABASE_DB_DIRECT_URL" -v ON_ERROR_STOP=1 -At -c "
select 'index_' || indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'products'
  and indexname in ('products_storefront_browse_idx', 'products_supplier_active_idx');
"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run — migration not applied."
  exit 0
fi

echo "== Applying $MIGRATION =="
psql "$SUPABASE_DB_DIRECT_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

echo "== Post-check =="
psql "$SUPABASE_DB_DIRECT_URL" -v ON_ERROR_STOP=1 -At -c "
select 'missing_slug_count=' || count(*)::text
from public.products
where slug is null or trim(slug) = '';
"

psql "$SUPABASE_DB_DIRECT_URL" -v ON_ERROR_STOP=1 -At -c "
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'products'
  and indexname in ('products_storefront_browse_idx', 'products_supplier_active_idx')
order by indexname;
"

echo "Done."
