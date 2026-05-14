-- Optional printing placement on quote requests (same catalog as embroidery_positions).
alter table public.quote_requests
  add column if not exists printing_position_id uuid references public.embroidery_positions (id) on delete set null;

notify pgrst, 'reload schema';
