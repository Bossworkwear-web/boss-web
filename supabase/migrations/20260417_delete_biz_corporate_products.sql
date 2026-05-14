-- Remove Fashion Biz "Biz Corporate(s)" catalog rows (name prefix or fb-bizcorporate* slugs).
-- `quote_requests.product_id` is ON DELETE SET NULL.
DELETE FROM public.products
WHERE lower(name) LIKE '%biz corporate%'
   OR lower(coalesce(slug, '')) LIKE '%bizcorporate%';
