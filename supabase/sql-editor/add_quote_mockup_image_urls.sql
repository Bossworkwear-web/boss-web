-- Run in Supabase SQL Editor if migration 20260470 was not applied yet.
alter table public.quote_requests add column if not exists quote_mockup_image_urls text[];
