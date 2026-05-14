-- Receipt column + bucket only (if accounting_expenses already exists).
-- Prefer running patch_accounting_expenses.sql once — it creates/updates the table, column, and bucket together.
-- Then Settings → API → Reload schema.

alter table public.accounting_expenses
  add column if not exists receipt_storage_path text null;

comment on column public.accounting_expenses.receipt_storage_path is
  'Object path in storage bucket accounting-expense-receipts (optional receipt photo).';

insert into storage.buckets (id, name, public)
values ('accounting-expense-receipts', 'accounting-expense-receipts', true)
on conflict (id) do update
set public = true;

drop policy if exists "Public read accounting expense receipts" on storage.objects;
create policy "Public read accounting expense receipts"
on storage.objects for select to public
using (bucket_id = 'accounting-expense-receipts');

notify pgrst, 'reload schema';
