-- Admin hub: rename queue table delivery → dispatch (wording). RPC name unchanged for compatibility.

do $$
begin
  if to_regclass('public.click_up_delivery_queue') is not null
     and to_regclass('public.click_up_dispatch_queue') is null then
    alter table public.click_up_delivery_queue rename to click_up_dispatch_queue;
  end if;
end $$;

alter index if exists public.click_up_delivery_queue_moved_at_idx rename to click_up_dispatch_queue_moved_at_idx;

do $$
begin
  if to_regclass('public.click_up_dispatch_queue') is null then
    return;
  end if;
  begin
    alter table public.click_up_dispatch_queue
      rename constraint click_up_delivery_queue_store_order_unique to click_up_dispatch_queue_store_order_unique;
  exception
    when undefined_object then null;
    when duplicate_object then null;
  end;
  begin
    alter table public.click_up_dispatch_queue
      rename constraint click_up_delivery_queue_store_order_id_fkey to click_up_dispatch_queue_store_order_id_fkey;
  exception
    when undefined_object then null;
    when duplicate_object then null;
  end;
end $$;

comment on table public.click_up_dispatch_queue is
  'Admin Dispatch list: row upserted when Quality Check sheet uses Move to Dispatch.';

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
  from public.click_up_dispatch_queue q
  where q.id = p_delivery_queue_id;

  if v_store_order_id is null then
    raise exception 'delivery_queue_not_found';
  end if;

  insert into public.click_up_complete_orders_queue (store_order_id, list_date, completed_at)
  values (v_store_order_id, coalesce(v_list_date, ''), now())
  on conflict (store_order_id) do update
    set list_date = excluded.list_date,
        completed_at = excluded.completed_at;

  delete from public.click_up_dispatch_queue
  where id = p_delivery_queue_id;
end;
$$;

notify pgrst, 'reload schema';
