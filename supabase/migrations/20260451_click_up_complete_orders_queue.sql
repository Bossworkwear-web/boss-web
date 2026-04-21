-- Complete Orders hub: row created when Delivery queue uses Complete (atomic move).

create table if not exists public.click_up_complete_orders_queue (
  id uuid primary key default gen_random_uuid (),
  store_order_id uuid not null references public.store_orders (id) on delete cascade,
  list_date text not null default '',
  completed_at timestamptz not null default now (),
  constraint click_up_complete_orders_queue_store_order_unique unique (store_order_id)
);

create index if not exists click_up_complete_orders_queue_completed_at_idx
  on public.click_up_complete_orders_queue (completed_at desc);

comment on table public.click_up_complete_orders_queue is
  'Admin Complete Orders list: row upserted when Delivery uses Complete.';

alter table public.click_up_complete_orders_queue enable row level security;

-- Single transaction: copy from delivery queue → complete list, then remove from delivery.
create or replace function public.move_store_order_from_delivery_to_complete (p_delivery_queue_id uuid)
returns void
language plpgsql
as $$
declare
  v_store_order_id uuid;
  v_list_date text;
begin
  select q.store_order_id, q.list_date
    into v_store_order_id, v_list_date
  from public.click_up_delivery_queue q
  where q.id = p_delivery_queue_id;

  if v_store_order_id is null then
    raise exception 'delivery_queue_not_found';
  end if;

  insert into public.click_up_complete_orders_queue (store_order_id, list_date, completed_at)
  values (v_store_order_id, coalesce(v_list_date, ''), now())
  on conflict (store_order_id) do update
    set list_date = excluded.list_date,
        completed_at = excluded.completed_at;

  delete from public.click_up_delivery_queue
  where id = p_delivery_queue_id;
end;
$$;

revoke all on function public.move_store_order_from_delivery_to_complete (uuid) from public;
grant execute on function public.move_store_order_from_delivery_to_complete (uuid) to service_role;

notify pgrst, 'reload schema';
