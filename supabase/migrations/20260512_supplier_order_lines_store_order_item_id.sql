-- Link supplier worksheet lines to store order items (Incoming goods → Received date sync).

alter table public.supplier_order_lines
  add column if not exists store_order_item_id uuid null references public.store_order_items (id) on delete set null;

create index if not exists supplier_order_lines_store_order_item_id_idx
  on public.supplier_order_lines (store_order_item_id)
  where store_order_item_id is not null;

comment on column public.supplier_order_lines.store_order_item_id is
  'FK to store_order_items when the line was created from web checkout; used to sync received_date from Incoming goods.';
