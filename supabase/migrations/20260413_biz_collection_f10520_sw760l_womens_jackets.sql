-- Biz Collection F10520, SW760L → Women's/Jackets (`biz-collection-force-jackets.json`; gender already `womens`).
UPDATE public.products
SET category = 'Jackets'
WHERE name IN ('Biz Collection F10520', 'Biz Collection SW760L')
   OR lower(coalesce(slug, '')) LIKE '%bizcollection%f10520%'
   OR lower(coalesce(slug, '')) LIKE '%bizcollection%sw760l%';
