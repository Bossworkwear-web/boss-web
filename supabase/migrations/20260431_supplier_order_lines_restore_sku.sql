-- Supplier daily lines use "SKU" again; "Customer order ID" is only on store_orders (checkout BOS_…).

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where
      table_schema = 'public'
      and table_name = 'supplier_order_lines'
      and column_name = 'customer_order_id'
  ) then
    alter table public.supplier_order_lines rename column customer_order_id to sku;
  end if;
end $$;

notify pgrst, 'reload schema';
