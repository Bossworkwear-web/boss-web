-- Admin Accounting: customer refund log (AUD cents; Xero reconciliation flag).

create table if not exists public.accounting_refunds (
  id uuid primary key default gen_random_uuid (),
  issue_date date not null,
  order_id text not null default '',
  description text not null,
  amount_cents integer not null,
  currency text not null default 'AUD',
  date_refunded date null,
  xero_updated boolean not null default false,
  created_at timestamptz not null default now ()
);

create index if not exists accounting_refunds_issue_date_idx
  on public.accounting_refunds (issue_date desc, created_at desc);

comment on table public.accounting_refunds is
  'Admin Accounting: refunds issued (amount_cents positive AUD outflow to customer).';

comment on column public.accounting_refunds.order_id is
  'Store order reference: store_orders.id (UUID) or order_number (e.g. BOS_…), free text.';

alter table public.accounting_refunds enable row level security;

notify pgrst, 'reload schema';
