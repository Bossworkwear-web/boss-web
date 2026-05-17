-- Stripe checkout / refund fields for store_orders (admin refunds to card).

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
