-- CRM: pipeline stages on quote_requests + activity / notification logs.
-- Run in Supabase SQL Editor after prior migrations.

alter table public.quote_requests
  add column if not exists pipeline_stage text not null default 'enquiry';

alter table public.quote_requests
  add column if not exists customer_profile_id uuid references public.customer_profiles (id) on delete set null;

alter table public.quote_requests
  add column if not exists internal_notes text;

alter table public.quote_requests
  add column if not exists next_follow_up_at timestamptz;

alter table public.quote_requests
  add column if not exists last_contacted_at timestamptz;

alter table public.quote_requests
  add column if not exists lead_source text not null default 'website';

alter table public.quote_requests
  add column if not exists automation_paused boolean not null default false;

alter table public.quote_requests
  drop constraint if exists quote_requests_pipeline_stage_check;

alter table public.quote_requests
  add constraint quote_requests_pipeline_stage_check
  check (pipeline_stage in ('enquiry', 'quote', 'approval', 'completion'));

create index if not exists quote_requests_pipeline_stage_idx on public.quote_requests (pipeline_stage);
create index if not exists quote_requests_next_follow_up_idx on public.quote_requests (next_follow_up_at);
create index if not exists quote_requests_customer_profile_idx on public.quote_requests (customer_profile_id);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests (id) on delete cascade,
  kind text not null,
  body text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint crm_activities_kind_check check (kind in ('note', 'stage_change', 'email', 'sms', 'system'))
);

create index if not exists crm_activities_quote_idx on public.crm_activities (quote_request_id, created_at desc);

create table if not exists public.crm_notification_log (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests (id) on delete cascade,
  channel text not null,
  template_key text not null,
  status text not null,
  error text,
  created_at timestamptz not null default now(),
  constraint crm_notification_log_channel_check check (channel in ('email', 'sms')),
  constraint crm_notification_log_status_check check (status in ('queued', 'sent', 'failed', 'skipped'))
);

create index if not exists crm_notification_log_quote_idx on public.crm_notification_log (quote_request_id, created_at desc);

alter table public.crm_activities enable row level security;
alter table public.crm_notification_log enable row level security;
