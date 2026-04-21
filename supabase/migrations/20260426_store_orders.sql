-- Storefront paid orders, line items, tracking token for customer self-service.

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid (),
  order_number text not null unique,
  tracking_token uuid not null unique default gen_random_uuid (),
  status text not null default 'paid'
    constraint store_orders_status_check
      check (status in ('paid', 'processing', 'shipped', 'cancelled')),
  customer_email text not null,
  customer_name text not null,
  delivery_address text not null,
  delivery_fee_cents integer not null default 0,
  subtotal_cents integer not null,
  total_cents integer not null,
  currency text not null default 'AUD',
  carrier text not null default 'Australia Post',
  tracking_number text,
  shipped_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists store_orders_created_at_idx on public.store_orders (created_at desc);
create index if not exists store_orders_status_idx on public.store_orders (status);
create index if not exists store_orders_tracking_token_idx on public.store_orders (tracking_token);

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid (),
  order_id uuid not null references public.store_orders (id) on delete cascade,
  product_id text not null default '',
  product_name text not null,
  quantity integer not null,
  unit_price_cents integer not null,
  line_total_cents integer not null,
  service_type text,
  color text,
  size text,
  placements jsonb not null default '[]'::jsonb,
  notes text,
  sort_order integer not null default 0
);

create index if not exists store_order_items_order_id_idx on public.store_order_items (order_id);

alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;

-- No policies: anon/authenticated cannot read/write; service role bypasses RLS for app server.
