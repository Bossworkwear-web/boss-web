-- Links a supplier line to a web checkout: same value as store_orders.order_number (e.g. BOS_YYYYMMDD_001).

alter table public.supplier_order_lines add column if not exists customer_order_id text not null default '';

comment on column public.supplier_order_lines.customer_order_id is
  'Optional: copy of store_orders.order_number (Customer order ID on Store orders admin).';

notify pgrst, 'reload schema';
