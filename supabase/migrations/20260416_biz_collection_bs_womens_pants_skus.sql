-- Biz Collection BS* ladies pants → Women's/Pants (`biz-collection-force-pants.json`; gender `womens`).
UPDATE public.products
SET category = 'Pants'
WHERE name IN (
  'Biz Collection BS128LS',
  'Biz Collection BS29320',
  'Biz Collection BS29323',
  'Biz Collection BS506L',
  'Biz Collection BS507L',
  'Biz Collection BS508L',
  'Biz Collection BS734L',
  'Biz Collection BS909L'
)
OR (
  lower(coalesce(slug, '')) LIKE '%bizcollection%bs128ls%'
  OR lower(coalesce(slug, '')) LIKE '%bizcollection%bs29320%'
  OR lower(coalesce(slug, '')) LIKE '%bizcollection%bs29323%'
  OR lower(coalesce(slug, '')) LIKE '%bizcollection%bs506l%'
  OR lower(coalesce(slug, '')) LIKE '%bizcollection%bs507l%'
  OR lower(coalesce(slug, '')) LIKE '%bizcollection%bs508l%'
  OR lower(coalesce(slug, '')) LIKE '%bizcollection%bs734l%'
  OR lower(coalesce(slug, '')) LIKE '%bizcollection%bs909l%'
);
