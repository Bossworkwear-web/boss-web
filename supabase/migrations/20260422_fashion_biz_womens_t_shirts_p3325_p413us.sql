-- Women's/T-shirts: P3325, P413US (`lib/fashion-biz-womens-t-shirts.json` + manual gender).
UPDATE public.products
SET category = 'T-shirts'
WHERE name IN (
  'Biz Collection P3325',
  'Biz Collection P413US'
)
OR lower(coalesce(slug, '')) LIKE '%bizcollection%p3325%'
OR lower(coalesce(slug, '')) LIKE '%bizcollection%p413us%';
