-- Human-readable supplier / brand for admin supplier sheets (e.g. Syzmik, Biz Collection).
alter table public.products
  add column if not exists supplier_name text not null default '';

comment on column public.products.supplier_name is
  'Supplier or brand name shown on Admin → Supplier orders (Daily order table).';
