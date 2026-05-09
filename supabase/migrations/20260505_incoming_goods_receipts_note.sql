-- Incoming goods: add admin notes per received row.

alter table public.incoming_goods_receipts
  add column if not exists note text not null default '';

comment on column public.incoming_goods_receipts.note is
  'Admin note for incoming goods line item.';

notify pgrst, 'reload schema';

