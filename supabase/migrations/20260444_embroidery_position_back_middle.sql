-- Some projects never ran init.sql; ensure table exists before seeding.
create table if not exists public.embroidery_positions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.embroidery_positions enable row level security;

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

-- Full storefront set (app uses DB rows whenever any exist; a single row would break the placement list).
insert into public.embroidery_positions (name)
values
  ('Left chest'),
  ('Right chest'),
  ('Center chest'),
  ('Back Upper'),
  ('Back Middle'),
  ('Left sleeve'),
  ('Right sleeve')
on conflict (name) do nothing;
