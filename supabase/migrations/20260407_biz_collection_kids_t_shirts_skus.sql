-- Biz Collection Kid's/T-Shirts (`lib/biz-collection-kids-only-t-shirts.json`).
UPDATE public.products
SET category = 'T-shirts'
WHERE name IN (
  'Biz Collection T207KS',
  'Biz Collection T301KS',
  'Biz Collection T318KS'
)
OR (
  lower(slug) LIKE '%bizcollection%t207ks%'
  OR lower(slug) LIKE '%bizcollection%t301ks%'
  OR lower(slug) LIKE '%bizcollection%t318ks%'
);
