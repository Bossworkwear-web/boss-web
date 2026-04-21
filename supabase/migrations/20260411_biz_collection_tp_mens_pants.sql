-- Biz Collection products with TP in name/slug → Men's/Pants (`category` + gender route `mens`).
UPDATE public.products
SET category = 'Pants'
WHERE (lower(name) LIKE '%biz collection%' AND lower(name) LIKE '%tp%')
   OR (
     lower(coalesce(slug, '')) LIKE '%bizcollection%'
     AND lower(coalesce(slug, '')) LIKE '%tp%'
   );
