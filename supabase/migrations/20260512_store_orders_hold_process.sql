-- Admin Store orders: optional hold flag + free-text note (fulfilment / dispatch).
alter table public.store_orders
  add column if not exists hold_process boolean not null default false;

alter table public.store_orders
  add column if not exists hold_note text;

comment on column public.store_orders.hold_process is 'When true, staff marked this order as on hold (Store orders list).';
comment on column public.store_orders.hold_note is 'Optional note paired with hold_process (Store orders list).';
