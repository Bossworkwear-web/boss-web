-- Removes sku (and legacy customer_order_id) from supplier_order_lines. Run in Supabase SQL Editor after pulling latest app.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where
      table_schema = 'public'
      and table_name = 'supplier_order_lines'
      and column_name = 'sku'
  ) then
    alter table public.supplier_order_lines drop column sku;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where
      table_schema = 'public'
      and table_name = 'supplier_order_lines'
      and column_name = 'customer_order_id'
  ) then
    alter table public.supplier_order_lines drop column customer_order_id;
  end if;
end $$;

notify pgrst, 'reload schema';
