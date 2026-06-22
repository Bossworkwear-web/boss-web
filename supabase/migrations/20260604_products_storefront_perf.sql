-- Storefront page-transition performance: browse/supplier indexes + slug backfill.
-- Safe to re-run (IF NOT EXISTS / idempotent slug updates only where missing).

create or replace function public.slugify_product_name(name text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(
      regexp_replace(lower(trim(coalesce(name, ''))), '\s+', '-', 'g'),
      '[^a-z0-9-]', '-', 'g'
    ),
    '-+', '-', 'g'
  ));
$$;

comment on function public.slugify_product_name(text) is
  'Lowercase URL slug from product name; matches storefront slugifyProductNameForPath.';

-- 1) Category/home/search browse: active + visible, ordered by name.
create index if not exists products_storefront_browse_idx
  on public.products (name)
  where is_active = true and storefront_hidden is not true;

-- 3) PDP related products: filter by supplier_name.
create index if not exists products_supplier_active_idx
  on public.products (supplier_name)
  where is_active = true and storefront_hidden is not true;

-- 2) Backfill missing slugs so PDP can use slug index (avoids full-table scan fallback).
do $$
declare
  r record;
  base_slug text;
  candidate text;
  suffix text;
  attempt int;
begin
  for r in
    select id, name
    from public.products
    where slug is null or trim(slug) = ''
    order by id
  loop
    base_slug := public.slugify_product_name(r.name);
    if base_slug = '' then
      base_slug := 'product';
    end if;

    candidate := base_slug;
    suffix := left(replace(r.id::text, '-', ''), 8);
    attempt := 0;

    while exists (
      select 1
      from public.products p
      where p.slug = candidate
        and p.id <> r.id
    ) loop
      attempt := attempt + 1;
      if attempt = 1 then
        candidate := base_slug || '-' || suffix;
      else
        candidate := base_slug || '-' || suffix || '-' || attempt::text;
      end if;
    end loop;

    update public.products
    set slug = candidate
    where id = r.id;
  end loop;
end $$;
