-- Optional GST-inclusive promotional unit price. When set below calculated list retail
-- (from base_price), storefront shows list struck through and uses sale_price at checkout config.
alter table public.products add column if not exists sale_price numeric(10,2);

comment on column public.products.sale_price is
  'GST-inclusive sale unit price; active only when strictly below list retail from base_price.';
