-- Process scan token for warehouse / production (Code128-friendly: UUID without hyphens).

alter table public.store_orders
  add column if not exists order_scan_code text;

update public.store_orders
set order_scan_code = replace(id::text, '-', '')
where order_scan_code is null or btrim(order_scan_code) = '';

create unique index if not exists store_orders_order_scan_code_uidx on public.store_orders (order_scan_code);

alter table public.store_orders
  alter column order_scan_code set not null;

comment on column public.store_orders.order_scan_code is
  'Unique scan payload (32 hex = UUID without hyphens). Filled by trigger on insert; use for Code128 across production/QC/etc.';

create or replace function public.store_orders_set_order_scan_code()
returns trigger
language plpgsql
as $$
begin
  if new.order_scan_code is null or btrim(new.order_scan_code) = '' then
    new.order_scan_code := replace(new.id::text, '-', '');
  end if;
  return new;
end;
$$;

drop trigger if exists store_orders_order_scan_code_bi on public.store_orders;

create trigger store_orders_order_scan_code_bi
before insert on public.store_orders
for each row
EXECUTE FUNCTION public.store_orders_set_order_scan_code();
