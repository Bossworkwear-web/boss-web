-- Admin-editable supplier order lines (daily log) + monthly reporting inputs.

create table if not exists public.supplier_order_lines (
  id uuid primary key default gen_random_uuid (),
  supplier text not null default '',
  sku text not null default '',
  product_id text not null default '',
  colour text not null default '',
  size text not null default '',
  quantity integer not null default 0,
  ordered_date date null,
  received_date date null,
  notes text not null default '',
  unit_price_cents integer not null default 0,
  list_date date not null default (((now() at time zone 'Australia/Perth'))::date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_order_lines_quantity_check check (quantity >= 0),
  constraint supplier_order_lines_unit_price_check check (unit_price_cents >= 0)
);

comment on table public.supplier_order_lines is
  'Admin supplier PO lines: editable daily; Reports (25th) sums qty and line totals by supplier for ordered_date in month 1–25.';

create index if not exists supplier_order_lines_supplier_ordered_idx
  on public.supplier_order_lines (supplier, ordered_date);

create index if not exists supplier_order_lines_ordered_date_idx
  on public.supplier_order_lines (ordered_date);

alter table public.supplier_order_lines enable row level security;

-- No policies: service role bypasses RLS for app server (same pattern as store_orders).
