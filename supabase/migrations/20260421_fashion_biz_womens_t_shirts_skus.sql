-- Women's/T-shirts (`lib/fashion-biz-womens-t-shirts.json` + `fashion-biz-gender-route` manual).
UPDATE public.products
SET category = 'T-shirts'
WHERE name IN (
  'Biz Care CS952LS',
  'Biz Care CT247LL',
  'Biz Collection SG319L',
  'Biz Collection SG702L',
  'Biz Collection T10022',
  'Biz Collection T301LS',
  'Biz Collection T403L',
  'Biz Collection T701LS',
  'Biz Collection T800L',
  'Biz Collection T800LS'
)
OR lower(coalesce(slug, '')) LIKE '%bizcare%cs952ls%'
OR lower(coalesce(slug, '')) LIKE '%bizcare%ct247ll%'
OR lower(coalesce(slug, '')) LIKE '%bizcollection%sg319l%'
OR lower(coalesce(slug, '')) LIKE '%bizcollection%sg702l%'
OR lower(coalesce(slug, '')) LIKE '%bizcollection%t10022%'
OR lower(coalesce(slug, '')) LIKE '%bizcollection%t301ls%'
OR lower(coalesce(slug, '')) LIKE '%bizcollection%t403l%'
OR lower(coalesce(slug, '')) LIKE '%bizcollection%t701ls%'
OR lower(coalesce(slug, '')) LIKE '%bizcollection%t800l%'
OR lower(coalesce(slug, '')) LIKE '%bizcollection%t800ls%';
