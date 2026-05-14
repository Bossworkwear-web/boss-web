-- AusPost / carrier QR or barcode label images attached to Dispatch queue rows.

alter table public.click_up_dispatch_queue
  add column if not exists carrier_label_image_urls text[] not null default '{}'::text[];

comment on column public.click_up_dispatch_queue.carrier_label_image_urls is
  'Public URLs of uploaded carrier label images (QR/barcode PDF or PNG/JPEG) for warehouse dispatch.';

insert into storage.buckets (id, name, public)
values ('dispatch-carrier-labels', 'dispatch-carrier-labels', true)
on conflict (id) do update
set public = true;

drop policy if exists "Public read dispatch carrier labels" on storage.objects;
create policy "Public read dispatch carrier labels"
on storage.objects for select to public
using (bucket_id = 'dispatch-carrier-labels');

notify pgrst, 'reload schema';
