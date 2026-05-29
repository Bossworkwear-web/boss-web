-- Self-service quotes emailed from the storefront cart. Saved per customer so they
-- can reorder the exact cart later from My account → My Quote.

create table if not exists public.customer_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null,
  customer_email text not null,
  customer_name text,
  currency text not null default 'AUD',
  product_gross_cents integer not null default 0,
  volume_discount_cents integer not null default 0,
  product_net_cents integer not null default 0,
  logo_setup_cents integer not null default 0,
  delivery_cents integer not null default 0,
  total_cents integer not null default 0,
  total_quantity integer not null default 0,
  pickup boolean not null default false,
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists customer_quotes_email_created_idx
  on public.customer_quotes (lower(customer_email), created_at desc);

comment on table public.customer_quotes is
  'Cart quotes a signed-in customer emailed to themselves. Restorable into the cart from My account.';
comment on column public.customer_quotes.lines is
  'Snapshot of cart lines (StoreOrderCartLine[]) used to rebuild the cart on reorder.';
