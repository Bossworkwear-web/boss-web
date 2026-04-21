-- public.quote_requests + CRM log tables (matches supabase/init.sql + 20260320_crm_pipeline.sql).
-- Prerequisites: public.products, public.embroidery_positions, public.customer_profiles must already exist.
-- Run in Supabase → SQL Editor, then Settings → API → Reload schema.
-- If you only need printing + multi-select placement columns, you can run instead:
--   supabase/sql-editor/add_quote_position_array_columns.sql

create extension if not exists pgcrypto;

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid (),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  product_id uuid references public.products (id) on delete set null,
  embroidery_position_id uuid references public.embroidery_positions (id) on delete set null,
  service_type text,
  placement_labels text[],
  product_color text,
  logo_file_url text,
  quantity integer,
  notes text,
  created_at timestamptz not null default now ()
);

alter table public.quote_requests add column if not exists service_type text;

alter table public.quote_requests add column if not exists placement_labels text[];

alter table public.quote_requests add column if not exists product_color text;

alter table public.quote_requests add column if not exists logo_file_url text;

alter table public.quote_requests add column if not exists pipeline_stage text not null default 'enquiry';

alter table public.quote_requests add column if not exists customer_profile_id uuid;

alter table public.quote_requests add column if not exists internal_notes text;

alter table public.quote_requests add column if not exists next_follow_up_at timestamptz;

alter table public.quote_requests add column if not exists last_contacted_at timestamptz;

alter table public.quote_requests add column if not exists lead_source text not null default 'website';

alter table public.quote_requests add column if not exists automation_paused boolean not null default false;

-- Backfill then enforce FK (safe if column already had FK).
update public.quote_requests qr
set
  customer_profile_id = null
where
  customer_profile_id is not null
  and not exists (
    select 1
    from public.customer_profiles cp
    where
      cp.id = qr.customer_profile_id
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'quote_requests_customer_profile_id_fkey'
  ) then
    alter table public.quote_requests
      add constraint quote_requests_customer_profile_id_fkey foreign key (customer_profile_id) references public.customer_profiles (id) on delete set null;
  end if;
end $$;

alter table public.quote_requests drop constraint if exists quote_requests_pipeline_stage_check;

alter table public.quote_requests
  add constraint quote_requests_pipeline_stage_check check (
    pipeline_stage in ('enquiry', 'quote', 'approval', 'completion')
  );

create index if not exists quote_requests_pipeline_stage_idx on public.quote_requests (pipeline_stage);

create index if not exists quote_requests_next_follow_up_idx on public.quote_requests (next_follow_up_at);

create index if not exists quote_requests_customer_profile_idx on public.quote_requests (customer_profile_id);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid (),
  quote_request_id uuid not null references public.quote_requests (id) on delete cascade,
  kind text not null,
  body text not null,
  metadata jsonb,
  created_at timestamptz not null default now (),
  constraint crm_activities_kind_check check (kind in ('note', 'stage_change', 'email', 'sms', 'system'))
);

create index if not exists crm_activities_quote_idx on public.crm_activities (quote_request_id, created_at desc);

create table if not exists public.crm_notification_log (
  id uuid primary key default gen_random_uuid (),
  quote_request_id uuid not null references public.quote_requests (id) on delete cascade,
  channel text not null,
  template_key text not null,
  status text not null,
  error text,
  created_at timestamptz not null default now (),
  constraint crm_notification_log_channel_check check (channel in ('email', 'sms')),
  constraint crm_notification_log_status_check check (status in ('queued', 'sent', 'failed', 'skipped'))
);

create index if not exists crm_notification_log_quote_idx on public.crm_notification_log (quote_request_id, created_at desc);

alter table public.crm_activities enable row level security;

alter table public.crm_notification_log enable row level security;

alter table public.quote_requests enable row level security;

drop policy if exists "Allow public insert quotes" on public.quote_requests;

create policy "Allow public insert quotes" on public.quote_requests for insert to anon, authenticated with check (true);

insert into storage.buckets (id, name, public)
values ('quote-logos', 'quote-logos', true)
on conflict (id) do update
set
  public = true;

alter table public.quote_requests
  add column if not exists printing_position_id uuid references public.embroidery_positions (id) on delete set null;

alter table public.quote_requests add column if not exists embroidery_position_ids uuid[];

alter table public.quote_requests add column if not exists printing_position_ids uuid[];

notify pgrst, 'reload schema';
