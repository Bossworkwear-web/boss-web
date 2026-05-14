-- Biz Collection BS730L → Women's/Pants (`biz-collection-force-pants.json`; gender `womens`).
UPDATE public.products
SET category = 'Pants'
WHERE name IN ('Biz Collection BS730L')
   OR lower(coalesce(slug, '')) LIKE '%bizcollection%bs730l%';
