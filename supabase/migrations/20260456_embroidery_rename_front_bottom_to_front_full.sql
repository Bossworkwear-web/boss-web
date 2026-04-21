-- Rename storefront label (diagram code stays FB).
update public.embroidery_positions
set name = 'Front Full'
where name = 'Front Bottom';
