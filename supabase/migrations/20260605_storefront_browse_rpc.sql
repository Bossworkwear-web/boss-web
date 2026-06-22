-- Lightweight storefront browse source: caps gallery payload (first 8 images) for category/home/search.
-- App calls get_storefront_browse_rows(limit, offset) instead of scanning public.products with full image_urls.

create or replace view public.storefront_browse_products as
select
  p.id,
  p.name,
  p.base_price,
  p.sale_price,
  case
    when p.image_urls is not null and cardinality(p.image_urls) > 0 then
      p.image_urls[1:least(cardinality(p.image_urls), 8)]
    else null
  end as image_urls,
  p.category,
  p.slug,
  p.description,
  p.storefront_hidden,
  p.audience,
  p.supplier_name,
  p.available_colors,
  p.available_sizes
from public.products p
where p.is_active = true
  and p.storefront_hidden is not true;

comment on view public.storefront_browse_products is
  'Storefront category/home/search rows with trimmed image_urls (max 8) for faster API responses.';

grant select on public.storefront_browse_products to anon, authenticated;

create or replace function public.get_storefront_browse_rows(
  p_limit integer default 500,
  p_offset integer default 0
)
returns setof public.storefront_browse_products
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.storefront_browse_products
  order by name
  limit greatest(coalesce(p_limit, 500), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

comment on function public.get_storefront_browse_rows(integer, integer) is
  'Paginated storefront browse catalog; prefer over raw products select for smaller payloads.';

grant execute on function public.get_storefront_browse_rows(integer, integer) to anon, authenticated;
