-- Run once in Supabase → SQL Editor (same project as NEXT_PUBLIC_SUPABASE_URL).
-- Creates storefront order tables + columns required for checkout (placeStoreOrder).
-- Safe to re-run (IF NOT EXISTS / IF NOT EXISTS columns).

-- 1) Base tables (20260426_store_orders.sql)
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

-- 2) Status includes unpaid (20260509)
alter table public.store_orders drop constraint if exists store_orders_status_check;
alter table public.store_orders
  add constraint store_orders_status_check
  check (status in ('unpaid', 'paid', 'processing', 'shipped', 'cancelled'));

-- 3) Optional admin / reorder columns
alter table public.store_orders
  add column if not exists reordered_from_store_order_id uuid null references public.store_orders (id) on delete set null;

alter table public.store_orders
  add column if not exists invoice_reference text;

alter table public.store_orders
  add column if not exists hold_process boolean not null default false;

alter table public.store_orders
  add column if not exists hold_note text;

-- 4) Promotion columns (20260518) — checkout insert uses these
create table if not exists public.promotion_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text,
  discount_type text not null
    constraint promotion_codes_discount_type_check
      check (discount_type in ('percent', 'fixed_aud')),
  discount_value numeric(12, 2) not null,
  min_subtotal_aud numeric(12, 2) not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer,
  redemption_count integer not null default 0,
  max_redemptions_per_customer integer default 1,
  status text not null default 'active'
    constraint promotion_codes_status_check
      check (status in ('active', 'disabled', 'expired')),
  sent_to_email text,
  sent_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists promotion_codes_code_upper_idx
  on public.promotion_codes (upper(trim(code)));

create table if not exists public.promotion_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_code_id uuid not null references public.promotion_codes (id) on delete restrict,
  store_order_id uuid references public.store_orders (id) on delete set null,
  customer_email text not null,
  discount_cents integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.store_orders
  add column if not exists promotion_code_id uuid references public.promotion_codes (id) on delete set null;

alter table public.store_orders
  add column if not exists promotion_discount_cents integer not null default 0;

alter table public.promotion_codes enable row level security;
alter table public.promotion_code_redemptions enable row level security;

-- 5) Warehouse scan code + trigger (20260453)
alter table public.store_orders
  add column if not exists order_scan_code text;

update public.store_orders
set order_scan_code = replace(id::text, '-', '')
where order_scan_code is null or btrim(order_scan_code) = '';

create unique index if not exists store_orders_order_scan_code_uidx on public.store_orders (order_scan_code);

alter table public.store_orders
  alter column order_scan_code set not null;

create or replace function public.store_orders_set_order_scan_code()
returns trigger
language plpgsql
as $$
begin
  if new.order_scan_code is null or btrim(new.order_scan_code) = '' then
    new.order_scan_code := replace(new.id::text, '-', '');
  end if;
  return new;
end;
$$;

drop trigger if exists store_orders_order_scan_code_bi on public.store_orders;

create trigger store_orders_order_scan_code_bi
before insert on public.store_orders
for each row
execute function public.store_orders_set_order_scan_code();

-- 5) Stripe payment + refund (20260517)
alter table public.store_orders
  add column if not exists stripe_checkout_session_id text;

alter table public.store_orders
  add column if not exists stripe_payment_intent_id text;

alter table public.store_orders
  add column if not exists stripe_refund_id text;

alter table public.store_orders
  add column if not exists refunded_cents integer not null default 0;

alter table public.store_orders
  add column if not exists refunded_at timestamptz;

create unique index if not exists store_orders_stripe_checkout_session_id_unique
  on public.store_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table public.store_orders drop constraint if exists store_orders_status_check;
alter table public.store_orders
  add constraint store_orders_status_check
  check (status in ('unpaid', 'paid', 'processing', 'shipped', 'cancelled', 'refunded'));

-- Refresh API schema cache (fixes "schema cache" errors in the app)
notify pgrst, 'reload schema';
