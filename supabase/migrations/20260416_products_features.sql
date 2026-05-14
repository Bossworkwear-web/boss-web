-- Marketing / bullet-style features for PDP (under description).
alter table public.products
  add column if not exists features text;

comment on column public.products.features is
  'Storefront product features (plain text / line breaks), shown under description on PDP.';
