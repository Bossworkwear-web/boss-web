-- Persist per-customer master company logo so future orders inherit it until changed.

create table if not exists public.customer_master_company_logo (
  id uuid primary key default gen_random_uuid (),
  customer_email text not null,
  storage_bucket text not null default 'click-up-sheet-images',
  storage_path text not null,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint customer_master_company_logo_email_unique unique (customer_email)
);

create index if not exists customer_master_company_logo_email_idx
  on public.customer_master_company_logo (customer_email);

alter table public.customer_master_company_logo enable row level security;

comment on table public.customer_master_company_logo is
  'Customer-level master logo pointer (storage bucket + path), reused across future orders until reset.';

notify pgrst, 'reload schema';

