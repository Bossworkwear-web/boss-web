-- Optional note for tax invoice (e.g. phone/email order id); nullable.

alter table public.store_orders
  add column if not exists invoice_reference text;

comment on column public.store_orders.invoice_reference is
  'Shown on tax invoice under Invoice number; optional (phone/email orders).';
