-- Manual "goods received" flags per supplier order line (keyed by stable line_key).
-- Run in Supabase SQL Editor after pulling this migration.

create table if not exists public.supplier_receipt_checks (
  line_key text primary key,
  received boolean not null default false,
  received_at timestamptz null,
  updated_at timestamptz not null default now()
);

comment on table public.supplier_receipt_checks is
  'Admin toggles when supplier PO lines are physically received; line_key is app-defined (e.g. order line id or demo key).';

create index if not exists supplier_receipt_checks_received_idx
  on public.supplier_receipt_checks (received);
