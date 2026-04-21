-- Accounting expenses + optional receipt images (single run for Supabase → SQL Editor).
-- Then Dashboard → Settings → API → Reload schema.

create table if not exists public.accounting_expenses (
  id uuid primary key default gen_random_uuid (),
  expense_date date not null,
  category text not null default '',
  description text not null,
  amount_cents integer not null,
  currency text not null default 'AUD',
  vendor text not null default '',
  notes text not null default '',
  receipt_storage_path text null,
  created_at timestamptz not null default now ()
);

-- Table may already exist from an older patch without receipt_storage_path.
alter table public.accounting_expenses
  add column if not exists receipt_storage_path text null;

create index if not exists accounting_expenses_expense_date_idx
  on public.accounting_expenses (expense_date desc, created_at desc);

comment on table public.accounting_expenses is
  'Admin Accounting: recorded expenses (amount_cents, positive = outflow).';

comment on column public.accounting_expenses.expense_date is
  'Calendar date the expense applies to (typically invoice or payment date).';

comment on column public.accounting_expenses.receipt_storage_path is
  'Object path in storage bucket accounting-expense-receipts (optional receipt photo).';

alter table public.accounting_expenses enable row level security;

insert into storage.buckets (id, name, public)
values ('accounting-expense-receipts', 'accounting-expense-receipts', true)
on conflict (id) do update
set public = true;

drop policy if exists "Public read accounting expense receipts" on storage.objects;
create policy "Public read accounting expense receipts"
on storage.objects for select to public
using (bucket_id = 'accounting-expense-receipts');

notify pgrst, 'reload schema';
