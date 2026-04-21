-- Admin Accounting: manual expense lines (AUD cents; complements Xero until sync exists).

create table if not exists public.accounting_expenses (
  id uuid primary key default gen_random_uuid (),
  expense_date date not null,
  category text not null default '',
  description text not null,
  amount_cents integer not null,
  currency text not null default 'AUD',
  vendor text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now ()
);

create index if not exists accounting_expenses_expense_date_idx
  on public.accounting_expenses (expense_date desc, created_at desc);

comment on table public.accounting_expenses is
  'Admin Accounting: recorded expenses (amount_cents, positive = outflow).';

comment on column public.accounting_expenses.expense_date is
  'Calendar date the expense applies to (typically invoice or payment date).';

alter table public.accounting_expenses enable row level security;

notify pgrst, 'reload schema';
