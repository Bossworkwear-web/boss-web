-- Optional long-form specs (fabric, weight, features) for product detail pages.
alter table public.products
  add column if not exists specifications text;

comment on column public.products.specifications is
  'Storefront product specifications block (plain text / line breaks), shown under description on PDP.';
