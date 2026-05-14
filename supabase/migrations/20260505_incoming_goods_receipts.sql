-- Incoming goods: track received quantities per store order line item.

create table if not exists public.incoming_goods_receipts (
  id uuid primary key default gen_random_uuid (),
  store_order_item_id uuid not null references public.store_order_items (id) on delete cascade,
  received_qty integer not null default 0,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint incoming_goods_receipts_one_per_item unique (store_order_item_id)
);

create index if not exists incoming_goods_receipts_store_order_item_id_idx
  on public.incoming_goods_receipts (store_order_item_id);

alter table public.incoming_goods_receipts enable row level security;

comment on table public.incoming_goods_receipts is
  'Admin-entered received quantity for a store order item (incoming goods). One row per store_order_items.id.';

notify pgrst, 'reload schema';

