-- Run in Supabase SQL editor. Same as migrations/20260531_order_proofs.sql.
-- Embroidery / print proof (시안) approval rounds for a store order.

create table if not exists public.order_proofs (
  id uuid primary key default gen_random_uuid(),
  store_order_id uuid not null references public.store_orders (id) on delete cascade,
  order_number text not null default '',
  round integer not null default 1,
  status text not null default 'sent',
  token text not null,
  image_urls jsonb not null default '[]'::jsonb,
  note text,
  sent_to text not null default '',
  sent_at timestamptz not null default now(),
  decided_at timestamptz,
  customer_comment text,
  created_at timestamptz not null default now(),
  constraint order_proofs_status_check check (status in ('sent', 'approved', 'declined')),
  constraint order_proofs_token_unique unique (token)
);

create index if not exists order_proofs_store_order_round_idx
  on public.order_proofs (store_order_id, round desc);

alter table public.order_proofs enable row level security;

notify pgrst, 'reload schema';
