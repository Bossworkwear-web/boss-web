-- Click up sheet: flag assets as mock-up designs for worker-facing views.

alter table public.click_up_sheet_images
add column if not exists is_mockup boolean not null default false;

comment on column public.click_up_sheet_images.is_mockup is
  'When true, treat as production mock-up (PDF or image); workers can list by customer_order_id.';

create index if not exists click_up_sheet_images_order_mockup_idx on public.click_up_sheet_images (
  customer_order_id,
  is_mockup,
  list_date desc,
  created_at desc
);

notify pgrst, 'reload schema';
