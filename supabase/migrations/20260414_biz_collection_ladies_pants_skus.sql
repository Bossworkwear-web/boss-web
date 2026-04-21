-- Biz Collection L323LS, L323LT, L513LT, L514LL → Women's/Pants (`biz-collection-force-pants.json`; CSV gender `womens`).
UPDATE public.products
SET category = 'Pants'
WHERE name IN (
  'Biz Collection L323LS',
  'Biz Collection L323LT',
  'Biz Collection L513LT',
  'Biz Collection L514LL'
)
OR (
  lower(coalesce(slug, '')) LIKE '%bizcollection%l323ls%'
  OR lower(coalesce(slug, '')) LIKE '%bizcollection%l323lt%'
  OR lower(coalesce(slug, '')) LIKE '%bizcollection%l513lt%'
  OR lower(coalesce(slug, '')) LIKE '%bizcollection%l514ll%'
);
