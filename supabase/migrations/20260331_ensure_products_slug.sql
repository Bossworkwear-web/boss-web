-- Ensures public.products.slug exists for URL routing and brand filters (e.g. Syzmik in SKU slug).
-- Idempotent: safe to run on projects that already ran supabase/init.sql.

alter table public.products add column if not exists slug text;

comment on column public.products.slug is 'Catalog URL key / vendor SKU slug; may differ from a slug derived from name only.';

-- Matches init.sql: unique when set (PostgreSQL allows multiple NULLs).
create unique index if not exists products_slug_unique_idx on public.products (slug);
