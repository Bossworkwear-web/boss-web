-- Public bucket for supplier catalog photos (upload via scripts/upload-supplier-images.mjs).
insert into storage.buckets (id, name, public)
values ('supplier-product-images', 'supplier-product-images', true)
on conflict (id) do update
set public = true;

drop policy if exists "Public read supplier product images" on storage.objects;
create policy "Public read supplier product images"
on storage.objects for select
to public
using (bucket_id = 'supplier-product-images');
