-- Single FB placement label on the storefront (diagram file stays FB.png).
update public.embroidery_positions
set name = 'Full Back'
where name in ('Front Bottom', 'Front Full');
