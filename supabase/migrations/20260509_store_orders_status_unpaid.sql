-- Allow unpaid quotes / orders created from Customer Quote before payment.
alter table public.store_orders drop constraint if exists store_orders_status_check;

alter table public.store_orders
  add constraint store_orders_status_check
  check (status in ('unpaid', 'paid', 'processing', 'shipped', 'cancelled'));
