-- Click up sheet: mark one reference image as the "master company logo" for an order.

alter table public.click_up_sheet_images
  add column if not exists is_master_logo boolean not null default false;

comment on column public.click_up_sheet_images.is_master_logo is
  'Admin-selected master company logo (reference image). At most one per (list_date, customer_order_id).';

-- Enforce one master per order/date (applies to reference + mockup rows if used; UI only sets on reference).
create unique index if not exists click_up_sheet_images_one_master_per_order_idx
  on public.click_up_sheet_images (list_date, customer_order_id)
  where is_master_logo = true;

notify pgrst, 'reload schema';

