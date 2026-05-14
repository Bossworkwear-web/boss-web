alter table public.products
add column if not exists storefront_hidden_at timestamptz;

-- Backfill: if a product is currently hidden, set an initial timestamp.
update public.products
set storefront_hidden_at = now()
where storefront_hidden = true and storefront_hidden_at is null;

comment on column public.products.storefront_hidden_at is
  'Timestamp when product was last hidden from storefront (storefront_hidden set true).';

