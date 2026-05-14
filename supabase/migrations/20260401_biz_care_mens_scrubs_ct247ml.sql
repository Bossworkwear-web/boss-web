-- Biz Care CT247ML → Men's Scrubs (storefront sub-slug).
UPDATE public.products
SET category = 'Scrubs'
WHERE name = 'Biz Care CT247ML'
   OR lower(slug) LIKE '%bizcare%ct247ml%';
