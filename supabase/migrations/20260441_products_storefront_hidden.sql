alter table public.products
add column if not exists storefront_hidden boolean not null default false;

comment on column public.products.storefront_hidden is
  'Admin toggle: hide product from storefront pages without deleting it.';

