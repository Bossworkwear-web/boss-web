-- Pending Stripe Checkout payloads so webhooks can create orders if the browser never returns.

create table if not exists public.store_checkout_pending (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text not null unique,
  customer_email text not null,
  customer_name text not null,
  delivery_address text not null,
  cart_payload jsonb not null,
  promotion_code_id uuid references public.promotion_codes (id) on delete set null,
  pick_up boolean not null default false,
  reordered_from_store_order_id uuid references public.store_orders (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'fulfilled')),
  store_order_id uuid references public.store_orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_checkout_pending_status_created_idx
  on public.store_checkout_pending (status, created_at desc);

comment on table public.store_checkout_pending is
  'Stripe Checkout cart snapshot keyed by session id; fulfilled by return URL or webhook.';
