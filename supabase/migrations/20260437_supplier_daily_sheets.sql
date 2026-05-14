-- Per–list_date (Perth worksheet day) flags for admin workflow (e.g. Click Up).

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
