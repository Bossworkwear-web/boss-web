-- Fix: "Could not find the 'mockup_memo' column ... in the schema cache"
-- Run once in Supabase → SQL Editor (same project as the app).

alter table public.click_up_sheet_images add column if not exists mockup_memo text null;

comment on column public.click_up_sheet_images.mockup_memo is
  'Optional memo for mock-up designs (Click up sheet mock-up builder MEMO field).';

notify pgrst, 'reload schema';
