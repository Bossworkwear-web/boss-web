-- Optional production note on mock-up rows (set from Edit mock-up in Click up sheet).

alter table public.click_up_sheet_images
  add column if not exists mockup_memo text;

comment on column public.click_up_sheet_images.mockup_memo is
  'Optional memo for mock-up designs (admin Edit mock-up modal).';

-- Refresh PostgREST schema cache (avoids "Could not find ... in the schema cache" until next reload).
notify pgrst, 'reload schema';
