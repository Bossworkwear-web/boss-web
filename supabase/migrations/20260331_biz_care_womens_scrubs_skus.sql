-- Biz Care SKUs that are Women's Scrubs (fix category for storefront sub-slug).
UPDATE public.products
SET category = 'Scrubs'
WHERE name IN (
  'Biz Care C602W',
  'Biz Care C603U',
  'Biz Care CSP102UL',
  'Biz Care CST250US',
  'Biz Care CST313MS'
)
OR (
  lower(slug) LIKE '%bizcare%c602w%'
  OR lower(slug) LIKE '%bizcare%c603u%'
  OR lower(slug) LIKE '%bizcare%csp102ul%'
  OR lower(slug) LIKE '%bizcare%cst250us%'
  OR lower(slug) LIKE '%bizcare%cst313ms%'
);
