-- Phase 3: Stripe payment → Xero Paid; Stripe refund → Xero credit notes.

alter table public.store_orders
  add column if not exists xero_payment_id text,
  add column if not exists xero_payment_error text,
  add column if not exists xero_credit_notes jsonb not null default '[]'::jsonb,
  add column if not exists xero_refund_sync_error text;

comment on column public.store_orders.xero_payment_id is
  'Xero payment id when Stripe checkout is recorded against the sales invoice.';

comment on column public.store_orders.xero_credit_notes is
  'JSON array of { stripe_refund_id, credit_note_id, credit_note_number, amount_cents, created_at }.';

create unique index if not exists store_orders_xero_payment_id_unique
  on public.store_orders (xero_payment_id)
  where xero_payment_id is not null;
