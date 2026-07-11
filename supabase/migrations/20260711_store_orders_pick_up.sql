-- Persist checkout pickup vs delivery on the store order (not only on checkout pending).

alter table public.store_orders
  add column if not exists pick_up boolean not null default false;

comment on column public.store_orders.pick_up is
  'True when the customer chose in-store pickup at checkout; false for delivery.';

update public.store_orders so
set pick_up = true
from public.store_checkout_pending p
where p.store_order_id = so.id
  and p.pick_up = true
  and so.pick_up is distinct from true;
