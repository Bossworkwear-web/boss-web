-- Logo placement diagrams: FB.png, FC.png (see lib/placement-logo-location.ts).
insert into public.embroidery_positions (name)
values
  ('Full Back'),
  ('Full Chest')
on conflict (name) do nothing;
