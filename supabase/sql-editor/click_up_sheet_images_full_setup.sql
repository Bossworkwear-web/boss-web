-- Run in Supabase SQL Editor if migrations are not applied. Ends with PostgREST reload.

create table if not exists public.click_up_sheet_images (
  id uuid primary key default gen_random_uuid (),
  list_date text not null,
  customer_order_id text not null default '',
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now (),
  is_mockup boolean not null default false,
  constraint click_up_sheet_images_list_date_check check (list_date ~ '^\d{4}-\d{2}-\d{2}$')
);

alter table public.click_up_sheet_images
add column if not exists is_mockup boolean not null default false;

alter table public.click_up_sheet_images
add column if not exists mockup_decorate_methods text null;

alter table public.click_up_sheet_images
add column if not exists mockup_memo text null;

create index if not exists click_up_sheet_images_lookup_idx on public.click_up_sheet_images (
  list_date,
  customer_order_id,
  sort_order,
  created_at
);

create index if not exists click_up_sheet_images_order_mockup_idx on public.click_up_sheet_images (
  customer_order_id,
  is_mockup,
  list_date desc,
  created_at desc
);

alter table public.click_up_sheet_images enable row level security;

insert into
  storage.buckets (id, name, public)
values
  ('click-up-sheet-images', 'click-up-sheet-images', true)
on conflict (id) do update
set
  public = true;

drop policy if exists "Public read click up sheet images" on storage.objects;

create policy "Public read click up sheet images" on storage.objects for select to public using (
  bucket_id = 'click-up-sheet-images'
);

notify pgrst, 'reload schema';
