-- Biz Collection → Men's/Pants grid (`category` = Pants; see `lib/biz-collection-force-pants.json`).
UPDATE public.products
SET category = 'Pants'
WHERE name IN (
  'Biz Collection ST2020',
  'Biz Collection ST511M',
  'Biz Collection TP3160'
)
OR (
  lower(slug) LIKE '%bizcollection%st2020%'
  OR lower(slug) LIKE '%bizcollection%st511m%'
  OR lower(slug) LIKE '%bizcollection%tp3160%'
);
