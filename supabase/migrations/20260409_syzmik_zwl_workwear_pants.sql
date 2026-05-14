-- Syzmik styles with ZWL in name/slug → Workwear/Pants (ZWL must win over ZW → Shirts).
UPDATE public.products
SET category = 'Pants'
WHERE (lower(name) LIKE '%syzmik%' AND lower(name) LIKE '%zwl%')
   OR (
     lower(coalesce(slug, '')) LIKE '%syzmik%'
     AND lower(coalesce(slug, '')) LIKE '%zwl%'
   );
