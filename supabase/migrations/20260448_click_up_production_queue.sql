-- Production pack exists only after Click up sheet → Move to Production (app enforces; this table is the source of truth).

create table if not exists public.click_up_production_queue (
  id uuid primary key default gen_random_uuid (),
  store_order_id uuid not null references public.store_orders (id) on delete cascade,
  list_date text not null default '',
  moved_at timestamptz not null default now (),
  constraint click_up_production_queue_store_order_unique unique (store_order_id)
);

create index if not exists click_up_production_queue_moved_at_idx on public.click_up_production_queue (moved_at desc);

comment on table public.click_up_production_queue is
  'Admin Production list and pack access: row upserted when Click up sheet uses Move to Production.';

alter table public.click_up_production_queue enable row level security;

notify pgrst, 'reload schema';
