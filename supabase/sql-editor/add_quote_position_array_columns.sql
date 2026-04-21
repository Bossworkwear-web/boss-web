-- Run once in Supabase → SQL Editor if you see:
--   column quote_requests.embroidery_position_ids does not exist
-- (Adds printing_position_id if missing, then multi-select arrays + backfill.)
-- After Run: Settings → API → Reload schema.

alter table public.quote_requests
  add column if not exists printing_position_id uuid references public.embroidery_positions (id) on delete set null;

alter table public.quote_requests add column if not exists embroidery_position_ids uuid[];

alter table public.quote_requests add column if not exists printing_position_ids uuid[];

update public.quote_requests
set
  embroidery_position_ids = array[embroidery_position_id]::uuid[]
where
  embroidery_position_id is not null
  and (
    embroidery_position_ids is null
    or cardinality(embroidery_position_ids) = 0
  );

update public.quote_requests
set
  printing_position_ids = array[printing_position_id]::uuid[]
where
  printing_position_id is not null
  and (
    printing_position_ids is null
    or cardinality(printing_position_ids) = 0
  );

notify pgrst, 'reload schema';
