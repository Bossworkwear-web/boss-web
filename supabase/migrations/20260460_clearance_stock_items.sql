-- Manually curated lines for event / clearance pages (admin-managed; not tied to catalog import).

create table if not exists public.clearance_stock_items (
  id uuid primary key default gen_random_uuid (),
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  price_label text not null default '',
  quantity int null,
  product_slug text null,
  image_url text null,
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now ()
);

create index if not exists clearance_stock_items_sort_idx
  on public.clearance_stock_items (sort_order asc, created_at desc);

create index if not exists clearance_stock_items_published_sort_idx
  on public.clearance_stock_items (is_published, sort_order asc)
  where is_published = true;

comment on table public.clearance_stock_items is
  'Admin Clearance Stock: manual entries for promotions, events, and clearance pages.';

comment on column public.clearance_stock_items.product_slug is
  'Optional storefront product slug for deep link (/products/[slug]).';

alter table public.clearance_stock_items enable row level security;

notify pgrst, 'reload schema';
