-- Phase 2 audit: customer_profiles.login_password before/after migration script.
-- Run in Supabase SQL Editor (read-only checks).

-- Count by category
select
  count(*) filter (where login_password is null or trim(login_password) = '') as empty_password,
  count(*) filter (
    where login_password is not null
      and trim(login_password) <> ''
      and auth_user_id is not null
  ) as auth_linked_still_has_password,
  count(*) filter (
    where login_password is not null
      and trim(login_password) <> ''
      and auth_user_id is null
      and login_password like 'v1$%'
  ) as legacy_hashed,
  count(*) filter (
    where login_password is not null
      and trim(login_password) <> ''
      and auth_user_id is null
      and login_password not like 'v1$%'
  ) as legacy_plain_text
from public.customer_profiles;

-- List legacy plain-text rows (emails only — do not log passwords)
select id, email_address, created_at
from public.customer_profiles
where login_password is not null
  and trim(login_password) <> ''
  and auth_user_id is null
  and login_password not like 'v1$%'
order by created_at desc;
