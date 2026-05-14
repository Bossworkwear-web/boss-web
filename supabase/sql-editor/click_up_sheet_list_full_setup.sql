-- Click up sheet list (public.click_up_sheet_list). Run the ENTIRE file in Supabase → SQL Editor, then click Refresh in the Table Editor and reload the admin app.
--
-- If you still see PGRST205 after this, run ONLY this line in SQL Editor again:
--   NOTIFY pgrst, 'reload schema';

create table if not exists public.click_up_sheet_list (
  list_date text primary key,
  created_at timestamptz not null default now(),
  constraint click_up_sheet_list_list_date_ymd check (list_date ~ '^\d{4}-\d{2}-\d{2}$')
);

create index if not exists click_up_sheet_list_created_at_idx on public.click_up_sheet_list (created_at desc);

alter table public.click_up_sheet_list enable row level security;

-- Backfill from supplier_daily_sheets when that table exists. Must not fail the rest of this script.
do $$
begin
  insert into public.click_up_sheet_list (list_date, created_at)
  select
    s.list_date::text,
    s.updated_at
  from
    public.supplier_daily_sheets s
  where
    s.ready_for_processing = true
  on conflict (list_date) do update
  set
    created_at = excluded.created_at;
exception
  when undefined_table then
    raise notice 'click_up_sheet_list: skipped backfill (supplier_daily_sheets missing — create it first or ignore).';
  when others then
    raise notice 'click_up_sheet_list: backfill skipped: %', sqlerrm;
end
$$;

notify pgrst, 'reload schema';
