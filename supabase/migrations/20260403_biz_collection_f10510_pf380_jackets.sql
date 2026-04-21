-- F10510 / PF380 still on T-Shirts: normalized name + bizcollection slug.
UPDATE public.products
SET category = 'Jackets'
WHERE category IS DISTINCT FROM 'Jackets'
  AND (
    regexp_replace(lower(trim(name)), '\s+', ' ', 'g') IN (
      'biz collection f10510',
      'biz collection pf380'
    )
    OR lower(slug) LIKE '%bizcollection%f10510%'
    OR lower(slug) LIKE '%bizcollection%pf380%'
  );
