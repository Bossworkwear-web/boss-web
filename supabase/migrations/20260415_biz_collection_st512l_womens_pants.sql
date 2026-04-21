-- Biz Collection ST512L → Women's/Pants (`biz-collection-force-pants.json`; gender `womens`).
UPDATE public.products
SET category = 'Pants'
WHERE name IN ('Biz Collection ST512L')
   OR lower(coalesce(slug, '')) LIKE '%bizcollection%st512l%';
