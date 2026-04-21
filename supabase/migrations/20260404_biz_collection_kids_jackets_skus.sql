-- Biz Collection kids jacket SKUs → Kid's/Jackets (`lib/biz-collection-kids-only-jackets.json`).
UPDATE public.products
SET category = 'Jackets'
WHERE name IN (
  'Biz Collection SW239KL',
  'Biz Collection SW310K',
  'Biz Collection SW760K'
)
OR (
  lower(slug) LIKE '%bizcollection%sw239kl%'
  OR lower(slug) LIKE '%bizcollection%sw310k%'
  OR lower(slug) LIKE '%bizcollection%sw760k%'
);
