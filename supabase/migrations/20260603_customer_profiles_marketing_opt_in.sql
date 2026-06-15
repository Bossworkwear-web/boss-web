alter table public.customer_profiles
  add column if not exists marketing_opt_in boolean not null default false;

alter table public.customer_profiles
  add column if not exists marketing_opt_in_at timestamptz;
