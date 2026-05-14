
-- Delete every Biz Corporate(s) catalog product (name, slug, or image path under Fashion Biz).
-- Use this if 20260417 left rows (different spelling, encoded URLs, missing slug).
-- `quote_requests.product_id` is ON DELETE SET NULL.
DELETE FROM public.products
WHERE name ILIKE '%Biz%Corporate%'
   OR name ILIKE '%Biz%Corporates%'
   OR lower(coalesce(name, '')) LIKE '%bizcorporate%'
   OR lower(coalesce(name, '')) LIKE '%bizcorporates%'
   OR lower(coalesce(slug, '')) LIKE '%bizcorporate%'
   OR lower(coalesce(slug, '')) LIKE '%bizcorporates%'
   OR lower(coalesce(slug, '')) LIKE '%biz-corporate%'
   OR lower(coalesce(slug, '')) LIKE '%biz-corporates%'
   OR lower(coalesce(slug, '')) LIKE '%biz_corporate%'
   OR lower(coalesce(slug, '')) LIKE '%biz_corporates%'
   OR array_to_string(coalesce(image_urls, '{}'::text[]), ' ') ILIKE '%Biz Corporates%'
   OR array_to_string(coalesce(image_urls, '{}'::text[]), ' ') ILIKE '%Biz%20Corporates%'
   OR array_to_string(coalesce(image_urls, '{}'::text[]), ' ') ILIKE '%biz%corporates%';
