-- Biz Collection SKUs → Jackets (Men's/Jackets; names follow sync: "Biz Collection {SKU}").
UPDATE public.products
SET category = 'Jackets'
WHERE name IN (
  'Biz Collection F10510',
  'Biz Collection PF380',
  'Biz Collection SW239ML',
  'Biz Collection SW310M',
  'Biz Collection SW710M',
  'Biz Collection SW760M',
  'Biz Collection SW762M'
)
OR (
  lower(slug) LIKE '%bizcollection%f10510%'
  OR lower(slug) LIKE '%bizcollection%pf380%'
  OR lower(slug) LIKE '%bizcollection%sw239ml%'
  OR lower(slug) LIKE '%bizcollection%sw310m%'
  OR lower(slug) LIKE '%bizcollection%sw710m%'
  OR lower(slug) LIKE '%bizcollection%sw760m%'
  OR lower(slug) LIKE '%bizcollection%sw762m%'
);
