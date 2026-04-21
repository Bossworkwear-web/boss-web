-- Run this entire script once in Supabase → SQL Editor if you see:
-- "Could not find the table 'public.supplier_daily_sheets' in the schema cache" [PGRST205]
-- Safe to re-run (IF NOT EXISTS).
-- After running: restart dev if needed; ensure SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL match this project.

create table if not exists public.supplier_daily_sheets (
  list_date text primary key,
  ready_for_processing boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint supplier_daily_sheets_list_date_ymd check (list_date ~ '^\d{4}-\d{2}-\d{2}$')
);

create index if not exists supplier_daily_sheets_ready_idx on public.supplier_daily_sheets (list_date desc)
where
  ready_for_processing = true;

alter table public.supplier_daily_sheets enable row level security;

NOTIFY pgrst, 'reload schema';
