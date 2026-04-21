-- Men's/Jackets: J428U (`biz-collection-force-jackets.json` + manual gender `mens`).
UPDATE public.products
SET category = 'Jackets'
WHERE name IN ('Biz Collection J428U')
OR lower(coalesce(slug, '')) LIKE '%bizcollection%j428u%';
