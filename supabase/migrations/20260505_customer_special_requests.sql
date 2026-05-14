-- Customer-level special requests / notes (admin-editable).

create table if not exists public.customer_special_requests (
  id uuid primary key default gen_random_uuid (),
  customer_email text not null,
  body text not null default '',
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint customer_special_requests_email_unique unique (customer_email)
);

create index if not exists customer_special_requests_email_idx
  on public.customer_special_requests (customer_email);

alter table public.customer_special_requests enable row level security;

comment on table public.customer_special_requests is
  'Admin notes / special requests for a customer, keyed by email. One row per customer.';

notify pgrst, 'reload schema';

