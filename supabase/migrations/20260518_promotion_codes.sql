-- Checkout promotion / discount codes (admin-managed).

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

create index if not exists promotion_codes_status_idx on public.promotion_codes (status);
create index if not exists promotion_codes_ends_at_idx on public.promotion_codes (ends_at);

create table if not exists public.promotion_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_code_id uuid not null references public.promotion_codes (id) on delete restrict,
  store_order_id uuid references public.store_orders (id) on delete set null,
  customer_email text not null,
  discount_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists promotion_code_redemptions_code_idx
  on public.promotion_code_redemptions (promotion_code_id, created_at desc);

create index if not exists promotion_code_redemptions_customer_idx
  on public.promotion_code_redemptions (promotion_code_id, customer_email);

alter table public.store_orders
  add column if not exists promotion_code_id uuid references public.promotion_codes (id) on delete set null;

alter table public.store_orders
  add column if not exists promotion_discount_cents integer not null default 0;

alter table public.promotion_codes enable row level security;
alter table public.promotion_code_redemptions enable row level security;

comment on table public.promotion_codes is 'Storefront checkout discount codes; managed in Admin → Promotion.';
comment on table public.promotion_code_redemptions is 'Per-use audit when a code is applied at checkout.';
