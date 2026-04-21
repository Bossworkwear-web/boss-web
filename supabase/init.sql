-- Run this SQL in Supabase SQL Editor.
-- It creates base catalog tables and quote request table.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text,
  category text,
  description text,
  base_price numeric(10,2),
  weight_kg numeric(8,3),
  image_urls text[],
  available_colors text[],
  available_sizes text[],
  is_active boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now()
);

create table if not exists public.embroidery_positions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  product_id uuid references public.products(id) on delete set null,
  embroidery_position_id uuid references public.embroidery_positions(id) on delete set null,
  service_type text,
  placement_labels text[],
  product_color text,
  logo_file_url text,
  quantity integer,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  organisation text not null,
  contact_number text not null,
  email_address text not null,
  login_password text,
  delivery_address text not null,
  billing_address text not null,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists slug text;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists base_price numeric(10,2);
alter table public.products add column if not exists weight_kg numeric(8,3);
alter table public.products add column if not exists image_urls text[];
alter table public.products add column if not exists available_colors text[];
alter table public.products add column if not exists available_sizes text[];
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists sort_order integer;
alter table public.products add column if not exists stock_quantity integer not null default 0;
alter table public.products add column if not exists specifications text;
alter table public.products add column if not exists features text;
alter table public.products add column if not exists supplier_name text not null default '';
alter table public.products add column if not exists storefront_hidden boolean not null default false;
alter table public.products add column if not exists storefront_hidden_at timestamptz;
alter table public.products add column if not exists audience text;

alter table public.quote_requests add column if not exists service_type text;
alter table public.quote_requests add column if not exists placement_labels text[];
alter table public.quote_requests add column if not exists product_color text;
alter table public.quote_requests add column if not exists logo_file_url text;

alter table public.customer_profiles add column if not exists customer_name text;
alter table public.customer_profiles add column if not exists organisation text;
alter table public.customer_profiles add column if not exists contact_number text;
alter table public.customer_profiles add column if not exists email_address text;
alter table public.customer_profiles add column if not exists login_password text;
alter table public.customer_profiles add column if not exists delivery_address text;
alter table public.customer_profiles add column if not exists billing_address text;

create unique index if not exists customer_profiles_email_unique_idx on public.customer_profiles (email_address);

insert into storage.buckets (id, name, public)
values ('quote-logos', 'quote-logos', true)
on conflict (id) do update
set public = true;

create unique index if not exists products_slug_unique_idx on public.products (slug);

