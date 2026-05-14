-- Biz Care C602W, C603U → PPE / Miscellaneous (`isBizCareListingInMiscGeneratedSet`).
UPDATE public.products
SET category = 'Miscellaneous'
WHERE name IN ('Biz Care C602W', 'Biz Care C603U')
   OR lower(coalesce(slug, '')) LIKE '%bizcare%c602w%'
   OR lower(coalesce(slug, '')) LIKE '%bizcare%c603u%';
