-- Optional per-user admin password (Access control). When set and enforcement is on,
-- login must match this hash instead of BOSS_ADMIN_PASSWORD.

alter table public.admin_access_users
  add column if not exists password_hash text null;

comment on column public.admin_access_users.password_hash is
  'Optional scrypt hash (v1$...). When access control enforces and hash is set, Admin login password must verify against this; when null, BOSS_ADMIN_PASSWORD applies for that user.';

notify pgrst, 'reload schema';
