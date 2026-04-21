-- Store every selected embroidery / printing placement (not only the first FK).
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
