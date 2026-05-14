-- Add mock-up builder decoration method selections (Embroidery, DTF/HTV, Sublimation) stored as JSON text.

alter table public.click_up_sheet_images
add column if not exists mockup_decorate_methods text null;

comment on column public.click_up_sheet_images.mockup_decorate_methods is
  'JSON array of decoration methods from Add mock-up modal, e.g. ["Embroidery","DTF/HTV"].';

notify pgrst, 'reload schema';
