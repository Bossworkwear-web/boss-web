-- Biz Collection Kid's/Pants (`lib/biz-collection-kids-only-pants.json`).
UPDATE public.products
SET category = 'Pants'
WHERE name IN (
  'Biz Collection ST2020B',
  'Biz Collection ST511K'
)
OR (
  lower(slug) LIKE '%bizcollection%st2020b%'
  OR lower(slug) LIKE '%bizcollection%st511k%'
);
