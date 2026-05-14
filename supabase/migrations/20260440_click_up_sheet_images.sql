-- Click up sheet: multiple images per worksheet + optional customer order id.

create table if not exists public.click_up_sheet_images (
  id uuid primary key default gen_random_uuid (),
  list_date text not null,
  customer_order_id text not null default '',
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now (),
  constraint click_up_sheet_images_list_date_check check (list_date ~ '^\d{4}-\d{2}-\d{2}$')
);

create index if not exists click_up_sheet_images_lookup_idx on public.click_up_sheet_images (
  list_date,
  customer_order_id,
  sort_order,
  created_at
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
