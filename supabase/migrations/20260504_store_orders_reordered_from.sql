-- Links a new store order to the prior order when the customer used My account → Reorder (carries Click Up mock-up context).
alter table public.store_orders
  add column if not exists reordered_from_store_order_id uuid null references public.store_orders (id) on delete set null;

create index if not exists store_orders_reordered_from_store_order_id_idx
  on public.store_orders (reordered_from_store_order_id)
  where reordered_from_store_order_id is not null;

comment on column public.store_orders.reordered_from_store_order_id is
  'Prior store_orders.id when checkout was started from Reorder; admin Click Up merges prior order mock-ups.';

notify pgrst, 'reload schema';
