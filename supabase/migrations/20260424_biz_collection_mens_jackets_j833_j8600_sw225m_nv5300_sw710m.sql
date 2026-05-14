-- Men's/Jackets: J833, J8600, SW225M, NV5300 (catalog SKU), SW710M.
UPDATE public.products
SET category = 'Jackets'
WHERE name IN (
  'Biz Collection J833',
  'Biz Collection J8600',
  'Biz Collection SW225M',
  'Biz Collection NV5300',
  'Biz Collection SW710M'
)
OR lower(coalesce(slug, '')) LIKE '%bizcollection%j833%'
OR lower(coalesce(slug, '')) LIKE '%bizcollection%j8600%'
OR lower(coalesce(slug, '')) LIKE '%bizcollection%sw225m%'
OR lower(coalesce(slug, '')) LIKE '%bizcollection%nv5300%'
OR lower(coalesce(slug, '')) LIKE '%bizcollection%sw710m%';
