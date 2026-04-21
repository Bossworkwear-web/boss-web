-- =============================================================================
-- Delivery queue only (legacy name: click_up_delivery_queue)
-- =============================================================================
-- Prefer: patch_click_up_dispatch_queue.sql — creates delivery table + renames to
-- click_up_dispatch_queue and updates RPC in one run.
-- Use this file only if you will run 20260455_rename_click_up_delivery_queue_to_dispatch.sql separately.
-- Then Settings → API → Reload schema if needed.
-- =============================================================================

create table if not exists public.click_up_delivery_queue (
  id uuid primary key default gen_random_uuid (),
  store_order_id uuid not null references public.store_orders (id) on delete cascade,
  list_date text not null default '',
  moved_at timestamptz not null default now (),
  constraint click_up_delivery_queue_store_order_unique unique (store_order_id)
);

create index if not exists click_up_delivery_queue_moved_at_idx on public.click_up_delivery_queue (moved_at desc);

comment on table public.click_up_delivery_queue is
  'Admin Delivery list: row upserted when Quality Check sheet uses Move to Delivery.';

alter table public.click_up_delivery_queue enable row level security;

notify pgrst, 'reload schema';
