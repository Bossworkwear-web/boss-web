-- Syzmik products with ZA in name/slug → PPE / Miscellaneous (`resolveProductSubSlug` → `miscellaneous`).
UPDATE public.products
SET category = 'Miscellaneous'
WHERE (lower(name) LIKE '%syzmik%' AND lower(name) LIKE '%za%')
   OR (
     lower(coalesce(slug, '')) LIKE '%syzmik%'
     AND lower(coalesce(slug, '')) LIKE '%za%'
   );
