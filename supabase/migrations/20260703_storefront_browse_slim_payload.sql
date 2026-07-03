-- Slim storefront browse payload: one grid image + truncated description for faster category/home/search.

create or replace view public.storefront_browse_products as
select
  p.id,
  p.name,
  p.base_price,
  p.sale_price,
  case
    when p.image_urls is not null and cardinality(p.image_urls) > 0 then
      array[
        coalesce(
          (
            select u
            from unnest(p.image_urls) as u
            where upper(u) like '%CL542UL_TALENT_MIDNIGHTNAVY_07.JPG%'
            limit 1
          ),
          p.image_urls[1]
        )
      ]
    else null
  end as image_urls,
  p.category,
  p.slug,
  case
    when p.description is null then null
    else left(p.description, 512)
  end as description,
  p.storefront_hidden,
  p.audience,
  p.supplier_name,
  p.available_colors,
  p.available_sizes
from public.products p
where p.is_active = true
  and p.storefront_hidden is not true;

comment on view public.storefront_browse_products is
  'Storefront category/home/search rows with one grid image and description capped at 512 chars.';

grant select on public.storefront_browse_products to anon, authenticated;
