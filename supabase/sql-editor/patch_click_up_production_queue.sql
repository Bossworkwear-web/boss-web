-- =============================================================================
-- Click up → Production queue (필수)
-- =============================================================================
-- 증상: Move to Production 후 /admin/production 에 목록이 안 뜸, 또는
--   "Could not find the table 'public.click_up_production_queue' in the schema cache"
-- 조치: 이 파일 전체를 Supabase Dashboard → SQL Editor 에 붙여넣고 Run.
--   마이그레이션으로 이미 적용했다면 이 스크립트는 안전하게 재실행 가능(IF NOT EXISTS).
-- 실행 후에도 동일 메시지면: Dashboard → Settings → API → "Reload schema".
-- =============================================================================

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
