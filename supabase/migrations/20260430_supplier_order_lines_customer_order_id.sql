-- Daily sheet: "Customer order ID" replaces former sku column (same data, clearer label).

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
    alter table public.supplier_order_lines rename column sku to customer_order_id;
  end if;
end $$;

notify pgrst, 'reload schema';
