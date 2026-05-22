-- Run in Supabase SQL Editor if migrations are not applied via CLI.
-- Same as supabase/migrations/20260521_xero_integration.sql

create table if not exists public.xero_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tenant_name text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint xero_connections_tenant_id_unique unique (tenant_id)
);

comment on table public.xero_connections is
  'Single Xero organisation connection (service role only). Tokens used server-side for invoice sync.';

alter table public.xero_connections enable row level security;

alter table public.store_orders
  add column if not exists xero_contact_id text,
  add column if not exists xero_invoice_id text,
  add column if not exists xero_invoice_number text,
  add column if not exists xero_sync_status text not null default 'pending',
  add column if not exists xero_sync_error text,
  add column if not exists xero_synced_at timestamptz;

comment on column public.store_orders.xero_invoice_number is
  'Official invoice number from Xero (also copied to invoice_reference for PDFs when synced).';

comment on column public.store_orders.xero_sync_status is
  'pending | synced | failed | skipped — set after payment when Xero invoice job runs.';

create unique index if not exists store_orders_xero_invoice_id_unique
  on public.store_orders (xero_invoice_id)
  where xero_invoice_id is not null;

alter table public.store_orders
  drop constraint if exists store_orders_xero_sync_status_check;

alter table public.store_orders
  add constraint store_orders_xero_sync_status_check
  check (xero_sync_status in ('pending', 'synced', 'failed', 'skipped'));
