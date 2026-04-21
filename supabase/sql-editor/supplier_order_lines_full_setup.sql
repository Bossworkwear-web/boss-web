-- Run this entire script once in Supabase → SQL Editor if you see:
-- "Could not find the table 'public.supplier_order_lines' in the schema cache"
-- Safe to re-run (IF NOT EXISTS / IF NOT EXISTS column).
-- Equivalent to migrations through 20260433 (customer_order_id = store order_number; ends with NOTIFY below).

create table if not exists public.supplier_order_lines (
  id uuid primary key default gen_random_uuid (),
  supplier text not null default '',
  customer_order_id text not null default '',
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

alter table public.supplier_order_lines add column if not exists list_date date;

update public.supplier_order_lines
set
  list_date = coalesce(
    ordered_date,
    ((created_at at time zone 'Australia/Perth'))::date
  )
where
  list_date is null;

update public.supplier_order_lines
set
  list_date = ((now() at time zone 'Australia/Perth'))::date
where
  list_date is null;

alter table public.supplier_order_lines alter column list_date set not null;

create index if not exists supplier_order_lines_supplier_ordered_idx
  on public.supplier_order_lines (supplier, ordered_date);

create index if not exists supplier_order_lines_ordered_date_idx
  on public.supplier_order_lines (ordered_date);

create index if not exists supplier_order_lines_list_date_idx on public.supplier_order_lines (list_date desc);

alter table public.supplier_order_lines
  add column if not exists sheet_row_ok boolean not null default false;

alter table public.supplier_order_lines enable row level security;

NOTIFY pgrst, 'reload schema';
