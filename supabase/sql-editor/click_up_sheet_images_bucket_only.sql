-- Run in Supabase SQL Editor if uploads return "Bucket not found" but you already have click_up_sheet_images table.

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
