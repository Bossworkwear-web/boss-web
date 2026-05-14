-- Quality Control hub: rows upserted when Production pack uses Move to QC.

create table if not exists public.click_up_qc_queue (
  id uuid primary key default gen_random_uuid (),
  store_order_id uuid not null references public.store_orders (id) on delete cascade,
  list_date text not null default '',
  moved_at timestamptz not null default now (),
  constraint click_up_qc_queue_store_order_unique unique (store_order_id)
);

create index if not exists click_up_qc_queue_moved_at_idx on public.click_up_qc_queue (moved_at desc);

comment on table public.click_up_qc_queue is
  'Admin Quality Control list: row upserted when Production pack uses Move to QC.';

alter table public.click_up_qc_queue enable row level security;

notify pgrst, 'reload schema';
