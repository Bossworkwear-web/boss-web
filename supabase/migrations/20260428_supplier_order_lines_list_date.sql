-- Bucket each line onto a daily worksheet (Perth calendar date).

alter table public.supplier_order_lines add column if not exists list_date date;

update public.supplier_order_lines
set
  list_date = coalesce(
    ordered_date,
    ((created_at at time zone 'Australia/Perth'))::date
  )
where
  list_date is null;

update public.supplier_order_lines
set
  list_date = ((now() at time zone 'Australia/Perth'))::date
where
  list_date is null;

alter table public.supplier_order_lines alter column list_date set not null;

create index if not exists supplier_order_lines_list_date_idx on public.supplier_order_lines (list_date desc);

comment on column public.supplier_order_lines.list_date is
  'Worksheet day (Australia/Perth calendar); UI shows one table per day; rows are created under this date.';