insert into public.products (name, slug, category, description, base_price, weight_kg, image_urls, available_colors, available_sizes, is_active, sort_order)
values
  (
    'T-shirt',
    't-shirt',
    'T-shirts',
    'Reliable everyday teamwear for light industrial and warehouse environments.',
    18.90,
    0.220,
    array[
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80'
    ],
    array['Black', 'White', 'Navy', 'Grey', 'Charcoal', 'Olive'],
    array['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    true,
    10
  ),
  (
    'Work shirt',
    'work-shirt',
    'Work Shirts',
    'Durable shirts built for workshop, transport, and industrial field teams.',
    32.00,
    0.420,
    array[
      'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1593032465171-8bd66f4f8f53?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80'
    ],
    array['Navy', 'Khaki', 'Charcoal', 'Black', 'Orange', 'Hi-Vis Yellow', 'Royal Blue', 'Bottle Green'],
    array['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
    true,
    20
  ),
  (
    'Polo',
    'polo',
    'Polos',
    'Smart-casual polos for customer-facing staff and corporate teams.',
    24.50,
    0.280,
    array[
      'https://images.unsplash.com/photo-1592878940526-0214b0f374f6?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1200&q=80'
    ],
    array['Navy', 'Black', 'White', 'Grey', 'Red', 'Maroon', 'Royal Blue', 'Sky Blue', 'Teal', 'Purple'],
    array['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'],
    true,
    30
  ),
  (
    'Scrub',
    'scrub',
    'Scrubs',
    'Comfort-driven medical scrub options for clinics and healthcare operations.',
    29.40,
    0.310,
    array[
      'https://images.unsplash.com/photo-1612532275214-e4ca76d0e4d1?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80'
    ],
    array['Navy', 'Ceil Blue', 'Teal', 'Black', 'Grey', 'Wine', 'Olive'],
    array['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    true,
    40
  ),
  (
    'Premium Work Polo',
    'premium-work-polo',
    'Polos',
    'Industrial-grade premium polo with comfort stretch fabric and embroidery-ready finish.',
    29.90,
    0.300,
    array[
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1592878940526-0214b0f374f6?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80'
    ],
    array[
      'Navy',
      'Black',
      'White',
      'Charcoal',
      'Grey',
      'Royal Blue',
      'Sky Blue',
      'Maroon',
      'Red',
      'Forest Green',
      'Emerald',
      'Teal'
    ],
    array['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'],
    true,
    50
  )
on conflict (name) do update
set
  slug = excluded.slug,
  category = excluded.category,
  description = excluded.description,
  base_price = excluded.base_price,
  weight_kg = excluded.weight_kg,
  image_urls = excluded.image_urls,
  available_colors = excluded.available_colors,
  available_sizes = excluded.available_sizes,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

insert into public.embroidery_positions (name)
values
  ('Left chest'),
  ('Right chest'),
  ('Center chest'),
  ('Full Back'),
  ('Full Chest'),
  ('Back'),
  ('Left sleeve'),
  ('Right sleeve')
on conflict (name) do nothing;

-- Admin supplier PO line receipts (manual "goods received" checks); accessed via service role only.
create table if not exists public.supplier_receipt_checks (
  line_key text primary key,
  received boolean not null default false,
  received_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.supplier_receipt_checks enable row level security;

-- CRM: pipeline on quote requests + activity / notification logs (admin / service role).
alter table public.quote_requests add column if not exists pipeline_stage text not null default 'enquiry';
alter table public.quote_requests add column if not exists customer_profile_id uuid references public.customer_profiles (id) on delete set null;
alter table public.quote_requests add column if not exists internal_notes text;
alter table public.quote_requests add column if not exists next_follow_up_at timestamptz;
alter table public.quote_requests add column if not exists last_contacted_at timestamptz;
alter table public.quote_requests add column if not exists lead_source text not null default 'website';
alter table public.quote_requests add column if not exists automation_paused boolean not null default false;

alter table public.quote_requests add column if not exists quote_email_product_id text;
alter table public.quote_requests add column if not exists quote_email_product_name text;
alter table public.quote_requests add column if not exists quote_email_total_cents integer;
alter table public.quote_requests add column if not exists quote_email_lead_time text;

alter table public.quote_requests add column if not exists quote_email_delivery_address_1 text;
alter table public.quote_requests add column if not exists quote_email_delivery_address_2 text;
alter table public.quote_requests add column if not exists quote_email_delivery_suburb text;
alter table public.quote_requests add column if not exists quote_email_delivery_state text;
alter table public.quote_requests add column if not exists quote_email_delivery_country text;

alter table public.quote_requests add column if not exists quote_email_products jsonb not null default '[]'::jsonb;

alter table public.quote_requests add column if not exists quote_mockup_image_urls text[];

alter table public.quote_requests add column if not exists quote_email_embroidery_service text;
alter table public.quote_requests add column if not exists quote_email_print_service text;

alter table public.quote_requests add column if not exists quote_portal_token text;
alter table public.quote_requests add column if not exists quote_customer_accepted_at timestamptz;
alter table public.quote_requests add column if not exists quote_customer_accept_payload jsonb;

create unique index if not exists quote_requests_quote_portal_token_uidx
  on public.quote_requests (quote_portal_token)
  where quote_portal_token is not null;

alter table public.quote_requests add column if not exists quote_customer_accept_comment text;

alter table public.quote_requests add column if not exists printing_position_id uuid references public.embroidery_positions(id) on delete set null;

alter table public.quote_requests add column if not exists embroidery_position_ids uuid[];

alter table public.quote_requests add column if not exists printing_position_ids uuid[];

alter table public.quote_requests drop constraint if exists quote_requests_pipeline_stage_check;

alter table public.quote_requests add constraint quote_requests_pipeline_stage_check
  check (pipeline_stage in ('enquiry', 'quote', 'approval', 'completion'));

create index if not exists quote_requests_pipeline_stage_idx on public.quote_requests (pipeline_stage);
create index if not exists quote_requests_next_follow_up_idx on public.quote_requests (next_follow_up_at);
create index if not exists quote_requests_customer_profile_idx on public.quote_requests (customer_profile_id);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests (id) on delete cascade,
  kind text not null,
  body text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint crm_activities_kind_check check (kind in ('note', 'stage_change', 'email', 'sms', 'system'))
);

create index if not exists crm_activities_quote_idx on public.crm_activities (quote_request_id, created_at desc);

create table if not exists public.crm_notification_log (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests (id) on delete cascade,
  channel text not null,
  template_key text not null,
  status text not null,
  error text,
  created_at timestamptz not null default now(),
  constraint crm_notification_log_channel_check check (channel in ('email', 'sms')),
  constraint crm_notification_log_status_check check (status in ('queued', 'sent', 'failed', 'skipped'))
);

create index if not exists crm_notification_log_quote_idx on public.crm_notification_log (quote_request_id, created_at desc);

alter table public.crm_activities enable row level security;
alter table public.crm_notification_log enable row level security;

-- Demo-only RLS policies for quick testing.
-- For production, tighten these policies with auth-based rules.
alter table public.products enable row level security;
alter table public.embroidery_positions enable row level security;
alter table public.quote_requests enable row level security;
alter table public.customer_profiles enable row level security;

drop policy if exists "Allow public read products" on public.products;
create policy "Allow public read products"
on public.products for select
to anon, authenticated
using (true);

drop policy if exists "Allow public insert products" on public.products;
create policy "Allow public insert products"
on public.products for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow public read positions" on public.embroidery_positions;
create policy "Allow public read positions"
on public.embroidery_positions for select
to anon, authenticated
using (true);

drop policy if exists "Allow public insert positions" on public.embroidery_positions;
create policy "Allow public insert positions"
on public.embroidery_positions for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow public insert quotes" on public.quote_requests;
create policy "Allow public insert quotes"
on public.quote_requests for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow public insert customer profiles" on public.customer_profiles;
create policy "Allow public insert customer profiles"
on public.customer_profiles for insert
to anon, authenticated
with check (true);
