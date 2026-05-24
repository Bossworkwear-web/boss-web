-- Editable storefront copy (homepage hero, legal pages, etc.).

create table if not exists public.site_content (
  key text primary key,
  body text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists site_content_updated_at_idx on public.site_content (updated_at desc);

comment on table public.site_content is
  'Key/value storefront content edited from Admin → Site & content.';

alter table public.site_content enable row level security;
