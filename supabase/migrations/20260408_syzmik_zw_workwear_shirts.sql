-- Syzmik products with ZW in the name → Workwear/Shirts (`category` maps to sub slug `shirts`).
UPDATE public.products
SET category = 'Shirts'
WHERE (lower(name) LIKE '%syzmik%' AND lower(name) LIKE '%zw%')
   OR (
     lower(coalesce(slug, '')) LIKE '%syzmik%'
     AND lower(coalesce(slug, '')) LIKE '%zw%'
   );
