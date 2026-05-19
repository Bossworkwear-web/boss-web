-- Run in Supabase SQL Editor (same as migration 20260520_customer_profiles_auth_user_id.sql)

alter table public.customer_profiles
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

create index if not exists customer_profiles_auth_user_id_idx
  on public.customer_profiles (auth_user_id)
  where auth_user_id is not null;
