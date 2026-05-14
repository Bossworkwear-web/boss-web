-- Biz Collection BS732L → Women's/Jackets (`biz-collection-force-jackets.json`; gender `womens`).
UPDATE public.products
SET category = 'Jackets'
WHERE name IN ('Biz Collection BS732L')
   OR lower(coalesce(slug, '')) LIKE '%bizcollection%bs732l%';
