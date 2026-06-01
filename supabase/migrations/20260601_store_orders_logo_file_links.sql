-- Click up sheet → Production pack: embroidery / printing logo file links (multiple per order).
alter table public.store_orders
  add column if not exists embroidery_logo_file_link text[] not null default '{}';

alter table public.store_orders
  add column if not exists printing_logo_file_link text[] not null default '{}';

comment on column public.store_orders.embroidery_logo_file_link is
  'Staff-entered embroidery logo file links (paths or URLs), one per placement e.g. front/back/sleeve.';
comment on column public.store_orders.printing_logo_file_link is
  'Staff-entered printing logo file links (paths or URLs), one per placement e.g. front/back/sleeve.';
