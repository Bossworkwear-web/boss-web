-- Admin access control: allowlist of admin identifiers (email/name).
-- Enforcement is in lib/admin-auth.ts when at least one active row exists.

create table if not exists public.admin_access_users (
  id uuid primary key default gen_random_uuid (),
  identifier text not null,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now ()
);

create unique index if not exists admin_access_users_identifier_unique
  on public.admin_access_users (lower(identifier));

create index if not exists admin_access_users_active_idx
  on public.admin_access_users (is_active, created_at desc);

comment on table public.admin_access_users is
  'Admin access allowlist. identifier must match Admin login "Email / name" value.';

comment on column public.admin_access_users.role is
  'Reserved for future fine-grained permissions (e.g. accounting-only).';

alter table public.admin_access_users enable row level security;

notify pgrst, 'reload schema';

