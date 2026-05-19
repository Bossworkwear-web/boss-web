-- Link storefront customer_profiles to Supabase Auth (auth.users).
alter table public.customer_profiles
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

create index if not exists customer_profiles_auth_user_id_idx
  on public.customer_profiles (auth_user_id)
  where auth_user_id is not null;

comment on column public.customer_profiles.auth_user_id is
  'Supabase Auth user id (Google / Microsoft / Apple / email).';
