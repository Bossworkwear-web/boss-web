-- Inventory: units on hand per product (admin stock management).
alter table public.products
  add column if not exists stock_quantity integer not null default 0;

comment on column public.products.stock_quantity is 'Units on hand (admin-managed).';
