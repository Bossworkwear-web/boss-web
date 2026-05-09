/* Password reset tokens (one-time, expiring). */

create table if not exists public.customer_password_resets (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz null
);

create index if not exists customer_password_resets_token_hash_idx
  on public.customer_password_resets (token_hash);

create index if not exists customer_password_resets_customer_profile_id_idx
  on public.customer_password_resets (customer_profile_id);

-- Allow server-side reads/writes via service role; keep anonymous users blocked.
alter table public.customer_password_resets enable row level security;

drop policy if exists "Service role manage customer password resets" on public.customer_password_resets;
create policy "Service role manage customer password resets"
on public.customer_password_resets
for all
to public
using (false)
with check (false);

